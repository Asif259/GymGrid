// DOM helpers with no network: shared by the apps and the offline design preview.

export const $ = (id) => document.getElementById(id);

// Build DOM without innerHTML so member-entered text can never run as HTML.
export function el(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
  return n;
}

const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
<symbol id="i-today" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5"/></symbol>
<symbol id="i-members" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2"/><circle cx="17.2" cy="9" r="2.4"/><path d="M16.4 14.6c2.9 0 4.6 1.7 4.6 4.4"/></symbol>
<symbol id="i-add" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></symbol>
<symbol id="i-plans" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h4.5"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
</svg>`;

// One inline sprite per page, parsed (not innerHTML) so icons are real SVG, drawn in one stroke weight.
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
