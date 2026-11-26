import test from 'node:test';
import assert from 'node:assert/strict';
import {
  targetKcal,
  validateIntake,
  checkWorkout,
  checkDiet,
} from './plans.js';

// 5 sample member profiles covering cut/muscle/lean, M/F, beginner knee injury, vegetarian, peanut allergy
export const SAMPLE_PROFILES = {
  cutMale: {
    goal: 'fat loss',
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
    goal: 'muscle',
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
    goal: 'lean',
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
    goal: 'fat loss',
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
  peanutAllergyMale: {
    goal: 'muscle',
    age: 22,
    sex: 'male',
    height_cm: 180,
    weight_kg: 70,
    goal_weight_kg: 76,
    level: 'advanced',
    days_per_week: 5,
    equipment: 'full_gym',
    activity: 'moderate',
    injuries: null,
    diet_pref: 'halal',
    allergies: 'peanuts',
  },
};

test('targetKcal computes Mifflin-St Jeor x activity x goal with sex floor', () => {
  // cutMale: (10*88 + 6.25*176 - 5*32 + 5) = 880 + 1100 - 160 + 5 = 1825 * 1.55 * 0.85 = 2404.4375 -> 2404
  assert.equal(targetKcal(SAMPLE_PROFILES.cutMale), 2404);

  // muscleFemale: (10*55 + 6.25*164 - 5*25 - 161) = 550 + 1025 - 125 - 161 = 1289 * 1.725 * 1.10 = 2445.8775 -> 2446
  assert.equal(targetKcal(SAMPLE_PROFILES.muscleFemale), 2446);

  // vegetarianFemale: (520 + 968.75 - 145 - 161) = 1182.75 * 1.2 * 0.85 = 1206.4 -> 1206 (above 1200)
  assert.equal(targetKcal(SAMPLE_PROFILES.vegetarianFemale), 1206);

  // Floor check: very small cut female floors at 1200, small cut male floors at 1500
  assert.equal(
    targetKcal({ goal: 'fat loss', age: 60, sex: 'female', height_cm: 145, weight_kg: 45, activity: 'sedentary' }),
    1200,
  );
  assert.equal(
    targetKcal({ goal: 'fat loss', age: 60, sex: 'male', height_cm: 155, weight_kg: 52, activity: 'sedentary' }),
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
    goal: 'fly',
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
  assert.ok(bad.errors.length >= 10);
});

test('checkWorkout passes valid plans and catches every failure rule', () => {
  const validBeginner = {
    days: [
      { day: 'Mon', focus: 'Upper Push', exercises: [{ name: 'Push-ups', sets: 3, reps: '8-12', rest_sec: 60, notes: 'Controlled tempo' }] },
      { day: 'Wed', focus: 'Upper Pull', exercises: [{ name: 'Inverted Row', sets: 3, reps: '8-10', rest_sec: 60, notes: 'Squeeze shoulder blades' }] },
      { day: 'Fri', focus: 'Core & Glutes', exercises: [{ name: 'Glute Bridge', sets: 4, reps: '12-15', rest_sec: 45, notes: 'Keep knees stable' }] },
    ],
  };
  assert.deepEqual(checkWorkout(validBeginner, SAMPLE_PROFILES.beginnerKnee), []);

  // Wrong days count
  assert.ok(
    checkWorkout({ days: validBeginner.days.slice(0, 2) }, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /Expected 3 workout days/.test(e)),
  );

  // Beginner > 4 sets
  const tooManySets = structuredClone(validBeginner);
  tooManySets.days[0].exercises[0].sets = 5;
  assert.ok(
    checkWorkout(tooManySets, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /Beginner limit exceeded/.test(e)),
  );

  // Beginner 1RM work
  const oneRm = structuredClone(validBeginner);
  oneRm.days[0].exercises[0].reps = '1RM';
  assert.ok(
    checkWorkout(oneRm, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /1RM/.test(e)),
  );

  // Injury conflict: knee -> Squat / Lunge
  const kneeBad = structuredClone(validBeginner);
  kneeBad.days[2].exercises.push({ name: 'Bodyweight Squat', sets: 3, reps: '12', rest_sec: 60, notes: '' });
  assert.ok(
    checkWorkout(kneeBad, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /conflicts with listed injury/.test(e)),
  );

  const lungeBad = structuredClone(validBeginner);
  lungeBad.days[2].exercises.push({ name: 'Walking Lunge', sets: 3, reps: '10', rest_sec: 60, notes: '' });
  assert.ok(
    checkWorkout(lungeBad, SAMPLE_PROFILES.beginnerKnee)
      .some((e) => /conflicts with listed injury/.test(e)),
  );
});

test('checkDiet passes valid plans and catches kcal, macro, floor, diet_pref, and allergy failures', () => {
  const vegKcal = targetKcal(SAMPLE_PROFILES.vegetarianFemale); // 1206
  const validVeg = {
    target_kcal: 1206,
    protein_g: 85,
    carbs_g: 135,
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
  // Total = 190+60+160+230+195+320+50 = 1205 (within ±5% of 1206)
  assert.deepEqual(checkDiet(validVeg, SAMPLE_PROFILES.vegetarianFemale, vegKcal), []);

  // Vegetarian violation (meat / fish)
  const meatBad = structuredClone(validVeg);
  meatBad.meals[2].items[0] = { food: 'Grilled chicken breast', qty: '150g', kcal: 320 };
  assert.ok(
    checkDiet(meatBad, SAMPLE_PROFILES.vegetarianFemale, vegKcal)
      .some((e) => /vegetarian/.test(e)),
  );

  // Peanut allergy violation
  const allergyKcal = targetKcal(SAMPLE_PROFILES.peanutAllergyMale);
  const peanutBad = {
    target_kcal: allergyKcal,
    protein_g: 180,
    carbs_g: 340,
    fat_g: 85,
    meals: [
      {
        name: 'Breakfast',
        items: [
          { food: 'Oatmeal with peanut butter', qty: '1 bowl', kcal: Math.round(allergyKcal * 0.4) },
          { food: 'Chicken breast and rice', qty: '300g', kcal: Math.round(allergyKcal * 0.6) },
        ],
      },
    ],
  };
  assert.ok(
    checkDiet(peanutBad, SAMPLE_PROFILES.peanutAllergyMale, allergyKcal)
      .some((e) => /allergy/.test(e)),
  );

  // Halal violation (pork)
  const porkBad = structuredClone(peanutBad);
  porkBad.meals[0].items[0] = { food: 'Pork chop', qty: '200g', kcal: Math.round(allergyKcal * 0.4) };
  assert.ok(
    checkDiet(porkBad, SAMPLE_PROFILES.peanutAllergyMale, allergyKcal)
      .some((e) => /halal/.test(e)),
  );

  // Meal kcal sum outside ±5%
  const offKcal = structuredClone(validVeg);
  offKcal.meals[2].items[0].kcal = 600; // sum 1485 vs 1206
  assert.ok(
    checkDiet(offKcal, SAMPLE_PROFILES.vegetarianFemale, vegKcal)
      .some((e) => /within ±5%/.test(e)),
  );

  // Missing macros
  const noMacros = structuredClone(validVeg);
  delete noMacros.protein_g;
  assert.ok(
    checkDiet(noMacros, SAMPLE_PROFILES.vegetarianFemale, vegKcal)
      .some((e) => /protein_g/.test(e)),
  );

  // Floor violation
  const belowFloor = structuredClone(validVeg);
  belowFloor.target_kcal = 1100;
  assert.ok(
    checkDiet(belowFloor, SAMPLE_PROFILES.vegetarianFemale, 1100)
      .some((e) => /floor/.test(e)),
  );
});
