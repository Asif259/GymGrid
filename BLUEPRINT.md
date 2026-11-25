# Gym System Blueprint

Replaces the paper notebook and the n8n idea. One gym, ~120 members.

Decisions (from owner answers, 2026-11-24):
- Build/ops agents: Claude Code project (this folder).
- Users: owner, trainers **and members**.
- WhatsApp: click-to-send `wa.me` links (owner taps to send; free, no Meta approval).
- Data: Supabase (Postgres + Auth + Edge Functions).
- Country: Bangladesh. Currency ৳, gym time Asia/Dhaka. bKash/Nagad instead of UPI.
- Online payment: member sends money to the gym's bKash/Nagad number and enters the TrxID; staff confirms.
- Members sign in by email link; first sign-in links to the member row with the same (confirmed) email.

## 1. Architecture

```
Members / Trainers / Owner
        |  (phone browser)
   Web app (Next.js or plain HTML, hosted on Vercel/Netlify free)
        |
   Supabase
     - Postgres: members, plans, payments, workout_plans, diet_plans
     - Auth: email magic link (SMS OTP costs money)
     - Row Level Security: member sees only own rows
     - Edge Functions: ai-trainer, generate-workout, generate-diet  --> Claude API
     - pg_cron: nightly status update (active -> due -> expired)
        |
   Claude Code (this folder, owner's Mac)
     - .claude/agents/*  : worker + verifier agents
     - scheduled task 07:00: gym-ops builds daily report + renewal links
```

Why two layers: members cannot use Claude Code. Runtime AI (trainer chat, plan
generators) lives in Supabase Edge Functions calling the Claude API. Claude Code
agents build the app, run daily ops, and verify work.

## 2. Features (both apps)

| Feature | Admin app (`web/index.html`) | Members app (`web/member.html`) |
|---|---|---|
| Register + subscribe | join form (phone, email, plan, paid now / pending) | — |
| Payments + receipts | verify TrxID & mark paid, renew (cash), receipt link | Pay: gym bKash/Nagad number, exact amount, TrxID form; Payments list |
| Receipts | `receipt.html?id=` printable, WhatsApp share | same page, own receipts only |
| QR attendance | `desk-qr.html` poster, Check in button, rotate QR | scan desk QR -> `member.html#checkin=token` -> checked in |
| Reminders | tap-to-send WhatsApp with renew link to members app | — |
| Plans | assign trainer, workout + diet from templates or typed | My plans |
| Dashboard | active, today's attendance, revenue today/month, pending, checked in without paying | Home: status, days left |

## 2b. n8n flows mapped

| n8n flow | Replacement |
|---|---|
| New member -> Google Sheet row | Join form in web app inserts into `members`; first `payments` row sets `expiry_date` |
| WhatsApp reminder 2 days before expiry | Daily report lists members with `expiry_date = today + 2`, each with a prefilled `wa.me` link |
| Payment status auto-update | Trainer taps "Mark paid" -> DB trigger extends `expiry_date` by plan months; pg_cron flips `status` nightly |
| Morning report to owner | `gym-ops` agent at 07:00 writes `reports/YYYY-MM-DD.md` (active, expiring, expired, pending payments) |

## 3. Data model (Supabase)

```sql
create table plans (
  id serial primary key,
  name text not null,            -- Monthly, Quarterly, Yearly, custom
  months int not null check (months > 0),
  price numeric(10,2) not null
);

create table members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users,   -- null until member signs up
  name text not null,
  phone text not null,                       -- E.164, e.g. 8801XXXXXXXXX
  plan_id int references plans,
  join_date date not null default current_date,
  expiry_date date,
  status text not null default 'active' check (status in ('active','due','expired','frozen')),
  goal text,                                 -- fat loss, muscle, fitness
  age int, sex text, height_cm int, weight_kg numeric,
  injuries text, diet_pref text,             -- veg, halal, allergies
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members on delete cascade,
  amount numeric(10,2) not null,
  method text,                               -- cash, bKash, card
  status text not null default 'pending' check (status in ('pending','paid')),
  period_start date, period_end date,
  paid_on date,
  recorded_by uuid references auth.users
);

create table workout_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members on delete cascade,
  plan jsonb not null,                       -- days -> exercises, sets, reps
  verified boolean not null default false,
  created_at timestamptz default now()
);

create table diet_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members on delete cascade,
  plan jsonb not null,                       -- target_kcal, macros, meals
  verified boolean not null default false,
  created_at timestamptz default now()
);
```

Added later (migrations 6-13): `gym_settings`, `attendance` (+ `paid_up` snapshot), `plan_templates`,
`members.email`, `members.trainer_id`, `staff.display_name`, `payments.trx_id`, `payments.receipt_no`,
functions `check_in(token)`, `claim_member()`, `checkin_qr_token()`, `rotate_checkin_token()`, `daily_report()`.

Nightly status rule (pg_cron, 00:01 Asia/Dhaka):
- `expiry_date < today` -> `expired`
- `expiry_date <= today + 2` -> `due`
- else `active`

## 4. AI features (Edge Functions -> Claude API)

| Function | Input | Output | Runtime check before save |
|---|---|---|---|
| `ai-trainer` | member profile + last plans + chat | chat reply | refuses medical diagnosis; flags injury questions to trainer |
| `generate-workout` | goal, level, days/week, equipment, injuries | JSON plan | schema valid; no exercise that loads an injured area; volume within limits |
| `generate-diet` | goal, weight, height, age, sex, diet_pref | JSON plan | calories within +-10% of Mifflin-St Jeor target; no listed allergen |

Customizable gym plans = owner edits `plans` table (name, months, price) from the admin page.

Model: Sonnet for chat and generators (cost), Haiku for the verify pass.
Plans save with `verified = false` until the check passes; trainer can override.

## 5. Agents (Claude Code)

Location: `Gym/.claude/agents/` (project-only, commit with the repo).
Global alternative: `~/.claude/agents/` (every project sees them).

| Agent | Role | Kind |
|---|---|---|
| `gym-ops` | daily report, renewal links, payment reconciliation | worker |
| `plan-coach` | writes and edits workout/diet prompts and templates | worker |
| `data-verifier` | checks DB rows, statuses and report numbers against SQL | verifier |
| `plan-safety-verifier` | checks generated plans for injuries, calories, allergens | verifier |
| `release-verifier` | before any deploy: RLS on, tests pass, no secrets committed | verifier |

Rule: a worker's output is "done" only after its verifier returns PASS.

## 6. Build order

1. DONE 2026-11-24. `supabase/migrations/` (core, cron, harden, grants), `supabase/seed.sql`, `staff` table
   (owner/trainer roles), triggers (mark paid -> expiry, expiry -> status), `daily_summary` view.
   Applied to hosted project `ddpeovltsddbomjwnsyl`. Check: `npm run verify:db` 20/20 PASS + hosted checks in
   `docs/verification/2026-11-24.md`.
2. DONE 2026-11-24. `web/` static admin page (magic-link login, stats, member list + filters, join form,
   mark paid, renew, WhatsApp link). Run: `npm run web` -> http://localhost:3000. Check: expiry extends on
   mark-paid (hosted DB, rolled-back transaction as trainer; output in `docs/verification/2026-11-24.md`).
   Page itself not deployed to a web host yet; plan editor not built.
3. DONE 2026-11-24. `daily_report()` SQL function (migration 5), "Send reminders today" card on admin page,
   `scripts/report-md.mjs` -> `reports/YYYY-MM-DD.md`, `gym-ops` agent uses Supabase MCP. Check: report counts =
   SQL counts (record in `docs/verification/2026-11-24.md`). 07:00 scheduled run not created yet.
4. DONE 2026-11-24. DB rules for member-written data: bKash/Nagad TrxID submit (server sets amount/status/dates),
   receipt numbers, QR check-in, confirmed-email claim, verified-only plans, dashboard numbers (migrations 6-13).
   Check: `npm run verify:db` 52/52 + hosted impersonation tests + data-verifier.
5. DONE 2026-11-24. Admin app: dashboard tiles, unpaid check-ins, verify TrxID, receipts, staff check-in,
   member details (email, trainer, plans), plan templates, owner settings, desk QR.
6. DONE 2026-11-24. Members app `web/member.html`. Check: `npm test`, browser logged-out render, QR decode,
   release-verifier. Signed-in screens need a real phone test.
7. Go live: host `web/` (Netlify/Cloudflare Pages, owner's account), set app URL in settings, add it to Supabase
   Auth Site URL + redirect URLs, print desk QR, test with one real member.
8. `generate-workout`, `generate-diet` + runtime checks. Check: `plan-safety-verifier` on 10 sample members.
9. `ai-trainer` chat in the members app. Check: RLS test, member A cannot read member B.
10. Import the real members (CSV) with emails. Check: row count matches the notebook.

## 7. Open items

- Payment gateway (bKash/Stripe webhook) would make "paid" fully automatic; now manual tap.
- Trainers can read all payments (revenue); hide if the owner wants revenue private.
- Members need an email to use the members app; phone-only members are checked in by staff.
- Daily report runs only while the owner's Mac is on. Move to Supabase pg_cron + email if that fails.
- Claude API key lives only in Supabase secrets, never in the web app.

## 8. Backend automation (2026-11-25)
Decisions: no payment gateway (UPI is not available in Bangladesh; "reconciliation" fires when staff confirm a payment),
WhatsApp stays tap-to-send, automatic messages go by email (nodemailer over SMTP), Sheets backup through a shared service account.

| Feature | Where |
|---|---|
| Outbox events (member created/updated, payment paid) | `automation_events`, triggers (migration 14, 20) |
| Receipt PDF stored privately + emailed once | Edge Function `automation` `/dispatch`, bucket `receipts` (15), `payments.receipt_emailed_at` (20) |
| Self-registration by link | `self_register()` + `signup_link_token()` (16, 20), `web/join.html` |
| Plan to many members | `assign_plan()` (17), bulk action in `web/app.js` |
| Streaks, revenue_total, yesterday's attendance, digest numbers | `my_streak()`, `daily_report()`, `owner_digest()` (17, 20) |
| Live dashboard + desk screen | Realtime publication (18), `web/desk.html`, `web/app.js` |
| 2-day expiry reminders by email | `/reminders`, cron `0 3 * * *` UTC + retries (19) |
| 8:00 Dhaka owner digest by email + wa.me link | `/digest`, cron `0 2 * * *` UTC (19) |
| Google Sheets backup | `/dispatch` Sheets upsert (needs `gym_settings.sheet_id` + service account) |

Status: migrations 14-18, 20, 21 and the function are live on the hosted project. NOT live: migration 19 (cron) and every secret
(SMTP, Google, AUTOMATION_SECRET, Vault entries). Nothing has sent a real email or touched a real Sheet yet.
Not built: payment gateway/webhook, WhatsApp auto-send, UPI, per-trainer revenue hiding.
