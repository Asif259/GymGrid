---
name: Gym Admin (Ice Tonal Workspace)
description: Material 3-inspired ice-blue canvas (#F0F4F9), seamless sidebar, pure white floating cards (#FFFFFF), soft sky active nav pills (#C2E7FF / #001D35), and Material 3 Blue (#0B57D0) primary CTAs.
colors:
  bg: "#f0f4f9"
  surface: "#ffffff"
  surface-raised: "#e8eef6"
  surface-rail: "#f0f4f9"
  ink: "#1f1f1f"
  ink-secondary: "#444746"
  ink-muted: "#444746"
  hairline: "#e1e3e1"
  hairline-strong: "#c4c7c5"
  accent: "#0b57d0"
  accent-hover: "#0842a0"
  accent-ink: "#001d35"
  accent-soft: "#c2e7ff"
  nav-active-bg: "#c2e7ff"
  nav-active-ink: "#001d35"
  positive: "#137333"
  positive-bg: "#e6f4ea"
  warning: "#b06000"
  warning-bg: "#fef7e0"
  danger: "#c5221f"
  danger-ink: "#8c1d18"
  danger-bg: "#fce8e6"
  frozen: "#444746"
  frozen-bg: "#eef2f6"
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
  pill: "999px"
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

# Design System: Gym Admin (Ice Tonal Workspace)

## Overview

**Creative North Star: "Ice Tonal Operations Ledger"**

A light-mode workspace built on a cool ice-blue canvas (`#f0f4f9`) with a seamless sidebar and pure white floating cards (`#ffffff`) separated by subtle `#e1e3e1` borders and soft elevation. Primary actions use Material 3 Blue (`#0b57d0`), active navigation and selected filter pills use Soft Sky (`#c2e7ff` with `#001d35` ink), and semantic red (`#c5221f`) is reserved strictly for money owed, expired memberships, and errors.

**Key Characteristics:**
- Ice-tonal canvas (`#f0f4f9`) and seamless left rail (`#f0f4f9`) framing pure white cards (`#ffffff`) with `#e1e3e1` borders.
- Soft Sky (`#c2e7ff`) pill with `#001d35` text for the active navigation item and pressed filter tabs.
- Material 3 Blue (`#0b57d0`) for primary CTAs, the hero revenue numeral, and today's pulse bar.
- Clean sans-serif (`Inter` / system stack) in weights `400`, `500`, and `600`, paired with tabular monospace for TrxIDs, receipt numbers, phone/copy codes, and chart/meta labels.
- Light mode only (`color-scheme: light`).

## Layout & Adaptivity

- **Shell:** On desktop (`900px` and up), a `248px` sticky seamless sidebar (`100dvh`) with `40px` pill nav rows (`2px` gap) beside a fluid `minmax(0, 1fr)` content area capped at `1440px` (`24px` block, `32px` inline padding). On mobile (`< 900px`), a sticky blurred `#f0f4f9` top bar and a fixed white bottom tab rail with `env(safe-area-inset-bottom)` (`viewport-fit=cover`) and `scroll-padding-block-start` on `html`.
- **Today Hierarchy:**
  - `.metrics`: asymmetric summary strip where `Revenue today` spans full width on phone and `1.55fr` on desktop alongside four compact counts (`Checked in today`, `Active members`, `Pending payments`, `Expired`).
  - `.today-band`: `1.35fr` 7-day check-in pulse chart paired with `1fr` quick check-in search in natural DOM order.
  - `.cols`: `1.35fr` primary action queue (`Came in without paying`, `Payments to confirm`) paired with `1fr` reminder lists (`Ends in 2 days`, `Expired in last 30 days`).
- **Container Queries:** `#member-rows` runs inside `.members-region` (`container-type: inline-size; container-name: members`). Below `760px`, rows stack cleanly with an explicit `"Show N more"` / `"Hide extra actions"` disclosure button; at `760px` and above, rows align into four columns without wrapping buttons.
- **Logical Properties:** Direction-dependent spacing, borders, alignment, and offsets use logical properties (`padding-inline`, `margin-block`, `inset-inline-start`, `text-align: start|end`).

## Typography

- **Scale (`rem`):** `0.75rem` meta, `0.8125rem` caption, `0.875rem` UI, `1rem` body (`1.5` unitless line-height), `1.125rem` `h2`, `1.5rem` `h1` (`-0.015em` tracking), `1.75rem`–`2rem` tabular KPI figures.
- **Rules:** Weights stay within `400`–`600`; sentence case everywhere; `text-wrap: balance` on headings; `text-wrap: pretty` on paragraphs/descriptions; `overflow-wrap: break-word` on member names and sublines; `font-variant-numeric: tabular-nums` globally; inputs render at `16px` (`1rem`) below `640px` to prevent iOS Safari zoom and `14px` (`0.875rem`) at `640px` and up; root font smoothing applied once on `:root`.

## Components & Motion

- **Controls:** `8px` radius, `36px` height on desktop (`44px` on mobile touch targets). Primary buttons use solid `#0b57d0` (`#0842a0` hover); secondary buttons use white surface with `#c4c7c5` border; quiet buttons are borderless until hover; active filter/tab buttons use `#c2e7ff` with `#001d35` ink.
- **Status Tags (`.pill`):** `6px` radius, `12px` sentence-case label with a `6px` semantic dot (`Active` green, `Due` amber, `Expired` red, `Frozen` slate) and `text-box: trim-both cap alphabetic`.
- **Icons:** Uniform `16px`/`18px` inline SVG sprite at `1.5` stroke weight inheriting text role color.
- **Motion:** Single easing curve `cubic-bezier(0.22, 1, 0.36, 1)` transitioning only `background-color`, `border-color`, `color`, and `transform` (`scale(0.98)` on press), disabled under `prefers-reduced-motion: reduce`.
