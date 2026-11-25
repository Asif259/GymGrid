import { sb, $, el, flash, act, loadSettings, session, sendLoginLink, planView, today } from './common.js';
import { money, workoutLines, dietLines, daysLeft, pendingPayment } from './logic.js';

const TABS = [['home', 'Home'], ['pay', 'Pay'], ['plans', 'My plans'], ['receipts', 'Payments'], ['visits', 'Visits']];
let state = { user: null, member: null, settings: {} };

// Remember a desk-QR scan across the email sign-in round trip (the redirect replaces the URL hash).
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('checkin')) store.set('pendingCheckin', hash.get('checkin'));
if (location.hash === '#pay') store.set('openTab', 'pay');
if (hash.get('checkin') || location.hash === '#pay') history.replaceState(null, '', location.pathname);

function show(section) {
  for (const id of ['login', 'no-member', 'app']) $(id).hidden = id !== section;
  $('logout').hidden = section === 'login';
}

function openTab(name) {
  for (const s of document.querySelectorAll('section[data-tab]')) s.hidden = s.dataset.tab !== name;
  for (const b of $('tabs').children) b.setAttribute('aria-pressed', String(b.dataset.tab === name));
}

async function boot() {
  state.settings = await loadSettings();
  $('title').textContent = state.settings.name;
  state.user = await session();
  $('who').textContent = state.user?.email ?? '';
  if (!state.user) {
    if (store.get('pendingCheckin')) flash('Sign in once to check in. Next time, scanning checks you in straight away.', true);
    return show('login');
  }

  if (boot.running) return;
  boot.running = true;
  try { await signedIn(); } finally { boot.running = false; }
}

async function signedIn() {
  const { data: memberId, error } = await sb.rpc('claim_member');
  if (error) return flash(error.message);
  if (!memberId) { $('nm-email').textContent = state.user.email; return show('no-member'); }

  show('app');
  $('tabs').replaceChildren(...TABS.map(([k, label]) => {
    const b = el('button', { type: 'button', textContent: label });
    b.dataset.tab = k;
    b.onclick = () => openTab(k);
    return b;
  }));

  const token = store.get('pendingCheckin');
  if (token) { store.set('pendingCheckin', null); await checkIn(token); }
  await load(memberId);
  openTab(store.get('openTab') ?? 'home');
  store.set('openTab', null);
}

async function checkIn(token) {
  const { data, error } = await sb.rpc('check_in', { token });
  const box = $('checkin-result');
  box.hidden = false;
  if (error) {
    box.replaceChildren(el('div', { className: 'result bad card' }, el('p', { className: 'big', textContent: 'Check-in failed' }), el('p', { textContent: error.message })));
    return;
  }
  const paid = data.status === 'active' || (data.status === 'due' && data.expiry_date && data.expiry_date >= today());
  box.replaceChildren(el('div', { className: `result card ${paid ? 'ok' : 'bad'}` },
    el('p', { className: 'big', textContent: data.already ? 'Already checked in today' : `Welcome, ${data.name}!` }),
    el('p', { textContent: paid
      ? `Membership valid until ${data.expiry_date}.`
      : data.expiry_date ? `Your membership ended on ${data.expiry_date}. Please renew at the desk or in Pay.` : 'Your membership is not paid yet. Please pay at the desk or in Pay.' })));
  if (!paid) store.set('openTab', 'pay');
}

async function load(memberId) {
  const [m, w, d, att] = await Promise.all([
    sb.from('members').select('*, plans(name, months, price), payments(id, amount, status, method, trx_id, receipt_no, paid_on, period_end, created_at)').eq('id', memberId).single(),
    // Explicit member/verified filters: RLS already limits members, but staff testing their own membership see more.
    sb.from('workout_plans').select('plan').eq('member_id', memberId).eq('verified', true).order('created_at', { ascending: false }).limit(1),
    sb.from('diet_plans').select('plan').eq('member_id', memberId).eq('verified', true).order('created_at', { ascending: false }).limit(1),
    sb.from('attendance').select('day, checked_in_at').eq('member_id', memberId).order('day', { ascending: false }).limit(60),
  ]);
  const err = m.error || w.error || d.error || att.error;
  if (err) return flash(err.message);
  state.member = m.data;
  let trainer = null;
  if (m.data.trainer_id) trainer = (await sb.from('staff').select('display_name').eq('user_id', m.data.trainer_id).maybeSingle()).data?.display_name;

  renderHome(m.data);
  renderPay(m.data);
  renderPlans(trainer, w.data[0]?.plan, d.data[0]?.plan);
  renderReceipts(m.data.payments);
  renderVisits(att.data);
}

const cur = (n) => money(n, state.settings.currency);

function renderHome(m) {
  const left = daysLeft(m.expiry_date, today());
  $('h-plan').textContent = `${m.plans?.name ?? 'No plan'}${m.plans ? ` · ${cur(m.plans.price)}` : ''}`;
  $('h-status').textContent = m.status;
  $('h-status').className = `pill s-${m.status}`;
  $('h-expiry').textContent = !m.expiry_date ? 'Not paid yet.'
    : left >= 0 ? `Valid until ${m.expiry_date} (${left} day${left === 1 ? '' : 's'} left).` : `Ended on ${m.expiry_date}.`;
  const p = pendingPayment(m.payments);
  $('h-pending').hidden = !p?.trx_id;
  if (p?.trx_id) $('h-pending').textContent = `Waiting for the gym to confirm your ${p.method} payment (TrxID ${p.trx_id}).`;
  $('h-pay').onclick = () => openTab('pay');
}

function renderPay(m) {
  const s = state.settings;
  $('p-amount').textContent = m.plans ? cur(m.plans.price) : '—';
  const nums = [['bkash', 'bKash', s.bkash_number], ['nagad', 'Nagad', s.nagad_number]].filter(([, , n]) => n);
  $('p-numbers').replaceChildren(...(nums.length ? nums.map(([, label, n]) => {
    const copy = el('button', { type: 'button', textContent: 'Copy' });
    copy.onclick = async () => { try { await navigator.clipboard.writeText(n); flash(`${label} number copied`, true); } catch { flash(`Copy failed — number is ${n}`); } };
    return el('div', { className: 'pay-number-row' },
      el('span', {}, el('div', { className: 'muted', textContent: `${label} (Send Money)` }), el('div', { className: 'copy', textContent: n })), copy);
  }) : [el('p', { className: 'muted', textContent: 'The gym has not set a bKash or Nagad number yet. Please pay at the desk.' })]));
  $('p-method').replaceChildren(...nums.map(([v, label]) => el('option', { value: v, textContent: label })));
  $('pay-form').hidden = !nums.length || !m.plans;
}

$('pay-form').onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const m = state.member;
  act(e.target.querySelector('button'), async () => {
    // Amount, dates and status are set by the database; the member only supplies method + TrxID.
    const r = await sb.from('payments').insert({ member_id: m.id, amount: m.plans.price, method: f.get('method'), trx_id: f.get('trx_id').trim() });
    if (r.error?.code === '23505') r.error.message = 'This TrxID was already sent. If it is yours, the gym will confirm it soon.';
    return r;
  }, 'Sent. The gym will confirm your payment and your receipt will appear under Payments.', async () => { e.target.reset(); await load(m.id); openTab('home'); });
};

function renderPlans(trainer, workout, diet) {
  $('pl-trainer').textContent = trainer ? `Your trainer: ${trainer}` : 'No trainer assigned yet.';
  $('pl-workout').replaceChildren(workout ? planView(workoutLines(workout)) : el('p', { className: 'muted', textContent: 'Your trainer has not assigned a workout yet.' }));
  $('pl-diet').replaceChildren(diet ? planView(dietLines(diet)) : el('p', { className: 'muted', textContent: 'No diet plan yet.' }));
}

function renderReceipts(payments) {
  const rows = [...payments].sort((a, b) => b.created_at.localeCompare(a.created_at));
  $('rc-list').replaceChildren(...(rows.length ? rows.map((p) => el('li', {},
    el('span', {}, el('div', { textContent: `${cur(p.amount)} · ${p.method ?? 'cash'}` }),
      el('div', { className: 'muted', textContent: p.status === 'paid' ? `Paid ${p.paid_on} · valid to ${p.period_end}` : `Waiting for confirmation${p.trx_id ? ` · TrxID ${p.trx_id}` : ''}` })),
    p.receipt_no ? el('a', { className: 'btn', href: `receipt.html?id=${p.id}`, textContent: 'Receipt' }) : el('span', { className: 'pill s-due', textContent: 'pending' })))
    : [el('li', { className: 'muted', textContent: 'No payments yet.' })]));
}

function renderVisits(rows) {
  const month = today().slice(0, 7);
  $('v-count').textContent = `${rows.filter((r) => r.day.startsWith(month)).length} visits this month.`;
  $('v-list').replaceChildren(...rows.slice(0, 30).map((r) => el('li', {},
    el('span', { textContent: r.day }),
    el('span', { className: 'muted', textContent: new Date(r.checked_in_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' }) }))));
}

$('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const { error } = await sendLoginLink($('login-email').value);
  error ? flash(error.message) : flash('Check your email and open the sign-in link on this phone.', true);
};
$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') boot(); });
boot();
