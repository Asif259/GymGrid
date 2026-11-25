# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web (Next.js App Router PWA with responsive desktop floating sidebar and mobile fixed bottom navbar)

## Users
- **Owner & Staff**: Gym owner and trainers running the gym. Manage daily desk check-ins, member directory, workout/diet plans, pricing, settings, and payment verifications via the **Admin Portal** (`/admin`).
- **Members**: Gym members accessing the portal primarily on mobile (also desktop) via the **Member App** (`/`, also alias `/member`): scan desk QR codes to check in, submit renewal payments via bKash/Nagad TrxID, view workout and diet plans, track visit streaks, and download payment receipts.
- **Prospective Members**: Visitors registering online through self-registration links (`/join` and `/join/[gymSlug]`).

## Product Purpose
Replace the paper register. Nobody should train without paying, no expiry should be missed, and the owner should know active members, today's attendance, revenue, and pending payments at a glance. Both members and owners have a unified, clean, responsive dashboard experience.

## Positioning
Built for how neighbourhood gyms actually operate in Bangladesh: bKash/Nagad Send Money with TrxID submission confirmed by front-desk staff, tap-to-send WhatsApp renewal reminders, printed QR desk posters, and a live "checked in without paying" attendance monitor. No third-party payment gateway fees, no SMS costs, and no native app store dependency.

## Operating Context
- Front desk with a printed check-in QR poster (`/desk-qr`); members scan with their phone camera to check in (`/checkin`).
- Real-time front-desk reception screen (`/desk`) displaying check-ins and payment alerts.
- Payments: cash at the desk, or bKash/Nagad Send Money to the gym's registered number. Members submit the TrxID via the Renew/Pay dashboard view; staff verify the TrxID in their mobile wallet before approving.
- Receipts: generated automatically on payment confirmation, accessible online (`/receipt?id=...`), or downloadable as PDF.
- Morning report generated at 07:04 Dhaka time into `reports/`; renewal reminders are WhatsApp links staff can tap directly.
- Time zone: `Asia/Dhaka`; currency: `৳` (BDT Taka).

## Capabilities and Constraints
- **Architecture & Tech Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, Lucide icons, Recharts, and Sonner toasts.
- **Backend & Database**: Supabase (Postgres + Row-Level Security (RLS) + Auth email magic links + Storage for receipts). Schema and migrations in `supabase/migrations/`.
- **Unified Responsive Shell (`DashboardShell`)**:
  - **Desktop (`>= 768px`)**: Floating collapsible sidebar navigation with brand header and profile footer.
  - **Mobile (`< 768px`)**: Fixed bottom navigation bar (`grid-cols-4` or `grid-cols-5`) with safe-area padding (`env(safe-area-inset-bottom)`) and `min-h-11`/`min-h-14` tap targets.
- **Routes & Views**:
  - **Member Portal (`/`, alias `/member`)**: Default homepage. 5 unified dashboard views:
    - *Overview*: Quick status badge, membership KPIs, today's check-in status, attendance pulse chart, trainer info, workout/diet preview.
    - *Plans*: Workout routine and diet plan details, assigned trainer contact, and available gym membership plans.
    - *Renew / Pay*: Mobile wallet details (bKash/Nagad numbers with auto-detection), plan pricing, and TrxID submission form locked by RLS.
    - *Visits*: 4-card streak stats, 14-day attendance pulse chart, and chronological check-in history.
    - *Receipts*: Pending verification queue and paid receipt list with signed PDF downloads.
    - *Profile Sheet*: Slide-over sheet displaying member details, join date, emergency contacts, and sign-out.
  - **Admin Dashboard (`/admin`)**: Operations hub for owners and staff (`/admin` today overview, `/members` directory, `/add` member, `/plans` templates, `/settings` gym configuration).
  - **Utility Routes**: `/checkin` (QR check-in handler), `/join` & `/join/[gymSlug]` (public sign-up), `/desk` (live desk screen), `/desk-qr` (printable QR poster), `/receipt` (public receipt viewer), `/welcome` (onboarding welcome), `/onboarding` (SaaS gym setup).
- **Security & Data Integrity**:
  - Profiles are read-only for members via `members_self_read`.
  - Payment submissions are strictly validated and locked to `member.plan_id` via Postgres trigger `payments_guard()`.
  - Gym plans readable via `plans_read` RLS.
- **Member Statuses**: `active`, `due` (expires within 2 days or never paid), `expired`, `frozen`.

## Brand Commitments
Dynamic multi-tenant gym branding: gym name, logo, phone, address, and mobile wallet numbers configurable in gym settings. Supports dark and light themes seamlessly.

## Product Principles
1. **Money truth first**: Who paid, who didn't, and what's pending verification is always unambiguous.
2. **Unified, professional dashboard UX**: Both owner and member experiences follow consistent layout, typography, status badges, and mobile-first ergonomics.
3. **One-hand, one-glance**: Critical actions (desk check-in, verifying payments, logging attendance) take a single tap with accessible touch targets.
4. **Mobile network resilience**: Zero horizontal overflow, lightweight pages, safe-area inset support, and responsive data visualization that renders smoothly on low-end mobile devices.
5. **Human-in-the-loop**: Reminders and confirmations are verified and dispatched with human approval.

## Accessibility & Inclusion
Optimized for bright gym floors and mobile screens: WCAG 2.2 AA compliant contrast, 16px minimum font size on mobile inputs to avoid iOS auto-zoom, minimum 44px tap targets, `tabular-nums` for currencies/dates, and keyboard/screen-reader accessibility throughout.
