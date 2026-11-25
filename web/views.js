// Dashboard and member-list renderers. Pure DOM from data, no network: app.js wires the actions,
// design-preview.html feeds fixtures. Handlers arrive in `h`.
import { el, icon } from './dom.js';
import { lastPaid, standing, memberAmount, memberExpiryLabel } from './logic.js';
import { renderDataTable, renderTableToolbar } from './table.js';

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
    (m) => item(m.name, [m.expiry_date ? `Ended ${memberExpiryLabel(m).replace(/^Ended /, '')}` : 'Never paid', m.time && `in at ${m.time}`].filter(Boolean).join(' · '), true, waBtn(wa(m, null))),
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

const detailItem = (label, value) =>
  el('div', { className: 'dt-detail-item' },
    el('span', { className: 'dt-detail-label', textContent: label }),
    typeof value === 'string'
      ? el('span', { className: 'dt-detail-value', textContent: value })
      : el('div', { className: 'dt-detail-value' }, value));

export function renderMembersTable(container, members, ctx, h) {
  renderDataTable(container, {
    rows: members,
    rowLabel: (m) => m.name,
    sort: ctx.sort,
    onSortChange: ctx.onSortChange,
    emptyText: 'No members match the current filter',
    columns: [
      {
        key: 'name',
        label: 'Member',
        role: 'identity',
        sortable: true,
        render: (m) => {
          const checked = ctx.checkedInSet.has(m.id);
          return el('span', {},
            el('span', { className: 'dt-identity-name', textContent: m.name }),
            el('span', { className: 'dt-identity-sub', textContent: `+${m.phone}${checked ? ' · In today' : ''}` }));
        },
      },
      {
        key: 'plan',
        label: 'Plan',
        role: 'detail',
        desktopOnly: true,
        render: (m) => el('span', { className: 'dt-expiry', textContent: m.plans?.name ?? 'No plan' }),
      },
      {
        key: 'status',
        label: 'Status',
        role: 'state',
        sortable: true,
        desktopOnly: true,
        render: (m) => el('span', { className: `pill s-${m.status}`, textContent: m.status }),
      },
      {
        key: 'expiry',
        label: 'Expiry',
        role: 'detail',
        sortable: true,
        desktopOnly: true,
        render: (m) => el('span', { className: 'dt-expiry', textContent: memberExpiryLabel(m) }),
      },
      {
        key: 'amount',
        label: 'Amount',
        role: 'value',
        align: 'end',
        sortable: true,
        render: (m) => {
          const { amount, isOwed, label, pending } = memberAmount(m);
          const subText = pending?.trx_id ? `${label} · ${pending.method} ${pending.trx_id}` : label;
          return el('span', {},
            el('span', { className: `dt-amount${isOwed ? ' is-owed' : ''}`, textContent: amount != null ? ctx.cur(amount) : '—' }),
            el('span', { className: `dt-amount-sub${isOwed ? ' is-owed' : ''}`, textContent: subText }));
        },
      },
    ],
    mobileSummary: (m) => el('span', { className: 'dt-mobile-meta-inner' },
      el('span', { className: `dt-inline-state s-${m.status}`, textContent: m.status }),
      el('span', { 'aria-hidden': 'true', textContent: '·' }),
      el('span', { className: 'dt-inline-detail', textContent: memberExpiryLabel(m) })),
    rowActions: (m) => {
      const { pending } = memberAmount(m);
      const paid = lastPaid(m.payments);
      const checkedIn = ctx.checkedInSet.has(m.id);

      const primary = pending
        ? {
            label: pending.trx_id ? `Verify ${ctx.cur(pending.amount)}` : `Mark paid ${ctx.cur(pending.amount)}`,
            onClick: (b) => h.onVerify(b, m, pending),
          }
        : m.plans
          ? { label: 'Renew (cash)', onClick: (b) => h.onRenew(b, m) }
          : null;

      const menu = [];
      if (!checkedIn) menu.push({ label: 'Check in', onClick: (b) => h.onCheckin(b, m) });
      if (m.status === 'due' || m.status === 'expired') menu.push({ label: 'Send WhatsApp', href: ctx.wa(m), wa: true });
      if (paid?.receipt_no) menu.push({ label: 'View receipt', href: `receipt.html?id=${paid.id}` });
      menu.push({ label: 'Profile & plans', onClick: () => h.onDetails(m) });
      return { primary, menu };
    },
    expandedContent: (m) => {
      const { amount, isOwed, label, pending } = memberAmount(m);
      const paid = lastPaid(m.payments);
      const checkedIn = ctx.checkedInSet.has(m.id);
      const standingText = pending
        ? `${label} ${ctx.cur(pending.amount)} (${pending.method}${pending.trx_id ? ` · TrxID ${pending.trx_id}` : ''})`
        : `${standing(m)}${amount != null ? ` · ${ctx.cur(amount)}` : ''}`;

      const actions = [];
      if (pending) {
        const b = el('button', { type: 'button', className: 'primary', textContent: pending.trx_id ? `Verify ${ctx.cur(pending.amount)}` : `Mark paid ${ctx.cur(pending.amount)}` });
        b.onclick = () => h.onVerify(b, m, pending);
        actions.push(b);
      } else if (m.plans) {
        const b = el('button', { type: 'button', textContent: 'Renew (cash)' });
        b.onclick = () => h.onRenew(b, m);
        actions.push(b);
      }
      if (!checkedIn) {
        const b = el('button', { type: 'button', textContent: 'Check in' });
        b.onclick = () => h.onCheckin(b, m);
        actions.push(b);
      }
      if (m.status === 'due' || m.status === 'expired') actions.push(waBtn(ctx.wa(m)));
      if (paid?.receipt_no) actions.push(el('a', { className: 'btn', href: `receipt.html?id=${paid.id}`, target: '_blank', rel: 'noopener', textContent: 'Receipt' }));
      const profileBtn = el('button', { type: 'button', className: 'quiet', textContent: 'Profile & plans' });
      profileBtn.onclick = () => h.onDetails(m);
      actions.push(profileBtn);

      return el('div', { className: 'dt-expand-panel' },
        el('div', { className: 'dt-detail-grid' },
          detailItem('Phone', `+${m.phone}`),
          detailItem('Plan', m.plans ? `${m.plans.name} (${ctx.cur(m.plans.price)})` : 'No plan'),
          detailItem('Status', el('span', { className: `pill s-${m.status}`, textContent: m.status })),
          detailItem('Expiry', memberExpiryLabel(m)),
          detailItem('Payment', el('span', { className: isOwed ? 'sub owed' : '', textContent: standingText })),
          detailItem('Today', checkedIn ? 'Checked in' : 'Not checked in')),
        el('div', { className: 'dt-detail-actions' }, actions));
    },
  });
}

export { renderTableToolbar, icon };
