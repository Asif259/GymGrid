import { sb, $, el, flash, loadSettings, session, today } from './common.js';
import { deskState } from './logic.js';

const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' });
const recent = [];

async function memberOf(id) {
  const { data } = await sb.from('members').select('name, status, expiry_date').eq('id', id).maybeSingle();
  return data;
}

function render() {
  const last = recent[0];
  if (last) {
    $('card').className = `card card-stack result ${last.st.ok ? 'ok' : 'bad'}`;
    $('card').replaceChildren(el('p', { className: 'big', textContent: last.name }), el('p', { textContent: last.st.text }));
  }
  $('recent').replaceChildren(...recent.map((r) => el('li', {},
    el('span', { textContent: r.name }),
    el('span', { className: r.st.ok ? 'muted' : 'owed', textContent: `${hhmm(r.at)} · ${r.st.ok ? 'paid' : 'not paid'}` }))));
}

async function add(row) {
  const m = await memberOf(row.member_id);
  recent.unshift({ name: m?.name ?? 'Unknown member', st: deskState(m ?? {}, today()), at: row.checked_in_at ?? new Date().toISOString() });
  recent.length = Math.min(recent.length, 10);
  render();
}

async function boot() {
  const user = await session();
  if (user) {
    const { data } = await sb.from('staff').select('role').eq('user_id', user.id).maybeSingle();
    if (data) {
      $('who').textContent = user.email;
      $('title').textContent = (await loadSettings()).name;
      $('live').hidden = false;
      const { data: rows, error } = await sb.from('attendance').select('member_id, checked_in_at').order('checked_in_at', { ascending: false }).limit(10);
      if (error) flash(error.message);
      for (const r of (rows ?? []).reverse()) await add(r);
      // Realtime needs migration 18; without it the screen just stays on the initial list.
      sb.channel('desk').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, (p) => add(p.new)).subscribe();
      return;
    }
  }
  $('denied').hidden = false;
}
boot();
