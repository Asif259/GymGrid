---
name: Gym Admin (Crisp Neutral Graphite)
description: Neutral off-white/slate operations ledger for a neighbourhood gym desk with a single forest-green accent and semantic vermilion reserved strictly for money owed or expired memberships.
colors:
  bg: "#fafafa"
  surface: "#ffffff"
  surface-raised: "#f4f4f5"
  surface-rail: "#f4f4f5"
  ink: "#171717"
  ink-secondary: "#525252"
  ink-muted: "#737373"
  hairline: "rgb(23 23 23 / 0.08)"
  hairline-strong: "rgb(23 23 23 / 0.16)"
  accent: "#0f5132"
  accent-hover: "#146c43"
  accent-ink: "#0b3d26"
  accent-soft: "rgb(15 81 50 / 0.08)"
  positive: "#15803d"
  positive-bg: "#f0fdf4"
  warning: "#b45309"
  warning-bg: "#fffbeb"
  danger: "#dc2626"
  danger-ink: "#991b1b"
  danger-bg: "#fef2f2"
  frozen: "#475569"
  frozen-bg: "#f1f5f9"
typography:
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Bengali, sans-serif"
    weights: [400, 500, 600]
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
  scale:
    meta: { fontSize: "0.75rem", lineHeight: 1.35, weight: 500 }
    caption: { fontSize: "0.8125rem", lineHeight: 1.4, weight: 400 }
    ui: { fontSize: "0.875rem", lineHeight: 1.4, weight: 500 }
    body: { fontSize: "1rem", lineHeight: 1.5, weight: 400 }
    heading: { fontSize: "1.125rem", lineHeight: 1.3, weight: 600 }
    title: { fontSize: "1.5rem", lineHeight: 1.2, weight: 600 }
    figure: { fontSize: "1.75rem", lineHeight: 1.1, weight: 600 }
    figure-hero: { fontSize: "2rem", lineHeight: 1.05, weight: 600 }
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
layout:
  railWidth: "248px"
  maxContentWidth: "1440px"
  rowMinHeight: "52px"
  mobileControlHeight: "44px"
  desktopControlHeight: "36px"
---

# Design System: Gym Admin (Crisp Neutral Graphite)

## Overview

**Creative North Star: "Desk Operations Ledger"**

A light-mode, neutral graphite operations console built for front-desk speed and sunlit legibility. Chrome, navigation, and secondary controls stay quiet so the content carries the signal: daily revenue leads the top summary strip, a 7-day check-in pulse anchors today's activity alongside one-tap quick check-in, and urgent actions (unpaid check-ins, TrxID verifications) lead over renewal reminders.

**Key Characteristics:**
- Neutral graphite surfaces (`#fafafa` ground, `#ffffff` cards, `#f4f4f5` rail and raised tint) with `1px` hairlines (`rgb(23 23 23 / 0.08)`).
- Single forest-green accent (`#0f5132`) for primary actions, active navigation icon, and the hero revenue metric / today bar.
- Semantic vermilion (`#dc2626`) used strictly for money owed, expired memberships, and errors.
- Clean sans-serif (`Inter` / system stack) in weights `400`, `500`, and `600`, paired with tabular monospace for TrxIDs, receipt numbers, phone/copy codes, and chart/meta labels.
- Light mode only (`color-scheme: light`).

## Layout & Adaptivity

- **Shell:** On desktop (`900px` and up), a `248px` sticky sidebar (`100dvh`) with `36px` nav rows (`2px` gap) beside a fluid `minmax(0, 1fr)` content area capped at `1440px` (`24px` block, `32px` inline padding). On mobile (`< 900px`), a sticky blurred top bar and a fixed bottom tab rail with `env(safe-area-inset-bottom)` (`viewport-fit=cover`) and `scroll-padding-block-start` on `html`.
- **Today Hierarchy:**
  - `.metrics`: asymmetric summary strip where `Revenue today` spans full width on phone and `1.55fr` on desktop alongside four compact metrics (`Checked in today`, `Active members`, `Pending payments`, `Expired`).
  - `.today-band`: `1.35fr` 7-day check-in pulse chart paired with `1fr` quick check-in search in natural DOM order.
  - `.cols`: `1.35fr` primary action queue (`Came in without paying`, `Payments to confirm`) paired with `1fr` reminder lists (`Ends in 2 days`, `Expired in last 30 days`).
- **Container Queries:** `#member-rows` runs inside `.members-region` (`container-type: inline-size; container-name: members`). Below `760px`, rows stack cleanly with an explicit `"Show N more"` / `"Hide extra actions"` disclosure button; at `760px` and above, rows align into four columns without wrapping buttons.
- **Logical Properties:** Direction-dependent spacing, borders, alignment, and offsets use logical properties (`padding-inline`, `margin-block`, `inset-inline-start`, `text-align: start|end`).

## Typography

- **Scale (`rem`):** `0.75rem` meta, `0.8125rem` caption, `0.875rem` UI, `1rem` body (`1.5` unitless line-height), `1.125rem` `h2`, `1.5rem` `h1` (`-0.015em` tracking), `1.75rem`–`2rem` tabular KPI figures.
- **Rules:** Weights stay within `400`–`600`; sentence case everywhere; `text-wrap: balance` on headings; `text-wrap: pretty` on paragraphs/descriptions; `overflow-wrap: break-word` on member names and sublines; `font-variant-numeric: tabular-nums` globally; inputs render at `16px` (`1rem`) below `640px` to prevent iOS Safari zoom and `14px` (`0.875rem`) at `640px` and up; root font smoothing applied once on `:root`.

## Components & Motion

- **Controls:** `8px` radius, `36px` height on desktop (`44px` on mobile touch targets). Primary buttons use solid `#0f5132` with a subtle `1px` top highlight; secondary buttons use white surface with `1px` hairline border; quiet buttons are borderless until hover.
- **Status Tags (`.pill`):** `6px` radius, `12px` sentence-case label with a `6px` semantic dot (`Active` green, `Due` amber, `Expired` vermilion, `Frozen` slate) and `text-box: trim-both cap alphabetic`.
- **Icons:** Uniform `16px`/`18px` inline SVG sprite at `1.5` stroke weight inheriting text role color.
- **Motion:** Single easing curve `cubic-bezier(0.22, 1, 0.36, 1)` transitioning only `background-color`, `border-color`, `color`, and `transform` (`scale(0.98)` on press), disabled under `prefers-reduced-motion: reduce`.
