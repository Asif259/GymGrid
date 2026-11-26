// Member-triggered AI workout & diet plan generator using the gym owner's configured providers (Vault-backed).
// Verifies JWT, checks gym AI availability (409), validates intake, enforces 24h rate limit (429),
// runs sequential failover across enabled providers, and gates verified=true on deterministic safety checks.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  targetKcal,
  validateIntake,
  checkWorkout,
  checkDiet,
} from '../_shared/plans.js';
import {
  complete,
  runWithFailover,
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

const SYSTEM_PROMPT = `You are an evidence-based strength, conditioning, and nutrition coach for gym members.
You provide training and nutrition guidance only. You never diagnose medical conditions or prescribe medication; when injuries are listed, select safe pain-free movements and include a brief note recommending a human trainer or doctor for pain/injury concerns.

Respond with valid JSON only (no markdown fences, no extra prose).

Workout JSON contract:
{
  "days": [
    {
      "day": "Mon",
      "focus": "Upper Body",
      "exercises": [
        { "name": "Push-ups", "sets": 3, "reps": "8-12", "rest_sec": 60, "notes": "Control the descent" }
      ]
    }
  ]
}

Workout rules:
- Return the exact number of training days requested in days_per_week.
- Respect equipment: bodyweight (no weights/machines), dumbbells (dumbbells + bodyweight only), full_gym (barbells, dumbbells, cables, machines).
- Give each primary muscle group at least 48 hours of rest between sessions.
- Beginner rule: maximum 4 sets per exercise and strictly NO 1-rep-max (1RM) or single-rep maximal testing.
- Injury safety: NEVER include any exercise that loads, stresses, or names an injured area (e.g., knee injury -> no squats, lunges, jumps, leg press, leg extensions, sprints; lower back -> no deadlifts, good mornings, bent-over barbell rows, hyperextensions; shoulder -> no overhead presses, dips, upright rows).
- Include integer rest_sec (e.g. 60-120) and short form/safety notes on every exercise.

Diet JSON contract:
{
  "target_kcal": 2000,
  "protein_g": 150,
  "carbs_g": 200,
  "fat_g": 65,
  "meals": [
    {
      "name": "Breakfast",
      "items": [
        { "food": "Rolled oats", "qty": "60g", "kcal": 225 }
      ]
    }
  ]
}

Diet rules:
- Use the exact target_kcal provided in the user prompt (already computed via Mifflin-St Jeor and safe calorie floors). Do not alter target_kcal.
- Include integer protein_g, carbs_g, and fat_g aligned with the goal and target_kcal.
- Ensure the sum of item kcal across all meals is within +-5% of target_kcal.
- Strictly exclude every listed allergy and anything excluded by diet_pref (e.g. vegetarian = no meat/poultry/fish/seafood; vegan = no animal products; halal = no pork or alcohol). Watch out for hidden ingredients.`;

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildUserPrompt(kind: 'workout' | 'diet', intake: Record<string, unknown>, kcal: number | null) {
  const lines = [
    `Create a personalized ${kind} plan as valid JSON for this gym member:`,
    `- Goal: ${intake.goal}`,
    `- Age: ${intake.age}`,
    `- Sex: ${intake.sex}`,
    `- Height: ${intake.height_cm} cm`,
    `- Weight: ${intake.weight_kg} kg`,
    intake.goal_weight_kg != null ? `- Goal weight: ${intake.goal_weight_kg} kg` : null,
    `- Experience level: ${intake.level}`,
    `- Training days per week: ${intake.days_per_week}`,
    `- Equipment: ${intake.equipment}`,
    `- Daily activity level: ${intake.activity}`,
    `- Injuries / limitations: ${intake.injuries ?? 'None'}`,
    `- Diet preference: ${intake.diet_pref ?? 'None'}`,
    `- Allergies: ${intake.allergies ?? 'None'}`,
    kind === 'diet' && kcal != null ? `- Exact target_kcal to use: ${kcal}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

interface AiProviderRow {
  id: string;
  gym_id: string;
  kind: 'gemini' | 'openai_compat';
  label: string;
  base_url: string | null;
  model: string;
  enabled: boolean;
  priority: number;
  cooldown_until: string | null;
  last_error: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
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

  let memberQuery = db
    .from('members')
    .select('id, gym_id')
    .eq('auth_user_id', userRes.user.id);
  if (typeof body?.member_id === 'string' && UUID_RE.test(body.member_id)) {
    memberQuery = memberQuery.eq('id', body.member_id);
  }
  const { data: member, error: memberErr } = await memberQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memberErr) {
    console.error('member lookup error:', memberErr.message);
    return json({ error: 'Failed to look up member profile' }, 500);
  }
  if (!member) {
    return json({ error: 'Member profile not found' }, 404);
  }

  const { data: providerRows, error: provErr } = await db
    .from('ai_providers')
    .select('id, gym_id, kind, label, base_url, model, enabled, priority, cooldown_until, last_error')
    .eq('gym_id', member.gym_id)
    .eq('enabled', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (provErr) {
    console.error('ai_providers lookup error:', provErr.message);
    return json({ error: 'Failed to load gym AI settings' }, 500);
  }
  if (!providerRows || providerRows.length === 0) {
    return json(
      {
        code: 'ai_not_configured',
        error: "Your gym hasn't turned on AI plans yet",
      },
      409,
    );
  }

  const kind = body?.kind;
  if (kind !== 'workout' && kind !== 'diet') {
    return json({ error: 'kind must be "workout" or "diet"' }, 400);
  }

  const { data: intake, errors: intakeErrors } = validateIntake(body);
  if (!intake || intakeErrors.length > 0) {
    return json({ error: intakeErrors.join('; '), failures: intakeErrors }, 400);
  }

  const { error: updateErr } = await db
    .from('members')
    .update({ ...intake, details_updated_at: new Date().toISOString() })
    .eq('id', member.id);
  if (updateErr) {
    console.error('member intake update error:', updateErr.message);
    return json({ error: 'Failed to save intake details' }, 500);
  }

  const table = kind === 'workout' ? 'workout_plans' : 'diet_plans';
  const since = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
  const { data: recentRows, error: rateErr } = await db
    .from(table)
    .select('id, created_at')
    .eq('member_id', member.id)
    .eq('source', 'ai')
    .gte('created_at', since)
    .limit(1);

  if (rateErr) {
    console.error('rate limit check error:', rateErr.message);
    return json({ error: 'Failed to check plan generation limit' }, 500);
  }
  if (recentRows && recentRows.length > 0) {
    return json(
      {
        error: `You can generate one AI ${kind} plan every 24 hours. Please try again later.`,
      },
      429,
    );
  }

  const now = Date.now();
  const providersWithKeys: Array<AiProviderRow & { apiKey: string }> = [];
  for (const row of providerRows as AiProviderRow[]) {
    const cd = row.cooldown_until ? Date.parse(row.cooldown_until) : 0;
    if (cd > now) continue;
    const { data: apiKey, error: keyErr } = await db.rpc('get_ai_provider_key', { p_id: row.id });
    if (keyErr || typeof apiKey !== 'string' || !apiKey) continue;
    providersWithKeys.push({ ...row, apiKey });
  }

  if (providersWithKeys.length === 0) {
    return json(
      { error: 'AI providers are temporarily cooling down. Please try again in a few minutes.' },
      502,
    );
  }

  const kcal = kind === 'diet' ? targetKcal(intake) : null;
  const basePrompt = buildUserPrompt(kind, intake, kcal);
  const validatePlan = (plan: unknown) =>
    kind === 'workout' ? checkWorkout(plan, intake) : checkDiet(plan, intake, kcal);

  let failoverResult: {
    result: { plan: Record<string, unknown> | null; failures: string[] };
    provider: AiProviderRow;
    failures: Array<{ provider: AiProviderRow; classification: { cooldownMs: number; message: string } }>;
  };

  try {
    failoverResult = await runWithFailover(
      providersWithKeys,
      async (provider: AiProviderRow & { apiKey: string }) => {
        let plan = await complete(provider, { system: SYSTEM_PROMPT, user: basePrompt });
        let failures = validatePlan(plan);

        if (failures.length > 0) {
          const retryPrompt = `${basePrompt}\n\nYour previous JSON failed safety/schema checks:\n- ${failures.join('\n- ')}\n\nFix every listed issue and return valid JSON only.`;
          plan = await complete(provider, { system: SYSTEM_PROMPT, user: retryPrompt });
          failures = validatePlan(plan);
        }

        return { plan, failures };
      },
      now,
    );
  } catch (err) {
    const provFailures = (err as { failures?: Array<{ provider: AiProviderRow; classification: { cooldownMs: number; message: string } }> })?.failures ?? [];
    await Promise.all(
      provFailures.map((f) =>
        db
          .from('ai_providers')
          .update({
            cooldown_until: new Date(Date.now() + f.classification.cooldownMs).toISOString(),
            last_error: f.classification.message,
          })
          .eq('id', f.provider.id),
      ),
    );
    return json(
      { error: "Couldn't reach the gym's AI provider right now. Please try again shortly." },
      502,
    );
  }

  // Persist cooldowns for any providers that failed before failover succeeded, and clear winning provider's error.
  await Promise.all([
    ...failoverResult.failures.map((f) =>
      db
        .from('ai_providers')
        .update({
          cooldown_until: new Date(Date.now() + f.classification.cooldownMs).toISOString(),
          last_error: f.classification.message,
        })
        .eq('id', f.provider.id),
    ),
    failoverResult.provider.last_error || failoverResult.provider.cooldown_until
      ? db
          .from('ai_providers')
          .update({ cooldown_until: null, last_error: null })
          .eq('id', failoverResult.provider.id)
      : Promise.resolve(),
  ]);

  const { plan, failures } = failoverResult.result;
  if (failures.length > 0 || !plan) {
    return json(
      {
        error: "Couldn't build a safe plan, try changing inputs",
        failures,
      },
      422,
    );
  }

  const { error: insertErr } = await db.from(table).insert({
    member_id: member.id,
    plan,
    verified: true,
    source: 'ai',
  });

  if (insertErr) {
    console.error('plan insert error:', insertErr.message);
    return json({ error: 'Failed to save generated plan' }, 500);
  }

  return json({ kind, plan, verified: true }, 200);
});
