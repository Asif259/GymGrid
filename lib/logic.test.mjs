import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendancePulse, computeMemberKpis, estimateWorkoutDurationMin, fmtDateTimeDhaka, formatMemberCode } from './logic.ts';

test('attendancePulse defaults to 7 days and supports configurable window (14 days)', () => {
  const defaultSeries = attendancePulse([{ day: '2026-11-25' }], '2026-11-25');
  assert.equal(defaultSeries.length, 7);
  assert.equal(defaultSeries[0].day, '2026-11-19');

  const twoWeekSeries = attendancePulse(
    [{ day: '2026-11-12' }, { day: '2026-11-25' }],
    '2026-11-25',
    14,
  );
  assert.equal(twoWeekSeries.length, 14);
  assert.equal(twoWeekSeries[0].day, '2026-11-12');
  assert.equal(twoWeekSeries[0].count, 1);
  assert.equal(twoWeekSeries[13].day, '2026-11-25');
  assert.equal(twoWeekSeries[13].isToday, true);
});

test('computeMemberKpis handles unassigned plan, null expiry, and empty visits/streak', () => {
  const kpis = computeMemberKpis(
    {
      status: 'due',
      expiry_date: null,
      plans: null,
      payments: [],
    },
    [],
    null,
    '2026-11-25',
    '৳',
  );
  assert.equal(kpis.standingLabel, 'Never paid');
  assert.equal(kpis.planCaption, 'No plan assigned');
  assert.equal(kpis.daysDelta, 'Unpaid');
  assert.equal(kpis.daysTone, 'rose');
  assert.equal(kpis.expiryLabel, 'Not active');
  assert.equal(kpis.billingDelta, 'No plan');
  assert.equal(kpis.billingTone, 'neutral');
  assert.equal(kpis.visitsMonth, 0);
  assert.equal(kpis.todayVisitTime, null);
  assert.equal(kpis.weekVisits, 0);
  assert.equal(kpis.currentStreak, 0);
  assert.equal(kpis.bestStreak, 0);
});

test('computeMemberKpis handles active member, today visit, and pending payment', () => {
  const kpis = computeMemberKpis(
    {
      status: 'active',
      expiry_date: '2026-12-10',
      plans: { name: 'Monthly', months: 1, price: 1500 },
      payments: [
        {
          id: 1,
          amount: 1500,
          status: 'paid',
          method: 'bkash',
          trx_id: 'OLD123',
          receipt_no: 'R-2026-000001',
          paid_on: '2026-11-10',
          period_end: '2026-12-10',
          created_at: '2026-11-10T06:00:00Z',
        },
        {
          id: 2,
          amount: 1500,
          status: 'pending',
          method: 'nagad',
          trx_id: 'NEW999',
          receipt_no: null,
          paid_on: null,
          period_end: null,
          created_at: '2026-11-25T05:00:00Z',
        },
      ],
    },
    [
      { day: '2026-11-25', checked_in_at: '2026-11-25T03:30:00Z' },
      { day: '2026-11-23', checked_in_at: '2026-11-23T04:00:00Z' },
      { day: '2026-11-10', checked_in_at: '2026-11-10T04:00:00Z' },
    ],
    { current: 2, best: 6, visits_month: 8 },
    '2026-11-25',
    '৳',
  );

  assert.equal(kpis.standingLabel, 'Paid up');
  assert.equal(kpis.planCaption, 'Monthly · ৳1,500');
  assert.equal(kpis.daysDelta, '15d left');
  assert.equal(kpis.daysTone, 'lime');
  assert.equal(kpis.expiryLabel, '10\u00A0Dec');
  assert.match(kpis.billingCaption, /৳1,500/);
  assert.equal(kpis.billingDelta, 'Pending');
  assert.equal(kpis.billingTone, 'rose');
  assert.equal(kpis.visitsMonth, 8);
  assert.equal(kpis.todayVisitTime, '09:30');
  assert.equal(kpis.weekVisits, 2);
  assert.equal(kpis.currentStreak, 2);
  assert.equal(kpis.bestStreak, 6);
});

test('computeMemberKpis handles paid-up active member without pending payment, plus due/expired/frozen deltas', () => {
  const paidActive = computeMemberKpis(
    {
      status: 'active',
      expiry_date: '2026-11-25',
      plans: { name: 'Monthly', months: 1, price: 1500 },
      payments: [
        {
          id: 1,
          amount: 1500,
          status: 'paid',
          method: 'bkash',
          trx_id: 'TRX1',
          receipt_no: 'R-2026-000001',
          paid_on: '2026-10-26',
          period_end: '2026-11-25',
          created_at: '2026-10-26T06:00:00Z',
        },
      ],
    },
    [],
    { current: 0, best: 3, visits_month: 4 },
    '2026-11-25',
    '৳',
  );
  assert.equal(paidActive.daysDelta, 'Ends today');
  assert.equal(paidActive.daysTone, 'lime');
  assert.equal(paidActive.billingDelta, '৳1,500');
  assert.equal(paidActive.billingTone, 'lime');
  assert.match(paidActive.billingCaption, /26\u00A0Oct/);

  const expired = computeMemberKpis(
    {
      status: 'expired',
      expiry_date: '2026-11-20',
      plans: { name: 'Monthly', months: 1, price: 1500 },
      payments: [],
    },
    [],
    null,
    '2026-11-25',
    '৳',
  );
  assert.equal(expired.standingLabel, 'Renewal due');
  assert.equal(expired.daysDelta, '5d ago');
  assert.equal(expired.daysTone, 'rose');
  assert.equal(expired.billingTone, 'rose');

  const frozen = computeMemberKpis(
    {
      status: 'frozen',
      expiry_date: null,
      plans: null,
      payments: [],
    },
    [],
    null,
    '2026-11-25',
    '৳',
  );
  assert.equal(frozen.standingLabel, 'Frozen');
  assert.equal(frozen.daysDelta, 'Paused');
  assert.equal(frozen.daysTone, 'neutral');
});

test('fmtDateTimeDhaka formats timestamps in Dhaka timezone', () => {
  assert.equal(fmtDateTimeDhaka(null), '');
  assert.equal(fmtDateTimeDhaka('not-a-date'), '');
  assert.equal(
    fmtDateTimeDhaka('2026-11-26T09:35:00Z', new Date('2026-11-26T00:00:00Z')),
    '26\u00A0Nov, 15:35',
  );
  assert.equal(
    fmtDateTimeDhaka('2025-11-26T09:35:00Z', new Date('2026-11-26T00:00:00Z')),
    '26\u00A0Nov\u00A02025, 15:35',
  );
});

test('formatMemberCode builds customizable member IDs', () => {
  assert.equal(formatMemberCode('MM-', 102, 3, ''), 'MM-102');
  assert.equal(formatMemberCode('MS-', 221, 3, ''), 'MS-221');
  assert.equal(formatMemberCode('MM-', 1, 3, ''), 'MM-001');
  assert.equal(formatMemberCode('FIT-', 7, 4, '-26'), 'FIT-0007-26');
  assert.equal(formatMemberCode('', 42, 0, ''), '42');
});

test('estimateWorkoutDurationMin computes duration from sets, 40s work, rest, and 5m warmup', () => {
  assert.equal(estimateWorkoutDurationMin({ exercises: [] }), 0);
  // 12 sets x (40 + 90) = 1560s = 26 min + 5 min = 31 min
  assert.equal(
    estimateWorkoutDurationMin({
      exercises: [
        { name: 'Bench', sets: 4, rest_sec: 90 },
        { name: 'Row', sets: 4, rest_sec: 90 },
        { name: 'Squat', sets: 4, rest_sec: 90 },
      ],
    }),
    31,
  );
});
