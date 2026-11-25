# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Owner** of one small gym in Bangladesh (~120 members). Runs the front desk and the money. Uses the admin app on a
  phone on the floor and on a laptop/tablet at the reception desk, equally.
- **Trainers** (staff): register members, check them in, confirm payments, assign workout and diet plans.
- **Members**: use the members app on their own phones, mostly at the gym: scan the desk QR to check in, pay by
  bKash/Nagad, see their plans, receipts and visits.

## Product Purpose
Replace the paper register. Nobody should train without paying, no expiry should be missed, and the owner should know
active members, today's attendance, revenue and pending payments at a glance. Success: the owner stops using the notebook.

## Positioning
Built for how a Bangladeshi neighbourhood gym actually runs: bKash/Nagad Send Money with a TrxID the desk confirms,
tap-to-send WhatsApp reminders, a printed QR at the desk, and a "checked in without paying" list. No payment gateway,
no SMS costs, no app store.

## Operating Context
- Front desk with a printed check-in QR poster; members scan with the phone camera.
- Payments: cash at the desk, or bKash/Nagad Send Money to the gym's number; staff check their bKash/Nagad app for the
  TrxID before confirming. Receipts are printed or sent on WhatsApp.
- Morning report generated at 07:04 Dhaka time into `reports/`; renewal reminders are WhatsApp links the owner taps.
- Gym time zone Asia/Dhaka; currency ৳ (Taka).

## Capabilities and Constraints
- Backend: Supabase (Postgres + RLS + Auth email links). Schema and rules in `supabase/migrations/`, summary in `BLUEPRINT.md`.
- Frontend: plain static HTML/CSS/ES modules in `web/`, supabase-js from CDN, no build step. Pages: `index.html` (admin),
  `member.html` (members app), `receipt.html`, `desk-qr.html`.
- Member statuses: active, due (ends within 2 days or never paid), expired, frozen.
- Members only submit pending bKash/Nagad payments; amount, dates, receipt number are set by the database.
- Members sign in with the email staff recorded; members without email are checked in by staff.
- Plans (workout/diet) are written by staff as plain lines or picked from templates; AI generation is a later step.
- UI language: English.

## Brand Commitments
No name, logo or colors yet. "Our Gym" is a placeholder, editable in Gym settings (`gym_settings.name`). Nothing to preserve.

## Evidence on Hand
Demo data only (5 fictional "Demo" members with 555 phone numbers). No real member data, testimonials, photos or logo.
Do not fabricate any.

## Product Principles
1. Money truth first: who paid, who didn't, what's pending is never ambiguous.
2. One-hand, one-glance: the busiest moments (desk check-in, confirming a payment) take one tap on a phone.
3. Works on a cheap Android phone on mobile data: light pages, no heavy assets.
4. The member always knows their status and exactly what to do next (pay how much, to which number).
5. Nothing is sent without a human tap.

## Accessibility & Inclusion
Sunlit gym floor and low-end phones: strong contrast, large tap targets, readable at arm's length. WCAG 2.2 AA.
