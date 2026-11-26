# ai-admin function

Owner-only Deno Edge Function for configuring gym AI providers (Google Gemini and OpenAI-compatible endpoints).

## Auth
Requires a valid Supabase JWT (`verify_jwt = true` in `supabase/config.toml`) belonging to an `owner` in `gym_staff` for the target `gym_id`.

## Actions (`POST /functions/v1/ai-admin`)
- `status`: returns `ai_providers` metadata (never keys or `secret_id`).
- `test`: validates URL (SSRF guard), lists models from the provider, and returns `{ ok: true, model, models }`.
- `models`: returns `{ models, recommended }` for model override dropdowns.
- `save`: validates URL/inputs and calls `save_ai_provider` RPC (stores API key encrypted in Supabase Vault).
