---
name: Gym Admin (Rickshaw Enamel)
description: A painted tin sign for a neighbourhood gym desk. Deep green shell, cream ground, enamel plates for counts, vermilion only for money owed.
colors:
  rail-green: "#0f5132"
  rail-green-deep: "#0b3d26"
  rail-green-lift: "#1d6a47"
  cream-ground: "#f6f1e7"
  paper-plate: "#fffdf8"
  ink: "#1b1b1b"
  ink-soft: "#4f4b42"
  line: "#ddd3c0"
  line-strong: "#c9bda6"
  vermilion: "#d7261e"
  vermilion-wash: "#fbe9e7"
  ochre: "#f2b705"
  ochre-ink: "#7a4f00"
  focus-blue: "#1c4fa0"
  settled-wash: "#e3f1e8"
  white: "#ffffff"
  on-green: "#d4e6db"
  on-green-muted: "#b9d3c3"
  code-chip: "#ece4d2"
  dialog-scrim: "rgb(15 40 28 / .55)"
  print-ink: "#000000"
typography:
  display:
    fontFamily: "Alfa Slab One, Georgia, Times New Roman, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.15
  plate-numeral:
    fontFamily: "Alfa Slab One, Georgia, Times New Roman, serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.1
  section-title:
    fontFamily: "Alfa Slab One, Georgia, Times New Roman, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Bengali, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Bengali, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.45
  button:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Bengali, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.45
  caption:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Bengali, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.45
  small:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Bengali, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  phone-title:
    fontFamily: "Alfa Slab One, Georgia, Times New Roman, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.15
  login-title:
    fontFamily: "Alfa Slab One, Georgia, Times New Roman, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.25
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  plate: "6px"
  control: "8px"
  focus: "4px"
  keyline: "3px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.rail-green}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.rail-green}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.rail-green-lift}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.vermilion}"
    rounded: "{rounded.control}"
    height: "44px"
  plate:
    backgroundColor: "{colors.paper-plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "12px 14px"
    height: "104px"
  plate-green:
    backgroundColor: "{colors.rail-green}"
    textColor: "#ffffff"
    rounded: "{rounded.plate}"
  card:
    backgroundColor: "{colors.paper-plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "16px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  pill:
    textColor: "{colors.rail-green}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  rail:
    backgroundColor: "{colors.rail-green}"
    textColor: "#d4e6db"
    width: "216px"
---

# Design System: Gym Admin (Rickshaw Enamel)

## Overview

**Creative North Star: "The Painted Tin Sign"**

The admin app reads as the shop's own enamel signboard, not a SaaS panel. A deep green shell frames a cream ground; every count sits on a painted plate with a heavy ink border and a thin inset keyline; one hot colour, vermilion, is spent on money owed and nothing else. Everything settled stays quiet green or ink. The world lives in palette, plates and type. There is no ornament, illustration or pattern.

Density is working-desk density: 56px list rows, 44px touch targets, one tap per action (verify a TrxID, check in, send WhatsApp). Phone and desk are equal targets. On phone a green top bar and a bottom tab rail carry the shell; at 900px and up the rail becomes a fixed 216px left column.

**Key Characteristics:**
- Green shell, cream ground, paper-white plates and cards.
- Slab display face only for titles, the brand, and plate numerals; everything else is the system font.
- Vermilion means "money owed or expired", never decoration.
- Ochre marks selection and the active nav icon; the keyboard focus ring is blue for contrast.
- Tabular numerals everywhere (body sets `font-variant-numeric: tabular-nums`).
- Light mode only (`color-scheme: light`).

## Colors

A restrained five-voice palette: green shell, cream ground, ink text, vermilion for debt, ochre for marks. Values live in the frontmatter.

### Primary
- **Rail Green** (`rail-green`): the shell. Rail and phone header, primary buttons, link colour, the green plate, outlined secondary buttons, h1 colour, checkbox accent, caret. Deep and lift variants (`rail-green-deep`, `rail-green-lift`) serve the green plate border, ok-message text, and primary-button hover.

### Secondary
- **Vermilion** (`vermilion`): money owed and bad states only. The `.owed` plate numeral, `.sub.owed` lines, the alert card border and heading ("Came in without paying"), the EXPIRED status pill, danger buttons, error messages and the failed check-in result. Its wash (`vermilion-wash`) backs error messages and the bad result.

### Tertiary
- **Ochre** (`ochre`): focus-adjacent marks only. Active rail icon stroke, the text-selection background, the 4px rule under the phone header, the rail focus ring, and a 55% translucent halo around focused form fields. Never fills a button or surface. **Ochre Ink** (`ochre-ink`) is the legible text form, used for the DUE status pill.
- **Focus Blue** (`focus-blue`): the keyboard focus ring (3px outline, 2px offset) and the FROZEN status pill. Chosen over ochre for contrast against cream and paper.

### Neutral
- **Cream Ground** (`cream-ground`): page background.
- **Paper Plate** (`paper-plate`): plates, cards, dialogs, stat boxes. Inputs use pure white.
- **Ink** (`ink`) and **Ink Soft** (`ink-soft`): body text and secondary text/labels. Placeholder text is a one-off `#6b665a`.
- **Line** (`line`) and **Line Strong** (`line-strong`): list dividers and card borders; input borders.
- **Settled Wash** (`settled-wash`): hover fill on outlined buttons, ok messages, successful check-in result.

### Named Rules
**The Money-Owed Rule.** Vermilion appears only where someone owes money or a membership has lapsed. If a thing is merely important, it is not vermilion.

**The Focus-Is-Blue Rule.** Ochre decorates focus-adjacent state (active nav, selection, header rule); the actual focus ring is blue `#1c4fa0`. Do not swap them.

## Typography

**Display Font:** Alfa Slab One (Latin subset, self-hosted woff2, `font-display: swap`; fallback Georgia, Times New Roman, serif)
**Body Font:** system-ui stack (system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Bengali, sans-serif)

**Character:** A sign-painter's slab for the few things that are lettered on the sign, against a plain system face for everything that is read or typed. Alfa Slab One has one weight, so `font-synthesis: none` is set on every use; never request bold on it.

### Hierarchy
- **Display** (400, 24px, 1.15): page title `h1`, in green. Welcome page hero scales to `clamp(32px, 5vw, 52px)`.
- **Plate numeral** (400, 32px, 1.1): the count or amount on a plate. Welcome-page mini plates use 24px.
- **Section title** (400, 17px, 1.25): card `h2`. The brand in the rail is 20px; the sign-in `h2` is 22px; `.big` result text is 26px.
- **Body** (400, 16px, 1.45): default. Secondary lines are 14px in ink-soft.
- **Label** (700, 13px): plate captions and notes, form labels (14px/600), table heads.
- **Button** (700, 15px): all buttons and `.btn` links.
- **Status pill** (800, 12px, +0.04em, uppercase): the only uppercase text in the app.

### Named Rules
**The Plates-Only Rule.** The slab face is for titles, the brand, and plate numerals. Names, rows, buttons, labels and form text stay on the system font.

**Mono for copyable data.** A system monospace stack (`ui-monospace`, `SF Mono`, Menlo) sets exactly two things: the bKash/Nagad number a member copies (`.copy`, 18px) and inline `code` in help text (`.92em` on a `#ece4d2` chip). It is never used for labels, buttons or body text.

**The Taka Fallback Rule.** The Taka sign (U+09F3) is not in the Latin subset and falls back to the system font. It is accepted behaviour, so do not rely on the slab face to render it.

## Layout

Single column on phone (main max 1120px, 16px padding, 96px bottom clearance for the 64px tab rail); at 900px and up a two-column shell (216px sticky rail, content with 24px / 32px padding). Spacing runs on an 8px pitch with 4, 12, 16, 24 and 32 as the other steps. Plates are a 2-column grid on phone (the revenue plate spans both) and a 6-column row on desk. Action lists sit in two columns (`1fr 1fr`) on desk, stacked on phone. Forms use auto-fit grids with a 190px minimum.

Members list row: on phone, info lines then actions, with secondary actions behind a More button and the primary action full width. On desk (900px and up), a four-column grid (210px, 120px, 150px, flexible) with every action shown.

Print hides the rail, header and toasts and drops card borders and shadows.

## Elevation & Depth

Mostly flat with two deliberate lifts. Cards carry a soft ambient shadow; plates carry a 2px hard-ish ground shadow plus a diffuse one so they sit like mounted tin. Depth otherwise comes from borders and tonal layering (paper on cream).

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgb(27 27 27 / .10), 0 4px 12px rgb(27 27 27 / .06)`): cards, resting.
- **Plate** (`box-shadow: 0 2px 0 rgb(27 27 27 / .12), 0 6px 14px rgb(27 27 27 / .08)`): enamel plates.
- **Button hover** (`box-shadow: 0 3px 8px rgb(27 27 27 / .12)`): with a 1px upward lift.
- **Phone rail** (`box-shadow: 0 -2px 12px rgb(0 0 0 / .18)`): bottom tab rail only; none on desk.

### Named Rules
**The Mounted-Plate Rule.** A plate is an ink border, an inset 1px keyline at 22% opacity and a ground shadow. Do not add gradients or glossy effects.

## Shapes

Gently squared. Controls, cards, dialogs and nav items use 8px; plates use 6px with a 3px inset keyline; the focus ring corner is 4px; status pills are fully round. Borders are the structure: 2px for plates, controls and inputs, 1px for list dividers and card edges. Cards in alert state take a 2px vermilion border.

## Components

### Buttons
- **Shape:** 8px radius, 44px minimum height, 2px border, no wrapping.
- **Secondary (default):** transparent with green text and green border.
- **Primary:** solid green, white text; hover shifts to the lighter green.
- **Danger:** vermilion text and border.
- **Hover / Active:** settled-wash fill, 1px lift and soft shadow; presses 1px down. Disabled drops to 55% opacity. Pressed toggles (`aria-pressed`) go solid green.
- **WhatsApp:** a button with a masked 18px chat glyph prefix (`.wa`).
- **List actions** (`.item .go`) have a 136px minimum width.

### Plates (signature)
Counts live here. Paper ground, 2px ink border, 6px radius, 104px minimum height, grid of caption, numeral, note. Green variant inverts to white text on green. The owed variant turns the numeral vermilion. The revenue plate spans two columns. Plates animate in with a short rise-and-fade (`paint`, 0.35s, staggered 50ms), disabled under reduced motion.

### Cards / Containers
Paper background, 1px line border, 8px radius, 16px padding, 16px bottom margin, card shadow. Alert variant (`.card.alert`): 2px vermilion border and vermilion title.

### Lists and Member Rows
56px minimum row with 1px line dividers. Name in bold, sub line in 14px ink-soft; owed sub lines go bold vermilion. A settled member's name dims to ink-soft.

### Status Pills
Uppercase 12px outlined pills with a 1.5px current-colour border: ACTIVE green, DUE ochre-ink, EXPIRED vermilion, FROZEN blue.

### Inputs / Fields
44px height, 2px line-strong border, 8px radius, white. Hover darkens the border to ink-soft. Focus turns the border green and adds a 3px ochre halo at 55%. Labels sit above in 14px/600 ink-soft. Search fields carry a 20px inline icon.

### Navigation
Green rail. Phone: bottom tab bar, 64px, icon over a 12px label. Desk: fixed left column with brand in slab, date, and row items of 24px icon plus 15px label. Hover lifts to the lighter green; the active item is a white-14% tint with an ochre icon stroke. Rail focus ring is ochre (inset). On phone the header is green with a 4px ochre bottom rule.

### Messages and Dialogs
Messages: 2px border, 8px radius; error in vermilion wash, ok in settled wash. Dialogs: paper, 2px ink border, 8px radius, backdrop dark green at 55%.

## Do's and Don'ts

### Do:
- **Do** put every count on a plate, and keep the slab face to titles, the brand and plate numerals.
- **Do** use vermilion only for money owed, EXPIRED and never-paid states, and failures.
- **Do** keep the blue focus ring on all interactive elements; use ochre for selection, active nav and the phone header rule.
- **Do** keep targets at 44px minimum and list rows at 56px.
- **Do** set `font-synthesis: none` wherever Alfa Slab One is used.

### Don't:
- **Don't** use a grey sidebar, white KPI cards, or SaaS dashboard chrome.
- **Don't** add flowers, peacocks, patterns or other ornament; the world is palette, plates and type.
- **Don't** fill surfaces or buttons with ochre.
- **Don't** use bold on the display face, or use it for body copy, row names or buttons.
- **Don't** use vermilion for emphasis that is not about debt or a lapsed membership.

### Known gaps (not canonized)
- Desk Members rows with four actions can wrap; not yet fixed.
- Add, Plans, Settings and the members-app tabs were never visually reviewed.
- No logo or brand colours exist; "Our Gym" is a placeholder from `gym_settings`.
- Build carries `.plate.wide` redeclared in a desk media query with the same span (harmless duplicate), and inline `style=` on some elements; neither is a system rule.
