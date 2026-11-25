# automation function

Deno edge function. POST only. Every route requires header `x-automation-secret` equal to `AUTOMATION_SECRET` and must be deployed with `verify_jwt = false` (see `supabase/config.toml`): pg_net sends only that header.

## Routes
- `POST /automation/dispatch` - processes pending `automation_events` grouped/handled per `gym_id`. `payment.paid`: receipt PDF to bucket `receipts` at `<member_id>/<payment_id>.pdf`, sets `payments.receipt_path`, emails it when the member has an email, upserts Sheets rows. `member.created` / `member.updated`: upserts the Members row. Failures increment `attempts` and set `last_error`; after 5 attempts status becomes `failed`.
- `POST /automation/reminders` - loops over active/trial `gyms`, emails members expiring in 2 days with gym-scoped renewal links, logs to `reminder_log`.
- `POST /automation/digest` - loops over active/trial `gyms`, emails `owner_digest_for_gym(gym.id)` to each gym's owners (`gym_staff`) and `gyms.owner_digest_email`.

Sheets sync is skipped (logged) when a gym's `gyms.sheet_id` is empty. Tabs `Members` and `Payments`; Members upsert by member id and Payments by receipt number, both in column A. Share the sheet with the service account email.

## Function secrets
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from the runtime. Set:
- `AUTOMATION_SECRET`
- `SMTP_HOST`, `SMTP_PORT` (default 465, TLS), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (full key JSON)

## Vault entries (used by migration `20261126000019_automation_cron.sql`)
- `automation_url` - e.g. `https://<project>.supabase.co/functions/v1/automation`
- `automation_secret` - same value as `AUTOMATION_SECRET`

## Notes
- Dates: reminders and the digest use the Asia/Dhaka day (`gym_today()` in SQL, `Intl` in the function), not UTC.
- Receipt emails are at most once per payment: the run claims `payments.receipt_emailed_at` before sending and clears it if the send fails. Events are claimed with `claim_automation_events()`; a claim stuck for 10 minutes counts an attempt and 5 attempts end it as `failed`.
- Reminders: a failed send removes its `reminder_log` row and two extra cron passes (06:00 and 09:00 UTC) retry the same day.
- Reminders insert their `reminder_log` row first and delete it if the send fails.
- Digest WhatsApp link: no owner phone is stored, so the link opens WhatsApp's share picker.
