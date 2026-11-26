// Member-triggered AI workout & diet plan generator using the gym owner's configured providers (Vault-backed).
// Verifies JWT, checks gym AI availability (409), validates intake, enforces 24h rate limit (429),
// runs sequential failover across enabled providers, and gates verified=true on deterministic safety checks.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  targetKcal,
  proteinRangeGrams,
  getProgram,
  weeklySetRange,
  computeBmi,
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

function buildWorkoutSystemPrompt(intake: Record<string, unknown>): string {
  const prog = getProgram(intake);
  const [minSets, maxSets] = weeklySetRange(intake);
  const rangeStr = `${minSets}-${maxSets} sets per muscle per week`;

  return `You are a strength and conditioning coach. Write ONE week of training for this member.
Return JSON only, matching the schema. No text outside the JSON.

MEMBER: goal_type, level, sex, age, height_cm, weight_kg, goal_weight_kg,
days_per_week, session_minutes, equipment, injuries, run_ok.

RULES
1. Lifting sessions: exactly ${intake.days_per_week}, each ${intake.session_minutes} minutes or less of lifting. Cardio is listed separately.
2. Effort over volume. Every working set ends 1-3 reps short of failure (rir 1-3). Beginners: rir 2-3 on every exercise. No failure sets on squat, deadlift or bench.
3. Hard sets per muscle per week must fall in ${rangeStr}. Train each major muscle twice a week (full body, upper/lower or push/pull/legs, depending on days).
4. Per session: 5-7 exercises, at most 20 working sets. Compounds first. At most 2 exercises per muscle per session. No duplicate movement patterns, no finishers, burnouts, drop sets or circuits unless goal_type is general_fitness. If an exercise does not serve the goal, leave it out.
5. Reps and rest by role as in ${prog.repsSummary}. Use only: ${intake.equipment}.
6. Injuries: ${intake.injuries ?? 'None'}. Replace any exercise that loads that area. If unsure, leave it out and say why in notes.
7. Cardio: ${prog.cardioSummary}. Prefer walking and incline walking. Write minutes, incline % and a speed or "conversation pace". Include running only when run_ok is true and rule 6 allows it.
8. Tag every exercise's muscles using only: chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core.
Do not give medical advice. Do not claim results or timelines.

Schema:
{
  "days": [
    {
      "day": "Mon",
      "focus": "Upper Body",
      "exercises": [
        {
          "name": "Dumbbell Bench Press",
          "muscles": ["chest", "triceps", "shoulders"],
          "sets": 3,
          "reps": "6-10",
          "rir": 2,
          "rest_sec": 120,
          "notes": "Controlled lower, stop 2 reps short"
        }
      ]
    }
  ],
  "cardio": [
    {
      "day": "Tue",
      "type": "walk",
      "minutes": 30,
      "incline_pct": 6,
      "intensity": "conversation pace"
    }
  ]
}
(Omit duration_min on days; omit incline_pct unless type is incline_walk. Valid cardio type values: walk, incline_walk, run, cycle.)`;
}

function buildDietSystemPrompt(intake: Record<string, unknown>, protRange: [number, number | null]): string {
  const prog = getProgram(intake);
  const [minProt, maxProt] = protRange;
  const proteinRule = maxProt != null
    ? `Target ${minProt}-${maxProt}g protein/day (${prog.minProteinPerKg}-${prog.maxProteinPerKg} g/kg for ${prog.goalType}).`
    : `Meet or exceed ${minProt}g protein/day (at least ${prog.minProteinPerKg} g/kg for ${prog.goalType}).`;
  const goalCalorieNote =
    prog.goalType === 'muscle_gain'
      ? 'Includes +10% lean surplus for muscle_gain.'
      : prog.goalType === 'fat_loss'
        ? 'Includes -15% calorie deficit capped at 500 kcal/day for fat_loss (never below 1200 kcal F / 1500 kcal M).'
        : `Calibrated for ${prog.goalType} (never below 1200 kcal F / 1500 kcal M).`;

  return `You are an evidence-based nutrition coach for gym members.
You provide nutrition guidance only. You never diagnose medical conditions or prescribe medication. Do not claim results or timelines.
Respond with valid JSON only (no markdown fences, no extra prose).

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
- Use the exact target_kcal provided in the user prompt. Do not alter target_kcal. (${goalCalorieNote})
- ${proteinRule} Include integer carbs_g and fat_g aligned with target_kcal.
- Ensure the sum of item kcal across all meals is within +-5% of target_kcal.
- Strictly exclude every listed allergy and anything excluded by diet_pref (e.g. vegetarian = no meat/poultry/fish/seafood; vegan = no animal products; halal = no pork or alcohol). Watch out for hidden ingredients.`;
}

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildUserPrompt(
  kind: 'workout' | 'diet',
  intake: Record<string, unknown>,
  kcal: number | null,
  protRange: [number, number | null] | null,
) {
  const bmi = computeBmi(intake);
  const protLine =
    kind === 'diet' && protRange
      ? protRange[1] != null
        ? `- Target protein_g per day: ${protRange[0]}-${protRange[1]}g (minimum ${protRange[0]}g)`
        : `- Minimum protein_g per day: ${protRange[0]}g`
      : null;
  const lines = [
    `MEMBER:`,
    `- goal_type: ${intake.goal_type}`,
    intake.goal ? `- goal notes: ${intake.goal}` : null,
    `- level: ${intake.level}`,
    `- sex: ${intake.sex}`,
    `- age: ${intake.age}`,
    `- height_cm: ${intake.height_cm}`,
    `- weight_kg: ${intake.weight_kg}${bmi ? ` (BMI ${bmi.toFixed(1)})` : ''}`,
    intake.goal_weight_kg != null ? `- goal_weight_kg: ${intake.goal_weight_kg}` : null,
    `- days_per_week: ${intake.days_per_week}`,
    `- session_minutes: ${intake.session_minutes}`,
    `- equipment: ${intake.equipment}`,
    `- activity: ${intake.activity}`,
    `- injuries: ${intake.injuries ?? 'None'}`,
    `- run_ok: ${Boolean(intake.run_ok)}`,
    kind === 'diet' ? `- diet_pref: ${intake.diet_pref ?? 'None'}` : null,
    kind === 'diet' ? `- allergies: ${intake.allergies ?? 'None'}` : null,
    kind === 'diet' && kcal != null ? `- Exact target_kcal to use: ${kcal}` : null,
    protLine,
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
  const protRange: [number, number | null] | null =
    kind === 'diet' && kcal != null ? (proteinRangeGrams(intake, kcal) as [number, number | null]) : null;
  const systemPrompt =
    kind === 'workout'
      ? buildWorkoutSystemPrompt(intake)
      : buildDietSystemPrompt(intake, protRange ?? [0, null]);
  const basePrompt = buildUserPrompt(kind, intake, kcal, protRange);
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
        let plan = await complete(provider, { system: systemPrompt, user: basePrompt });
        let failures = validatePlan(plan);

        if (failures.length > 0) {
          const retryPrompt = `${basePrompt}\n\nYour previous JSON failed safety/schema checks:\n- ${failures.join('\n- ')}\n\nFix every listed issue and return valid JSON only.`;
          plan = await complete(provider, { system: systemPrompt, user: retryPrompt });
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
