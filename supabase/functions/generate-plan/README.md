# generate-plan function

Member-triggered Deno Edge Function that generates a verified AI workout split or diet plan using the gym owner's configured AI providers (Google Gemini or OpenAI-compatible, stored encrypted in Supabase Vault).

## Auth & config
- Requires a valid Supabase member JWT (`verify_jwt = true` in `supabase/config.toml`).
- Looks up the caller's `members` row via `auth_user_id = auth.uid()`.
- Returns `409` (`ai_not_configured`) if the member's gym has no enabled `ai_providers`.
- Enforces 1 `source = 'ai'` plan per `kind` per member every 24 hours (`429`).
- Runs sequential failover across enabled providers (`priority` order), updating `cooldown_until` and `last_error` on provider failures (5 min for 429/5xx/timeout, 1 h for 401/403).
- Runs deterministic safety checks (`supabase/functions/_shared/plans.js`) with 1 automatic retry; returns `422` without saving if the plan still fails safety checks.

## Function secrets
Only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (provided automatically by the Supabase runtime) are required — provider API keys are managed by each gym owner in Settings and stored in Supabase Vault.
