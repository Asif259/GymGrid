// Owner-only AI provider management function: test connection, fetch models, save to Vault via RPC, list status.
// Never returns or logs API keys.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  assertSafeBaseUrl,
  GEMINI_BASE_URL,
  listModels,
  pickModel,
  ProviderError,
} from '../_shared/llm.js';

const env = (k: string) => Deno.env.get(k) ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server is not configured' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'Missing authorization token' }, 401);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userRes, error: authErr } = await db.auth.getUser(token);
  if (authErr || !userRes?.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400);
  }

  const gymId = typeof body?.gym_id === 'string' ? body.gym_id.trim() : '';
  if (!UUID_RE.test(gymId)) {
    return json({ error: 'Valid gym_id is required' }, 400);
  }

  // Verify caller is an owner of this gym.
  const { data: staffRow, error: staffErr } = await db
    .from('gym_staff')
    .select('role')
    .eq('gym_id', gymId)
    .eq('user_id', userRes.user.id)
    .eq('role', 'owner')
    .maybeSingle();

  if (staffErr) {
    console.error('owner check error:', staffErr.message);
    return json({ error: 'Failed to verify gym ownership' }, 500);
  }
  if (!staffRow) {
    return json({ error: 'Owner access required' }, 403);
  }

  const action = body?.action;

  if (action === 'status') {
    const { data: providers, error } = await db
      .from('ai_providers')
      .select('id, gym_id, kind, label, base_url, model, enabled, priority, cooldown_until, last_error, key_hint, created_at')
      .eq('gym_id', gymId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      return json({ error: 'Failed to load AI providers' }, 500);
    }
    return json({ providers: providers ?? [] });
  }

  if (action === 'test' || action === 'models') {
    const kind = body?.kind;
    if (kind !== 'gemini' && kind !== 'openai_compat') {
      return json({ error: 'kind must be "gemini" or "openai_compat"' }, 400);
    }

    let rawUrl = typeof body?.base_url === 'string' ? body.base_url.trim() : '';
    if (kind === 'gemini' && !rawUrl) rawUrl = GEMINI_BASE_URL;

    let safeUrl: string;
    try {
      safeUrl = assertSafeBaseUrl(rawUrl);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Invalid base URL' }, 400);
    }

    let apiKey = typeof body?.api_key === 'string' ? body.api_key.trim() : '';
    if (!apiKey && typeof body?.provider_id === 'string' && UUID_RE.test(body.provider_id)) {
      const { data: existing } = await db
        .from('ai_providers')
        .select('id')
        .eq('id', body.provider_id)
        .eq('gym_id', gymId)
        .maybeSingle();
      if (existing) {
        const { data: decrypted } = await db.rpc('get_ai_provider_key', { p_id: existing.id });
        if (typeof decrypted === 'string') apiKey = decrypted;
      }
    }

    if (!apiKey) {
      return json({ error: 'API key is required to test connection' }, 400);
    }

    try {
      const models = await listModels({ kind, base_url: safeUrl, apiKey });
      const recommended = pickModel(kind, models) ?? models[0];
      if (action === 'test') {
        return json({ ok: true, model: recommended, models });
      }
      return json({ models, recommended });
    } catch (e) {
      const status = e instanceof ProviderError && e.status >= 400 && e.status < 500 ? 400 : 502;
      const msg = e instanceof Error ? e.message : 'Connection test failed';
      return json({ ok: false, error: msg }, status);
    }
  }

  if (action === 'save') {
    const kind = body?.kind;
    const label = typeof body?.label === 'string' ? body.label.trim() : '';
    const model = typeof body?.model === 'string' ? body.model.trim() : '';
    const rawUrl = typeof body?.base_url === 'string' ? body.base_url.trim() : '';
    const apiKey = typeof body?.api_key === 'string' ? body.api_key.trim() : null;
    const enabled = typeof body?.enabled === 'boolean' ? body.enabled : true;
    const priority = typeof body?.priority === 'number' && Number.isInteger(body.priority) ? body.priority : null;
    const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null;

    if (kind !== 'gemini' && kind !== 'openai_compat') {
      return json({ error: 'kind must be "gemini" or "openai_compat"' }, 400);
    }
    if (!label || !model) {
      return json({ error: 'label and model are required' }, 400);
    }

    let safeUrl: string | null = null;
    if (kind === 'openai_compat' || rawUrl) {
      try {
        safeUrl = assertSafeBaseUrl(rawUrl || GEMINI_BASE_URL);
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Invalid base URL' }, 400);
      }
    }

    // Use caller-scoped client so auth.uid() inside save_ai_provider is the verified owner.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: savedId, error: saveErr } = await userClient.rpc('save_ai_provider', {
      p_gym_id: gymId,
      p_kind: kind,
      p_label: label,
      p_base_url: safeUrl,
      p_model: model,
      p_api_key: apiKey,
      p_enabled: enabled,
      p_priority: priority,
      p_id: id,
    });

    if (saveErr) {
      return json({ error: saveErr.message }, 400);
    }
    return json({ ok: true, id: savedId });
  }

  return json({ error: 'Unknown action' }, 400);
});
