import { sb, $, el, flash, act, loadSettings, session, sendLoginLink, planView } from './common.js';
import { ensureSprite, icon } from './dom.js';
import {
  normalizePhone, renewalLink, money, fmtDate, parseWorkout, parseDiet, workoutLines, dietLines,
} from './logic.js';
import { renderPlates, unpaidCard, confirmCard, remindCard, memberRow } from './views.js';

const VIEWS = [['today', 'Today', 'today'], ['members', 'Members', 'members'], ['add', 'Add', 'add'], ['plans', 'Plans', 'plans'], ['settings', 'Settings', 'settings']];
let state = { user: null, role: null, members: [], plans: [], staff: [], templates: [], settings: {}, date: null,
  checkedIn: new Set(), filter: 'all', search: '', report: null };
const cur = (n) => money(n, state.settings.currency);
const wa = (m, plan) => renewalLink(plan === undefined ? m : { ...m, plans: plan ? { name: plan } : undefined }, state.settings.name, state.date, state.settings.app_url);
const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' });

function show(section) {
  for (const id of ['login', 'not-staff', 'app']) $(id).hidden = id !== section;
  $('rail').hidden = section !== 'app';
  $('shell').classList.toggle('has-rail', section === 'app');
  $('logout').hidden = section === 'login';
}

function buildRail() {
  const items = VIEWS.filter(([k]) => k !== 'settings' || state.role === 'owner');
  $('rail').replaceChildren($('brand'), $('date'), ...items.map(([k, label, ic]) =>
    el('a', { href: `#${k}`, id: `nav-${k}` }, icon(ic), el('span', { textContent: label }))));
}

function route() {
  let name = location.hash.slice(1);
  if (!VIEWS.some(([k]) => k === name) || (name === 'settings' && state.role !== 'owner')) name = 'today';
  for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== name;
  for (const a of $('rail').querySelectorAll('a')) a.removeAttribute('aria-current');
  $(`nav-${name}`)?.setAttribute('aria-current', 'page');
  $('t-view').textContent = VIEWS.find(([k]) => k === name)?.[1] ?? '';
}
window.addEventListener('hashchange', route);

async function boot() {
  ensureSprite();
  state.user = await session();
  $('who').textContent = state.user?.email ?? '';
  if (!state.user) return show('login');

  const { data: staff, error } = await sb.from('staff').select('role').eq('user_id', state.user.id).maybeSingle();
  if (error) return flash(error.message);
  if (!staff) { $('my-id').textContent = state.user.id; return show('not-staff'); }

  state.role = staff.role;
  $('who').textContent = `${state.user.email} · ${staff.role}`;
  buildRail();
  show('app');
  route();
  await load();
}

async function load() {
  const [settings, plans, members, report, staff, templates] = await Promise.all([
    loadSettings(),
    sb.from('plans').select('*').order('months'),
    sb.from('members').select('*, plans(name, months, price), payments(id, amount, status, method, trx_id, receipt_no, paid_on, period_end, created_at)').order('name'),
    sb.rpc('daily_report'),
    sb.from('staff').select('user_id, role, display_name'),
    sb.from('plan_templates').select('id, kind, name, plan').order('name'),
  ]);
  const err = plans.error || members.error || report.error || staff.error || templates.error;
  if (err) return flash(err.message);
  Object.assign(state, { settings, plans: plans.data, members: members.data, staff: staff.data, templates: templates.data, report: report.data, date: report.data.date });
  const att = await sb.from('attendance').select('member_id').eq('day', state.date);
  state.checkedIn = new Set((att.data ?? []).map((a) => a.member_id));

  $('t-gym').textContent = settings.name;
  $('brand').textContent = settings.name;
  $('date').textContent = new Date(`${state.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  $('hdate').textContent = $('date').textContent;
  renderToday();
  renderPlanSelect();
  renderFilters();
  renderMembers();
  renderTemplates();
  if (state.role === 'owner') renderSettings();
}

const handlers = {
  onVerify(button, m, p) {
    if (p.trx_id && !confirm(`Check your ${p.method} app first: did ${cur(p.amount)} arrive with TrxID ${p.trx_id}?`)) return;
    act(button, () => sb.from('payments').update({ status: 'paid', recorded_by: state.user.id }).eq('id', p.id), `${m.name}: payment confirmed`, load);
  },
  onRenew(button, m) {
    if (!confirm(`Record a paid ${m.plans.name} renewal (${cur(m.plans.price)}, cash) for ${m.name}?`)) return;
    act(button, () => sb.from('payments').insert({ member_id: m.id, amount: m.plans.price, method: 'cash', status: 'paid', recorded_by: state.user.id }), `${m.name}: renewed`, load);
  },
  onCheckin(button, m) {
    act(button, () => sb.from('attendance').insert({ member_id: m.id, method: 'staff', recorded_by: state.user.id }), `${m.name} checked in`, load);
  },
  onDetails: (m) => openMember(m),
};

function renderToday() {
  const r = state.report;
  renderPlates($('plates'), r.summary, cur);
  const unpaid = (r.unpaid_checkins ?? []).map((m) => ({ ...m, time: hhmm(m.checked_in_at) }));
  const toConfirm = state.members.flatMap((m) => m.payments.filter((p) => p.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at)).map((p) => ({ member: m, payment: p })));
  $('col-action').replaceChildren(unpaidCard(unpaid, wa), confirmCard(toConfirm, cur, handlers));
  $('col-remind').replaceChildren(
    remindCard('Ends in 2 days', r.expiring, (m) => `${m.plan ?? 'No plan'} · ends ${fmtDate(m.expiry_date)}`, wa),
    remindCard('Expired in last 30 days', r.expired_recent, (m) => `Ended ${fmtDate(m.expiry_date)}`, wa));
  renderQuickCheckin();
}

function renderQuickCheckin() {
  const q = $('q-checkin').value.trim().toLowerCase();
  const rows = !q ? [] : state.members.filter((m) => !state.checkedIn.has(m.id) && (m.name.toLowerCase().includes(q) || m.phone.includes(q))).slice(0, 5);
  $('q-results').replaceChildren(...(q && !rows.length
    ? [el('li', { className: 'empty', textContent: 'No match, or already checked in today.' })]
    : rows.map((m) => {
        const b = el('button', { className: 'primary', textContent: 'Check in' });
        b.onclick = () => act(b, () => sb.from('attendance').insert({ member_id: m.id, method: 'staff', recorded_by: state.user.id }), `${m.name} checked in`, async () => { $('q-checkin').value = ''; await load(); });
        return el('li', { className: 'item' },
          el('span', {}, el('span', { className: 'who-name', textContent: m.name }), el('span', { className: `sub${m.status === 'expired' || m.status === 'due' ? ' owed' : ''}`, textContent: `${m.status} · ${m.expiry_date ? `until ${fmtDate(m.expiry_date)}` : 'never paid'}` })), b);
      })));
}
$('q-checkin').oninput = renderQuickCheckin;

function renderPlanSelect() {
  $('plan-select').replaceChildren(...state.plans.map((p) =>
    el('option', { value: p.id, textContent: `${p.name} · ${p.months} mo · ${cur(p.price)}` })));
}

function renderFilters() {
  const counts = { all: state.members.length };
  for (const m of state.members) counts[m.status] = (counts[m.status] ?? 0) + 1;
  $('filters').replaceChildren(...['all', 'active', 'due', 'expired', 'frozen'].map((f) => {
    const b = el('button', { type: 'button', textContent: `${f} (${counts[f] ?? 0})` });
    b.setAttribute('aria-pressed', String(state.filter === f));
    b.onclick = () => { state.filter = f; renderFilters(); renderMembers(); };
    return b;
  }));
}

function renderMembers() {
  const q = state.search.toLowerCase();
  const rows = state.members
    .filter((m) => state.filter === 'all' || m.status === state.filter)
    .filter((m) => !q || m.name.toLowerCase().includes(q) || m.phone.includes(q))
    .map((m) => memberRow(m, { cur, wa, checkedIn: state.checkedIn.has(m.id) }, handlers));
  $('member-rows').replaceChildren(...(rows.length ? rows : [el('p', { className: 'empty', textContent: 'No members match.' })]));
}

function renderTemplates() {
  $('template-count').textContent = `· ${state.templates.length}`;
  $('template-list').replaceChildren(...(state.templates.length
    ? state.templates.map((t) => el('li', { className: 'item' }, el('span', {}, el('span', { className: 'who-name', textContent: t.name }), el('span', { className: 'sub', textContent: t.kind })), el('span', { className: 'pill s-active', textContent: t.kind })))
    : [el('li', { className: 'empty', textContent: 'No templates yet. Save one above, then assign it from a member\'s details.' })]));
}

const staffName = (s) => s.display_name || `${s.role} ${s.user_id.slice(0, 4)}`;

async function openMember(m) {
  $('md-title').textContent = m.name;
  const [w, d] = await Promise.all([
    sb.from('workout_plans').select('plan, created_at').eq('member_id', m.id).eq('verified', true).order('created_at', { ascending: false }).limit(1),
    sb.from('diet_plans').select('plan, created_at').eq('member_id', m.id).eq('verified', true).order('created_at', { ascending: false }).limit(1),
  ]);

  const email = el('input', { type: 'email', value: m.email ?? '', placeholder: 'member@example.com' });
  const saveEmail = el('button', { textContent: 'Save email' });
  saveEmail.onclick = () => act(saveEmail, () => sb.from('members').update({ email: email.value.trim().toLowerCase() || null }).eq('id', m.id),
    'Email saved. The member can now sign in to the members app with it.', load);

  const trainer = el('select', {}, el('option', { value: '', textContent: 'No trainer' }),
    state.staff.map((s) => el('option', { value: s.user_id, textContent: staffName(s), selected: s.user_id === m.trainer_id })));
  const saveTrainer = el('button', { textContent: 'Assign trainer' });
  saveTrainer.onclick = () => act(saveTrainer, () => sb.from('members').update({ trainer_id: trainer.value || null }).eq('id', m.id), 'Trainer assigned', load);

  $('md-body').replaceChildren(
    el('p', { className: 'muted', textContent: [m.goal, m.age && `${m.age}y`, m.sex, m.height_cm && `${m.height_cm}cm`, m.weight_kg && `${m.weight_kg}kg`,
      m.injuries && `injuries: ${m.injuries}`, m.diet_pref && `diet: ${m.diet_pref}`].filter(Boolean).join(' · ') || 'No profile details.' }),
    el('label', {}, 'Email for the members app', el('div', { className: 'row' }, email, saveEmail)),
    el('label', { style: 'margin-top:8px' }, 'Trainer', el('div', { className: 'row' }, trainer, saveTrainer)),
    planSection(m, 'workout', w.data?.[0]?.plan, workoutLines, parseWorkout),
    planSection(m, 'diet', d.data?.[0]?.plan, dietLines, parseDiet),
  );
  $('member-dialog').showModal();
}

function planSection(m, kind, current, toLines, parse) {
  const table = kind === 'workout' ? 'workout_plans' : 'diet_plans';
  const templates = state.templates.filter((t) => t.kind === kind);
  const pick = el('select', {}, el('option', { value: '', textContent: templates.length ? `Pick a ${kind} template` : 'No templates yet' }),
    templates.map((t) => el('option', { value: t.id, textContent: t.name })));
  const text = el('textarea', { placeholder: kind === 'workout' ? 'Mon - Legs: Squat 3x10, Lunges 3x12' : 'Breakfast: Oats 60g, 2 eggs' });
  const assign = el('button', { className: 'primary', textContent: `Assign ${kind} plan` });
  assign.onclick = () => {
    let plan;
    try { plan = text.value.trim() ? parse(text.value) : templates.find((t) => t.id === pick.value)?.plan; }
    catch (e) { return flash(e.message); }
    if (!plan) return flash(`Pick a template or write a ${kind} plan.`);
    // Staff-written plans are human-checked, so members see them straight away.
    act(assign, () => sb.from(table).insert({ member_id: m.id, plan, verified: true }), `${kind} plan assigned to ${m.name}`, () => openMember(m));
  };
  return el('div', { className: 'card', style: 'margin-top:12px' },
    el('h3', { textContent: `${kind[0].toUpperCase()}${kind.slice(1)} plan` }),
    current ? planView(toLines(current)) : el('p', { className: 'empty', textContent: 'None assigned.' }),
    el('div', { className: 'row' }, pick), el('p', { className: 'muted', textContent: 'Or write one for this member:' }), text,
    el('div', { className: 'row', style: 'margin-top:8px' }, assign));
}

function renderSettings() {
  const f = $('settings-form');
  for (const k of ['name', 'bkash_number', 'nagad_number', 'app_url']) f.elements[k].value = state.settings[k] ?? '';
  $('staff-list').replaceChildren(...state.staff.map((s) => {
    const input = el('input', { value: s.display_name ?? '', placeholder: 'Name shown to members', 'aria-label': `Name for ${s.role}` });
    const save = el('button', { textContent: 'Save' });
    save.onclick = () => act(save, () => sb.from('staff').update({ display_name: input.value.trim() || null }).eq('user_id', s.user_id), 'Name saved', load);
    return el('div', { className: 'row', style: 'margin-bottom:8px' }, el('span', { className: 'pill s-active', textContent: s.role }), input, save);
  }));
}

$('settings-form').onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const v = (k) => f.get(k)?.trim() || null;
  const digits = (k) => v(k)?.replace(/\D/g, '') || null;
  act(e.target.querySelector('button.primary'), () => sb.from('gym_settings').update({
    name: v('name'), bkash_number: digits('bkash_number'), nagad_number: digits('nagad_number'), app_url: v('app_url')?.replace(/\/$/, '') ?? null,
  }).eq('id', true), 'Settings saved', load);
};

$('rotate-qr').onclick = (e) => {
  if (!confirm('Make a new check-in QR? The printed one stops working; print the new one.')) return;
  act(e.target, () => sb.rpc('rotate_checkin_token'), 'New QR made. Open the check-in QR page and print it.');
};

$('template-form').onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const kind = f.get('kind');
  let plan;
  try { plan = (kind === 'workout' ? parseWorkout : parseDiet)(f.get('text')); } catch (err) { return flash(err.message); }
  act(e.target.querySelector('button.primary'), () => sb.from('plan_templates').insert({ kind, name: f.get('name').trim(), plan, created_by: state.user.id }),
    'Template saved', async () => { e.target.reset(); await load(); });
};

$('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const { error } = await sendLoginLink($('login-email').value);
  error ? flash(error.message) : flash('Check your email for the sign-in link.', true);
};

$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
$('search').oninput = (e) => { state.search = e.target.value.trim(); renderMembers(); };
$('md-close').onclick = () => $('member-dialog').close();

$('join-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const phone = normalizePhone(f.get('phone'));
  if (!phone) return flash('Phone must be 8-15 digits with country code, e.g. 8801XXXXXXXXX.');

  const num = (k) => (f.get(k) ? Number(f.get(k)) : null);
  const txt = (k) => f.get(k)?.trim() || null;
  const member = {
    name: f.get('name').trim(), phone, email: txt('email')?.toLowerCase() ?? null, plan_id: Number(f.get('plan_id')),
    goal: txt('goal'), age: num('age'), sex: txt('sex'), height_cm: num('height_cm'), weight_kg: num('weight_kg'),
    injuries: txt('injuries'), diet_pref: txt('diet_pref'),
  };
  const plan = state.plans.find((p) => p.id === member.plan_id);
  if (!plan) return flash('Pick a plan.');
  const btn = e.target.querySelector('button.primary');
  btn.disabled = true;

  const { data: created, error } = await sb.from('members').insert(member).select('id').single();
  if (error) { btn.disabled = false; return flash(error.code === '23505' ? 'A member with this phone or email already exists.' : error.message); }

  const { error: payErr } = await sb.from('payments').insert({
    member_id: created.id, amount: plan.price, method: f.get('method'), trx_id: txt('trx_id'),
    status: f.get('paid_now') ? 'paid' : 'pending', recorded_by: state.user.id,
  });
  btn.disabled = false;
  if (payErr) flash(`Member added, but payment failed: ${payErr.message}`);
  else { flash(`${member.name} added`, true); e.target.reset(); location.hash = '#members'; }
  await load();
};

sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') boot(); });
boot();
