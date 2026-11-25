export type MemberTab = 'home' | 'plans' | 'pay' | 'visits' | 'receipts';

export const VALID_MEMBER_TABS: readonly MemberTab[] = [
  'home',
  'plans',
  'pay',
  'visits',
  'receipts',
] as const;

/**
 * Parse a query/hash tab identifier into a canonical `MemberTab`, mapping `"overview"` to `"home"`.
 */
export function parseMemberTab(raw: string | null | undefined): MemberTab | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'overview' || normalized === 'home') return 'home';
  if ((VALID_MEMBER_TABS as readonly string[]).includes(normalized)) {
    return normalized as MemberTab;
  }
  return null;
}

/**
 * Serialize a `MemberTab` for the `?tab=` URL search parameter (`"home"` -> `"overview"`).
 */
export function memberTabParam(tab: MemberTab): string {
  return tab === 'home' ? 'overview' : tab;
}

/**
 * Resolve initial member tab and check-in token from `window.location.hash` and `search`,
 * giving `#checkin=` and `#<tab>` (including `#pay`) priority over `?tab=`.
 */
export function resolveInitialTabAndHash(
  hash: string,
  search: string,
): { tab: MemberTab | null; checkinToken: string | null } {
  if (hash.startsWith('#checkin=')) {
    const rawToken = hash.slice('#checkin='.length);
    let checkinToken: string | null = null;
    try {
      checkinToken = decodeURIComponent(rawToken) || null;
    } catch {
      checkinToken = rawToken || null;
    }
    return { tab: 'home', checkinToken };
  }

  const hashTab = hash.startsWith('#') ? parseMemberTab(hash.slice(1)) : null;
  if (hashTab) {
    return { tab: hashTab, checkinToken: null };
  }

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    tab: parseMemberTab(params.get('tab')),
    checkinToken: null,
  };
}

/**
 * Build a member portal URL preserving existing query params while updating `?tab=`.
 */
export function buildMemberUrl(pathname: string, search: string, tab: MemberTab): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.set('tab', memberTabParam(tab));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Resolve the active mobile wallet method and availability flags from gym payment numbers.
 */
export function resolvePaymentMethod(
  bkash: string | null | undefined,
  nagad: string | null | undefined,
  current: 'bkash' | 'nagad',
): { method: 'bkash' | 'nagad'; hasBkash: boolean; hasNagad: boolean; hasAny: boolean } {
  const hasBkash = Boolean(bkash && bkash.trim());
  const hasNagad = Boolean(nagad && nagad.trim());
  const hasAny = hasBkash || hasNagad;

  let method: 'bkash' | 'nagad' = current;
  if (current === 'nagad' && !hasNagad && hasBkash) {
    method = 'bkash';
  } else if (current === 'bkash' && !hasBkash && hasNagad) {
    method = 'nagad';
  }

  return { method, hasBkash, hasNagad, hasAny };
}

/**
 * Map mobile bottom navigation item count to a static Tailwind grid columns class.
 */
export function mobileNavGridCols(count: number): string {
  return count === 4 ? 'grid-cols-4' : 'grid-cols-5';
}
