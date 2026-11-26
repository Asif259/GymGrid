// Pure plan intake validation, calorie & protein math, PROGRAMS config table, and deterministic safety checks.
// Used by supabase/functions/generate-plan/index.ts and tested directly with node --test.

export const GOAL_TYPES = [
  'muscle_gain',
  'strength',
  'fat_loss',
  'maintain_lean',
  'general_fitness',
];
export const SEXES = ['male', 'female'];
export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const EQUIPMENT = ['full_gym', 'dumbbells', 'bodyweight'];
export const ACTIVITIES = ['sedentary', 'light', 'moderate', 'active'];
export const SESSION_MINUTES = [45, 60];
export const VALID_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
];
export const MAJOR_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
];
export const CARDIO_TYPES = ['walk', 'incline_walk', 'run', 'cycle'];

const ACTIVITY_FACTOR = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

// Design choices (not trial results): per-level set ranges, maintain_lean volume,
// and 40s-per-set duration heuristic. Tune after reviewing real generated plans.
export const PROGRAMS = {
  muscle_gain: {
    label: 'Build muscle (hypertrophy)',
    weeklySets: { beginner: [8, 10], other: [10, 14] },
    repsRange: [6, 15],
    restRange: [60, 180],
    repsSummary: 'compounds 6-10 reps (rest 120-180s); isolation 10-15 reps (rest 60-90s)',
    cardioSummary: 'optional: 0-2 easy walks of 20-30 min',
    minCardioSessions: 0,
    minCardioMinutes: 0,
    maxRuns: 0,
    goalFactor: 1.1,
    minProteinPerKg: 1.6,
  },
  strength: {
    label: 'Get stronger',
    weeklySets: { beginner: [6, 8], other: [8, 12] },
    repsRange: [3, 12],
    restRange: [60, 240],
    repsSummary: 'main lifts 3-5 reps (rest 180-240s); 2-3 accessories at 8-12 reps (rest 60-150s)',
    cardioSummary: '1-2 easy walks of 20-30 min',
    minCardioSessions: 1,
    minCardioMinutes: 20,
    maxRuns: 0,
    goalFactor: 1.0,
    minProteinPerKg: 1.6,
  },
  fat_loss: {
    label: 'Lose fat (cutting)',
    weeklySets: { beginner: [8, 10], other: [10, 12] },
    repsRange: [6, 15],
    restRange: [60, 180],
    repsSummary: 'keep lifting heavy: compounds 6-10 reps (rest 120-180s); isolation 10-15 reps (rest 60-90s)',
    cardioSummary:
      '3-5 sessions of 30-45 min walking or incline walking (5-10% incline, conversation pace), building toward 150-300 min/week; at most 2 easy runs (20-30 min) only if run_ok is true, no lower-body injury, and BMI < 30',
    minCardioSessions: 3,
    minCardioMinutes: 90,
    maxRuns: 2,
    goalFactor: 0.85,
    maxDeficitKcal: 500,
    minProteinPerKg: 1.8,
    maxProteinPerKg: 2.4,
  },
  maintain_lean: {
    label: 'Stay lean',
    weeklySets: { beginner: [6, 10], other: [8, 10] },
    repsRange: [6, 15],
    restRange: [60, 180],
    repsSummary: 'compounds 6-10 reps (rest 120-180s); isolation 10-15 reps (rest 60-90s)',
    cardioSummary: '2-3 walks of 30 min',
    minCardioSessions: 2,
    minCardioMinutes: 60,
    maxRuns: 0,
    goalFactor: 1.0,
    minProteinPerKg: 1.8,
    maxProteinPerKg: 2.4,
  },
  general_fitness: {
    label: 'General fitness',
    weeklySets: { beginner: [6, 10], other: [6, 10] },
    repsRange: [8, 15],
    restRange: [60, 120],
    repsSummary: 'full body: compounds 8-12 reps (rest 90-120s); accessories 10-15 reps (rest 60-90s)',
    cardioSummary: 'walking to reach at least 150 min/week total activity including lifting',
    minCardioSessions: 1,
    minCardioMinutes: 20,
    maxRuns: 0,
    goalFactor: 1.0,
    minProteinPerKg: 1.6,
  },
};

export function normalizeGoalType(raw) {
  const g = String(raw ?? '').trim().toLowerCase();
  if (GOAL_TYPES.includes(g)) return g;
  if (g === 'fat loss' || g === 'cut') return 'fat_loss';
  if (g === 'muscle' || g === 'bulk') return 'muscle_gain';
  if (g === 'lean') return 'maintain_lean';
  if (g === 'fitness') return 'general_fitness';
  return null;
}

export function getProgram(profile) {
  const key = normalizeGoalType(profile?.goal_type ?? profile?.goal) ?? 'general_fitness';
  return { goalType: key, ...PROGRAMS[key] };
}

export function weeklySetRange(profile) {
  const prog = getProgram(profile);
  return profile?.level === 'beginner' ? prog.weeklySets.beginner : prog.weeklySets.other;
}

export function estimateWorkoutDurationMin(day) {
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
  let totalSec = 0;
  for (const ex of exercises) {
    const sets = Number(ex?.sets) || 0;
    const rest = Number(ex?.rest_sec ?? 90);
    // Heuristic: 40s assumed per working set + rest_sec.
    totalSec += sets * (40 + rest);
  }
  return Math.round(totalSec / 60 + 5);
}

export function computeBmi(profile) {
  const w = Number(profile?.weight_kg);
  const h = Number(profile?.height_cm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null;
  const hm = h / 100;
  return w / (hm * hm);
}

function cleanOptionalText(raw, label, maxLen, errors) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    errors.push(`${label} must be text`);
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    errors.push(`${label} must be at most ${maxLen} characters`);
    return null;
  }
  return trimmed;
}

function parseNumber(raw, label, { min, max, integer = false, optional = false }, errors) {
  if (raw === undefined || raw === null || raw === '') {
    if (optional) return null;
    errors.push(`${label} is required`);
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    errors.push(`${label} must be a valid number`);
    return null;
  }
  if (integer && !Number.isInteger(n)) {
    errors.push(`${label} must be a whole number`);
    return null;
  }
  if (n < min || n > max) {
    errors.push(`${label} must be between ${min} and ${max}`);
    return null;
  }
  return integer ? n : Math.round(n * 10) / 10;
}

function parseEnum(raw, label, allowed, errors) {
  if (typeof raw !== 'string' || !raw.trim()) {
    errors.push(`${label} is required`);
    return null;
  }
  const val = raw.trim().toLowerCase();
  if (!allowed.includes(val)) {
    errors.push(`${label} must be one of: ${allowed.join(', ')}`);
    return null;
  }
  return val;
}

/**
 * Trust-boundary validation for member intake payload before DB write or AI call.
 */
export function validateIntake(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { data: null, errors: ['Request body must be an object'] };
  }

  const rawGoalType = body.goal_type ?? body.goal;
  const goal_type = normalizeGoalType(rawGoalType);
  if (!goal_type) {
    errors.push(`goal_type must be one of: ${GOAL_TYPES.join(', ')}`);
  }

  const goal = cleanOptionalText(body.goal, 'goal', 60, errors);
  const age = parseNumber(body.age, 'age', { min: 10, max: 100, integer: true }, errors);
  const sex = parseEnum(body.sex, 'sex', SEXES, errors);
  const height_cm = parseNumber(body.height_cm, 'height_cm', { min: 100, max: 250, integer: true }, errors);
  const weight_kg = parseNumber(body.weight_kg, 'weight_kg', { min: 25, max: 300 }, errors);
  const goal_weight_kg = parseNumber(body.goal_weight_kg, 'goal_weight_kg', { min: 25, max: 300, optional: true }, errors);
  const level = parseEnum(body.level, 'level', LEVELS, errors);
  const days_per_week = parseNumber(body.days_per_week, 'days_per_week', { min: 2, max: 6, integer: true }, errors);
  const equipment = parseEnum(body.equipment, 'equipment', EQUIPMENT, errors);
  const activity = parseEnum(body.activity, 'activity', ACTIVITIES, errors);

  let run_ok = false;
  if (body.run_ok !== undefined && body.run_ok !== null) {
    if (typeof body.run_ok !== 'boolean') {
      errors.push('run_ok must be true or false');
    } else {
      run_ok = body.run_ok;
    }
  }

  let session_minutes = 60;
  if (body.session_minutes !== undefined && body.session_minutes !== null && body.session_minutes !== '') {
    const sm = Number(body.session_minutes);
    if (!SESSION_MINUTES.includes(sm)) {
      errors.push('session_minutes must be 45 or 60');
    } else {
      session_minutes = sm;
    }
  }

  const injuries = cleanOptionalText(body.injuries, 'injuries', 300, errors);
  const diet_pref = cleanOptionalText(body.diet_pref, 'diet_pref', 300, errors);
  const allergies = cleanOptionalText(body.allergies, 'allergies', 300, errors);

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      goal_type,
      goal: goal ?? PROGRAMS[goal_type].label,
      run_ok,
      session_minutes,
      age,
      sex,
      height_cm,
      weight_kg,
      goal_weight_kg,
      level,
      days_per_week,
      equipment,
      activity,
      injuries,
      diet_pref,
      allergies,
    },
    errors: [],
  };
}

/**
 * Mifflin-St Jeor BMR x activity factor x goal adjustment (+10% muscle_gain, -15% fat_loss
 * capped at 500 kcal/day deficit), floored at 1200 kcal (female) / 1500 kcal (male).
 */
export function targetKcal(profile) {
  const sexOffset = profile.sex === 'male' ? 5 : -161;
  const bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + sexOffset;
  const activityFactor = ACTIVITY_FACTOR[profile.activity] ?? ACTIVITY_FACTOR.moderate;
  const tdee = Math.round(bmr * activityFactor);
  const prog = getProgram(profile);

  let target = Math.round(tdee * prog.goalFactor);
  if (prog.maxDeficitKcal && tdee - target > prog.maxDeficitKcal) {
    target = tdee - prog.maxDeficitKcal;
  }

  const floor = profile.sex === 'male' ? 1500 : 1200;
  return Math.max(floor, target);
}

/**
 * Minimum daily protein grams from Morton 2018 (1.6 g/kg) and ISSN fat-loss/lean guidance (1.8-2.4 g/kg).
 */
export function minProteinGrams(profile, kcal) {
  const prog = getProgram(profile);
  const raw = Math.round((Number(profile?.weight_kg) || 60) * prog.minProteinPerKg);
  if (typeof kcal === 'number' && kcal > 0) {
    const maxFeasible = Math.floor((kcal * 0.55) / 4);
    return Math.min(raw, maxFeasible);
  }
  return raw;
}

/**
 * Target protein range [minGrams, maxGrams | null] derived from PROGRAMS and weight_kg.
 */
export function proteinRangeGrams(profile, kcal) {
  const prog = getProgram(profile);
  const minG = minProteinGrams(profile, kcal);
  if (!prog.maxProteinPerKg) return [minG, null];
  const rawMax = Math.round((Number(profile?.weight_kg) || 60) * prog.maxProteinPerKg);
  const cappedMax = typeof kcal === 'number' && kcal > 0 ? Math.floor((kcal * 0.55) / 4) : rawMax;
  return [minG, Math.max(minG, Math.min(rawMax, cappedMax))];
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTerm(text, term) {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(t)}(?:s|es)?(?:$|[^a-z0-9])`, 'i');
  return pattern.test(text);
}

// Shortcut: deterministic keyword/synonym matching catches common contraindications and allergens,
// though novel phrasing or uncommon synonyms can still slip through without clinical review.
const INJURY_STOP_WORDS = new Set([
  'none', 'no', 'na', 'n/a', 'nil', 'nothing', 'healthy',
  'pain', 'injury', 'injuries', 'sore', 'soreness', 'ache', 'aching',
  'mild', 'moderate', 'severe', 'chronic', 'old', 'recent', 'history',
  'bad', 'weak', 'tight', 'stiff', 'strain', 'sprain', 'tear', 'issue',
  'issues', 'problem', 'problems', 'left', 'right', 'both', 'side',
  'of', 'with', 'and', 'or', 'the', 'a', 'an', 'in', 'on', 'my',
]);

const INJURY_EXERCISES = {
  knee: ['knee', 'squat', 'lunge', 'jump', 'plyo', 'leg press', 'leg extension', 'step-up', 'step up', 'burpee', 'sprint'],
  patella: ['knee', 'squat', 'lunge', 'jump', 'leg extension', 'leg press'],
  acl: ['knee', 'squat', 'lunge', 'jump', 'plyo', 'sprint', 'burpee'],
  meniscus: ['knee', 'squat', 'lunge', 'jump', 'leg extension', 'leg press'],
  shoulder: ['shoulder', 'overhead press', 'military press', 'arnold press', 'upright row', 'dip', 'dips', 'behind-the-neck', 'snatch', 'lateral raise', 'front raise'],
  rotator: ['shoulder', 'overhead press', 'military press', 'upright row', 'dip', 'dips', 'behind-the-neck'],
  'lower back': ['lower back', 'deadlift', 'good morning', 'bent-over row', 'bent over row', 'barbell row', 'hyperextension', 'back extension', 'rack pull', 'clean'],
  lumbar: ['lower back', 'deadlift', 'good morning', 'bent-over row', 'bent over row', 'barbell row', 'hyperextension', 'back extension', 'rack pull'],
  spine: ['deadlift', 'good morning', 'back squat', 'hyperextension', 'back extension', 'bent-over row'],
  back: ['deadlift', 'good morning', 'bent-over row', 'bent over row', 'barbell row', 'hyperextension', 'back extension', 'rack pull'],
  wrist: ['wrist', 'barbell curl', 'push-up', 'pushup', 'front squat', 'clean'],
  ankle: ['ankle', 'calf raise', 'jump', 'sprint', 'running', 'lunge', 'box jump', 'burpee'],
  elbow: ['elbow', 'skullcrusher', 'skull crusher', 'tricep extension', 'preacher curl', 'dip', 'dips'],
  hip: ['hip', 'squat', 'deadlift', 'lunge', 'hip thrust', 'leg press'],
  neck: ['neck', 'shrug', 'behind-the-neck', 'upright row'],
};

const LOWER_BODY_INJURY_TERMS = ['knee', 'patella', 'acl', 'meniscus', 'ankle', 'hip', 'back', 'lower back', 'lumbar', 'spine', 'shin', 'achilles', 'foot', 'calf'];
const UPPER_BODY_INJURY_TERMS = ['shoulder', 'rotator', 'elbow', 'wrist', 'chest', 'pec', 'neck'];

function hasLowerBodyInjury(injuriesText) {
  if (!injuriesText || typeof injuriesText !== 'string') return false;
  const lower = injuriesText.toLowerCase();
  return LOWER_BODY_INJURY_TERMS.some((t) => hasTerm(lower, t));
}

function injuredMajorMuscles(injuriesText) {
  const skip = new Set();
  if (!injuriesText || typeof injuriesText !== 'string') return skip;
  const lower = injuriesText.toLowerCase();
  if (LOWER_BODY_INJURY_TERMS.some((t) => hasTerm(lower, t))) {
    if (hasTerm(lower, 'knee') || hasTerm(lower, 'patella') || hasTerm(lower, 'acl') || hasTerm(lower, 'meniscus')) {
      skip.add('quads');
    }
    if (hasTerm(lower, 'back') || hasTerm(lower, 'lower back') || hasTerm(lower, 'lumbar') || hasTerm(lower, 'spine')) {
      skip.add('back');
      skip.add('hamstrings');
    }
    if (hasTerm(lower, 'hip') || hasTerm(lower, 'ankle')) {
      skip.add('quads');
      skip.add('hamstrings');
      skip.add('glutes');
    }
  }
  if (UPPER_BODY_INJURY_TERMS.some((t) => hasTerm(lower, t))) {
    if (hasTerm(lower, 'shoulder') || hasTerm(lower, 'rotator')) {
      skip.add('shoulders');
      skip.add('chest');
    }
    if (hasTerm(lower, 'elbow') || hasTerm(lower, 'wrist')) {
      skip.add('chest');
      skip.add('shoulders');
    }
  }
  return skip;
}

function blockedExerciseTerms(injuriesText) {
  if (!injuriesText || typeof injuriesText !== 'string') return [];
  const lower = injuriesText.trim().toLowerCase();
  if (!lower || INJURY_STOP_WORDS.has(lower) || /^no\s+injur/i.test(lower)) return [];

  const terms = new Set();
  for (const [area, blocked] of Object.entries(INJURY_EXERCISES)) {
    if (hasTerm(lower, area)) {
      for (const b of blocked) terms.add(b);
    }
  }

  for (const token of lower.split(/[,;/\s]+/)) {
    const clean = token.replace(/[^a-z0-9-]/g, '');
    if (clean.length >= 3 && !INJURY_STOP_WORDS.has(clean)) {
      terms.add(clean);
      if (INJURY_EXERCISES[clean]) {
        for (const b of INJURY_EXERCISES[clean]) terms.add(b);
      }
    }
  }
  return [...terms];
}

function isOneRepMaxWork(ex) {
  const reps = String(ex.reps ?? '').trim().toLowerCase();
  const text = `${ex.name ?? ''} ${reps} ${ex.notes ?? ''}`.toLowerCase();
  if (/^\s*1\s*(?:rep)?\s*$/i.test(reps)) return true;
  if (/\b1\s*-?\s*rm\b|\bone[\s-]+rep[\s-]+max\b|\bmax\s+effort\s+single\b/.test(text)) return true;
  return false;
}

function parseRepBounds(repsStr) {
  const m = String(repsStr ?? '').match(/\d+/g);
  if (!m || m.length === 0) return null;
  const nums = m.map(Number).filter(Number.isFinite);
  if (nums.length === 0) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

/**
 * Deterministic safety, volume, duration, RIR, cardio, and injury checks for a workout plan.
 * Returns an array of failure descriptions (empty when valid).
 */
export function checkWorkout(plan, profile) {
  const failures = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return ['Workout plan must be an object'];
  }
  if (!Array.isArray(plan.days)) {
    return ['Workout plan must include a days array'];
  }
  if (profile?.days_per_week != null && plan.days.length !== profile.days_per_week) {
    failures.push(`Expected ${profile.days_per_week} workout days, got ${plan.days.length}`);
  }
  if (plan.days.length === 0) {
    failures.push('Workout plan must contain at least one day');
  }

  const prog = getProgram(profile);
  const [minWeeklySets, maxWeeklySets] = weeklySetRange(profile);
  const isBeginner = profile?.level === 'beginner';
  const blocked = blockedExerciseTerms(profile?.injuries);
  const sessionMin = Number(profile?.session_minutes) || 60;
  const durationBounds = sessionMin === 45 ? [30, 50] : [40, 65];

  const weeklyMuscleSets = Object.fromEntries(VALID_MUSCLES.map((m) => [m, 0]));

  plan.days.forEach((day, dIdx) => {
    const dayLabel = `Day ${dIdx + 1}`;
    if (!day || typeof day !== 'object') {
      failures.push(`${dayLabel} must be an object`);
      return;
    }
    if (typeof day.day !== 'string' || !day.day.trim()) {
      failures.push(`${dayLabel} is missing a day name`);
    }
    if (typeof day.focus !== 'string' || !day.focus.trim()) {
      failures.push(`${dayLabel} is missing a focus`);
    }
    if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
      failures.push(`${dayLabel} must include at least one exercise`);
      return;
    }
    if (day.exercises.length > 7) {
      failures.push(`${dayLabel} has ${day.exercises.length} exercises (max 7)`);
    }

    let dayWorkingSets = 0;

    day.exercises.forEach((ex, eIdx) => {
      const exLabel = `${dayLabel} exercise ${eIdx + 1}`;
      if (!ex || typeof ex !== 'object') {
        failures.push(`${exLabel} must be an object`);
        return;
      }
      if (typeof ex.name !== 'string' || !ex.name.trim()) {
        failures.push(`${exLabel} is missing a name`);
        return;
      }
      if (!Number.isInteger(ex.sets) || ex.sets < 1 || ex.sets > 12) {
        failures.push(`"${ex.name}" has invalid sets (${ex.sets})`);
      } else {
        dayWorkingSets += ex.sets;
      }
      if (typeof ex.reps !== 'string' || !ex.reps.trim()) {
        failures.push(`"${ex.name}" is missing reps`);
      } else {
        const bounds = parseRepBounds(ex.reps);
        const isTimed = /\d+\s*s(?:ec)?/i.test(ex.reps);
        if (!isTimed && bounds) {
          if (bounds[0] < prog.repsRange[0] || bounds[1] > prog.repsRange[1]) {
            failures.push(
              `"${ex.name}" reps (${ex.reps}) outside ${prog.goalType} range (${prog.repsRange[0]}-${prog.repsRange[1]})`,
            );
          }
        }
      }

      if (!Number.isInteger(ex.rest_sec) || ex.rest_sec < prog.restRange[0] || ex.rest_sec > prog.restRange[1]) {
        failures.push(
          `"${ex.name}" rest_sec (${ex.rest_sec}) outside ${prog.goalType} range (${prog.restRange[0]}-${prog.restRange[1]}s)`,
        );
      }

      const rirMin = isBeginner ? 2 : 1;
      if (!Number.isInteger(ex.rir) || ex.rir < rirMin || ex.rir > 3) {
        failures.push(`"${ex.name}" rir (${ex.rir}) must be ${rirMin}-3`);
      }

      if (!Array.isArray(ex.muscles) || ex.muscles.length === 0) {
        failures.push(`"${ex.name}" must list target muscles`);
      } else {
        for (const m of ex.muscles) {
          if (typeof m !== 'string' || !VALID_MUSCLES.includes(m)) {
            failures.push(`"${ex.name}" has unknown muscle tag "${m}"`);
          } else if (Number.isInteger(ex.sets)) {
            weeklyMuscleSets[m] += ex.sets;
          }
        }
      }

      if (isBeginner) {
        if (typeof ex.sets === 'number' && ex.sets > 4) {
          failures.push(`Beginner limit exceeded: "${ex.name}" has ${ex.sets} sets (max 4)`);
        }
        if (isOneRepMaxWork(ex)) {
          failures.push(`Beginner 1RM restriction violated by "${ex.name}" (${ex.reps})`);
        }
      }

      for (const term of blocked) {
        if (hasTerm(ex.name, term)) {
          failures.push(`Exercise "${ex.name}" conflicts with listed injury (${profile.injuries})`);
          break;
        }
      }
    });

    if (dayWorkingSets > 20) {
      failures.push(`${dayLabel} has ${dayWorkingSets} working sets (max 20)`);
    }

    const estMin = estimateWorkoutDurationMin(day);
    if (estMin < durationBounds[0] || estMin > durationBounds[1]) {
      failures.push(
        `${dayLabel} estimated duration (${estMin} min) outside ${durationBounds[0]}-${durationBounds[1]} min`,
      );
    }
  });

  // Weekly sets per muscle inside the goal range
  const skipMuscles = injuredMajorMuscles(profile?.injuries);
  for (const muscle of VALID_MUSCLES) {
    const sets = weeklyMuscleSets[muscle];
    if (sets > maxWeeklySets) {
      failures.push(`Weekly sets for ${muscle} (${sets}) exceed max ${maxWeeklySets} for ${prog.goalType}`);
    }
    if (MAJOR_MUSCLES.includes(muscle) && !skipMuscles.has(muscle) && sets < minWeeklySets) {
      failures.push(`Weekly sets for ${muscle} (${sets}) below min ${minWeeklySets} for ${prog.goalType}`);
    }
  }

  // Cardio validation
  if (!Array.isArray(plan.cardio)) {
    failures.push('Workout plan must include a cardio array');
  } else {
    let totalCardioMin = 0;
    let runCount = 0;
    const bmi = computeBmi(profile);
    const lowerInj = hasLowerBodyInjury(profile?.injuries);

    plan.cardio.forEach((c, idx) => {
      const cLabel = `Cardio ${idx + 1}`;
      if (!c || typeof c !== 'object') {
        failures.push(`${cLabel} must be an object`);
        return;
      }
      if (typeof c.day !== 'string' || !c.day.trim()) {
        failures.push(`${cLabel} is missing a day`);
      }
      if (!CARDIO_TYPES.includes(c.type)) {
        failures.push(`${cLabel} has invalid type (${c.type})`);
      }
      if (!Number.isInteger(c.minutes) || c.minutes < 5 || c.minutes > 120) {
        failures.push(`${cLabel} has invalid minutes (${c.minutes})`);
      } else {
        totalCardioMin += c.minutes;
      }
      if (typeof c.intensity !== 'string' || !c.intensity.trim()) {
        failures.push(`${cLabel} is missing intensity`);
      }

      if (c.type === 'run') {
        runCount += 1;
        if (!profile?.run_ok) {
          failures.push('Cardio includes running when run_ok is false');
        }
        if (lowerInj) {
          failures.push(`Cardio includes running despite lower-body/back injury (${profile.injuries})`);
        }
        if (bmi !== null && bmi >= 30) {
          failures.push(`Cardio includes running when BMI (${bmi.toFixed(1)}) is >= 30`);
        }
        if (prog.maxRuns === 0) {
          failures.push(`Cardio includes running which is not in ${prog.goalType} cardio plan`);
        } else if (c.minutes > 30) {
          failures.push(`Run session (${c.minutes} min) exceeds 30 min max`);
        }
      }
    });

    if (runCount > prog.maxRuns && prog.maxRuns > 0) {
      failures.push(`Too many run sessions (${runCount}, max ${prog.maxRuns})`);
    }
    if (plan.cardio.length < prog.minCardioSessions) {
      failures.push(
        `Expected at least ${prog.minCardioSessions} cardio session(s) for ${prog.goalType}, got ${plan.cardio.length}`,
      );
    }
    if (totalCardioMin < prog.minCardioMinutes) {
      failures.push(
        `Total cardio minutes (${totalCardioMin}) below ${prog.minCardioMinutes} min for ${prog.goalType}`,
      );
    }
    if (prog.goalType === 'general_fitness') {
      const liftingMin = plan.days.reduce((sum, d) => sum + estimateWorkoutDurationMin(d), 0);
      if (liftingMin + totalCardioMin < 150) {
        failures.push(
          `Total weekly activity (${liftingMin}m lifting + ${totalCardioMin}m cardio) is below 150 min/week`,
        );
      }
    }
  }

  return failures;
}

const ALLERGY_SYNONYMS = {
  peanut: ['peanut', 'peanut butter', 'groundnut'],
  peanuts: ['peanut', 'peanut butter', 'groundnut'],
  'tree nut': ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut'],
  nut: ['peanut', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'nut butter'],
  nuts: ['peanut', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'nut butter'],
  dairy: ['milk', 'cheese', 'yogurt', 'curd', 'paneer', 'whey', 'casein', 'butter', 'ghee', 'cream', 'kefir', 'dairy'],
  lactose: ['milk', 'cheese', 'yogurt', 'curd', 'paneer', 'whey', 'butter', 'cream', 'ice cream'],
  milk: ['milk', 'cheese', 'yogurt', 'curd', 'paneer', 'whey', 'casein', 'butter', 'ghee', 'cream'],
  egg: ['egg', 'omelette', 'omelet', 'mayonnaise', 'frittata'],
  eggs: ['egg', 'omelette', 'omelet', 'mayonnaise', 'frittata'],
  gluten: ['wheat', 'bread', 'roti', 'chapati', 'naan', 'pasta', 'noodle', 'barley', 'rye', 'flour', 'seitan', 'couscous', 'gluten'],
  wheat: ['wheat', 'bread', 'roti', 'chapati', 'naan', 'pasta', 'noodle', 'flour', 'couscous', 'seitan'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soybean'],
  soya: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soybean'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'rohu', 'hilsa', 'sardine', 'mackerel', 'trout', 'pangas', 'katla'],
  shellfish: ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop'],
  shrimp: ['shrimp', 'prawn', 'shellfish'],
  prawn: ['prawn', 'shrimp', 'shellfish'],
  sesame: ['sesame', 'tahini'],
};

const MEAT_TERMS = [
  'chicken', 'beef', 'pork', 'lamb', 'mutton', 'turkey', 'duck', 'venison',
  'meat', 'steak', 'bacon', 'ham', 'sausage', 'pepperoni', 'salami', 'prosciutto', 'lard',
];
const SEAFOOD_TERMS = [
  'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'rohu', 'hilsa', 'sardine',
  'mackerel', 'trout', 'shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'anchovy',
];
const EGG_TERMS = ['egg', 'omelette', 'omelet', 'frittata', 'mayonnaise'];
const DAIRY_TERMS = ['milk', 'cheese', 'yogurt', 'curd', 'paneer', 'whey', 'casein', 'butter', 'ghee', 'cream', 'kefir'];
const HALAL_FORBIDDEN = ['pork', 'bacon', 'ham', 'pepperoni', 'lard', 'prosciutto', 'wine', 'beer', 'alcohol', 'rum', 'vodka', 'whiskey'];

const FOOD_STOP_WORDS = new Set([
  'none', 'no', 'na', 'n/a', 'nil', 'nothing', 'allergy', 'allergies',
  'allergic', 'to', 'and', 'or', 'free', 'avoid', 'intolerance', 'mild', 'severe',
]);

function normalizeFoodForDairyCheck(foodLower) {
  return foodLower
    .replace(/\b(?:almond|soy|soya|oat|coconut|rice|cashew|hemp)\s+milk\b/g, 'plant beverage')
    .replace(/\b(?:almond|soy|soya|oat|coconut|cashew)\s+yogurt\b/g, 'plant yogurt_sub')
    .replace(/\b(?:peanut|almond|cashew|sunflower|sesame|tahini|apple|cocoa|shea)\s+butter\b/g, 'seed paste')
    .replace(/\bvegan\s+(?:cheese|butter|yogurt|milk|cream)\b/g, 'plant sub')
    .replace(/\bbutternut\b/g, 'squash')
    .replace(/\beggplant\b/g, 'aubergine')
    .replace(/\bchickpea\b/g, 'garbanzo');
}

function forbiddenFoodRules(profile) {
  const rules = [];
  const addTerms = (terms, reason) => {
    for (const term of terms) {
      rules.push({ term, reason });
    }
  };

  if (profile?.allergies && typeof profile.allergies === 'string') {
    const lower = profile.allergies.trim().toLowerCase();
    if (lower && !FOOD_STOP_WORDS.has(lower) && !/^no\s+allerg/i.test(lower)) {
      for (const [key, list] of Object.entries(ALLERGY_SYNONYMS)) {
        if (hasTerm(lower, key)) addTerms(list, `allergy (${key})`);
      }
      for (const raw of lower.split(/[,;/]+/)) {
        const cleaned = raw.trim();
        if (!cleaned) continue;
        const words = cleaned.split(/\s+/).filter((w) => w.length >= 3 && !FOOD_STOP_WORDS.has(w));
        for (const w of words) {
          addTerms([w], `allergy (${cleaned})`);
          if (ALLERGY_SYNONYMS[w]) addTerms(ALLERGY_SYNONYMS[w], `allergy (${cleaned})`);
        }
      }
    }
  }

  if (profile?.diet_pref && typeof profile.diet_pref === 'string') {
    const pref = profile.diet_pref.trim().toLowerCase();
    if (pref && !FOOD_STOP_WORDS.has(pref)) {
      if (/\bvegan\b/.test(pref) && !/\bnon[-\s]?vegan\b/.test(pref)) {
        addTerms([...MEAT_TERMS, ...SEAFOOD_TERMS, ...EGG_TERMS, ...DAIRY_TERMS, 'honey', 'gelatin'], 'diet_pref (vegan)');
      } else if ((/\bvegetarian\b/.test(pref) || /\bveg\b/.test(pref)) && !/\bnon[-\s]?veg/i.test(pref)) {
        addTerms([...MEAT_TERMS, ...SEAFOOD_TERMS, 'gelatin'], 'diet_pref (vegetarian)');
      } else if (/\bpescatarian\b/.test(pref)) {
        addTerms(MEAT_TERMS, 'diet_pref (pescatarian)');
      }
      if (/\bhalal\b/.test(pref)) {
        addTerms(HALAL_FORBIDDEN, 'diet_pref (halal)');
      }
      if (/\bdairy[-\s]?free\b|\bno dairy\b/.test(pref)) {
        addTerms(DAIRY_TERMS, 'diet_pref (dairy-free)');
      }
      if (/\bgluten[-\s]?free\b|\bno gluten\b/.test(pref)) {
        addTerms(ALLERGY_SYNONYMS.gluten, 'diet_pref (gluten-free)');
      }
      if (/\bnut[-\s]?free\b|\bno nuts\b/.test(pref)) {
        addTerms(ALLERGY_SYNONYMS.nuts, 'diet_pref (nut-free)');
      }
      const noMatches = pref.matchAll(/\b(?:no|avoid|without)\s+([a-z0-9-]{3,})/g);
      for (const m of noMatches) {
        const item = m[1];
        if (!FOOD_STOP_WORDS.has(item)) {
          addTerms(ALLERGY_SYNONYMS[item] ?? [item], `diet_pref (no ${item})`);
        }
      }
    }
  }

  return rules;
}

/**
 * Deterministic safety, protein, calorie, and allergen checks for a generated diet plan.
 * Returns an array of failure descriptions (empty when valid).
 */
export function checkDiet(plan, profile, kcal) {
  const failures = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return ['Diet plan must be an object'];
  }

  if (typeof plan.target_kcal !== 'number' || !Number.isFinite(plan.target_kcal) || plan.target_kcal <= 0) {
    failures.push('Diet plan is missing a valid target_kcal');
  }
  for (const macro of ['protein_g', 'carbs_g', 'fat_g']) {
    const val = plan[macro];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || (macro !== 'carbs_g' && val <= 0)) {
      failures.push(`Diet plan is missing a valid ${macro}`);
    }
  }

  const floor = profile?.sex === 'male' ? 1500 : 1200;
  if (typeof plan.target_kcal === 'number' && plan.target_kcal < floor) {
    failures.push(`target_kcal (${plan.target_kcal}) is below minimum safe floor (${floor} kcal)`);
  }

  const effectiveKcal = typeof kcal === 'number' && Number.isFinite(kcal) && kcal > 0 ? kcal : plan.target_kcal;
  if (typeof kcal === 'number' && Number.isFinite(kcal) && kcal > 0 && typeof plan.target_kcal === 'number') {
    const diffTarget = Math.abs(plan.target_kcal - kcal) / kcal;
    if (diffTarget > 0.05) {
      failures.push(`target_kcal (${plan.target_kcal}) must be within ±5% of computed target (${kcal})`);
    }
  }

  const reqProtein = minProteinGrams(profile, effectiveKcal);
  if (typeof plan.protein_g === 'number' && plan.protein_g < reqProtein) {
    failures.push(`protein_g (${plan.protein_g}g) is below minimum target (${reqProtein}g/day)`);
  }

  if (!Array.isArray(plan.meals) || plan.meals.length === 0) {
    failures.push('Diet plan must include at least one meal');
    return failures;
  }

  const rules = forbiddenFoodRules(profile);
  let mealSum = 0;

  plan.meals.forEach((meal, mIdx) => {
    const mealLabel = `Meal ${mIdx + 1}`;
    if (!meal || typeof meal !== 'object') {
      failures.push(`${mealLabel} must be an object`);
      return;
    }
    if (typeof meal.name !== 'string' || !meal.name.trim()) {
      failures.push(`${mealLabel} is missing a name`);
    }
    if (!Array.isArray(meal.items) || meal.items.length === 0) {
      failures.push(`${mealLabel} must include at least one item`);
      return;
    }

    meal.items.forEach((item, iIdx) => {
      const itemLabel = `${mealLabel} item ${iIdx + 1}`;
      if (!item || typeof item !== 'object') {
        failures.push(`${itemLabel} must be an object`);
        return;
      }
      if (typeof item.food !== 'string' || !item.food.trim()) {
        failures.push(`${itemLabel} is missing a food name`);
        return;
      }
      if (typeof item.qty !== 'string' || !item.qty.trim()) {
        failures.push(`"${item.food}" is missing qty`);
      }
      if (typeof item.kcal !== 'number' || !Number.isFinite(item.kcal) || item.kcal < 0) {
        failures.push(`"${item.food}" has invalid kcal (${item.kcal})`);
      } else {
        mealSum += item.kcal;
      }

      const rawLower = item.food.toLowerCase();
      const dairyNormalized = normalizeFoodForDairyCheck(rawLower);
      for (const rule of rules) {
        const isDairyRule =
          rule.reason.includes('dairy') ||
          rule.reason.includes('milk') ||
          rule.reason.includes('lactose') ||
          rule.reason === 'diet_pref (vegan)';
        const haystack = isDairyRule ? dairyNormalized : rawLower;
        if (hasTerm(haystack, rule.term)) {
          failures.push(`Food "${item.food}" violates ${rule.reason}`);
          break;
        }
      }
    });
  });

  if (typeof plan.target_kcal === 'number' && plan.target_kcal > 0) {
    const pct = Math.abs(mealSum - plan.target_kcal) / plan.target_kcal;
    if (pct > 0.05) {
      failures.push(`Meal kcal sum (${mealSum}) must be within ±5% of target_kcal (${plan.target_kcal})`);
    }
  }
  if (typeof kcal === 'number' && Number.isFinite(kcal) && kcal > 0) {
    const pctTarget = Math.abs(mealSum - kcal) / kcal;
    if (pctTarget > 0.05) {
      failures.push(`Meal kcal sum (${mealSum}) must be within ±5% of target (${kcal})`);
    }
  }

  return failures;
}
