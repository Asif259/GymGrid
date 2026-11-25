import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone, renewalLink, pendingPayment, lastPaid, reportMarkdown, money, receiptText,
  parseWorkout, parseDiet, workoutLines, dietLines, daysLeft,
} from './logic.js';

test('normalizePhone', () => {
  assert.equal(normalizePhone('+880 1712-345678'), '8801712345678');
  assert.equal(normalizePhone('008801712345678'), '8801712345678');
  assert.equal(normalizePhone('01712345678'), null); // no country code -> leading 0 rejected
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone(''), null);
});

test('money', () => {
  assert.equal(money(1500), '৳1,500');
  assert.equal(money('3000.00', '৳'), '৳3,000');
  assert.equal(money(null), '৳0');
});

test('renewalLink encodes message', () => {
  const url = renewalLink({ name: 'A & B', phone: '15550000002', expiry_date: '2026-11-26', plans: { name: 'Monthly' } }, 'Gym', '2026-11-24');
  assert.ok(url.startsWith('https://wa.me/15550000002?text='));
  assert.equal(decodeURIComponent(url.split('text=')[1]), 'Hi A & B, your Monthly membership ends on 2026-11-26. Reply to renew. - Gym');
  assert.match(renewalLink({ name: 'X', phone: '1555', expiry_date: null }, 'G'), /is%20not%20active%20yet/);
  assert.match(renewalLink({ name: 'X', phone: '1555', expiry_date: '2026-11-19' }, 'G', '2026-11-24'), /ended%20on%202026-11-19/);
  assert.match(renewalLink({ name: 'X', phone: '1555', expiry_date: '2026-11-24' }, 'G', '2026-11-24'), /ends%20on%202026-11-24/);
  const withApp = decodeURIComponent(renewalLink({ name: 'X', phone: '1555', expiry_date: '2026-11-26' }, 'G', '2026-11-24', 'https://gym.example/'));
  assert.match(withApp, /Renew here: https:\/\/gym\.example\/member\.html#pay - G$/);
});

test('receiptText', () => {
  const t = receiptText(
    { receipt_no: 'R-2026-000005', amount: '1500.00', method: 'bkash', trx_id: 'TST9X8Y7Z6', paid_on: '2026-11-24', period_start: '2026-11-24', period_end: '2026-12-23' },
    { name: 'Demo Echo', phone: '15550000005', plans: { name: 'Monthly' } }, 'Gym');
  assert.match(t, /^Gym payment receipt R-2026-000005\n/);
  assert.match(t, /Amount: ৳1,500 by bkash \(TrxID TST9X8Y7Z6\)/);
  assert.match(t, /Valid: 2026-11-24 to 2026-12-23$/);
});

test('parseWorkout', () => {
  const p = parseWorkout('Mon - Legs: Squat 3x10, Leg press 3 x 12, Plank 3x45s\n\nWed: Push-ups, Bench 4x8');
  assert.deepEqual(p.days[0], { day: 'Mon', focus: 'Legs', exercises: [
    { name: 'Squat', sets: 3, reps: '10' }, { name: 'Leg press', sets: 3, reps: '12' }, { name: 'Plank', sets: 3, reps: '45s' }] });
  assert.deepEqual(p.days[1].exercises, [{ name: 'Push-ups' }, { name: 'Bench', sets: 4, reps: '8' }]);
  assert.equal(p.days[1].focus, '');
  assert.throws(() => parseWorkout('  \n '), /at least one day/);
  assert.throws(() => parseWorkout('Mon:'), /No exercises/);
  assert.deepEqual(workoutLines(p)[0], { title: 'Mon - Legs', items: ['Squat 3x10', 'Leg press 3x12', 'Plank 3x45s'] });
});

test('parseDiet', () => {
  const p = parseDiet('Breakfast: Oats 60g, 2 eggs\nLunch: Rice, Dal, Fish');
  assert.deepEqual(p.meals[0], { name: 'Breakfast', items: [{ food: 'Oats 60g' }, { food: '2 eggs' }] });
  assert.throws(() => parseDiet('just food'), /meal name/);
  assert.deepEqual(dietLines({ meals: [{ name: 'L', items: [{ food: 'Rice', qty: '200g', kcal: 260 }] }] })[0].items, ['Rice 200g (260 kcal)']);
});

test('daysLeft', () => {
  assert.equal(daysLeft('2026-11-26', '2026-11-24'), 2);
  assert.equal(daysLeft('2026-11-19', '2026-11-24'), -5);
  assert.equal(daysLeft(null), null);
});

test('reportMarkdown', () => {
  const md = reportMarkdown({
    date: '2026-11-24',
    summary: { active: 2, due: 2, expired: 1, frozen: 0, pending_payments: 2, pending_amount: 3000, attendance_today: 4, revenue_today: 1500, revenue_month: 7000 },
    expiring: [{ name: 'Demo Bravo', phone: '15550000002', plan: 'Monthly', expiry_date: '2026-11-26' }],
    expired_recent: [],
    pending: [{ name: 'Demo Echo', phone: '15550000005', amount: 1500, method: 'bkash', trx_id: 'ABC123XYZ', days_waiting: 3 }],
    unpaid_checkins: [{ name: 'Demo Echo', phone: '15550000005', expiry_date: null }],
  }, 'Gym');
  assert.match(md, /^# Gym daily report: 2026-11-24/);
  assert.match(md, /\| 2 \| 2 \| 1 \| 4 \| ৳1,500 \| ৳7,000 \| 2 \(৳3,000\) \|/);
  assert.match(md, /Checked in today without paying \(1\)\n- Demo Echo \(\+15550000005\), never paid: \[WhatsApp\]/);
  assert.match(md, /Expiring in 2 days: send renewal reminder \(1\)\n- Demo Bravo \(\+15550000002\), Monthly, ends 2026-11-26: \[WhatsApp\]\(https:\/\/wa\.me\/15550000002\?text=Hi%20Demo%20Bravo%2C%20your%20Monthly%20membership%20ends%20on%202026-11-26/);
  assert.match(md, /Expired in last 30 days \(0\)\n_None._/);
  assert.match(md, /- Demo Echo \(\+15550000005\): ৳1,500 bkash TrxID ABC123XYZ, waiting 3 day\(s\)/);
  // Old report JSON without the new fields still renders.
  assert.doesNotThrow(() => reportMarkdown({ date: 'd', summary: { active: 0, due: 0, expired: 0, pending_payments: 0, pending_amount: 0 }, expiring: [], expired_recent: [], pending: [] }, 'G'));
});

test('pendingPayment picks oldest pending, lastPaid newest paid', () => {
  const ps = [
    { id: 3, status: 'paid', paid_on: '2026-01-01', created_at: '2026-01-01' },
    { id: 4, status: 'paid', paid_on: '2026-02-01', created_at: '2026-02-01' },
    { id: 2, status: 'pending', created_at: '2026-03-01' },
    { id: 1, status: 'pending', created_at: '2026-02-01' },
  ];
  assert.equal(pendingPayment(ps).id, 1);
  assert.equal(lastPaid(ps).id, 4);
  assert.equal(pendingPayment([]), null);
  assert.equal(pendingPayment(undefined), null);
  assert.equal(lastPaid([]), null);
});

import { fmtDate, standing, attendancePulse, memberAmount, memberExpiryLabel, sortMembers } from './logic.js';
test('fmtDate and standing', () => {
  assert.equal(fmtDate('2026-11-27', new Date('2026-11-25')), '27 Nov');
  assert.equal(fmtDate('2027-02-23', new Date('2026-11-25')), '23 Feb 2027');
  assert.equal(fmtDate(null), '');
  assert.equal(standing({ status: 'active' }), 'Paid up');
  assert.equal(standing({ status: 'expired', expiry_date: '2026-11-19' }), 'Renewal due');
  assert.equal(standing({ status: 'due', expiry_date: null }), 'Never paid');
  assert.equal(standing({ status: 'due', expiry_date: '2026-11-27' }), 'Ends soon');
  assert.equal(standing({ status: 'frozen' }), 'Frozen');
});

test('attendancePulse builds 7-day series ending on today', () => {
  const series = attendancePulse([
    { day: '2026-11-25' },
    { day: '2026-11-25' },
    { day: '2026-11-23' },
    { day: '2026-11-10' },
  ], '2026-11-25');
  assert.equal(series.length, 7);
  assert.equal(series[0].day, '2026-11-19');
  assert.equal(series[4].count, 1);
  assert.equal(series[6].day, '2026-11-25');
  assert.equal(series[6].count, 2);
  assert.equal(series[6].isToday, true);
});

test('memberAmount, memberExpiryLabel, and sortMembers', () => {
  const rows = [
    { id: '1', name: 'Zara', status: 'active', expiry_date: '2026-12-20', plans: { price: 1500 }, payments: [] },
    { id: '2', name: 'Arif', status: 'expired', expiry_date: '2026-11-10', plans: { price: 4000 }, payments: [] },
    { id: '3', name: 'Bina', status: 'due', expiry_date: null, plans: { price: 1500 }, payments: [{ id: 9, amount: 2500, status: 'pending', created_at: '2026-11-25' }] },
  ];
  assert.deepEqual(memberAmount(rows[2]).amount, 2500);
  assert.equal(memberAmount(rows[2]).isOwed, true);
  assert.equal(memberExpiryLabel(rows[2]), 'Never paid');
  assert.match(memberExpiryLabel(rows[1]), /^Ended /);
  assert.match(memberExpiryLabel(rows[0]), /^Until /);
  assert.deepEqual(sortMembers(rows, 'name', 'asc').map((r) => r.id), ['2', '3', '1']);
  assert.deepEqual(sortMembers(rows, 'amount', 'desc').map((r) => r.id), ['2', '3', '1']);
  assert.deepEqual(sortMembers(rows, 'status', 'asc').map((r) => r.id), ['2', '3', '1']);
  assert.deepEqual(sortMembers(rows, 'expiry', 'asc').map((r) => r.id), ['3', '2', '1']);
});
