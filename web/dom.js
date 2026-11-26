// DOM helpers with no network: shared by the apps and the offline design preview.

export const $ = (id) => document.getElementById(id);

// Build DOM without innerHTML so member-entered text can never run as HTML.
export function el(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
  return n;
}

const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
<symbol id="i-today" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></symbol>
<symbol id="i-members" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.5a5 5 0 0 1 5 5.5"/></symbol>
<symbol id="i-add" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></symbol>
<symbol id="i-plans" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5h6v3H9zM8.5 11.5h7M8.5 15.5h5"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.35-4.35"/></symbol>
</svg>`;

// One inline sprite per page, parsed (not innerHTML) so icons are real SVG at uniform 1.5 stroke.
export function ensureSprite() {
  if (document.getElementById('i-today')) return;
  const doc = new DOMParser().parseFromString(SPRITE, 'image/svg+xml');
  document.body.prepend(document.importNode(doc.documentElement, true));
}

export function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function ensureFooter(brandName = 'GymGrid') {
  if (typeof document === 'undefined' || document.querySelector('.site-footer')) return;
  const host = document.querySelector('main') || document.body;
  const year = String(new Date().getFullYear());
  const link = el('a', {
    href: 'https://ashrafulasif.vercel.app',
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: 'Ashraful Asif',
  });
  const footer = el(
    'footer',
    { className: 'site-footer no-print' },
    el('p', { className: 'site-footer-copy', textContent: `© ${year} ${brandName}` }),
    el('p', { className: 'site-footer-credit' }, 'Designed & built by ', link),
  );
  host.append(footer);
}
