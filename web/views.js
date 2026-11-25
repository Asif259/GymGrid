// Dashboard and member-list renderers. Pure DOM from data, no network: app.js wires the actions,
// design-preview.html feeds fixtures. Handlers arrive in `h`.
import { el, icon } from './dom.js';
import { pendingPayment, lastPaid, fmtDate, standing } from './logic.js';

const metric = (cls, label, value, meta) =>
  el('div', { className: `metric${cls ? ` ${cls}` : ''}` },
    el('span', { className: 'metric-label', textContent: label }),
    el('span', { className: 'metric-value', textContent: value }),
    el('span', { className: 'metric-meta', textContent: meta }));

export function renderPlates(box, s, cur) {
  const attendanceToday = s.attendance_today ?? 0;
  const activePct = s.active ? `${Math.round((attendanceToday / s.active) * 100)}% of active` : 'No active members';
  box.replaceChildren(
    metric('hero', 'Revenue today', cur(s.revenue_today), `${cur(s.revenue_month)} collected this month`),
    metric('', 'Checked in today', attendanceToday, activePct),
    metric('', 'Active members', s.active, `${s.due ?? 0} due within 2 days`),
    metric(s.pending_payments > 0 ? 'owed' : '', 'Pending payments', s.pending_payments, s.pending_payments > 0 ? `${cur(s.pending_amount)} to verify` : 'All verified'),
    metric(s.expired > 0 ? 'owed' : '', 'Expired', s.expired, s.expired > 0 ? 'Needs renewal' : 'None lapsed'),
  );
}

export function renderPulse(box, series = []) {
  const max = Math.max(1, ...series.map((d) => d.count));
  const total = series.reduce((sum, d) => sum + d.count, 0);
  const avg = series.length ? Math.round(total / series.length) : 0;
  const todayCount = series.at(-1)?.count ?? 0;
  const diff = todayCount - avg;
  const diffText = diff === 0 ? 'On 7-day average' : `${diff > 0 ? '+' : ''}${diff} vs 7-day avg (${avg})`;

  box.replaceChildren(
    el('div', { className: 'pulse-summary' },
      el('div', {},
        el('h2', { textContent: '7-day check-in pulse' }),
        el('p', { className: 'muted', textContent: `${total} total visits over the last 7 days` })),
      el('div', { className: 'pulse-kpi' },
        el('strong', { textContent: String(todayCount) }),
        el('span', { className: 'muted mono', textContent: diffText }))),
    el('div', {},
      el('div', { className: 'pulse-chart', role: 'img', 'aria-label': `7-day check-in counts: ${series.map((d) => `${d.label} ${d.count}`).join(', ')}` },
        series.map((d) => {
          const pct = Math.max(4, Math.round((d.count / max) * 100));
          const bar = el('div', { className: 'pulse-bar' });
          bar.style.height = `${pct}%`;
          return el('div', { className: `pulse-col${d.isToday ? ' is-today' : ''}` },
            el('span', { className: 'pulse-val', textContent: String(d.count) }),
            bar);
        })),
      el('div', { className: 'pulse-days' },
        series.map((d) => el('span', { className: `pulse-day${d.isToday ? ' is-today' : ''}`, textContent: d.isToday ? 'Today' : d.label })))));
}

const waBtn = (href) => el('a', { className: 'btn wa', href, target: '_blank', rel: 'noopener', textContent: 'WhatsApp' });

function card(title, count, rows, build, { alert = false, empty }) {
  const filled = rows.length > 0;
  return el('section', { className: `card${alert && filled ? ' alert' : ''}` },
    el('div', { className: 'card-head' },
      el('h2', {}, title, ' ', el('span', { className: 'card-count', textContent: String(count ?? rows.length) }))),
    filled ? el('ul', { className: 'list' }, rows.map(build)) : el('p', { className: 'empty', textContent: empty }));
}

const item = (name, sub, owed, ...actions) => el('li', { className: 'item' },
  el('div', { className: 'item-info' },
    el('span', { className: 'who-name', textContent: name }),
    el('span', { className: `sub${owed ? ' owed' : ''}`, textContent: sub })),
  el('div', { className: 'go' }, actions));

export function unpaidCard(rows, wa) {
  return card('Came in without paying', rows.length, rows,
    (m) => item(m.name, [m.expiry_date ? `Ended ${fmtDate(m.expiry_date)}` : 'Never paid', m.time && `in at ${m.time}`].filter(Boolean).join(' · '), true, waBtn(wa(m, null))),
    { alert: true, empty: 'No unpaid check-ins today' });
}

// rows: [{ member, payment }] with a pending payment each.
export function confirmCard(rows, cur, h) {
  return card('Payments to confirm', rows.length, rows, ({ member: m, payment: p }) => {
    const online = Boolean(p.trx_id);
    const b = el('button', { className: 'primary', textContent: online ? `Verify ${cur(p.amount)}` : `Mark paid ${cur(p.amount)}` });
    b.onclick = () => h.onVerify(b, m, p);
    return item(m.name, online ? `${p.method} · TrxID ${p.trx_id}` : 'Cash at the desk', false, b);
  }, { empty: 'Nothing waiting to confirm' });
}

export function remindCard(title, rows, note, wa) {
  return card(title, rows.length, rows, (m) => item(m.name, note(m), false, waBtn(wa(m, m.plan))),
    { empty: 'No reminders due' });
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

  const d = el('button', { className: 'quiet', textContent: 'Details' });
  d.onclick = () => h.onDetails(m);
  go.append(d);

  // On narrow containers secondary actions collapse behind an explicit disclosure label; wide containers show all.
  const row = el('div', { className: `mrow${m.status === 'active' && !pending ? ' settled' : ''}` });
  const extraCount = extra.children.length;
  if (extraCount) {
    const closedLabel = `Show ${extraCount} more`;
    const openLabel = 'Hide extra actions';
    const more = el('button', { className: 'more-btn quiet', type: 'button', textContent: closedLabel, ariaExpanded: 'false' });
    more.onclick = () => {
      const open = row.classList.toggle('open');
      more.textContent = open ? openLabel : closedLabel;
      more.setAttribute('aria-expanded', String(open));
    };
    go.append(more);
    go.append(extra);
  }

  const owes = pending ? `Owes ${c.cur(pending.amount)}` : standing(m);
  const alarm = pending || m.status === 'expired' || (m.status === 'due' && !m.expiry_date);
  row.append(
    el('div', { className: 'mrow-identity' },
      el('span', { className: 'who-name', textContent: m.name }),
      el('span', { className: 'sub', textContent: `${c.checkedIn ? 'In today · ' : ''}+${m.phone} · ${m.plans?.name ?? 'No plan'}` })),
    el('div', { className: 'mrow-status' },
      el('span', { className: `pill s-${m.status}`, textContent: m.status }),
      el('span', { className: 'sub', textContent: m.expiry_date ? `Until ${fmtDate(m.expiry_date)}` : 'Never paid' })),
    el('div', { className: `mrow-standing sub${alarm ? ' owed' : ''}` },
      owes,
      pending?.trx_id && el('span', { className: 'sub mono', textContent: `${pending.method} · ${pending.trx_id}` })),
    go);
  return row;
}

export { icon };
