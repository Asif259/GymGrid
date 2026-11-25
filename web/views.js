// Dashboard and member-list renderers. Pure DOM from data, no network: app.js wires the actions,
// design-preview.html feeds fixtures. Handlers arrive in `h`.
import { el, icon } from './dom.js';
import { money, pendingPayment, lastPaid, fmtDate, standing } from './logic.js';

// Always three rows (label, numeral, note) so every numeral sits on the same line across plates.
const plate = (cls, value, label, note) =>
  el('div', { className: `plate ${cls}` }, el('span', { textContent: label }), el('b', { textContent: value }), el('small', { textContent: note ?? '\u00A0' }));

export function renderPlates(box, s, cur) {
  box.replaceChildren(
    plate('green', s.active, 'Active members'),
    plate('', s.attendance_today ?? 0, 'In today'),
    plate('wide', cur(s.revenue_today), 'Revenue today', `${cur(s.revenue_month)} this month`),
    plate(s.pending_payments > 0 ? 'owed' : '', s.pending_payments, 'Pending payments', cur(s.pending_amount)),
    plate('', s.expired, 'Expired'));
}

const waBtn = (href) => el('a', { className: 'btn wa', href, target: '_blank', rel: 'noopener', textContent: 'WhatsApp' });

function card(title, count, rows, build, { alert = false, empty }) {
  const filled = rows.length > 0;
  return el('section', { className: `card${alert && filled ? ' alert' : ''}` },
    el('h2', {}, title, ' ', el('span', { className: 'n', textContent: `· ${count ?? rows.length}` })),
    filled ? el('ul', { className: 'list' }, rows.map(build)) : el('p', { className: 'empty', textContent: empty }));
}

const item = (name, sub, owed, ...actions) => el('li', { className: 'item' },
  el('span', {}, el('span', { className: 'who-name', textContent: name }), el('span', { className: `sub${owed ? ' owed' : ''}`, textContent: sub })),
  el('span', { className: 'go' }, actions));

export function unpaidCard(rows, wa) {
  return card('Came in without paying', rows.length, rows,
    (m) => item(m.name, [m.expiry_date ? `Ended ${fmtDate(m.expiry_date)}` : 'Never paid', m.time && `in at ${m.time}`].filter(Boolean).join(' · '), true, waBtn(wa(m, null))),
    { alert: true, empty: 'Nobody came in without paying today.' });
}

// rows: [{ member, payment }] with a pending payment each.
export function confirmCard(rows, cur, h) {
  return card('Payments to confirm', rows.length, rows, ({ member: m, payment: p }) => {
    const online = Boolean(p.trx_id);
    const b = el('button', { className: 'primary', textContent: online ? `Verify ${cur(p.amount)}` : `Mark paid ${cur(p.amount)}` });
    b.onclick = () => h.onVerify(b, m, p);
    return item(m.name, online ? `${p.method} · TrxID ${p.trx_id}` : 'Cash at the desk', false, b);
  }, { empty: 'Nothing waiting for you to confirm.' });
}

export function remindCard(title, rows, note, wa) {
  return card(title, rows.length, rows, (m) => item(m.name, note(m), false, waBtn(wa(m, m.plan))),
    { empty: 'Nobody today.' });
}

// One row of the members list.
export function memberRow(m, c, h) {
  const pending = pendingPayment(m.payments);
  const paid = lastPaid(m.payments);
  const go = el('div', { className: 'go' });
  const extra = el('div', { className: 'extra' });

  if (pending) {
    const online = Boolean(pending.trx_id);
    const b = el('button', { className: 'primary', textContent: online ? 'Verify & mark paid' : `Mark paid ${c.cur(pending.amount)}` });
    b.onclick = () => h.onVerify(b, m, pending);
    go.append(b);
  } else if (m.plans) {
    const b = el('button', { textContent: 'Renew (cash)' });
    b.onclick = () => h.onRenew(b, m);
    go.append(b);
  }
  if (!c.checkedIn) {
    const b = el('button', { textContent: 'Check in' });
    b.onclick = () => h.onCheckin(b, m);
    extra.append(b);
  }
  if (m.status === 'due' || m.status === 'expired') extra.append(waBtn(c.wa(m)));
  if (paid?.receipt_no) extra.append(el('a', { className: 'btn', href: `receipt.html?id=${paid.id}`, target: '_blank', textContent: 'Receipt' }));
  const d = el('button', { textContent: 'Details' });
  d.onclick = () => h.onDetails(m);
  go.append(d);
  // On a phone the secondary actions fold behind "More"; on a desk screen they all show.
  const row = el('div', { className: `mrow${m.status === 'active' && !pending ? ' settled' : ''}` });
  const more = el('button', { className: 'more-btn', type: 'button', textContent: 'More', ariaExpanded: 'false' });
  more.onclick = () => { const open = row.classList.toggle('open'); more.textContent = open ? 'Less' : 'More'; more.setAttribute('aria-expanded', String(open)); };
  if (extra.children.length) go.append(more);
  go.append(extra);

  const owes = pending ? `Owes ${c.cur(pending.amount)}` : standing(m);
  const alarm = pending || m.status === 'expired' || (m.status === 'due' && !m.expiry_date);
  row.append(
    el('div', {}, el('span', { className: 'who-name', textContent: m.name }),
      el('span', { className: 'sub', textContent: `${c.checkedIn ? 'In today · ' : ''}+${m.phone} · ${m.plans?.name ?? 'No plan'}` })),
    el('div', {}, el('span', { className: `pill s-${m.status}`, textContent: m.status }),
      el('span', { className: 'sub', textContent: m.expiry_date ? `until ${fmtDate(m.expiry_date)}` : 'never paid' })),
    el('div', { className: `sub${alarm ? ' owed' : ''}` }, owes, pending?.trx_id && el('span', { className: 'sub', style: 'white-space:nowrap', textContent: `${pending.method} ${pending.trx_id}` })),
    go);
  return row;
}

export { icon };
