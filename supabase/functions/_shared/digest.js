const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (n, c) => `${c}${Number(n ?? 0).toLocaleString('en-US')}`;

function lines(s, settings) {
  const cur = settings.currency ?? '৳';
  const exp = s.expiring ?? [];
  return [
    `${settings.gym_name ?? 'Gym'} daily digest`,
    `Active members: ${s.active}`,
    `Attendance yesterday: ${s.attendance_yesterday}`,
    `Expired: ${s.expired}`,
    `Pending payments: ${s.pending_count} (${money(s.pending_amount, cur)})`,
    `Expiring soon: ${exp.length}`,
    ...exp.map((m) => `- ${m.name} (${m.expiry_date})`),
  ];
}

export function digestText(s, settings = {}) {
  const text = lines(s, settings).join('\n');
  const p = settings.owner_phone ? `${settings.owner_phone}` : '';
  return `${text}\n\nShare: https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function digestHtml(s, settings = {}) {
  const [title, ...rest] = lines(s, settings);
  const link = `https://wa.me/${settings.owner_phone ?? ''}?text=${encodeURIComponent(lines(s, settings).join('\n'))}`;
  return `<h2>${esc(title)}</h2>${rest.map((l) => `<p>${esc(l)}</p>`).join('')}<p><a href="${esc(link)}">Share on WhatsApp</a></p>`;
}
