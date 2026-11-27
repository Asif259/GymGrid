import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptLines } from './receipt.js';
import { digestText, digestHtml } from './digest.js';
import { memberRow, paymentRow, a2cell, MEMBER_HEADERS } from './sheets.js';
import { selectReminders, reminderEmail } from './reminders.js';

const m = { id: 1, name: 'Ann', phone: '880', email: 'a@x.com', plans: { name: 'Gold' }, status: 'active', expiry_date: '2026-11-27' };
const p = { receipt_no: 'R1', amount: 1500, method: 'bkash', trx_id: 'T9', paid_on: '2026-11-25', period_start: 'a', period_end: 'b' };

test('receipt', () => {
  const l = receiptLines(p, m, { gym_name: 'G' });
  assert.equal(l[0], 'G payment receipt R1');
  assert.equal(l[3], 'Amount: ৳1,500 by bkash (TrxID T9)');
});
test('digest', () => {
  const s = { active: 5, attendance_yesterday: 3, expired: 1, pending_count: 2, pending_amount: 900, expiring: [m] };
  assert.match(digestText(s, {}), /Pending payments: 2 \(৳900\)/);
  assert.match(digestText(s, {}), /wa\.me\/\?text=Gym%20daily/);
  assert.match(digestHtml({ ...s, expiring: [{ name: '<b>', expiry_date: 'x' }] }, {}), /&lt;b&gt;/);
});
test('sheets', () => {
  assert.equal(memberRow(m).length, MEMBER_HEADERS.length);
  assert.equal(paymentRow(p, m)[2], 'Ann');
  assert.equal(a2cell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(a2cell(-5), '-5');
});
test('reminders', () => {
  const ms = [m, { ...m, id: 2, status: 'frozen' }, { ...m, id: 3, email: null }, { ...m, id: 4 }, { ...m, id: 5, expiry_date: '2026-11-28' }];
  assert.deepEqual(selectReminders(ms, '2026-11-25', [4]).map((x) => x.id), [1]);
  assert.match(reminderEmail(m, { app_url: 'https://a.b' }).text, /https:\/\/a\.b\/member#pay/);
  assert.match(reminderEmail(m, { app_url: 'https://a.b/', slug: 'iron-pulse', gym_name: 'Iron Pulse' }).text, /https:\/\/a\.b\/member\?gym=iron-pulse#pay/);
});

import { reminderEmail as _re } from './reminders.js';
import test2 from 'node:test';
import assert2 from 'node:assert/strict';
test2('reminderEmail escapes member-controlled text in html', () => {
  const e = _re({ email: 'a@b.test', name: '<img src=x onerror=1>', expiry_date: '2026-11-27' }, { app_url: 'https://x.example', gym_name: 'G' });
  assert2.ok(!e.html.includes('<img'));
  assert2.ok(e.html.includes('&lt;img'));
});

test('isSingleEmail accepts one address only', async () => {
  const { isSingleEmail } = await import('./reminders.js');
  assert.equal(isSingleEmail('a@x.com'), true);
  assert.equal(isSingleEmail('a@x.com, b@y.com'), false);
  assert.equal(isSingleEmail('A <a@x.com>'), false);
});
