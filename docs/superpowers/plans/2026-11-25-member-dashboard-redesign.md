# Unified Member & Owner Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Member App (`/member`) into a professional multi-view dashboard matching the Owner Dashboard, and unify both Owner (`AdminShell`) and Member (`MemberShell`) onto one shared responsive `DashboardShell` with a desktop floating sidebar (`>= 768px`) and fixed mobile bottom navbar (`< 768px`).

**Architecture:** Extract layout chrome from `AdminShell` into `components/DashboardShell.tsx`, switching mobile navigation for both apps to a `grid-cols-4`/`grid-cols-5` fixed bottom bar with safe-area padding while preserving desktop `SidebarProvider`. Split `/member` into modular client view components (`MemberOverview`, `MemberPlans`, `MemberPay`, `MemberVisits`, `MemberReceipts`, `MemberProfileSheet`) orchestrated by `MemberShell` and pure helper functions in `lib/member-helpers.ts`, preserving existing `?gym=`, `#pay`, and `#checkin=` links without database schema changes.

**Tech Stack:** Next.js 16.4.6 (App Router), React 19.3, TypeScript 6, Tailwind CSS v4, shadcn/ui (`components/ui/*`), Lucide React, Recharts, Zustand (`lib/stores/member-app-store.ts`), `next-themes`, `sonner`, Node native test runner (`node --test`).

**Spec:** [docs/superpowers/specs/2026-11-25-member-dashboard-redesign-design.md](file:///Users/ashrafulasif/Gym/docs/superpowers/specs/2026-11-25-member-dashboard-redesign-design.md)

## Global Constraints

- **No DB migrations or RLS changes:** Member profile fields stay read-only (`members_self_read`); TrxID payment submission stays locked to `member.plan_id` via `payments_guard()`; `plans` are readable via `plans_read`.
- **Keep `/join` and `/join/[gymSlug]` untouched by dashboard chrome:** Never mount `MemberShell` in `app/(member)/layout.tsx`; mount it inside `app/(member)/member/page.tsx` via `components/member/MemberShell.tsx`.
- **Theme & tokens:** Reuse existing semantic CSS variables in `app/globals.css` (`--primary`, `--card`, `--secondary`, `--status-*`, `--chart-*`); support both light and dark modes.
- **Timezone & currency:** Use `Asia/Dhaka` (`dhakaToday()`, `hhmmDhaka()`, `fmtDate()`) and `settings.currency` (default `"৳"`).
- **Mobile ergonomics & accessibility:** `44px+` mobile tap targets (`min-h-11` / `min-h-14` bottom bar), `text-base md:text-sm` inputs (`16px` mobile), `tabular-nums`, `aria-current="page"`, `env(safe-area-inset-bottom)` clearance on `<main>` and `Sonner` mobile toasts, and no horizontal overflow at `320px–375px`.
- **Deep-link preservation:** Keep `/member#checkin=<token>`, `/member#pay`, `/member?gym=<slug>#pay`, `/checkin`, `/receipt?id=...`, and `public/manifest.webmanifest` `start_url: "/member"` working seamlessly.

## Review Focus

- **Unassigned plan or never-paid member (`member.plans === null` or `member.expiry_date === null`):** KPI cards render `"No plan assigned"` / `"Not active"` without `NaN`, and `MemberPay` disables TrxID submission with front-desk guidance.
- **Missing bKash/Nagad numbers (`bkash_number` and/or `nagad_number` null):** `MemberPay` auto-selects whichever number is configured, or displays `"Ask front desk for payment number"` and prevents blind submission if both are missing.
- **Tab/hash/gym URL precedence (`/member?gym=iron&tab=visits#pay` or `?tab=invalid`):** `#pay` overrides stale `?tab=`, `?gym=<slug>` survives every tab change, and unknown `?tab=` falls back to `"home"`.
- **Non-owner staff nav grid count (`role !== "owner"`):** `AdminShell` filters out `Settings` leaving 4 items; bottom navbar must resolve to `grid-cols-4` rather than leaving a blank 5th slot on `grid-cols-5`.
- **Empty activity data (`visits = []`, `streak = null`, `payments = []`):** Overview KPIs, 7-day pulse chart, 14-day Visits chart, and Receipts view render clean zero/empty states without Recharts or formatting errors.

---

### Task 1: Pure Logic, Member Helpers, and Unit Tests

**Files:**
- Modify: `types/gym.ts:66-86`
- Modify: `lib/logic.ts:193-281`
- Create: `lib/member-helpers.ts`
- Create: `lib/logic.test.mjs`
- Create: `lib/member-helpers.test.mjs`
- Modify: `package.json:12`

**Interfaces:**
- Produces in `types/gym.ts`: `Member.join_date?: string | null`
- Produces in `lib/logic.ts`:
  - `attendancePulse(rows?: Array<{ day?: string | null }>, todayIso: string, days?: number): PulsePoint[]`
  - `export interface MemberKpis { standingLabel: string; planCaption: string; daysDelta: string; daysTone: "lime" | "neutral" | "rose"; expiryLabel: string; billingCaption: string; billingDelta: string; billingTone: "lime" | "neutral" | "rose"; visitsMonth: number; todayVisitTime: string | null; weekVisits: number; currentStreak: number; bestStreak: number }`
  - `export function computeMemberKpis(member: Pick<Member, "status" | "expiry_date" | "plans" | "payments">, visits: Array<{ day: string; checked_in_at: string }>, streak: AttendanceStreak | null, todayIso: string, currency?: string): MemberKpis`
- Produces in `lib/member-helpers.ts`:
  - `export type MemberTab = "home" | "plans" | "pay" | "visits" | "receipts";`
  - `export const VALID_MEMBER_TABS: readonly MemberTab[]`
  - `export function parseMemberTab(raw: string | null | undefined): MemberTab | null`
  - `export function memberTabParam(tab: MemberTab): string`
  - `export function resolveInitialTabAndHash(hash: string, search: string): { tab: MemberTab | null; checkinToken: string | null }`
  - `export function buildMemberUrl(pathname: string, search: string, tab: MemberTab): string`
  - `export function resolvePaymentMethod(bkash: string | null | undefined, nagad: string | null | undefined, current: "bkash" | "nagad"): { method: "bkash" | "nagad"; hasBkash: boolean; hasNagad: boolean; hasAny: boolean }`
  - `export function mobileNavGridCols(count: number): string`

- [ ] **Step 1: Write failing unit tests in `lib/logic.test.mjs` and `lib/member-helpers.test.mjs`**

Create `lib/logic.test.mjs` (covering `attendancePulse` 7/14-day windows and `computeMemberKpis` zero/null edge cases):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendancePulse, computeMemberKpis } from './logic.ts';

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
  assert.equal(kpis.expiryLabel, 'Not active');
  assert.equal(kpis.billingDelta, 'No plan');
  assert.equal(kpis.visitsMonth, 0);
  assert.equal(kpis.todayVisitTime, null);
  assert.equal(kpis.weekVisits, 0);
  assert.equal(kpis.currentStreak, 0);
  assert.equal(kpis.bestStreak, 0);
});
```

Create `lib/member-helpers.test.mjs` covering URL/tab precedence, wallet fallback, and nav grid cols:
```js
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
```

- [ ] **Step 2: Run new tests to verify they fail**

Run: `node --test lib/logic.test.mjs lib/member-helpers.test.mjs`
Expected: FAIL (`lib/member-helpers.ts` not found; `computeMemberKpis` not exported; `attendancePulse` ignores 3rd arg).

- [ ] **Step 3: Implement changes in `types/gym.ts`, `lib/logic.ts`, `lib/member-helpers.ts`, and `package.json`**

1. In `types/gym.ts`, add `join_date?: string | null;` to `Member`.
2. In `lib/logic.ts`:
   - Update `attendancePulse(rows: Array<{ day?: string | null }> = [], todayIso: string, days = 7): PulsePoint[]` to loop `for (let offset = -(Math.max(1, days) - 1); offset <= 0; offset++)`.
   - Export `MemberKpis` and `computeMemberKpis(...)` reusing `standing`, `daysLeft`, `fmtDate`, `money`, `pendingPayment`, `lastPaid`, `attendancePulse`, and `hhmmDhaka` (zero duplication). Exact delta mapping: `daysRemaining === null ? (member.status === "frozen" ? "Paused" : "Unpaid") : daysRemaining > 0 ? \`\${daysRemaining}d left\` : daysRemaining === 0 ? "Ends today" : \`\${Math.abs(daysRemaining)}d ago\``.
3. In `lib/member-helpers.ts` (zero runtime imports so both Next.js and Node 24 native TS test runner import it cleanly):
   - Export `MemberTab`, `VALID_MEMBER_TABS`, `parseMemberTab`, `memberTabParam`, `resolveInitialTabAndHash`, `buildMemberUrl`, `resolvePaymentMethod`, and `mobileNavGridCols` (`4 -> "grid-cols-4"`, default `"grid-cols-5"`).
4. In `package.json`, update `"test"` to `"node --test web/*.test.mjs && node --test supabase/functions/_shared/*.test.mjs && node --test lib/*.test.mjs"`.

- [ ] **Step 4: Run tests and typecheck to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS (all existing 18 tests + new `lib/` tests pass, `tsc --noEmit` exits 0).

- [ ] **Step 5: Commit**

```bash
git add types/gym.ts lib/logic.ts lib/member-helpers.ts lib/logic.test.mjs lib/member-helpers.test.mjs package.json
git commit -m "feat(member): add member dashboard helpers, pulse window, and unit tests"
```

---

### Task 2: Extend Member Store & Mobile Toast Clearance

**Files:**
- Modify: `lib/stores/member-app-store.ts:1-272`
- Modify: `components/ui/sonner.tsx:10-46`

**Interfaces:**
- Consumes: `MemberTab`, `VALID_MEMBER_TABS`, `parseMemberTab` from `@/lib/member-helpers`
- Produces in `lib/stores/member-app-store.ts`:
  - Re-exports `type MemberTab`, `VALID_MEMBER_TABS`, `parseMemberTab`
  - Adds to `MemberAppState`:
    - `gymPlans: Plan[]`
    - `lastSync: string`
    - `refreshing: boolean`
    - `refreshMemberData: () => Promise<void>`

- [ ] **Step 1: Update `lib/stores/member-app-store.ts`**

1. Import `Plan` from `@/types/gym` and `hhmmDhaka` from `@/lib/logic`, and `MemberTab`, `VALID_MEMBER_TABS`, `parseMemberTab` from `@/lib/member-helpers` (re-export `type MemberTab`, `VALID_MEMBER_TABS`, `parseMemberTab`).
2. Add `gymPlans: []`, `lastSync: ""`, `refreshing: false` to initial store state.
3. Inside `loadMemberData(preferredGymId = null)`:
   - After `memberId` resolves, fetch `gymPlans` in parallel or right after `loadedMember` resolves (`loadedMember?.gym_id`): `supabase.from("plans").select("id, gym_id, name, months, price").eq("gym_id", loadedMember.gym_id).order("months")` (wrap safely so errors yield `[]`).
   - Set `lastSync: hhmmDhaka(new Date().toISOString())`, validate `_pendingTab` with `VALID_MEMBER_TABS.includes(...)`.
4. Add `refreshMemberData`: if `get().refreshing`, return early; set `{ refreshing: true }`, call `await get().loadMemberData(get().member?.gym_id ?? null)`, then `finally { set({ refreshing: false }, false, "memberApp/refreshDone"); }`.
5. Update `signOut` to also reset `gymPlans: []`, `lastSync: ""`, `checkinBanner: null`, `tab: "home"`.

- [ ] **Step 2: Update `components/ui/sonner.tsx` mobile toast offset**

Add `mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}` as the default prop on `<Sonner>` (before `{...props}` so explicit callers can still override) so mobile toasts float cleanly above the fixed bottom navbar.

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add lib/stores/member-app-store.ts components/ui/sonner.tsx
git commit -m "feat(member): load gym plans, background refresh state, and mobile toast offset"
```

---

### Task 3: Shared `DashboardShell` & Owner `AdminShell` Parity

**Files:**
- Create: `components/DashboardShell.tsx`
- Modify: `components/AdminShell.tsx:1-316`

**Interfaces:**
- Consumes: `mobileNavGridCols` from `@/lib/member-helpers`
- Produces in `components/DashboardShell.tsx`:
  - `export interface DashboardNavItem { id: string; label: string; mobileLabel?: string; icon: LucideIcon; active: boolean; href?: string; onSelect?: () => void; badge?: string | number; badgeDot?: boolean }`
  - `export interface DashboardShellProps { brand: { name: string; logoUrl?: string | null; subtitle?: string }; navGroupLabel: string; navItems: DashboardNavItem[]; header: { title: string; subtitle?: string; badge?: ReactNode; actions?: ReactNode }; account: { primaryLabel: string; secondaryLabel: string; onOpenProfile?: () => void; onSignOut: () => void }; children: ReactNode }`
  - `export function DashboardShell(props: DashboardShellProps): JSX.Element`

- [ ] **Step 1: Create `components/DashboardShell.tsx`**

Implement the unified layout shell used by both Owner and Member dashboards:
1. **Desktop (`>= 768px` / `md+`):**
   - `SidebarProvider` -> `<Sidebar variant="floating" collapsible="icon">` with `SidebarHeader` (gym `Avatar` + `brand.name` + `brand.subtitle`), `SidebarContent` (`SidebarGroup` -> `SidebarGroupLabel` + `SidebarMenu` rendering `SidebarMenuButton` as `<Link href={item.href}>` when `href && !onSelect` else `<button type="button" onClick={item.onSelect}>`, active classes `bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground`, plus `SidebarMenuBadge` when `item.badge != null`), and `SidebarFooter` (`ThemeToggle compact={false}` + user card clickable when `account.onOpenProfile` is passed + `Log out` `Button`).
2. **Main Inset & Sticky Mobile Header (`< 768px`):**
   - `<SidebarInset>` wrapping `<main className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col gap-5 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 md:gap-6 md:pb-6">`.
   - `<header className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-b-0 md:bg-transparent md:p-0 md:backdrop-blur-none">`:
     - Left: `<SidebarTrigger className="hidden md:inline-flex" />`, mobile-only gym `Avatar` (`size-8 shrink-0 md:hidden`), title block (`h1` `text-lg font-medium tracking-tight md:text-2xl` + optional `header.badge` + `header.subtitle` truncated).
     - Right: `header.actions`, mobile `ThemeToggle` (`md:hidden`), and mobile account action (`md:hidden`):
       - If `account.onOpenProfile` exists: `Button` (`variant="outline" size="icon"` with `className="size-11 md:hidden"` and `User` icon + `aria-label="Account and profile"`).
       - Else: `Button` (`variant="outline" size="icon"` with `className="size-11 md:hidden"` and `LogOut` icon + `aria-label="Log out"`).
3. **Fixed Mobile Bottom Navbar (`md:hidden`):**
   - `<nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] dark:shadow-[0_-4px_16px_rgb(0_0_0/0.25)] md:hidden">`
   - Inner container: `mx-auto grid max-w-lg px-1` + `mobileNavGridCols(navItems.length)`.
   - Each item renders `<Link href={item.href}>` (when `item.href && !item.onSelect`) or `<button type="button" onClick={item.onSelect}>`, with `min-h-14` (`56px`), `aria-current={item.active ? "page" : undefined}`, rounded-full icon capsule (`px-3 py-1 rounded-full` with `bg-primary/12 text-primary dark:bg-primary/20` when active), optional status dot when `item.badgeDot` is true (`size-2 rounded-full bg-status-yellow-fg` with `aria-hidden="true"`), and `text-[11px] leading-none` label (`item.mobileLabel ?? item.label`).

- [ ] **Step 2: Refactor `components/AdminShell.tsx` to use `DashboardShell`**

Keep all `if (status !== "ready")` branches unchanged. When `status === "ready"`, render `DashboardShell` with `NAV_ITEMS` (passing `mobileLabel: "Add"` for `"Add member"`), `membersCount` badge on `"/members"`, `header` title/subtitle (`{gymName} · {todayFormatted}${lastSync ? " · synced " + lastSync : ""}`), and `account` (`primaryLabel: user?.email ?? "Staff"`, `secondaryLabel: role ?? "staff"`, `onSignOut`).

- [ ] **Step 3: Verify typecheck, lint, and production build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (all admin routes compile cleanly).

- [ ] **Step 4: Commit**

```bash
git add components/DashboardShell.tsx components/AdminShell.tsx
git commit -m "feat(shell): create shared DashboardShell with desktop sidebar and mobile bottom navbar"
```

---

### Task 4: Member Overview & Profile Sheet

**Files:**
- Create: `components/member/MemberOverview.tsx`
- Create: `components/member/MemberProfileSheet.tsx`

**Interfaces:**
- Consumes: `StatCards`, `StatusBadge`, `ChartContainer` / `ChartTooltip`, `Sheet`, `computeMemberKpis`, `attendancePulse`, `fmtDate`, `hhmmDhaka`, `money`, `pendingPayment`, `lastPaid` from `@/lib/logic` and `MemberTab` from `@/lib/member-helpers`
- Produces:
  - `export function MemberOverview(props: { member: Member; settings: GymSettings; workout: WorkoutPlanData | null; diet: DietPlanData | null; visits: Array<{ day: string; checked_in_at: string }>; streak: AttendanceStreak | null; trainerName: string; checkinBanner: { ok: boolean; text: string } | null; onDismissCheckin: () => void; onNavigateTab: (tab: MemberTab) => void; onOpenProfile: () => void; onRefresh: () => void; onDownloadPdf: (payment: Payment) => void; refreshing: boolean }): JSX.Element`
  - `export function MemberProfileSheet(props: { open: boolean; onOpenChange: (open: boolean) => void; member: Member; settings: GymSettings; trainerName: string; email?: string | null; onSignOut: () => void }): JSX.Element`

- [ ] **Step 1: Create `components/member/MemberProfileSheet.tsx`**

Implement a responsive shadcn `Sheet` (`w-full sm:max-w-md overflow-y-auto`):
1. Header with member `Avatar` (initials), `member.name`, `member.email` (or auth `email`), `+${member.phone}`, and `<StatusBadge member={member} />`.
2. Details section (`rounded-2xl border bg-secondary/40 p-4`) listing `Plan` (`member.plans?.name ?? "None"`), `Joined` (`member.join_date ? fmtDate(member.join_date) : "—"`), `Coach` (`trainerName || "Not assigned"`), `Goal`, `Age`, `Sex`, `Height` (`cm`), `Weight` (`kg`), `Diet pref`, and `Injuries`.
3. Gym Contact section showing `settings.name`, `settings.phone` (as `tel:` link with `min-h-11`), and `settings.address`.
4. `SheetFooter` with full-width `"Log out"` button (`variant="outline"`, `className="min-h-11 w-full"`).

- [ ] **Step 2: Create `components/member/MemberOverview.tsx`**

Model layout directly after `components/admin/TodayClient.tsx`:
1. **QR Check-in Banner** (conditional on `checkinBanner`): `rounded-3xl` card (`bg-status-lime-bg` or `border-destructive bg-status-rose-bg`) with icon, message, optional `"Renew membership"` button (`min-h-11`, navigates to `"pay"`), and dismiss `X` button (`size-11`).
2. **Priority Status Alert** (conditional, omitted when `status === "active"` and no pending TrxID):
   - Pending TrxID (`owed`): `status-yellow-bg` card showing amount, method, `trx_id`, `"View payment"` (`pay`) and `"Refresh"` buttons (`min-h-11` on mobile).
   - Expired or Due: `status-rose-bg` / `status-yellow-bg` card with `"Renewal due"` / `"Ends soon"` summary and `"Renew now"` primary CTA (`min-h-11`).
   - Frozen: `bg-muted` info card explaining membership is paused.
3. **Row 1 — `StatCards` KPI Strip:** Compute values via `computeMemberKpis(member, visits, streak, todayIso, currency)` and map to 4 `StatItem` cards (`Membership`, `Valid until`, `Visits this month`, `Current streak`).
4. **Row 2 — `grid gap-6 lg:grid-cols-2`:**
   - **7-Day Attendance Pulse (`Card rounded-3xl`):** Total `{kpis.weekVisits} visits`, `"All visits"` outline button (`onNavigateTab("visits")`), and `ChartContainer` + Recharts `BarChart` consuming `attendancePulse(visits, todayIso, 7)`.
   - **Today's Training & Quick Actions (`Card rounded-3xl`):** Coach subtitle, interactive day pill selector over `workout?.days` (defaulting to day 0) previewing up to 4 exercises + diet meal count summary, `"Open full plans"` button (`min-h-11 sm:min-h-0`, navigates to `"plans"`), primary `"Renew / Pay"` button (`onNavigateTab("pay")`), and gym phone link (`tel:`) if `settings.phone` exists.
5. **Row 3 — `grid gap-6 lg:grid-cols-2`:**
   - **Recent Visits (`Card rounded-3xl`):** Last 5 visits (`fmtDate(v.day)`, `"Today"` badge when `v.day === todayIso`, `hhmmDhaka(v.checked_in_at)` in `font-mono tabular-nums`), empty state for 0 visits, `"View all"` link (`onNavigateTab("visits")`).
   - **Billing & Profile Summary (`Card rounded-3xl`):** Latest confirmed receipt row (`lastPaid(member.payments ?? [])` with `"PDF"` / `"View"` buttons) + `"All receipts"` link (`onNavigateTab("receipts")`), plus compact 2x3 profile chips (`Goal`, `Weight`, `Height`, `Diet`) and `"Full profile"` button (`onOpenProfile`).

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add components/member/MemberOverview.tsx components/member/MemberProfileSheet.tsx
git commit -m "feat(member): add MemberOverview dashboard and MemberProfileSheet"
```

---

### Task 5: Member Plans & Pay Views

**Files:**
- Create: `components/member/MemberPlans.tsx`
- Create: `components/member/MemberPay.tsx`

**Interfaces:**
- Consumes: `resolvePaymentMethod` from `@/lib/member-helpers`, `money`, `fmtDate`, `pendingPayment`, `StatusBadge`
- Produces:
  - `export function MemberPlans(props: { member: Member; workout: WorkoutPlanData | null; diet: DietPlanData | null; trainerName: string }): JSX.Element`
  - `export function MemberPay(props: { member: Member; settings: GymSettings; gymPlans: Plan[]; onSubmitted: () => Promise<void>; onRefresh: () => void; refreshing: boolean }): JSX.Element`

- [ ] **Step 1: Create `components/member/MemberPlans.tsx`**

1. **Coach & Context Strip (`Card rounded-3xl`):** Displays `Coach: trainerName || "Not assigned"` and semantic metadata pills for `member.goal`, `member.diet_pref`, and `member.injuries` (if present).
2. **2-Column Plan Grid (`grid gap-6 lg:grid-cols-2`):**
   - **Workout Split Card (`Card rounded-3xl`):** If `workout?.days.length` > 3, render scrollable/wrapping `"All"` + day filter buttons (`min-h-10`) so members can isolate today's split on mobile; render each day card with `day`, `focus`, and exercise rows showing name + `sets × reps` badge (`tabular-nums`). Clean empty state when no verified workout plan exists.
   - **Diet Plan Card (`Card rounded-3xl`):** Render each `DietMeal` (`name`) with food items, optional `qty` and `kcal` badges (`tabular-nums`). Clean empty state when no verified diet plan exists.

- [ ] **Step 2: Create `components/member/MemberPay.tsx`**

1. **2-Column Layout (`grid gap-6 lg:grid-cols-2`):**
   - **Left Column:**
     - Current Plan & Renewal Status (`Card rounded-3xl`): `StatusBadge`, plan name, cycle fee (`money(member.plans.price, currency)`), duration, `expiry_date`, and note explaining renewal period extension rules.
     - Pending TrxID Card (when `pendingPayment(member.payments ?? [])` exists): `bg-status-yellow-bg` notice displaying `amount`, `method`, `trx_id`, submission date, and `"Refresh status"` button (`min-h-11`).
     - Gym Plan Tiers Card (when `gymPlans.length > 0`): Read-only list highlighting `member.plan_id` with caption `"Ask the front desk to switch plans."`
   - **Right Column (`Card rounded-3xl`):**
     - Numbered instructions (Send exact fee -> Submit TrxID).
     - Copyable **bKash** and **Nagad** number cards (`min-h-11` Copy button, `font-mono text-base`, calls `navigator.clipboard.writeText` with Sonner feedback). If `!methodInfo.hasAny`, display a clear alert: `"Ask the front desk for the gym's bKash or Nagad number."`
     - Form (`onSubmit`):
       - Method selector using `resolvePaymentMethod(settings.bkash_number, settings.nagad_number, selectedMethod)`: accessible `role="radiogroup"` 2-button segmented control (`bKash`, `Nagad`, `min-h-11` each; disables unconfigured option if only one wallet is configured).
       - TrxID `<Input>` (`min-h-11`, `text-base md:text-sm`, required, trimmed on submit).
       - Full-width Submit `<Button className="min-h-11 w-full">` disabled when `submitting || member.plans?.price == null || !methodInfo.hasAny`; shows clear notice if `member.plans?.price == null` (`"Ask the front desk to assign a plan first."`).
       - Inserts `{ member_id: member.id, amount: price, method: methodInfo.method, trx_id: trxId.trim() }` via `createClient().from("payments").insert(...)`, clears input, toasts success, and calls `await onSubmitted()`.

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add components/member/MemberPlans.tsx components/member/MemberPay.tsx
git commit -m "feat(member): add MemberPlans and MemberPay dashboard views"
```

---

### Task 6: Member Visits & Receipts Views

**Files:**
- Create: `components/member/MemberVisits.tsx`
- Create: `components/member/MemberReceipts.tsx`

**Interfaces:**
- Consumes: `StatCards`, `ChartContainer` / `ChartTooltip`, `Table`, `attendancePulse`, `fmtDate`, `hhmmDhaka`, `money`
- Produces:
  - `export function MemberVisits(props: { visits: Array<{ day: string; checked_in_at: string }>; streak: AttendanceStreak | null }): JSX.Element`
  - `export function MemberReceipts(props: { payments: Payment[]; currency: string; onDownloadPdf: (payment: Payment) => void }): JSX.Element`

- [ ] **Step 1: Create `components/member/MemberVisits.tsx`**

1. **4-Card Streak KPIs (`StatCards`):** `Current streak`, `Best streak`, `This month`, `Last 60d visits` (`visits.length`), safely defaulting `streak` fields to `0` when `streak === null`.
2. **14-Day Attendance Pulse (`Card rounded-3xl`):** Uses `attendancePulse(visits, dhakaToday(), 14)` inside `ChartContainer` + Recharts `BarChart` (`h-48 w-full`).
3. **Check-in History (`Card rounded-3xl`):** Full chronological list of `visits` showing `fmtDate(v.day)`, `"Today"` badge when `v.day === todayIso`, and `hhmmDhaka(v.checked_in_at)` in `font-mono tabular-nums`, with clean empty state when `visits.length === 0`.

- [ ] **Step 2: Create `components/member/MemberReceipts.tsx`**

1. Split `payments` into `pendingPayments` (`status === "pending"`) and `paidReceipts` (`status === "paid"`), sorted newest first.
2. **Pending Card** (conditional if `pendingPayments.length > 0`): Shows amount, method, TrxID, and `"Awaiting verification"` badge.
3. **Paid Receipts Card (`Card rounded-3xl`):**
   - Desktop (`hidden md:block`): Semantic `Table` with columns `Receipt #`, `Paid on`, `Period`, `Method`, `Amount`, `Actions` (`PDF` button if `p.receipt_path`, plus `View` `<Link href="/receipt?id=...">`).
   - Mobile (`md:hidden`): Clean stacked rows (`divide-y`) with `min-h-11` action buttons (`PDF` + `View`).
   - Clean empty state when `paidReceipts.length === 0`.

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add components/member/MemberVisits.tsx components/member/MemberReceipts.tsx
git commit -m "feat(member): add MemberVisits and MemberReceipts dashboard views"
```

---

### Task 7: `MemberShell`, `/member` Page, Skeletons, & End-to-End Verification

**Files:**
- Create: `components/member/MemberShell.tsx`
- Modify: `app/(member)/member/page.tsx:1-622`
- Modify: `app/(member)/loading.tsx:1-11`

**Interfaces:**
- Consumes: `DashboardShell`, `MemberProfileSheet`, `useMemberAppStore`, `resolveInitialTabAndHash`, `buildMemberUrl`, `parseMemberTab`
- Produces:
  - `export function MemberShell(props: { children: (ctx: { openProfile: () => void }) => ReactNode }): JSX.Element`

- [ ] **Step 1: Create `components/member/MemberShell.tsx` and update `app/(member)/member/page.tsx` + `app/(member)/loading.tsx`**

1. In `components/member/MemberShell.tsx`:
   - Handle auth bootstrap (`supabase.auth.getUser()` + `onAuthStateChange`), `?gym=<slug>` resolution via `get_public_gym_by_slug`, `resolveInitialTabAndHash(window.location.hash, window.location.search)` (stripping `#checkin=`/`#pay` via `replaceState`), and `popstate` listener syncing `?tab=` changes.
   - Handle pre-ready states (`loading` dashboard-shaped skeleton inside `max-w-7xl mx-auto`, `signed_out` `LoginCard` with `nextPath` preserving `?gym=` and `?tab=`, `no_member` card with `Self-register` link + `"Switch account"` logout button).
   - When `status === "ready"` and `member` is present, render `DashboardShell` with the 5 nav items (`Overview` / `Home`, `Plans`, `Renew / Pay` / `Pay`, `Visits`, `Receipts`), `onSelect` updating Zustand `setTab` AND `window.history.replaceState(null, "", buildMemberUrl(pathname, search, nextTab))`, `StatusBadge` header badge, `Refresh` button (`refreshMemberData`), `MemberProfileSheet`, and `{children({ openProfile: () => setProfileOpen(true) })}`.
2. In `app/(member)/member/page.tsx`:
   - Render `<Suspense>` wrapping `<MemberShell>` and switching on `tab` (`home` -> `MemberOverview`, `plans` -> `MemberPlans`, `pay` -> `MemberPay`, `visits` -> `MemberVisits`, `receipts` -> `MemberReceipts`) plus shared `downloadPdf` handler (`supabase.storage.from("receipts").createSignedUrl(p.receipt_path, 60)`).
3. In `app/(member)/loading.tsx`:
   - Update fallback skeleton to a `max-w-7xl mx-auto` dashboard skeleton (`grid gap-4 sm:grid-cols-2 xl:grid-cols-4` + `grid gap-6 lg:grid-cols-2`) matching `app/(admin)/loading.tsx`.

- [ ] **Step 2: Run full static & unit test suite**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS across every command with 0 errors and 0 warnings introduced by new files.

- [ ] **Step 3: Visual & responsive verification (desktop `1280px` & mobile `375px` / `360px`)**

Start local Next.js server (`npm run dev`) or production server (`npm run start`) and inspect rendered pages (both `/` owner and `/member` member pre-ready + simulated/authenticated or preview states across light & dark themes) using headless browser/Playwright checks:
- Verify bottom navbar renders fixed on `< 768px` (`md:hidden`) and hidden at `>= 768px`, while floating `Sidebar` renders at `>= 768px` and hidden `< 768px` on BOTH `/` and `/member`.
- Verify zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`) at `360px`, `375px`, and `1280px`.
- Verify mobile bottom navbar touch targets (`>= 44px` height) and content scroll clearance (`pb-[calc(5.5rem+env(safe-area-inset-bottom))]`).

- [ ] **Step 4: Commit**

```bash
git add components/member/MemberShell.tsx app/(member)/member/page.tsx app/(member)/loading.tsx
git commit -m "feat(member): wire unified MemberShell dashboard and responsive views"
```
