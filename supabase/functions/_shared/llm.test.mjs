import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeBaseUrl,
  listModels,
  pickModel,
  complete,
  classify,
  runWithFailover,
  ProviderError,
} from './llm.js';

test('assertSafeBaseUrl enforces https and blocks SSRF targets', () => {
  assert.equal(assertSafeBaseUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1');
  assert.throws(() => assertSafeBaseUrl('http://api.groq.com/openai/v1'), /https/);
  assert.throws(() => assertSafeBaseUrl('https://localhost:8080/v1'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://127.0.0.1/v1'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://169.254.169.254/latest'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://10.0.0.5/v1'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://192.168.1.1/v1'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://172.16.0.10/v1'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://internal-service/v1'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://[::1]/v1'), /not allowed/);
  assert.throws(() => assertSafeBaseUrl('https://user:pass@api.openai.com/v1'), /credentials/);
});

test('pickModel filters utility models and applies preference order', () => {
  assert.equal(
    pickModel('gemini', [
      'text-embedding-004',
      'imagen-3.0-generate-002',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-2.5-flash',
    ]),
    'gemini-2.5-flash',
  );
  assert.equal(
    pickModel('gemini', ['gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-2.5-flash-tts']),
    'gemini-2.0-flash-exp',
  );
  assert.equal(
    pickModel('openai_compat', [
      'whisper-large-v3',
      'llama-guard-3-8b',
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
    ]),
    'llama-3.3-70b-versatile',
  );
  assert.equal(
    pickModel('openai_compat', ['gpt-4o-mini', 'gpt-4o', 'text-embedding-3-large']),
    'gpt-4o',
  );
  assert.equal(
    pickModel('openai_compat', ['qwen-7b-instruct', 'qwen-72b-instruct', 'qwen-32b-instruct']),
    'qwen-72b-instruct',
  );
  assert.equal(pickModel('openai_compat', ['text-embedding-3-small']), null);
});

test('listModels & complete work for Gemini and OpenAI-compat', async () => {
  const geminiFetch = async (url, init) => {
    assert.equal(init.headers['x-goog-api-key'], 'gem-secret-1234');
    if (url.endsWith('/models')) {
      return new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '```json\n{"days":[]}\n```' }] }, finishReason: 'STOP' }],
      }),
      { status: 200 },
    );
  };

  const gModels = await listModels({ kind: 'gemini', apiKey: 'gem-secret-1234' }, geminiFetch);
  assert.deepEqual(gModels, ['gemini-2.5-flash']);
  const gOut = await complete(
    { kind: 'gemini', model: 'gemini-2.5-flash', apiKey: 'gem-secret-1234' },
    { system: 'sys', user: 'usr' },
    geminiFetch,
  );
  assert.deepEqual(gOut, { days: [] });

  const groqFetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer groq-secret-5678');
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '{"meals":[]}' } }] }),
      { status: 200 },
    );
  };

  const cModels = await listModels(
    { kind: 'openai_compat', base_url: 'https://api.groq.com/openai/v1', apiKey: 'groq-secret-5678' },
    groqFetch,
  );
  assert.deepEqual(cModels, ['llama-3.3-70b-versatile']);
  const cOut = await complete(
    {
      kind: 'openai_compat',
      base_url: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      apiKey: 'groq-secret-5678',
    },
    { system: 'sys', user: 'usr' },
    groqFetch,
  );
  assert.deepEqual(cOut, { meals: [] });
});

test('classify assigns 5 min cooldown to 429/5xx/timeout and 1h to 401/403', () => {
  assert.equal(classify(new ProviderError('rate limit', { status: 429 })).cooldownMs, 5 * 60 * 1000);
  assert.equal(classify(new ProviderError('server err', { status: 503 })).cooldownMs, 5 * 60 * 1000);
  assert.equal(classify(new ProviderError('timeout', { status: 504, isTimeout: true })).cooldownMs, 5 * 60 * 1000);
  assert.equal(classify(new ProviderError('bad key', { status: 401 })).cooldownMs, 60 * 60 * 1000);
  assert.equal(classify(new ProviderError('forbidden', { status: 403 })).cooldownMs, 60 * 60 * 1000);
});

test('runWithFailover falls over on 429/401, skips cooling-down providers, and reports when all fail', async () => {
  const now = 1_700_000_000_000;
  const providers = [
    { id: 'p0', kind: 'gemini', enabled: true, priority: 0, cooldown_until: new Date(now + 60_000).toISOString() },
    { id: 'p1', kind: 'gemini', enabled: true, priority: 1, cooldown_until: null },
    { id: 'p2', kind: 'openai_compat', enabled: true, priority: 2, cooldown_until: null },
  ];

  // p0 skipped (cooling down), p1 hits 429 -> p2 succeeds
  const calls = [];
  const res = await runWithFailover(
    providers,
    async (p) => {
      calls.push(p.id);
      if (p.id === 'p1') throw new ProviderError('Too many requests', { status: 429 });
      return { ok: true, id: p.id };
    },
    now,
  );
  assert.deepEqual(calls, ['p1', 'p2']);
  assert.equal(res.provider.id, 'p2');
  assert.equal(res.failures.length, 1);
  assert.equal(res.failures[0].classification.cooldownMs, 5 * 60 * 1000);

  // Bad key on p1 (401 -> 1h), all fail
  await assert.rejects(
    () =>
      runWithFailover(
        [providers[1], providers[2]],
        async (p) => {
          if (p.id === 'p1') throw new ProviderError('Invalid API key', { status: 401 });
          throw new ProviderError('Upstream 502', { status: 502 });
        },
        now,
      ),
    (err) => {
      assert.equal(err.message, 'Upstream 502');
      assert.equal(err.failures.length, 2);
      assert.equal(err.failures[0].classification.cooldownMs, 60 * 60 * 1000);
      assert.equal(err.failures[1].classification.cooldownMs, 5 * 60 * 1000);
      return true;
    },
  );
});

test('assertSafeBaseUrl rejects trailing-dot and embedded-IPv4 IPv6 hosts', () => {
  for (const u of ['https://localhost./v1', 'https://metadata.google.internal./', 'https://[2002:7f00:1::]/']) {
    assert.throws(() => assertSafeBaseUrl(u), u);
  }
});

test('classify does not cool a provider down for model output errors', () => {
  assert.equal(classify(new ProviderError('bad json', { status: 502, code: 'invalid_json' })).cooldownMs, 0);
  assert.equal(classify(new ProviderError('stopped', { status: 422, code: 'refusal' })).cooldownMs, 0);
});
