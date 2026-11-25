# Unified Member & Owner Dashboard Redesign — Design Spec

**Date:** 2026-11-25  
**Scope:** Redesign the Member App (`/member`) into a professional multi-view dashboard matching the Owner Dashboard, and unify both Owner (`AdminShell`) and Member (`MemberShell`) under one shared responsive shell with a desktop floating sidebar (`>= 768px`) and a fixed mobile bottom navbar (`< 768px`).

---

## 1. Intent & Why

Currently, the Owner Dashboard (`app/(admin)/*`, `components/AdminShell.tsx`, `components/admin/TodayClient.tsx`) presents a structured operations workspace: a floating left sidebar on desktop, a 4-card KPI strip (`StatCards`), a 7-day attendance Recharts `BarChart`, and two-column prioritized panels. By contrast, the Member App (`app/(member)/member/page.tsx`) is confined to a single `max-w-xl` column with a horizontally scrollable top `TabsList` and a single status card on Home—making mobile one-handed navigation awkward and leaving member stats, plans, receipts, and visits under-presented on both phone and desktop.

Because gym members primarily open the app on their phones at the gym (including PWA standalone launch via `public/manifest.webmanifest` `start_url: "/member"`) and owners/trainers also use the admin app on phones on the gym floor, unifying **both** Member and Owner apps onto one responsive shell—desktop floating sidebar (`md+`) + fixed mobile bottom navbar (`< md`)—delivers consistent visual polish and effortless mobile thumb reachability across the whole product.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Shared Responsive Shell (`DashboardShell`):** Extract a reusable layout shell (`components/DashboardShell.tsx`) consumed by both `components/AdminShell.tsx` (Owner/Staff) and a new `components/member/MemberShell.tsx` (Members).
2. **Identical Desktop & Mobile Layout Architecture:**
   - **Desktop/Tablet (`md+`, `>= 768px`):** `SidebarProvider` + floating `Sidebar` (`variant="floating" collapsible="icon"`), `SidebarTrigger` collapse toggle, theme toggle, user footer card, and wide fluid `SidebarInset` content area (`max-w-7xl`).
   - **Mobile (`< 768px`):** Sticky compact top header bar + fixed bottom navbar (`grid-cols-4` or `grid-cols-5`) with `44px+` touch targets (`min-h-14` row height), active pill highlight, badge indicators, and `env(safe-area-inset-bottom)` clearance (`viewport-fit=cover` already enabled in `app/layout.tsx`). Replaces the Owner mobile `Sheet` drawer (`SidebarTrigger` hidden `< md`) so Owner and Member mobile UX are identical.
3. **Professional Member Dashboard (`Overview` + 4 Dedicated Views):**
   - `Overview` (`home` tab): `StatCards` 4-card KPI grid, 7-day attendance pulse `BarChart` (`ChartContainer` + `attendancePulse()`), Today's Workout/Diet & Quick Renew card, Recent Visits list, and Latest Receipt + Fitness Profile summary card, plus contextual check-in / due / pending alert banners.
   - `Plans` (`plans` tab): Coach & fitness context header + 2-column desktop Workout Split & Diet Meal cards.
   - `Pay` (`pay` tab): 2-column desktop Renew / Submit TrxID flow with current plan & pending TrxID status, gym tier reference list, one-tap copy bKash/Nagad cards, segmented method selector, and TrxID form.
   - `Visits` (`visits` tab): Streak KPI strip (`current`, `best`, `visits_month`, recorded count), 14-day visit pulse `BarChart`, and full chronological check-in log (Dhaka time).
   - `Receipts` (`receipts` tab): Pending TrxID notice (if present), responsive desktop `Table` / mobile stacked cards for paid receipts with signed-URL PDF download and printable `/receipt?id=...` view links.
   - `MemberProfileSheet`: Accessible profile & gym contact drawer (`Sheet`) triggered from the mobile header profile button and desktop sidebar footer user card.
4. **Full Compatibility with Existing Deep Links & Multi-Tenancy:** Preserve `/member#checkin=<token>`, `/member#pay`, `/member?gym=<slug>#pay`, `/checkin`, `/receipt?id=...`, `/join/[gymSlug]`, and `manifest.webmanifest` (`start_url: "/member"`). Sync active tab cleanly with `?tab=overview|plans|pay|visits|receipts` (preserving `?gym=`).
5. **Accessibility & Mobile Ergonomics:** WCAG 2.2 AA contrast in both light and dark modes (`app/globals.css`), `44px+` touch targets on mobile interactive controls, `16px` (`text-base md:text-sm`) mobile form inputs to prevent iOS Safari zoom, `tabular-nums`, keyboard `focus-visible` rings, `aria-current="page"`, and mobile toast/scroll clearance above the fixed bottom navbar.

### Non-Goals
- No Supabase database migrations, schema changes, or RLS policy edits (member profile fields remain read-only; TrxID payment submission remains server-locked to `member.plan_id` via `payments_guard()`).
- No AI trainer chat or AI plan generation Edge Functions (`BLUEPRINT.md` steps 8–9).
- No changes to legacy static files under `web/`.
- No changes to public/kiosk/onboarding pages (`/welcome`, `/preview`, `/desk`, `/desk-qr`, `/onboarding`, `/join`, `/join/[gymSlug]`) beyond keeping `/member` links seamless.

### Anti-Goals
- Do **not** mount `MemberShell` inside `app/(member)/layout.tsx` directly, because `/join` and `/join/[gymSlug]` live inside `app/(member)/` and are public registration pages that must not display the authenticated member dashboard chrome.
- Do **not** invent a separate palette or override `app/globals.css` design tokens; reuse `--primary`, `--card`, `--secondary`, `--status-*`, and `--chart-*`.
- Do **not** let fixed bottom navbar labels wrap, clip, or overflow on narrow `320px–375px` viewports, or allow page content/Sonner toasts to sit behind the bottom navbar.

---

## 3. Constraints

- **Tech Stack:** Next.js 16.4.6 App Router, React 19.3, TypeScript 6, Tailwind CSS v4 (`@theme inline` in `app/globals.css`), shadcn/ui (`components/ui/*`), Lucide React, Recharts (`components/ui/chart.tsx`), Zustand (`lib/stores/member-app-store.ts`), `next-themes`, `sonner`.
- **Timezone & Currency:** `Asia/Dhaka` (`dhakaToday()`, `hhmmDhaka()`, `fmtDate()`) and `settings.currency` (default `"৳"`).
- **Supabase RLS & Triggers (`20261126000024_multitenant_gyms.sql` & `20261126000025_multitenant_storage.sql`):**
  - `members`: `SELECT` only for `auth_user_id = auth.uid()` (no self `UPDATE`).
  - `payments`: `SELECT` own rows; `INSERT` allowed only with `status = 'pending'`, `method in ('bkash', 'nagad')`, non-empty `trx_id`; `payments_guard()` sets `amount = member.plan_id` price (raises error if `member.plan_id` is null).
  - `plans`: `SELECT` allowed for all plans where `gym_id in my_member_gym_ids()`.
  - `workout_plans`, `diet_plans`: `SELECT` only `verified = true` rows for `my_member_ids()`.
  - `attendance`, `my_streak(p_member_id)`: `SELECT`/execute for own `member_id`.
  - `storage.objects` (`receipts` bucket): signed URLs via `createSignedUrl(p.receipt_path, 60)` for own `member_id` prefix.
- **Verification Gates:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` must pass after implementation.

---

## 4. Approaches Considered

### Approach A (Selected): Shared `DashboardShell` + single-route URL/hash-synced views on `/member`
- Extract a shared `DashboardShell` used by both `AdminShell` (which keeps its App Router pages `/`, `/members`, `/add`, `/plans`, `/settings` while adopting the mobile bottom navbar) and `MemberShell` (wrapping `/member`).
- Keep `/member` on a single App Router route (`app/(member)/member/page.tsx`) rendering modular view components (`MemberOverview`, `MemberPlans`, `MemberPay`, `MemberVisits`, `MemberReceipts`), keeping active view state in `useMemberAppStore` synchronized with `?tab=` and preserving `#pay`, `#checkin=`, and `?gym=`.
- **Tradeoffs:** Zero route-transition reloads on cheap mobile data once member data is loaded; preserves every existing `#pay`, `#checkin=`, and `?gym=` deep link across `lib/logic.ts`, `supabase/functions/_shared/reminders.js`, `app/checkin/page.tsx`, and `JoinGymClient.tsx`; cleanly keeps `/join` unaffected. Downside: browser history back-stepping across tabs requires explicit `popstate` sync if desired (solved by syncing `?tab=` cleanly; see Section 5.3).

### Approach B (Rejected): Shared `DashboardShell` + separate Next.js sub-routes (`/member`, `/member/plans`, `/member/pay`, `/member/visits`, `/member/receipts`)
- Mirrors `(admin)` file-per-route structure under a dedicated `(member-app)` route group.
- **Tradeoffs:** Adds Next.js navigation transitions on mobile data and requires redirect/rewrite adapters for all existing `/member#pay` and `/member?gym=slug#pay` links in email reminders, WhatsApp links, and QR check-in redirects.

---

## 5. Architecture & Component Design

### 5.1 Shared `DashboardShell` (`components/DashboardShell.tsx`)

Replaces duplicated shell markup in `AdminShell.tsx` and powers `MemberShell.tsx`, guaranteeing identical Owner and Member layouts at every breakpoint.

**Props contract (logical interface; exact helper types left to builder):**
- `brand`: `{ name: string; logoUrl?: string | null; subtitle?: string }`
- `navGroupLabel`: string (`"Operations"` for Owner/Staff, `"Member portal"` for Member)
- `navItems`: array of items:
  - `id: string`
  - `label: string` (desktop sidebar + header title context)
  - `mobileLabel?: string` (concise `<= 8` char label for mobile bottom navbar, e.g. `"Add"` for `"Add member"`, `"Home"` for `"Overview"`)
  - `icon: LucideIcon`
  - `active: boolean`
  - `href?: string` (used by `AdminShell`, or optional link fallback in `MemberShell`)
  - `onSelect?: () => void` (used by `MemberShell` for instant view switching)
  - `badge?: string | number` (desktop `SidebarMenuBadge` + mobile compact indicator)
  - `badgeDot?: boolean` (optional subtle status dot on mobile icon wrapper, e.g., pending TrxID or alert)
- `header`:
  - `title: string`
  - `subtitle?: string`
  - `badge?: ReactNode` (optional status pill next to title on desktop/mobile)
  - `actions?: ReactNode` (right-aligned desktop/mobile contextual action, e.g., quick refresh or status)
- `account`:
  - `email?: string | null`
  - `primaryLabel: string` (e.g., `member.name` or `user.email`)
  - `secondaryLabel: string` (e.g., `role` or `standing(member)`)
  - `onOpenProfile?: () => void` (Member opens `MemberProfileSheet`; if omitted, user card is static)
  - `onSignOut: () => void`
- `children: ReactNode`

**Desktop (`md:` / `>= 768px`) Behavior:**
- Uses `SidebarProvider` + `<Sidebar variant="floating" collapsible="icon">` with identical structure to current `AdminShell.tsx`:
  - `SidebarHeader`: Gym `Avatar` (`size-8`), `brand.name`, `brand.subtitle`.
  - `SidebarContent`: `SidebarGroup` -> `SidebarGroupLabel` + `SidebarMenu` with `SidebarMenuButton` (`isActive={item.active}`, active class `bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground`) and `SidebarMenuBadge`.
  - `SidebarFooter`: `ThemeToggle compact={false}` (hidden when collapsed to icon) + User Card (`primaryLabel`, `secondaryLabel`, clickable if `onOpenProfile` is provided) + `Log out` `Button` (`variant="outline" size="icon-sm"`).
- `SidebarInset` -> `<main className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col gap-6 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-6">`:
  - Top `<header>` shows `<SidebarTrigger className="hidden md:inline-flex" />` + title/subtitle + right controls (`header.actions` and on mobile `< md` compact `ThemeToggle` + Profile/Account button or `Log out` button).

**Mobile (`< 768px`) Behavior:**
- **Sticky Top Header:** Compact sticky header bar (`sticky top-0 z-30 -mx-4 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-b-0 md:bg-transparent md:p-0 md:backdrop-blur-none`) showing:
  - Left: Gym `Avatar` (`size-8 md:hidden`) + `h1` (`text-lg font-medium tracking-tight md:text-2xl`) + compact subtitle (`text-xs text-muted-foreground truncate`).
  - Right: `header.actions` (if compact) + `ThemeToggle compact` (`md:hidden`) + Mobile Account control (`md:hidden`):
    - When `account.onOpenProfile` is provided (Member): `Button` (`size="icon"`, `min-h-10 min-w-10` / `size-10` or `size-11`, `aria-label="Account and profile"`) showing user initials/icon.
    - Otherwise (Owner): `Button` (`variant="outline" size="icon"`, `aria-label="Log out"`, `min-h-10 min-w-10`) calling `account.onSignOut`.
- **Fixed Bottom Navbar (`md:hidden`):**
  - `<nav aria-label="Primary navigation">` at `fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] dark:shadow-[0_-4px_16px_rgb(0_0_0/0.25)] md:hidden`.
  - Inner grid `mx-auto grid max-w-lg` using `grid-cols-4` when `navItems.length === 4` or `grid-cols-5` when `navItems.length === 5` (lookup map, no dynamic Tailwind class interpolation).
  - Each nav item (`<Link>` if `href` and no `onSelect`, or `<button type="button">` if `onSelect`):
    - Minimum `min-h-14` (`56px`) height, centered vertical stack (`gap-1 px-1 py-1.5`), `focus-visible:ring-2 focus-visible:ring-ring`.
    - Active state: icon inside a rounded-full capsule (`px-3 py-1 rounded-full bg-primary/12 text-primary dark:bg-primary/20`) + label `text-[11px] font-semibold leading-none text-primary`.
    - Inactive state: `text-muted-foreground hover:text-foreground`, label `text-[11px] font-medium leading-none`.
    - `aria-current={item.active ? "page" : undefined}`.
    - Optional dot/count indicator on top-right of icon capsule (`badgeDot` -> `size-2 rounded-full bg-status-yellow-fg` or `bg-destructive`, plus `sr-only` status hint if appropriate).
- **Toast Clearance:** Configure `Toaster` in `components/ui/sonner.tsx` (or `app/layout.tsx`) with mobile bottom offset above the `~60px + safe-area` bottom bar so mobile toasts never obscure bottom navigation items.

### 5.2 Owner Shell Refactor (`components/AdminShell.tsx`)
- Keep all `status !== "ready"` gates (`loading`, `signed_out`, `no_gym`, `not_staff`) unchanged in structure, matching `AdminShell.tsx`.
- When `status === "ready"`, render `DashboardShell` with:
  - `brand`: `{ name: gymName, logoUrl: gym?.logo_url, subtitle: todayFormatted }`
  - `navGroupLabel`: `"Operations"`
  - `navItems`:
    1. `Today` (`/`)
    2. `Members` (`/members`, `badge: membersCount`)
    3. `Add member` (`mobileLabel: "Add"`, `/add`)
    4. `Plans` (`/plans`)
    5. `Settings` (`/settings`, `ownerOnly: true` filtered out for non-owners, yielding 4 items on `grid-cols-4` for trainers/staff and 5 items on `grid-cols-5` for owners)
  - `header`: `{ title: pageTitle, subtitle: `${gymName} · ${todayFormatted}${lastSync ? ` · synced ${lastSync}` : ""}` }`
  - `account`: `{ primaryLabel: user?.email ?? "Staff", secondaryLabel: role ?? "staff", onSignOut: () => void signOut() }`

### 5.3 Member Store & Shell (`lib/stores/member-app-store.ts`, `components/member/MemberShell.tsx`, `app/(member)/member/page.tsx`)

**Store Extensions (`lib/stores/member-app-store.ts` & `types/gym.ts`):**
- Add `join_date?: string | null;` to `Member` in `types/gym.ts` (column already returned by `select("*")` on `members`).
- Add to `MemberAppState`:
  - `gymPlans: Plan[]` (default `[]`): fetched alongside member data via `supabase.from("plans").select("id, gym_id, name, months, price").eq("gym_id", loadedMember.gym_id).order("months")` (RLS `plans_read` allows members to read own gym's plans).
  - `lastSync: string` (default `""`): set to `hhmmDhaka(new Date().toISOString())` on load completion.
  - `refreshing: boolean` (default `false`): tracks manual refresh in-flight without blanking the dashboard (`status` stays `"ready"` during background refresh).
  - `refreshMemberData: () => Promise<void>`: refreshes data for `member?.gym_id ?? null` cleanly with `refreshing` state.
- Export `VALID_MEMBER_TABS: readonly MemberTab[] = ["home", "plans", "pay", "visits", "receipts"]` and helper `parseMemberTab(raw: string | null): MemberTab | null` (`"overview"` maps to `"home"` for readable `?tab=overview` URLs while `"home"`, `"plans"`, `"pay"`, `"visits"`, `"receipts"` map 1:1).
- Update `signOut` to reset `gymPlans: []`, `lastSync: ""`, `checkinBanner: null`, `tab: "home"`.

**URL & Deep-Link Synchronization (`MemberShell` / `app/(member)/member/page.tsx`):**
- On initial mount:
  1. Check `window.location.hash`:
     - `#checkin=<token>` -> `setPendingCheckin(tok, null)` and strip hash via `replaceState`.
     - `#pay` -> `setPendingTab("pay")` and strip hash via `replaceState`.
  2. Check `searchParams.get("tab")`: if valid (and `#pay` was not set), initialize active tab (or `setPendingTab` before login completes).
  3. Preserve `?gym=<slug>` in `nextPath` passed to `LoginCard` (`/member?gym=...` and current `&tab=...` if set) and preserve `?gym=<slug>` whenever updating `?tab=` via `window.history.replaceState`.
  4. When user selects a tab (`setTab`), update `URLSearchParams` (`overview` when `tab === "home"`, otherwise `tab`) via `window.history.replaceState` without reloading the route.

**Pre-Ready States (`MemberShell.tsx`):**
- `loading`: Renders clean top header (gym avatar + name + `ThemeToggle`) + dashboard-shaped skeleton (4-card KPI grid + two `h-56` chart/card skeletons), keeping content `max-w-7xl mx-auto`.
- `signed_out`: Renders header + `LoginCard` with `title={`${gymName} · Members`}`, subtitle explaining magic-link email, `nextPath` preserving `?gym=` and `?tab=`.
- `no_member`: Renders header + centered `Card` (`rounded-3xl`) showing signed-in `user.email`, explanation, `"Self-register"` link (`/join/[slug]` or `/join`), and `"Switch account"` (`Log out`) button (`min-h-11`).
- `ready`: Wraps active member view in `DashboardShell`:
  - `brand`: `{ name: gymName, logoUrl: settings.logo_url, subtitle: member.plans?.name ?? "Member" }`
  - `navGroupLabel`: `"Member portal"`
  - `navItems`:
    1. `id: "home"`, `label: "Overview"`, `mobileLabel: "Home"`, `icon: LayoutDashboard`
    2. `id: "plans"`, `label: "Plans"`, `icon: Dumbbell`
    3. `id: "pay"`, `label: "Renew / Pay"`, `mobileLabel: "Pay"`, `icon: CreditCard`, `badge: owed ? "Pending" : undefined`, `badgeDot: Boolean(owed || member.status === "expired" || member.status === "due")`
    4. `id: "visits"`, `label: "Visits"`, `icon: CalendarCheck`
    5. `id: "receipts"`, `label: "Receipts"`, `icon: ClipboardList`, `badge: paidReceipts.length || undefined`
  - `header`:
    - `title`: View title (`"Overview"`, `"Workout & diet plans"`, `"Renew membership"`, `"Gym visits"`, `"Payment receipts"`)
    - `subtitle`: `${gymName} · ${todayFormatted}${lastSync ? ` · synced ${lastSync}` : ""}`
    - `badge`: `<StatusBadge member={member} />` (on desktop / header when space permits)
    - `actions`: Compact `"Refresh"` icon/outline button (`refreshMemberData`) so members waiting for desk confirmation can pull fresh status with one tap.
  - `account`:
    - `primaryLabel`: `member.name`
    - `secondaryLabel`: `standing(member)`
    - `onOpenProfile`: opens `MemberProfileSheet`
    - `onSignOut`: `() => void signOut()`

### 5.4 Member Dashboard Views (`components/member/*`)

1. **`MemberOverview.tsx` (`home` tab)** — Mirrors `components/admin/TodayClient.tsx`:
   - **QR Check-in Banner** (conditional on `checkinBanner`): Full-width `rounded-3xl` alert card (`status-lime-bg` or `status-rose-bg` with `border-destructive`), dismiss button (`min-h-11 min-w-11`), check-in message, and `"Renew membership"` button (`onGoToPay`) when `checkinBanner.ok === false`.
   - **Priority Membership / Payment Notice** (conditional, matching Owner's priority guardrail cards):
     - If `owed` (pending TrxID): Amber card showing `{money(owed.amount, currency)} · {owed.method} · TrxID {owed.trx_id}` awaiting desk confirmation, with `"View payment"` button (`onGoToPay`) and `"Refresh"` button.
     - Else if `member.status === "expired"` or `member.status === "due"`: Rose/Yellow alert card stating `"Membership expired"` or `"Membership ends soon"` (`daysLeft`), with `"Renew now"` primary CTA (`min-h-11`) -> `pay` tab.
     - Else if `member.status === "frozen"`: Muted notice card stating membership is paused and to contact the front desk to resume.
   - **Row 1 — 4-Card KPI Strip (`StatCards` component):**
     1. **Membership Status** (`ShieldCheck`, `bg-chart-1`):
        - `value`: `standing(member)` (`Paid up`, `Ends soon`, `Renewal due`, `Frozen`, `Never paid`)
        - `caption`: `member.plans ? `${member.plans.name} · ${money(member.plans.price, currency)}` : "No plan assigned"`
        - `delta`: `daysRemaining === null ? "Unpaid" : daysRemaining > 0 ? `${daysRemaining}d left` : daysRemaining === 0 ? "Ends today" : `${Math.abs(daysRemaining)}d ago``
        - `deltaTone`: `member.status === "active" ? "lime" : member.status === "expired" ? "rose" : "neutral"`
     2. **Valid Until** (`Calendar`, `member.status === "expired" ? "bg-chart-5" : "bg-chart-2"`):
        - `value`: `member.expiry_date ? fmtDate(member.expiry_date) : "Not active"`
        - `caption`: `owed ? `Pending ${money(owed.amount, currency)}` : lastPaidRow?.paid_on ? `Last paid ${fmtDate(lastPaidRow.paid_on)}` : "No payments yet"`
        - `delta`: `owed ? "Pending" : member.plans ? `${member.plans.months} mo` : "No plan"`
        - `deltaTone`: `owed ? "neutral" : member.status === "expired" ? "rose" : "lime"`
     3. **Visits This Month** (`CalendarCheck`, `bg-chart-3`):
        - `value`: `String(streak?.visits_month ?? 0)`
        - `caption`: `todayVisit ? `Checked in at ${hhmmDhaka(todayVisit.checked_in_at)}` : "Not checked in today"`
        - `delta`: `todayVisit ? "In today" : `${weekVisits} / 7d``
        - `deltaTone`: `todayVisit ? "lime" : "neutral"`
     4. **Attendance Streak** (`Flame`, `bg-chart-4`):
        - `value`: `${streak?.current ?? 0}d`
        - `caption`: `Best: ${streak?.best ?? 0}d`
        - `delta`: `(streak?.current ?? 0) > 0 ? "Active" : "Start today"`
        - `deltaTone`: `(streak?.current ?? 0) > 0 ? "lime" : "neutral"`
   - **Row 2 — 2-Column Interactive Band (`grid gap-6 lg:grid-cols-2`):**
     - **Left: 7-Day Attendance Pulse Card (`rounded-3xl`)**:
       - Header: `"7-day attendance pulse"`, hero numeral `"{weekVisits} visits"` (`tabular-nums`), `"View visits"` outline button -> `visits` tab.
       - Chart: Recharts `BarChart` wrapped in `ChartContainer` (`h-44 w-full`), consuming `attendancePulse(visits, todayIso)`, matching `TodayClient.tsx` (`XAxis` weekday labels, `YAxis` integer ticks, `ChartTooltip`, `Bar` with `radius={[6, 6, 0, 0]}`).
     - **Right: Training & Renewal Quick Card (`rounded-3xl`)**:
       - Displays Coach (`trainerName || "Not assigned"`), interactive workout-day pill switcher or preview of the first/selected day's exercises (`workout?.days`) and diet meal count (`diet?.meals`), with `"Open full plans"` outline button (`min-h-11` on mobile) -> `plans` tab.
       - Footer / CTA bar: Primary `"Renew / Pay"` button (`min-h-11` on mobile) -> `pay` tab, plus gym phone quick-call link (`tel:...`) if `settings.phone` is present.
   - **Row 3 — 2-Column Summary Band (`grid gap-6 lg:grid-cols-2`):**
     - **Left: Recent Visits Card (`rounded-3xl`)**:
       - Up to 5 latest visits (`fmtDate(v.day)` + `"Today"` badge if `v.day === todayIso` + `hhmmDhaka(v.checked_in_at)` in `font-mono tabular-nums`), empty state if 0 visits, `"All visits"` link -> `visits` tab.
     - **Right: Billing & Fitness Profile Card (`rounded-3xl`)**:
       - Latest confirmed receipt row (amount, `paid_on`, `receipt_no`, quick `"PDF"` / `"View"` buttons if available) + `"All receipts"` link -> `receipts` tab.
       - Compact read-only fitness summary grid (`Goal`, `Weight`, `Height`, `Diet pref`, `Member since`) with `"Full profile"` button opening `MemberProfileSheet`.

2. **`MemberPlans.tsx` (`plans` tab)**:
   - **Coach & Fitness Profile Strip (`rounded-3xl`)**: Shows assigned Coach (`trainerName`), Goal (`member.goal`), Injuries (`member.injuries`), and Diet Preference (`member.diet_pref`) so the member sees what their coach tailored the plan around.
   - **2-Column Plan Cards (`grid gap-6 lg:grid-cols-2`)**:
     - **Workout Split Card**: Renders each `WorkoutDay` (`day`, `focus`) with clean exercise rows showing exercise name and `sets × reps` badge (`tabular-nums`). Includes quick day filter pills when `workout.days.length > 3` for effortless thumb browsing on mobile. Empty state explains trainer hasn't verified a workout plan yet.
     - **Diet Plan Card**: Renders each `DietMeal` (`name`) with food items, optional `qty` and `kcal` badges (`tabular-nums`). Empty state explains trainer hasn't verified a diet plan yet.
   - Note: `components/PlanView.tsx` stays intact for `components/admin/MemberDialog.tsx`.

3. **`MemberPay.tsx` (`pay` tab)**:
   - **2-Column Grid (`grid gap-6 lg:grid-cols-2`)**:
     - **Left Column (`flex flex-col gap-6`)**:
       - **Current Plan & Renewal Summary Card (`rounded-3xl`)**: `StatusBadge`, current plan name, exact renewal fee (`money(price, currency)`), duration (`months`), `expiry_date`, and plain explanation of period behavior (early renewal extends from current expiry; late renewal starts on confirmation date).
       - **Pending TrxID Card** (conditional on `owed`): Status-yellow card displaying submitted amount, method, `trx_id`, submission date (`fmtDate`), and `"Refresh status"` button. Note clarifying they don't need to repay if they already sent money.
       - **Gym Plan Tiers Card** (if `gymPlans.length > 0`): Read-only comparison list of the gym's membership tiers (`name`, `months`, `money(price, currency)`) highlighting the member's active tier, with caption `"Ask the front desk to switch plans."`
     - **Right Column (`Submit Payment Card`, `rounded-3xl`)**:
       - Clear 2-step checklist (Send exact plan fee -> Enter TrxID).
       - Copyable **bKash** and **Nagad** number tiles (`min-h-11` Copy button, `font-mono text-base`, handles missing numbers gracefully with a `"Ask front desk for payment number"` notice if neither is configured).
       - Form:
         - **Method selector:** Accessible 2-button segmented radio/toggle group (`bKash` / `Nagad`, each `min-h-11`) — faster one-tap mobile experience than a select dropdown. (Auto-selects an available configured method if only one is set.)
         - **TrxID Input:** `min-h-11`, `text-base md:text-sm`, uppercase hint, required.
         - **Submit CTA:** Full-width primary button (`min-h-11`) `"Send TrxID to gym"`, disabled with helpful notice when `member.plans?.price == null`.
         - On submit success: clears input, shows Sonner success toast, calls `loadMemberData(member.gym_id)`, and navigates back to `Overview` (`"home"`) where the new pending banner appears.

4. **`MemberVisits.tsx` (`visits` tab)**:
   - **4-Card Mini KPI Strip (`StatCards` or compact 2x2/4-col metric cards)**:
     - `Current streak` (`streak?.current ?? 0`), `Best streak` (`streak?.best ?? 0`), `This month` (`streak?.visits_month ?? 0`), `Last 60d visits` (`visits.length`).
   - **14-Day Attendance Pulse (`rounded-3xl`)**:
     - Recharts `BarChart` using a parameterized helper `attendancePulseDays(rows, todayIso, days)` in `lib/logic.ts` (extracting/generalizing `attendancePulse` with default `days = 7` so Overview + Owner use 7 days and Member Visits shows 14 days without duplicating logic!).
   - **Check-in History Card (`rounded-3xl`)**:
     - Full chronological list of recorded visits (up to 60 from store) showing formatted date, `"Today"` badge on `todayIso`, and Dhaka time (`hhmmDhaka`), with clean empty state.

5. **`MemberReceipts.tsx` (`receipts` tab)**:
   - **Pending Submissions Card** (conditional if any payment has `status === "pending"`): Lists pending payments (`amount`, `method`, `trx_id`, submitted timestamp) with `"Awaiting verification"` badge.
   - **Paid Receipts Card (`rounded-3xl`)**:
     - Desktop (`md+`): `Table` (`Receipt #`, `Paid on`, `Period`, `Method`, `TrxID`, `Amount`, `Actions`) using `tabular-nums`.
     - Mobile (`< md`): Clean stacked cards (`divide-y`) with `min-h-11` `"PDF"` (when `p.receipt_path` is present, calling `createSignedUrl`) and `"View"` (`/receipt?id=...`) buttons.
     - Empty state when `paidReceipts.length === 0`.

6. **`MemberProfileSheet.tsx`**:
   - Uses shadcn `Sheet` (`side="right"` on desktop, comfortable width `w-full sm:max-w-md`).
   - Displays:
     - Member header (`Avatar` initials, `member.name`, `member.email`, `+${member.phone}`, `StatusBadge`).
     - Fitness & Registration details grid (`Plan`, `Member since` / `join_date`, `Goal`, `Age`, `Sex`, `Height`, `Weight`, `Injuries`, `Diet preference`, `Coach`).
     - Gym Contact section (`settings.name`, `settings.phone` with `tel:` link, `settings.address`).
     - Footer with full-width `"Log out"` button (`min-h-11`, `variant="outline"`).

---

## 6. File Structure & Scope

**Modified:**
- `types/gym.ts` — add optional `join_date?: string | null` on `Member`.
- `lib/logic.ts` — generalize `attendancePulse(rows, todayIso, days = 7)` while preserving existing 2-arg call signature (`web/logic.test.mjs` unaffected).
- `lib/stores/member-app-store.ts` — add `gymPlans`, `lastSync`, `refreshing`, `refreshMemberData`, `VALID_MEMBER_TABS`, `parseMemberTab`.
- `components/AdminShell.tsx` — refactor `status === "ready"` shell to delegate to `DashboardShell` (preserving `status !== "ready"` gates and switching mobile `< md` from drawer to bottom navbar).
- `components/ui/sonner.tsx` — ensure mobile toast offset clears the fixed bottom navbar.
- `app/(member)/member/page.tsx` — slim entry point delegating to `MemberShell` + active view component (`MemberOverview`, `MemberPlans`, `MemberPay`, `MemberVisits`, `MemberReceipts`).

**Created:**
- `components/DashboardShell.tsx` — shared desktop floating `Sidebar` + mobile sticky top header + mobile fixed bottom navbar shell.
- `components/member/MemberShell.tsx` — member auth gates (`loading`, `signed_out`, `no_member`), URL/hash tab sync, `DashboardShell` integration, and `MemberProfileSheet` wiring.
- `components/member/MemberOverview.tsx` — KPI `StatCards`, 7-day pulse chart, today's plan & quick actions, recent visits, billing/profile summary.
- `components/member/MemberPlans.tsx` — coach/profile context strip + 2-column Workout Split & Diet Meal views.
- `components/member/MemberPay.tsx` — renewal status, gym plan tiers reference, bKash/Nagad copy tiles, and TrxID submission form.
- `components/member/MemberVisits.tsx` — streak KPIs, 14-day attendance chart, and chronological check-in history.
- `components/member/MemberReceipts.tsx` — pending payments + responsive desktop table / mobile cards for paid receipts and PDF downloads.
- `components/member/MemberProfileSheet.tsx` — member fitness profile, gym contact info, and mobile/desktop logout drawer.

---

## 7. Verification & Acceptance Criteria

1. **Responsive Layout Parity:**
   - At `>= 768px` (desktop), `/member` and `/` (owner) render the exact same floating left `Sidebar`, `SidebarTrigger`, user footer, and `max-w-7xl` dashboard grid.
   - At `< 768px` (`360px` and `390px` mobile viewports), both `/member` and `/` render the compact sticky header + fixed bottom navbar (`grid-cols-4` or `grid-cols-5`), with zero horizontal overflow, zero content clipped under the bottom bar, and `>= 44px` interactive touch targets.
2. **Functional Integrity:**
   - `/member#checkin=<token>` records check-in and renders `checkinBanner` with dismiss + renewal CTA when unpaid.
   - `/member#pay` and `/member?gym=<slug>#pay` land on `Pay` tab and preserve `gym=<slug>` across login and tab switches.
   - TrxID submission inserts pending `payments` row, refreshes member store, and redirects to `Overview` showing pending status.
   - Paid receipt PDF signed URL download and `/receipt?id=...` navigation work cleanly.
   - Light & dark modes (`ThemeToggle`) render legible contrast on all cards, charts, status badges, and the bottom navbar.
3. **Automated Checks:**
   - Add unit tests for `attendancePulse(..., days)` and `parseMemberTab(...)` (or pure view-model helpers) under existing Node test runner (`node --test`).
   - `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass cleanly.

---

## 8. Left to the Builder

- Exact component prop naming details inside `components/member/*` and internal sub-helpers for date/days-left formatting.
- Exact `ChartConfig` labels/colors for the 14-day visit chart (using `--chart-1` / `--color-count` consistent with `TodayClient.tsx`).
- Exact Sonner `mobileOffset` syntax matching `sonner@2.0.8` TypeScript definitions.
- Adding pure unit tests for any new helper logic added in `lib/logic.ts` / `lib/member-helpers.ts`.
