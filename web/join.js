import { sb, $, el, flash, loadSettings, session, sendLoginLink } from './common.js';
import { normalizePhone, money } from './logic.js';

// The sign-in redirect replaces the URL hash, so keep the signup token in localStorage across it.
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const fromHash = new URLSearchParams(location.hash.slice(1)).get('signup');
if (fromHash) { store.set('signupToken', fromHash); history.replaceState(null, '', location.pathname); }

const show = (id) => { for (const s of ['login', 'signup']) $(s).hidden = s !== id; $('logout').hidden = id === 'login'; };

async function boot() {
  const settings = await loadSettings();
  $('title').textContent = `Join ${settings.name}`;
  const user = await session();
  $('who').textContent = user?.email ?? '';
  if (!store.get('signupToken')) { show(null); return flash('This sign-up link is missing its code. Ask the gym for the link again.'); }
  if (!user) return show('login');
  const { data, error } = await sb.from('plans').select('id, name, months, price').order('months');
  if (error) return flash(error.message);
  $('plan-select').replaceChildren(...data.map((p) => el('option', { value: p.id, textContent: `${p.name} · ${p.months} mo · ${money(p.price, settings.currency)}` })));
  show('signup');
}

$('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const { error } = await sendLoginLink($('login-email').value);
  error ? flash(error.message) : flash('Check your email and open the sign-in link on this device.', true);
};

$('signup-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const phone = normalizePhone(f.get('phone'));
  if (!phone) return flash('Phone must be 8–15 digits with country code, e.g. 8801XXXXXXXXX');
  const txt = (k) => f.get(k)?.trim() || null;
  const num = (k) => (f.get(k) ? Number(f.get(k)) : null);
  const btn = e.target.querySelector('button.primary');
  btn.disabled = true;
  const { error } = await sb.rpc('self_register', {
    token: store.get('signupToken'), name: f.get('name').trim(), phone, plan_id: Number(f.get('plan_id')),
    goal: txt('goal'), age: num('age'), sex: txt('sex'), height_cm: num('height_cm'), weight_kg: num('weight_kg'),
    injuries: txt('injuries'), diet_pref: txt('diet_pref'),
  });
  btn.disabled = false;
  if (error) return flash(error.message);
  store.set('signupToken', null);
  location.href = 'member.html';
};

$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') boot(); });
boot();
