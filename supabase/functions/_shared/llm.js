// Provider adapters (Google Gemini + OpenAI-compatible), SSRF URL guard, model picker,
// error classification, and sequential failover with cooldown. Uses injected fetch for unit testing.

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const PROVIDER_PRESETS = [
  {
    id: 'gemini',
    kind: 'gemini',
    label: 'Google Gemini',
    base_url: GEMINI_BASE_URL,
    docs_url: 'https://aistudio.google.com/app/apikey',
    limits_url: 'https://ai.google.dev/gemini-api/docs/rate-limits',
  },
  {
    id: 'groq',
    kind: 'openai_compat',
    label: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    docs_url: 'https://console.groq.com/keys',
    limits_url: 'https://console.groq.com/docs/rate-limits',
  },
  {
    id: 'xai',
    kind: 'openai_compat',
    label: 'xAI Grok',
    base_url: 'https://api.x.ai/v1',
    docs_url: 'https://console.x.ai/',
    limits_url: 'https://docs.x.ai/docs/models',
  },
  {
    id: 'openrouter',
    kind: 'openai_compat',
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    docs_url: 'https://openrouter.ai/keys',
    limits_url: 'https://openrouter.ai/docs/api-reference/limits',
  },
  {
    id: 'deepseek',
    kind: 'openai_compat',
    label: 'DeepSeek',
    base_url: 'https://api.deepseek.com/v1',
    docs_url: 'https://platform.deepseek.com/api_keys',
    limits_url: 'https://api-docs.deepseek.com/quick_start/rate_limit',
  },
  {
    id: 'openai',
    kind: 'openai_compat',
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    docs_url: 'https://platform.openai.com/api-keys',
    limits_url: 'https://platform.openai.com/docs/guides/rate-limits',
  },
  {
    id: 'custom',
    kind: 'openai_compat',
    label: 'Custom (OpenAI-compatible)',
    base_url: '',
    docs_url: '',
    limits_url: '',
  },
];

const CONNECT_TIMEOUT_MS = 8_000;
const COMPLETE_TIMEOUT_MS = 60_000;

function isPrivateIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return true;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isUnsafeHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localdomain') ||
    host.endsWith('.arpa')
  ) {
    return true;
  }
  if (host === '::' || host === '::1') return true;
  if (host.includes(':')) {
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
    const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped && isPrivateIpv4(mapped[1])) return true;
    // Reject non-global IPv6 literals for safety
    if (/^[0-9a-f:]+$/.test(host) && !host.startsWith('2')) return true;
    return false;
  }
  if (isPrivateIpv4(host)) return true;
  // Require at least one dot for public DNS hostnames
  if (!host.includes('.')) return true;
  return false;
}

/**
 * SSRF guard for provider base URLs: HTTPS only, public hostnames/IPs only.
 */
export function assertSafeBaseUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('Base URL is required');
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid base URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Base URL must use https://');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Base URL must not contain credentials');
  }
  if (isUnsafeHost(parsed.hostname)) {
    throw new Error('Base URL host is not allowed');
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${cleanPath}`;
}

export class ProviderError extends Error {
  constructor(message, { status = 0, code = 'provider_error', isTimeout = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
    this.isTimeout = isTimeout;
  }
}

async function fetchJson(fetchFn, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
  try {
    const res = await fetchFn(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const msg =
        body?.error?.message ||
        body?.message ||
        (typeof body?.error === 'string' ? body.error : null) ||
        `HTTP ${res.status}`;
      throw new ProviderError(String(msg).slice(0, 240), { status: res.status });
    }
    if (body === null) {
      throw new ProviderError('Provider returned non-JSON response', { status: res.status || 502 });
    }
    return body;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const isAbort = err?.name === 'AbortError' || /timed out|aborted/i.test(String(err?.message ?? err));
    throw new ProviderError(isAbort ? 'Provider request timed out' : String(err?.message ?? err).slice(0, 240), {
      status: isAbort ? 504 : 502,
      isTimeout: isAbort,
    });
  } finally {
    clearTimeout(timer);
  }
}

function resolveBaseUrl(provider) {
  if (provider.kind === 'gemini') {
    return assertSafeBaseUrl(provider.base_url || GEMINI_BASE_URL);
  }
  return assertSafeBaseUrl(provider.base_url);
}

/**
 * List available chat/generate models for a provider. Doubles as the Test connection check.
 */
export async function listModels(provider, fetchFn = fetch, timeoutMs = CONNECT_TIMEOUT_MS) {
  const apiKey = String(provider?.apiKey ?? '').trim();
  if (!apiKey) throw new ProviderError('API key is required', { status: 400 });
  const base = resolveBaseUrl(provider);

  if (provider.kind === 'gemini') {
    const data = await fetchJson(
      fetchFn,
      `${base}/models`,
      {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey },
      },
      timeoutMs,
    );
    const models = Array.isArray(data?.models) ? data.models : [];
    const ids = models
      .filter((m) => {
        const methods = m?.supportedGenerationMethods;
        return !Array.isArray(methods) || methods.includes('generateContent');
      })
      .map((m) => String(m?.name ?? '').replace(/^models\//, ''))
      .filter(Boolean);
    if (ids.length === 0) {
      throw new ProviderError('No compatible Gemini models returned', { status: 502 });
    }
    return ids;
  }

  const data = await fetchJson(
    fetchFn,
    `${base}/models`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    timeoutMs,
  );
  const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const ids = rawList.map((m) => String(m?.id ?? '')).filter(Boolean);
  if (ids.length === 0) {
    throw new ProviderError('No models returned by provider', { status: 502 });
  }
  return ids;
}

const EXCLUDED_MODEL_RE =
  /(?:embed|embedding|whisper|tts|audio|speech|guard|moderation|image|imagen|dall-e|veo|sora|transcribe|realtime|rerank|aqa|bison|gecko)/i;

function extractParamBillions(id) {
  const m = id.toLowerCase().match(/(?:^|[-_/])(\d+(?:\.\d+)?)b(?=$|[-_/])/);
  return m ? Number(m[1]) : 0;
}

function extractGeminiVersion(id) {
  const m = id.toLowerCase().match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Drop non-chat/utility models and pick the best default model for the provider kind.
 */
export function pickModel(kind, ids) {
  const clean = (ids ?? []).filter((id) => typeof id === 'string' && id.trim() && !EXCLUDED_MODEL_RE.test(id));
  if (clean.length === 0) return null;

  if (kind === 'gemini') {
    const geminiOnly = clean.filter((id) => /gemini/i.test(id));
    const pool = geminiOnly.length > 0 ? geminiOnly : clean;

    const exact25Flash = pool.find((id) => /^gemini-2\.5-flash$/i.test(id));
    if (exact25Flash) return exact25Flash;

    const any25Flash = pool.find((id) => /gemini-2\.5-flash/i.test(id) && !/lite/i.test(id));
    if (any25Flash) return any25Flash;

    const flashes = pool
      .filter((id) => /flash/i.test(id))
      .sort((a, b) => extractGeminiVersion(b) - extractGeminiVersion(a));
    if (flashes.length > 0) return flashes[0];

    const pros = pool
      .filter((id) => /pro/i.test(id))
      .sort((a, b) => extractGeminiVersion(b) - extractGeminiVersion(a));
    if (pros.length > 0) return pros[0];

    return pool[0];
  }

  const llama33 = clean.find((id) => /llama-3\.3-70b/i.test(id));
  if (llama33) return llama33;

  const gpt4oExact = clean.find((id) => /(?:^|\/)gpt-4o$/i.test(id));
  if (gpt4oExact) return gpt4oExact;
  const gpt4oAny = clean.find((id) => /gpt-4o/i.test(id));
  if (gpt4oAny) return gpt4oAny;

  const deepseekChat = clean.find((id) => /deepseek-chat/i.test(id));
  if (deepseekChat) return deepseekChat;

  let bestByParams = null;
  let maxB = 0;
  for (const id of clean) {
    const b = extractParamBillions(id);
    if (b > maxB) {
      maxB = b;
      bestByParams = id;
    }
  }
  if (bestByParams) return bestByParams;

  return clean[0];
}

function stripCodeFences(raw) {
  const trimmed = String(raw ?? '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Call Gemini generateContent or OpenAI-compatible chat/completions and return parsed JSON.
 */
export async function complete(provider, { system, user }, fetchFn = fetch, timeoutMs = COMPLETE_TIMEOUT_MS) {
  const apiKey = String(provider?.apiKey ?? '').trim();
  if (!apiKey) throw new ProviderError('API key is required', { status: 400 });
  if (!provider?.model) throw new ProviderError('Model is required', { status: 400 });
  const base = resolveBaseUrl(provider);

  if (provider.kind === 'gemini') {
    const url = `${base}/models/${encodeURIComponent(provider.model)}:generateContent`;
    const data = await fetchJson(
      fetchFn,
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        }),
      },
      timeoutMs,
    );

    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
      throw new ProviderError(`Model stopped: ${candidate.finishReason}`, { status: 422, code: 'refusal' });
    }
    const text = (candidate?.content?.parts ?? [])
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
    if (!text) {
      throw new ProviderError('Gemini returned an empty response', { status: 502 });
    }
    try {
      return JSON.parse(stripCodeFences(text));
    } catch {
      throw new ProviderError('Gemini returned invalid JSON', { status: 502, code: 'invalid_json' });
    }
  }

  const data = await fetchJson(
    fetchFn,
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      }),
    },
    timeoutMs,
  );

  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text) {
    throw new ProviderError('Provider returned an empty response', { status: 502 });
  }
  try {
    return JSON.parse(stripCodeFences(text));
  } catch {
    throw new ProviderError('Provider returned invalid JSON', { status: 502, code: 'invalid_json' });
  }
}

/**
 * Classify a provider error into cooldown duration and error category.
 * - 401/403 -> 1 h cooldown
 * - 429/5xx/timeout/other -> 5 min cooldown
 */
export function classify(err) {
  const status = Number(err?.status ?? 0);
  const msg = String(err?.message ?? err ?? 'Provider error').slice(0, 240);
  if (status === 401 || status === 403) {
    return { cooldownMs: 60 * 60 * 1000, kind: 'auth', message: msg };
  }
  if (status === 429 || status >= 500 || err?.isTimeout || /timeout|aborted/i.test(msg)) {
    return { cooldownMs: 5 * 60 * 1000, kind: 'transient', message: msg };
  }
  return { cooldownMs: 5 * 60 * 1000, kind: 'error', message: msg };
}

function toEpochMs(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const ms = Date.parse(String(val));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Run `fn(provider)` sequentially by priority, skipping disabled or cooling-down providers.
 * Returns `{ result, provider, failures }` on success; throws an Error with `.failures` if all fail.
 */
export async function runWithFailover(providers, fn, now = Date.now()) {
  const ordered = [...(providers ?? [])]
    .filter((p) => p && p.enabled !== false)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const eligible = ordered.filter((p) => toEpochMs(p.cooldown_until) <= now);
  if (eligible.length === 0) {
    const err = new Error('All configured AI providers are temporarily cooling down');
    err.code = 'all_cooling_down';
    err.failures = [];
    throw err;
  }

  const failures = [];
  let lastError = null;

  for (const provider of eligible) {
    try {
      const result = await fn(provider);
      return { result, provider, failures };
    } catch (err) {
      lastError = err;
      failures.push({
        provider,
        error: err,
        classification: classify(err),
      });
    }
  }

  const finalErr = lastError instanceof Error ? lastError : new Error(String(lastError ?? 'All AI providers failed'));
  finalErr.failures = failures;
  throw finalErr;
}
