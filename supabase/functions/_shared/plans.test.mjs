import test from 'node:test';
import assert from 'node:assert/strict';
import {
  targetKcal,
  minProteinGrams,
  proteinRangeGrams,
  validateIntake,
  checkWorkout,
  checkDiet,
  estimateWorkoutDurationMin,
} from './plans.js';

export const SAMPLE_PROFILES = {
  cutMale: {
    goal_type: 'fat_loss',
    run_ok: true,
    session_minutes: 60,
    age: 32,
    sex: 'male',
    height_cm: 176,
    weight_kg: 88,
    goal_weight_kg: 76,
    level: 'intermediate',
    days_per_week: 4,
    equipment: 'full_gym',
    activity: 'moderate',
    injuries: null,
    diet_pref: null,
    allergies: null,
  },
  muscleFemale: {
    goal_type: 'muscle_gain',
    run_ok: false,
    session_minutes: 60,
    age: 25,
    sex: 'female',
    height_cm: 164,
    weight_kg: 55,
    goal_weight_kg: 60,
    level: 'intermediate',
    days_per_week: 4,
    equipment: 'dumbbells',
    activity: 'active',
    injuries: null,
    diet_pref: null,
    allergies: null,
  },
  beginnerKnee: {
    goal_type: 'maintain_lean',
    run_ok: false,
    session_minutes: 45,
    age: 40,
    sex: 'male',
    height_cm: 172,
    weight_kg: 80,
    goal_weight_kg: 75,
    level: 'beginner',
    days_per_week: 3,
    equipment: 'bodyweight',
    activity: 'light',
    injuries: 'left knee pain',
    diet_pref: null,
    allergies: null,
  },
  vegetarianFemale: {
    goal_type: 'fat_loss',
    run_ok: false,
    session_minutes: 45,
    age: 29,
    sex: 'female',
    height_cm: 155,
    weight_kg: 52,
    goal_weight_kg: 48,
    level: 'beginner',
    days_per_week: 3,
    equipment: 'dumbbells',
    activity: 'sedentary',
    injuries: null,
    diet_pref: 'vegetarian',
    allergies: null,
  },
  strengthMale: {
    goal_type: 'strength',
    run_ok: false,
    session_minutes: 60,
    age: 22,
    sex: 'male',
    height_cm: 180,
    weight_kg: 70,
    goal_weight_kg: 74,
    level: 'advanced',
    days_per_week: 4,
    equipment: 'full_gym',
    activity: 'moderate',
    injuries: null,
    diet_pref: 'halal',
    allergies: 'peanuts',
  },
};

function makeValidBeginnerLeanPlan() {
  // 3 days x 45 min, maintain_lean beginner range: 6-10 weekly sets per major muscle
  const cleanDay = (day, focus) => ({
    day,
    focus,
    exercises: [
      { name: 'Push-ups', muscles: ['chest', 'triceps', 'shoulders'], sets: 3, reps: '8-12', rest_sec: 120, rir: 2, notes: 'Controlled tempo' },
      { name: 'Inverted Row', muscles: ['back', 'biceps'], sets: 3, reps: '8-12', rest_sec: 120, rir: 2, notes: 'Squeeze shoulder blades' },
      { name: 'Glute Bridge', muscles: ['glutes', 'hamstrings'], sets: 3, reps: '10-15', rest_sec: 90, rir: 2, notes: 'Keep knees neutral' },
      { name: 'Dead Bug', muscles: ['core'], sets: 3, reps: '10-12', rest_sec: 60, rir: 3, notes: 'Brace gently' },
      { name: 'Standing Calf Raise', muscles: ['calves'], sets: 3, reps: '12-15', rest_sec: 60, rir: 3, notes: 'Full range of motion' },
    ],
  });
  return {
    days: [
      cleanDay('Mon', 'Full Body A'),
      cleanDay('Wed', 'Full Body B'),
      cleanDay('Fri', 'Full Body C'),
    ],
    cardio: [
      { day: 'Tue', type: 'walk', minutes: 30, intensity: 'easy conversation pace' },
      { day: 'Sat', type: 'incline_walk', minutes: 30, incline_pct: 6, intensity: 'moderate conversation pace' },
    ],
  };
}

test('targetKcal applies Mifflin-St Jeor, caps fat_loss deficit at 500 kcal, and enforces floor', () => {
  // cutMale: bmr = 880+1100-160+5 = 1825, tdee = round(1825*1.55) = 2829, 0.85 = 2405 (deficit 424 <= 500)
  assert.equal(targetKcal(SAMPLE_PROFILES.cutMale), 2405);

  // Heavy active male fat_loss: deficit > 500 gets capped at 500 kcal/day
  // bmr = 1300+1125-150+5 = 2280, tdee = round(2280*1.725) = 3933 -> 0.85 = 3343 (590 deficit) -> capped to 3933-500 = 3433
  assert.equal(
    targetKcal({ goal_type: 'fat_loss', age: 30, sex: 'male', height_cm: 180, weight_kg: 130, activity: 'active' }),
    3433,
  );

  // muscleFemale: +10%
  assert.equal(targetKcal(SAMPLE_PROFILES.muscleFemale), 2446);

  // Floors: 1200 F / 1500 M
  assert.equal(
    targetKcal({ goal_type: 'fat_loss', age: 60, sex: 'female', height_cm: 145, weight_kg: 45, activity: 'sedentary' }),
    1200,
  );
  assert.equal(
    targetKcal({ goal_type: 'fat_loss', age: 60, sex: 'male', height_cm: 155, weight_kg: 52, activity: 'sedentary' }),
    1500,
  );
});

test('validateIntake accepts valid profiles and rejects out-of-range / bad enums', () => {
  for (const [name, profile] of Object.entries(SAMPLE_PROFILES)) {
    const res = validateIntake(profile);
    assert.deepEqual(res.errors, [], `${name} should be valid`);
    assert.ok(res.data);
  }

  const bad = validateIntake({
    goal_type: 'fly',
    run_ok: 'yes',
    session_minutes: 90,
    age: 5,
    sex: 'other',
    height_cm: 80,
    weight_kg: 400,
    goal_weight_kg: 10,
    level: 'pro',
    days_per_week: 7,
    equipment: 'kettlebells',
    activity: 'extreme',
    injuries: 'x'.repeat(301),
    diet_pref: 'y'.repeat(301),
    allergies: 'z'.repeat(301),
  });
  assert.equal(bad.data, null);
  assert.ok(bad.errors.length >= 12);
});

test('checkWorkout validates volume, duration, RIR, cardio, run_ok/BMI, and injuries', () => {
  const valid = makeValidBeginnerLeanPlan();
  assert.ok(estimateWorkoutDurationMin(valid.days[0]) >= 30 && estimateWorkoutDurationMin(valid.days[0]) <= 50);
  assert.deepEqual(checkWorkout(valid, SAMPLE_PROFILES.beginnerKnee), []);

  // Wrong days count
  assert.ok(
    checkWorkout({ ...valid, days: valid.days.slice(0, 2) }, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /Expected 3 workout days/.test(e)),
  );

  // Beginner > 4 sets
  const tooManySets = structuredClone(valid);
  tooManySets.days[0].exercises[0].sets = 5;
  assert.ok(
    checkWorkout(tooManySets, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /Beginner limit exceeded/.test(e)),
  );

  // Beginner RIR < 2
  const badRir = structuredClone(valid);
  badRir.days[0].exercises[0].rir = 1;
  assert.ok(
    checkWorkout(badRir, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /rir .* must be 2-3/.test(e)),
  );

  // Unknown muscle tag
  const badMuscle = structuredClone(valid);
  badMuscle.days[0].exercises[0].muscles = ['forearms'];
  assert.ok(
    checkWorkout(badMuscle, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /unknown muscle tag/.test(e)),
  );

  // Too many working sets (> 20)
  const overVolume = structuredClone(valid);
  overVolume.days[0].exercises.push({
    name: 'Dips',
    muscles: ['chest'],
    sets: 9,
    reps: '8-12',
    rest_sec: 90,
    rir: 2,
    notes: '',
  });
  assert.ok(
    checkWorkout(overVolume, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /working sets \(max 20\)/.test(e)),
  );

  // Injury conflict: knee -> Squat
  const kneeBad = structuredClone(valid);
  kneeBad.days[2].exercises[2] = {
    name: 'Bodyweight Squat',
    muscles: ['quads', 'glutes'],
    sets: 3,
    reps: '10-12',
    rest_sec: 90,
    rir: 2,
    notes: '',
  };
  assert.ok(
    checkWorkout(kneeBad, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /conflicts with listed injury/.test(e)),
  );

  // Running rejected when run_ok=false or BMI >= 30 or lower-body injury
  const runBad = structuredClone(valid);
  runBad.cardio.push({ day: 'Sun', type: 'run', minutes: 20, intensity: 'easy' });
  assert.ok(
    checkWorkout(runBad, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /run_ok is false/.test(e)),
  );

  const highBmiCut = { ...SAMPLE_PROFILES.cutMale, weight_kg: 110, height_cm: 175, run_ok: true }; // BMI ~35.9
  assert.ok(
    checkWorkout(
      {
        days: [valid.days[0], valid.days[1], valid.days[2], valid.days[0]],
        cardio: [
          { day: 'Mon', type: 'walk', minutes: 35, intensity: 'easy' },
          { day: 'Wed', type: 'walk', minutes: 35, intensity: 'easy' },
          { day: 'Fri', type: 'run', minutes: 25, intensity: 'easy' },
        ],
      },
      highBmiCut,
    ).some((e) => /BMI .* >= 30/.test(e)),
  );
});

test('checkDiet validates kcal, protein target, floor, diet_pref, and allergies', () => {
  const vegKcal = targetKcal(SAMPLE_PROFILES.vegetarianFemale); // 1206
  const reqProt = minProteinGrams(SAMPLE_PROFILES.vegetarianFemale, vegKcal); // round(52 * 1.8) = 94g
  const validVeg = {
    target_kcal: vegKcal,
    protein_g: reqProt,
    carbs_g: 125,
    fat_g: 36,
    meals: [
      {
        name: 'Breakfast',
        items: [
          { food: 'Rolled oats', qty: '50g', kcal: 190 },
          { food: 'Almond milk', qty: '250ml', kcal: 60 },
          { food: 'Eggplant scramble with tofu', qty: '150g', kcal: 160 },
        ],
      },
      {
        name: 'Lunch',
        items: [
          { food: 'Lentil dal', qty: '200g', kcal: 230 },
          { food: 'Steamed rice', qty: '150g', kcal: 195 },
        ],
      },
      {
        name: 'Dinner',
        items: [
          { food: 'Paneer tikka', qty: '120g', kcal: 320 },
          { food: 'Mixed salad', qty: '100g', kcal: 50 },
        ],
      },
    ],
  };
  assert.deepEqual(checkDiet(validVeg, SAMPLE_PROFILES.vegetarianFemale, vegKcal), []);

  // Low protein caught
  const lowProt = structuredClone(validVeg);
  lowProt.protein_g = 60;
  assert.ok(
    checkDiet(lowProt, SAMPLE_PROFILES.vegetarianFemale, vegKcal)
      .some((e) => /below minimum target/.test(e)),
  );

  // Vegetarian violation
  const meatBad = structuredClone(validVeg);
  meatBad.meals[2].items[0] = { food: 'Grilled chicken breast', qty: '150g', kcal: 320 };
  assert.ok(
    checkDiet(meatBad, SAMPLE_PROFILES.vegetarianFemale, vegKcal)
      .some((e) => /vegetarian/.test(e)),
  );

  // Peanut allergy violation
  const strengthKcal = targetKcal(SAMPLE_PROFILES.strengthMale);
  const peanutBad = {
    target_kcal: strengthKcal,
    protein_g: minProteinGrams(SAMPLE_PROFILES.strengthMale, strengthKcal),
    carbs_g: 300,
    fat_g: 80,
    meals: [
      {
        name: 'Breakfast',
        items: [
          { food: 'Oatmeal with peanut butter', qty: '1 bowl', kcal: Math.round(strengthKcal * 0.4) },
          { food: 'Chicken breast and rice', qty: '300g', kcal: Math.round(strengthKcal * 0.6) },
        ],
      },
    ],
  };
  assert.ok(
    checkDiet(peanutBad, SAMPLE_PROFILES.strengthMale, strengthKcal)
      .some((e) => /allergy/.test(e)),
  );

  // Meal kcal sum outside ±5%
  const offKcal = structuredClone(validVeg);
  offKcal.meals[2].items[0].kcal = 600;
  assert.ok(
    checkDiet(offKcal, SAMPLE_PROFILES.vegetarianFemale, vegKcal)
      .some((e) => /within ±5%/.test(e)),
  );

  // Protein ranges: 1.8-2.4 g/kg for fat_loss/maintain_lean, >= 1.6 g/kg otherwise
  assert.deepEqual(proteinRangeGrams(SAMPLE_PROFILES.cutMale, 2405), [158, 211]);
  assert.deepEqual(proteinRangeGrams(SAMPLE_PROFILES.muscleFemale, 2446), [88, null]);
});
