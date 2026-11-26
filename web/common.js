// Shared by the admin page, members app, receipt and desk-QR pages.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY, GYM_NAME } from './config.js';

import { $, el, ensureFooter } from './dom.js';
export { $, el, ensureFooter };

ensureFooter(GYM_NAME);

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // YYYY-MM-DD, gym time

export function flash(text, ok = false) {
  const f = $('flash');
  f.textContent = text;
  f.className = `msg ${ok ? 'ok' : 'err'}`;
  f.hidden = false;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => (f.hidden = true), 7000);
}

// Runs a Supabase call from a button: disables it, shows the error or okText, then calls after().
export async function act(button, fn, okText, after) {
  if (button) button.disabled = true;
  const { error } = await fn();
  if (button) button.disabled = false;
  if (error) return flash(error.message);
  if (okText) flash(okText, true);
  if (after) await after();
}

export async function loadSettings() {
  const { data } = await sb.from('gym_settings').select('name, currency, bkash_number, nagad_number, app_url').maybeSingle();
  return { name: GYM_NAME, currency: '৳', ...(data ?? {}) };
}

export async function session() {
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export function sendLoginLink(email) {
  return sb.auth.signInWithOtp({
    email: email.trim(),
    // No hash: the sign-in redirect puts its own tokens there. Pages keep their intent in localStorage instead.
    options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
  });
}

// A plan (workout/diet) as headed lists.
export function planView(lines) {
  return el('div', { className: 'plan' }, lines.map((l) => [el('h4', { textContent: l.title }), el('ul', {}, l.items.map((i) => el('li', { textContent: i })))]));
}
