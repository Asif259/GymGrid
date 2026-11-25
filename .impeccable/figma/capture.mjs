// Captures review screenshots at true viewport widths via CDP device-metrics emulation (not --window-size).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../review/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', '--user-data-dir=/tmp/gym-capture-profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); if (targets.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result.value;

async function shot(name, url, width, height, { seekMs = null, full = true } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width < 600 });
  await send('Page.navigate', { url });
  await sleep(2500);
  if (url.includes('#')) { await evalJs('location.reload()'); await sleep(2500); }
  if (seekMs != null) await evalJs(`document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${seekMs}; }); 1`);
  const sw = await evalJs('document.documentElement.scrollWidth');
  const h = await evalJs('document.documentElement.scrollHeight');
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, clip: full ? { x: 0, y: 0, width, height: Math.min(h, 2400), scale: 1 } : undefined });
  writeFileSync(`${OUT}${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log(name.padEnd(22), `viewport ${width}`, `scrollWidth ${sw}`, sw > width ? 'OVERFLOW' : 'ok', `height ${h}`);
}

const B = 'http://localhost:3000';
await shot('mobile', `${B}/design-preview`, 390, 844);
await shot('mobile-members', `${B}/design-preview#members`, 390, 844);
await shot('desktop', `${B}/design-preview`, 1280, 900, { full: false });
await shot('desktop-members', `${B}/design-preview#members`, 1280, 900);
await shot('welcome-mobile', `${B}/welcome`, 390, 844, { seekMs: 6600 });
await shot('welcome-desktop', `${B}/welcome`, 1280, 800, { seekMs: 6600, full: false });
await shot('member-login-mobile', `${B}/member`, 390, 844, { full: false });
await shot('admin-login-desktop', `${B}/`, 1280, 800, { full: false });
ws.close(); chrome.kill();
