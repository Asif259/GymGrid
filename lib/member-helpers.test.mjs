import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemberUrl,
  mobileNavGridCols,
  parseMemberTab,
  resolveInitialTabAndHash,
  resolvePaymentMethod,
} from './member-helpers.ts';

test('parseMemberTab and resolveInitialTabAndHash preserve #pay priority and #checkin', () => {
  assert.equal(parseMemberTab('overview'), 'home');
  assert.equal(parseMemberTab('plans'), 'plans');
  assert.equal(parseMemberTab('unknown'), null);

  assert.deepEqual(
    resolveInitialTabAndHash('#pay', '?gym=iron&tab=visits'),
    { tab: 'pay', checkinToken: null },
  );
  assert.deepEqual(
    resolveInitialTabAndHash('#checkin=tok%201', '?gym=iron&tab=pay'),
    { tab: 'home', checkinToken: 'tok 1' },
  );
  assert.deepEqual(
    resolveInitialTabAndHash('', '?gym=iron&tab=unknown'),
    { tab: null, checkinToken: null },
  );
  assert.equal(
    buildMemberUrl('/member', '?gym=iron&tab=visits', 'home'),
    '/member?gym=iron&tab=overview',
  );
});

test('resolvePaymentMethod handles missing or single mobile wallet numbers', () => {
  assert.deepEqual(resolvePaymentMethod(null, null, 'bkash'), {
    method: 'bkash',
    hasBkash: false,
    hasNagad: false,
    hasAny: false,
  });
  assert.deepEqual(resolvePaymentMethod('', '01812345678', 'bkash'), {
    method: 'nagad',
    hasBkash: false,
    hasNagad: true,
    hasAny: true,
  });
  assert.deepEqual(resolvePaymentMethod('01712345678', null, 'nagad'), {
    method: 'bkash',
    hasBkash: true,
    hasNagad: false,
    hasAny: true,
  });
});

test('mobileNavGridCols maps 4 and 5 items cleanly', () => {
  assert.equal(mobileNavGridCols(4), 'grid-cols-4');
  assert.equal(mobileNavGridCols(5), 'grid-cols-5');
});
