// Usage: node scripts/report-md.mjs <daily_report.json>
// Input: the JSON returned by `select public.daily_report()`. Writes reports/<date>.md and prints its path.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { reportMarkdown } from '../web/logic.js';
import { GYM_NAME } from '../web/config.js';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/report-md.mjs <daily_report.json>'); process.exit(1); }

let report = JSON.parse(readFileSync(file, 'utf8'));
// Accept the raw MCP/SQL row shape too: [{ "daily_report": {...} }] or { "daily_report": {...} }.
if (Array.isArray(report)) report = report[0];
if (report.daily_report) report = report.daily_report;
for (const k of ['date', 'summary', 'expiring', 'expired_recent', 'pending']) {
  if (!(k in report)) { console.error(`not a daily_report: missing "${k}"`); process.exit(1); }
}

const out = new URL(`../reports/${report.date}.md`, import.meta.url);
mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
writeFileSync(out, reportMarkdown(report, GYM_NAME));
console.log(out.pathname);
