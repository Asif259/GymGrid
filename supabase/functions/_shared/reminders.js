const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export function selectReminders(members, today, alreadySentIds = []) {
  const target = addDays(today, 2);
  const sent = new Set(alreadySentIds);
  return members.filter((m) => m.expiry_date === target && m.status !== 'frozen' && m.email && !sent.has(m.id));
}

export function reminderEmail(m, settings = {}) {
  const base = (settings.app_url ?? '').replace(/\/$/, '');
  const slugQuery = settings.slug ? `?gym=${encodeURIComponent(settings.slug)}` : '';
  const link = `${base}/member${slugQuery}#pay`;
  const gym = settings.gym_name ?? settings.name ?? 'Gym';
  return {
    to: m.email,
    subject: `${gym}: your membership expires on ${m.expiry_date}`,
    text: `Hi ${m.name}, your membership expires on ${m.expiry_date}. Renew here: ${link}`,
    html: `<p>Hi ${esc(m.name)}, your membership expires on ${esc(m.expiry_date)}.</p><p><a href="${esc(link)}">Renew now</a></p>`,
  };
}
