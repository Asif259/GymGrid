---
name: GymGrid (Material 3 Operations Ledger & Member Pass)
description: Google Material Design 3 neutral surfaces (#F8F9FA / #FFFFFF light, #131314 / #1E1F20 dark), Google Blue primary (#0B57D0 / #A8C7FA), Newsreader + Inter + JetBrains Mono typography, unified KPI ledger strip, and centered shadcn Dialog/AlertDialog primitives across Admin, Member, and Landing views.
colors:
  light:
    bg: "#f8f9fa"
    surface: "#ffffff"
    surface-container: "#f0f4f9"
    surface-muted: "#eef2f6"
    sidebar: "#f0f4f9"
    sidebar-accent: "#d3e3fd"
    sidebar-accent-ink: "#041e49"
    ink: "#1f1f1f"
    ink-muted: "#444746"
    border: "#dadce0"
    primary: "#0b57d0"
    primary-ink: "#ffffff"
    accent: "#d3e3fd"
    accent-ink: "#041e49"
    destructive: "#b3261e"
    destructive-ink: "#ffffff"
    positive: "#137333"
    positive-bg: "#e6f4ea"
    warning: "#8a4b00"
    warning-bg: "#fef7e0"
    danger: "#b3261e"
    danger-bg: "#fce8e6"
    chart: ["#1a73e8", "#1e8e3e", "#f9ab00", "#d93025", "#12b5cb"]
  dark:
    bg: "#131314"
    surface: "#1e1f20"
    surface-container: "#282a2c"
    popover: "#242628"
    sidebar: "#1a1c1e"
    sidebar-accent: "#282a2c"
    sidebar-accent-ink: "#d3e3fd"
    ink: "#e3e3e3"
    ink-muted: "#c4c7c5"
    border: "#333537"
    input-border: "#3c4043"
    primary: "#a8c7fa"
    primary-ink: "#062e6f"
    accent: "#0842a0"
    accent-ink: "#d3e3fd"
    destructive: "#f2b8b5"
    destructive-ink: "#601410"
    positive: "#81c995"
    positive-bg: "#163825"
    warning: "#fdd663"
    warning-bg: "#3b2a08"
    danger: "#f2b8b5"
    danger-bg: "#4a1917"
    chart: ["#8ab4f8", "#81c995", "#fdd663", "#f28b82", "#78d9ec"]
  landing:
    dark-band-bg: "#0b1d33"
    dark-band-ink: "#f8f9fa"
    ticker-dot: "#8ab4f8"
    manifest-theme: "#0b57d0"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    weights: [500, 600]
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, Noto Sans Bengali, sans-serif"
    weights: [400, 500, 600]
  landingBody:
    fontFamily: "Geist, system-ui, sans-serif"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  scale:
    micro: { fontSize: "0.6875rem", lineHeight: 1.2, weight: 500 }
    caption: { fontSize: "0.75rem", lineHeight: 1.4, weight: 400 }
    ui: { fontSize: "0.875rem", lineHeight: 1.35, weight: 500 }
    body: { fontSize: "1rem", lineHeight: 1.5, weight: 400 }
    section: { fontSize: "1rem", lineHeight: 1.35, weight: 500 }
    pageTitle: { fontSize: "1.25rem–1.75rem", lineHeight: 1.2, weight: 500, font: "Newsreader" }
    kpi: { fontSize: "1.5rem–1.875rem", lineHeight: 1.15, weight: 500 }
rounded:
  base: "0.625rem (10px)"
  badgeChip: "6px (rounded-md)"
  control: "8px (rounded-lg)"
  card: "12px–16px (rounded-xl / rounded-2xl)"
  pill: "9999px (rounded-full)"
spacing:
  grid: "4px base scale"
  pagePadding: "16px mobile, 24px desktop (max-w-7xl)"
  sectionGap: "20px mobile, 24px desktop"
layout:
  maxContentWidth: "80rem (max-w-7xl)"
  stickyHeaderScrollOffset: "4.5rem"
  mobileTouchTarget: "44px (min-h-11)"
  desktopControlHeight: "36px–40px"
---

# Design System: GymGrid (Material 3 Operations Ledger & Member Pass)

## Overview

A light- and dark-mode gym management workspace and public landing page grounded in **Google Material Design 3** neutral surfaces (`#f8f9fa` / `#ffffff` in light, `#131314` / `#1e1f20` in dark) and **Google Blue** (`#0b57d0` light, `#a8c7fa` dark) reserved strictly for primary CTAs, live focus states, and today's attendance highlight. All semantic status badges, charts, and landing surfaces share the same WCAG AA token set defined in `app/globals.css` and `app/landing.css` (zero violet/lavender hues).

**Key Characteristics:**
- **Unified neutrals, quiet chrome:** Tinted Workspace-style sidebar (`#f0f4f9` / `#1a1c1e`) with tonal active nav rows (`bg-sidebar-accent` + primary-tinted icon) instead of loud filled nav pills.
- **Tonal KPI icon chips:** Metric columns keep colored Material 3 tonal icon wells (`TONAL_ICON_CLASSES` in `components/StatCards.tsx`) with >= 5:1 icon contrast across Blue, Green, Amber, Red, and Slate tones.
- **Editorial-sans pairing:** `Newsreader` (`--font-editorial`) on dashboard `<h1>` headings and landing display headings paired with `Inter` for operational UI, `Geist` on landing body copy, and `JetBrains Mono` / `Geist Mono` (`tabular-nums`) for member IDs (`MM-xxx`), TrxIDs, receipt numbers, and chart ticks.
- **Light + dark support:** Both themes defined in `:root` / `.dark` (`app/globals.css` and `app/landing.css`), with `ThemeToggle` in sidebar/header.

## Layout & Adaptivity

- **Dashboard Shell (`components/DashboardShell.tsx`):**
  - **Desktop (`md+`):** Collapsible floating `Sidebar` (`variant="floating"`, `collapsible="icon"`), `h-9` nav rows, and `SidebarInset` containing a `max-w-7xl` content container (`p-6`, `gap-6`).
  - **Mobile (`< md`):** Sticky blurred top header (`bg-background/95 backdrop-blur-md`) paired with `scroll-padding-top: 4.5rem` on `html`, `pb-[calc(5rem+env(safe-area-inset-bottom))]` clearance, and a fixed bottom tab rail with `44px+` touch targets.
- **Admin Today Desk (`components/admin/TodayClient.tsx`):**
  - **KPI Ledger Strip (`components/StatCards.tsx`):** Unified 4-column hairline surface (`rounded-xl border bg-card`, `divide-y` on mobile, `divide-x` on `xl+`) with left-aligned labels, top-right `size-8` tonal icon chips, `1.5rem–1.875rem` tabular figures, and a top-bordered caption + mono delta row.
  - **Asymmetric Workspace (`lg:grid-cols-12`):** `7`-column elevated `bg-card` **7-day attendance pulse** chart (horizontal dashed `CartesianGrid`, mono ticks, only today's bar highlighted in `--chart-1`) paired with a `5`-column recessed tonal **Check someone in** tray (`bg-secondary/45`).
  - **Bottom Ledger (`lg:grid-cols-12`):** `7`-column queue (**Trained without paying today** alert card + **Pending approvals**) paired with a `5`-column consolidated **Renewals watchlist** (**Expiring in 2 days** + **Expired recently** separated by a hairline).
- **Member Overview (`components/member/MemberOverview.tsx`):**
  - Same 4-column `StatCards` ledger strip below any active check-in / billing / frozen alert card.
  - Asymmetric `12`-column focal workspace: `5`-column **Member pass** hero card (`border-t-2 border-t-primary`, `member_code`, `StatusBadge`, coach & body/plan summary, Today's training split selector, and primary actions) paired with a `7`-column **7-day attendance pulse**, **Recent visits**, and **Latest receipt** ledger card separated by spacing and hairline dividers.
- **Members Directory (`components/DataTable.tsx`):** Status `Tabs` filter row, `SearchInput`, sort `Select`, semantic `<table>` with `44px+` touch-friendly action menu (`⋮`), `title` fallback on truncated names, and `Pagination`.
- **Landing Page (`components/landing/LandingShell.tsx`, `app/landing.css`):** Stone-clean `#f8f9fa` / `#ffffff` ground synced to the Material 3 palette, GSAP/Lenis motion (respecting `prefers-reduced-motion: reduce`), and `#0b1d33` dark navy ticker and closing band.
- **Logical Properties:** Direction-dependent borders, alignment, and offsets use logical utilities (`border-s`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`). Mixed-direction identifiers (phones, `member_code`, `trx_id`, `receipt_no`, wallet numbers, account email) are wrapped in `<bdi>`.

## Typography & Accessibility

- **Scale & Unitless Line-Heights:** `1.15` on KPI figures, `1.2` on `Newsreader` `<h1>` page titles (wrapping with `text-balance`, never clipped with `truncate`) and compact nav labels, `1.35`–`1.45` on UI labels/metadata (`text-pretty`), and `1.5` on prose capped around `max-w-[65ch]`.
- **Weights & Numerals:** Interface weights stay in `400`–`500` (`600` sparingly), sentence case everywhere (no all-caps tracked eyebrows), global `font-variant-numeric: tabular-nums`, and typographic ellipsis `…` (`…{key_hint}`).
- **Forms & Inputs (`components/ui/input.tsx`):** Inputs render at `16px` (`text-base`) below `md` to prevent iOS Safari zoom and `14px` (`md:text-sm`) on desktop, with explicit `name`, `inputMode`, `enterKeyHint`, `noValidate`, `aria-invalid`, and `aria-describedby` error association.

## Components, Modals & Alerts

- **Modals (`components/ui/dialog.tsx`, `components/ui/alert-dialog.tsx`):**
  - All form/detail overlays use centered `Dialog` modals (`AiPlanDialog`, `AiProvidersDialog`, `MemberDialog`), keeping `Sheet` solely for mobile `Sidebar` navigation.
  - Overdue/frozen manual check-ins (`TodayClient`, `MembersClient`), AI provider deletion (`AiProvidersDialog`), and signup/QR token rotation (`app/(admin)/settings/page.tsx`) use `AlertDialog` confirmations instead of native `window.confirm`.
- **Alerts (`components/ui/alert.tsx`):** Inline error and prerequisite notices (`AiPlanDialog`, `AiProvidersDialog`, `MemberProfile`, `MemberPay`) use shadcn `<Alert>` (`variant="destructive"` or semantic status surface).
- **Status Badges (`components/StatusBadge.tsx`):** `StatusBadge` pairs a `6px` semantic dot with accessible light/dark badge tokens (`Active` `#137333`/`#e6f4ea`, `Due` `#8a4b00`/`#fef7e0`, `Expired` `#b3261e`/`#fce8e6`, `Frozen` muted slate).
- **Motion:** Transitions target explicit properties (`transition-colors`, `transition-[transform,opacity]`) with `motion-reduce:animate-none` and `@media (prefers-reduced-motion: reduce)` fallbacks.
