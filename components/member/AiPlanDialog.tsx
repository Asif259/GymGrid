"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Member } from "@/types/gym";

export interface AiPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  onGenerated: () => Promise<void>;
}

type FieldKey = "age" | "height_cm" | "weight_kg" | "goal_weight_kg";

function initialGoal(raw: string | null | undefined): string {
  const g = raw?.trim().toLowerCase() ?? "";
  if (g === "fat loss" || g === "muscle" || g === "lean") return g;
  if (g === "fitness") return "lean";
  return "lean";
}

async function extractInvokeError(error: unknown, data: unknown): Promise<{ message: string; code?: string }> {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return {
      message: data.error,
      code: "code" in data && typeof data.code === "string" ? data.code : undefined,
    };
  }
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const cloned = (ctx as Response).clone();
      const body = await cloned.json();
      if (body && typeof body.error === "string") {
        if (body.code === "ai_not_configured" || (ctx as Response).status === 409) {
          return { message: "Your gym hasn't turned on AI plans yet", code: "ai_not_configured" };
        }
        if (Array.isArray(body.failures) && body.failures.length > 0) {
          return { message: `${body.error}: ${body.failures[0]}`, code: body.code };
        }
        return { message: body.error, code: body.code };
      }
    } catch {
      // Fall through to generic message
    }
  }
  return {
    message: error instanceof Error ? error.message : "Could not generate plan",
  };
}

function validateNumericField(field: FieldKey, raw: string): string | null {
  const trimmed = raw.trim();
  if (field === "goal_weight_kg" && !trimmed) return null;
  const n = Number(trimmed);
  if (field === "age") {
    return !Number.isInteger(n) || n < 10 || n > 100
      ? "Enter a whole age between 10 and 100."
      : null;
  }
  if (field === "height_cm") {
    return !Number.isInteger(n) || n < 100 || n > 250
      ? "Enter a whole height in cm (100–250)."
      : null;
  }
  if (field === "weight_kg") {
    return !trimmed || !Number.isFinite(n) || n < 25 || n > 300
      ? "Enter a weight in kg (25–300)."
      : null;
  }
  return !Number.isFinite(n) || n < 25 || n > 300
    ? "Enter a goal weight in kg (25–300), or leave it blank."
    : null;
}

function AiPlanDialogForm({
  member,
  titleId,
  onOpenChange,
  onGenerated,
}: {
  member: Member;
  titleId: string;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => Promise<void>;
}) {
  const alertRef = useRef<HTMLDivElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const goalWeightRef = useRef<HTMLInputElement>(null);

  const [goal, setGoal] = useState(() => initialGoal(member.goal));
  const [heightCm, setHeightCm] = useState(() =>
    member.height_cm != null ? String(member.height_cm) : "",
  );
  const [weightKg, setWeightKg] = useState(() =>
    member.weight_kg != null ? String(member.weight_kg) : "",
  );
  const [goalWeightKg, setGoalWeightKg] = useState(() =>
    member.goal_weight_kg != null ? String(member.goal_weight_kg) : "",
  );
  const [age, setAge] = useState(() =>
    member.age != null ? String(member.age) : "",
  );
  const [sex, setSex] = useState(() =>
    member.sex === "male" || member.sex === "female" ? member.sex : "male",
  );
  const [level, setLevel] = useState(() =>
    member.level === "beginner" ||
    member.level === "intermediate" ||
    member.level === "advanced"
      ? member.level
      : "beginner",
  );
  const [daysPerWeek, setDaysPerWeek] = useState(() =>
    member.days_per_week != null &&
    member.days_per_week >= 2 &&
    member.days_per_week <= 6
      ? String(member.days_per_week)
      : "3",
  );
  const [equipment, setEquipment] = useState(() =>
    member.equipment === "full_gym" ||
    member.equipment === "dumbbells" ||
    member.equipment === "bodyweight"
      ? member.equipment
      : "full_gym",
  );
  const [activity, setActivity] = useState(() =>
    member.activity === "sedentary" ||
    member.activity === "light" ||
    member.activity === "moderate" ||
    member.activity === "active"
      ? member.activity
      : "moderate",
  );
  const [injuries, setInjuries] = useState(() => member.injuries ?? "");
  const [dietPref, setDietPref] = useState(() => member.diet_pref ?? "");
  const [allergies, setAllergies] = useState(() => member.allergies ?? "");

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [stageText, setStageText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleBlur(field: FieldKey, raw: string) {
    const err = validateNumericField(field, raw);
    setFieldErrors((prev) => ({ ...prev, [field]: err ?? undefined }));
  }

  function clearFieldErrorOnValidInput(field: FieldKey, raw: string) {
    if (!fieldErrors[field]) return;
    if (!validateNumericField(field, raw)) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);

    const nextErrors: Partial<Record<FieldKey, string>> = {
      age: validateNumericField("age", age) ?? undefined,
      height_cm: validateNumericField("height_cm", heightCm) ?? undefined,
      weight_kg: validateNumericField("weight_kg", weightKg) ?? undefined,
      goal_weight_kg: validateNumericField("goal_weight_kg", goalWeightKg) ?? undefined,
    };
    setFieldErrors(nextErrors);

    const firstInvalid: Array<[FieldKey, React.RefObject<HTMLInputElement | null>]> = [
      ["age", ageRef],
      ["height_cm", heightRef],
      ["weight_kg", weightRef],
      ["goal_weight_kg", goalWeightRef],
    ];
    for (const [key, ref] of firstInvalid) {
      if (nextErrors[key]) {
        setErrorMsg(nextErrors[key]);
        ref.current?.focus();
        return;
      }
    }

    const parsedGoalWeight = goalWeightKg.trim() ? Number(goalWeightKg) : null;
    const intake = {
      member_id: member.id,
      goal,
      age: Number(age),
      sex,
      height_cm: Number(heightCm),
      weight_kg: Number(weightKg),
      goal_weight_kg: parsedGoalWeight,
      level,
      days_per_week: Number(daysPerWeek),
      equipment,
      activity,
      injuries: injuries.trim() || null,
      diet_pref: dietPref.trim() || null,
      allergies: allergies.trim() || null,
    };

    const supabase = createClient();
    setSubmitting(true);
    let anySaved = false;

    try {
      setStageText("Generating workout split…");
      const wRes = await supabase.functions.invoke("generate-plan", {
        body: { ...intake, kind: "workout" },
      });
      if (wRes.error) {
        const errInfo = await extractInvokeError(wRes.error, wRes.data);
        setErrorMsg(
          errInfo.code === "ai_not_configured"
            ? errInfo.message
            : `Workout plan: ${errInfo.message}`,
        );
        alertRef.current?.focus();
        return;
      }
      anySaved = true;

      setStageText("Generating diet plan…");
      const dRes = await supabase.functions.invoke("generate-plan", {
        body: { ...intake, kind: "diet" },
      });
      if (dRes.error) {
        const errInfo = await extractInvokeError(dRes.error, dRes.data);
        await onGenerated();
        setErrorMsg(
          errInfo.code === "ai_not_configured"
            ? errInfo.message
            : `Workout plan saved, but diet plan failed: ${errInfo.message}`,
        );
        alertRef.current?.focus();
        return;
      }

      await onGenerated();
      toast.success("Your personalized AI plans are ready!");
      onOpenChange(false);
    } catch (err) {
      if (anySaved) await onGenerated();
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      alertRef.current?.focus();
    } finally {
      setSubmitting(false);
      setStageText("");
    }
  }

  return (
    <form
      aria-labelledby={titleId}
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <div className="flex flex-1 flex-col gap-4 p-5">
        {errorMsg ? (
          <div
            ref={alertRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl bg-status-rose-bg px-3 py-2.5 text-xs font-medium text-status-rose-fg break-words"
          >
            {errorMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-goal">Goal *</Label>
            <Select name="goal" value={goal} onValueChange={setGoal} disabled={submitting}>
              <SelectTrigger id="ai-goal" className="min-h-11 w-full sm:min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fat loss">Fat loss</SelectItem>
                <SelectItem value="muscle">Muscle gain</SelectItem>
                <SelectItem value="lean">Stay lean / fitness</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-sex">Sex *</Label>
            <Select name="sex" value={sex} onValueChange={setSex} disabled={submitting}>
              <SelectTrigger id="ai-sex" className="min-h-11 w-full sm:min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-age">Age *</Label>
            <Input
              ref={ageRef}
              id="ai-age"
              name="age"
              type="number"
              inputMode="numeric"
              enterKeyHint="next"
              required
              min={10}
              max={100}
              aria-invalid={fieldErrors.age ? true : false}
              aria-describedby={fieldErrors.age ? "ai-age-err" : undefined}
              className="min-h-11 user-invalid:border-destructive sm:min-h-10"
              value={age}
              disabled={submitting}
              onBlur={() => handleBlur("age", age)}
              onChange={(e) => {
                setAge(e.target.value);
                clearFieldErrorOnValidInput("age", e.target.value);
              }}
            />
            {fieldErrors.age ? (
              <span id="ai-age-err" className="text-xs text-destructive">
                {fieldErrors.age}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-height">Height (cm) *</Label>
            <Input
              ref={heightRef}
              id="ai-height"
              name="height_cm"
              type="number"
              inputMode="numeric"
              enterKeyHint="next"
              required
              min={100}
              max={250}
              aria-invalid={fieldErrors.height_cm ? true : false}
              aria-describedby={fieldErrors.height_cm ? "ai-height-err" : undefined}
              className="min-h-11 user-invalid:border-destructive sm:min-h-10"
              value={heightCm}
              disabled={submitting}
              onBlur={() => handleBlur("height_cm", heightCm)}
              onChange={(e) => {
                setHeightCm(e.target.value);
                clearFieldErrorOnValidInput("height_cm", e.target.value);
              }}
            />
            {fieldErrors.height_cm ? (
              <span id="ai-height-err" className="text-xs text-destructive">
                {fieldErrors.height_cm}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-weight">Weight (kg) *</Label>
            <Input
              ref={weightRef}
              id="ai-weight"
              name="weight_kg"
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              required
              step="0.1"
              min={25}
              max={300}
              aria-invalid={fieldErrors.weight_kg ? true : false}
              aria-describedby={fieldErrors.weight_kg ? "ai-weight-err" : undefined}
              className="min-h-11 user-invalid:border-destructive sm:min-h-10"
              value={weightKg}
              disabled={submitting}
              onBlur={() => handleBlur("weight_kg", weightKg)}
              onChange={(e) => {
                setWeightKg(e.target.value);
                clearFieldErrorOnValidInput("weight_kg", e.target.value);
              }}
            />
            {fieldErrors.weight_kg ? (
              <span id="ai-weight-err" className="text-xs text-destructive">
                {fieldErrors.weight_kg}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-goal-weight">Goal weight (kg)</Label>
            <Input
              ref={goalWeightRef}
              id="ai-goal-weight"
              name="goal_weight_kg"
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              step="0.1"
              min={25}
              max={300}
              placeholder="Optional"
              aria-invalid={fieldErrors.goal_weight_kg ? true : false}
              aria-describedby={fieldErrors.goal_weight_kg ? "ai-goal-weight-err" : undefined}
              className="min-h-11 user-invalid:border-destructive sm:min-h-10"
              value={goalWeightKg}
              disabled={submitting}
              onBlur={() => handleBlur("goal_weight_kg", goalWeightKg)}
              onChange={(e) => {
                setGoalWeightKg(e.target.value);
                clearFieldErrorOnValidInput("goal_weight_kg", e.target.value);
              }}
            />
            {fieldErrors.goal_weight_kg ? (
              <span id="ai-goal-weight-err" className="text-xs text-destructive">
                {fieldErrors.goal_weight_kg}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-level">Experience level *</Label>
            <Select name="level" value={level} onValueChange={setLevel} disabled={submitting}>
              <SelectTrigger id="ai-level" className="min-h-11 w-full sm:min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-days">Days per week *</Label>
            <Select name="days_per_week" value={daysPerWeek} onValueChange={setDaysPerWeek} disabled={submitting}>
              <SelectTrigger id="ai-days" className="min-h-11 w-full sm:min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 days / week</SelectItem>
                <SelectItem value="3">3 days / week</SelectItem>
                <SelectItem value="4">4 days / week</SelectItem>
                <SelectItem value="5">5 days / week</SelectItem>
                <SelectItem value="6">6 days / week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-equipment">Equipment *</Label>
            <Select name="equipment" value={equipment} onValueChange={setEquipment} disabled={submitting}>
              <SelectTrigger id="ai-equipment" className="min-h-11 w-full sm:min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_gym">Full gym</SelectItem>
                <SelectItem value="dumbbells">Dumbbells</SelectItem>
                <SelectItem value="bodyweight">Bodyweight</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-activity">Daily activity *</Label>
            <Select name="activity" value={activity} onValueChange={setActivity} disabled={submitting}>
              <SelectTrigger id="ai-activity" className="min-h-11 w-full sm:min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary (desk job)</SelectItem>
                <SelectItem value="light">Light (1–2 walks/wk)</SelectItem>
                <SelectItem value="moderate">Moderate (active daily)</SelectItem>
                <SelectItem value="active">Very active (physical job)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ai-injuries">Injuries or pain areas</Label>
            <Input
              id="ai-injuries"
              name="injuries"
              maxLength={300}
              enterKeyHint="next"
              placeholder="e.g. left knee, lower back (or leave blank)"
              className="min-h-11 sm:min-h-10"
              value={injuries}
              disabled={submitting}
              onChange={(e) => setInjuries(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-diet-pref">Diet preference</Label>
            <Input
              id="ai-diet-pref"
              name="diet_pref"
              maxLength={300}
              enterKeyHint="next"
              placeholder="e.g. halal, vegetarian, vegan"
              className="min-h-11 sm:min-h-10"
              value={dietPref}
              disabled={submitting}
              onChange={(e) => setDietPref(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-allergies">Food allergies</Label>
            <Input
              id="ai-allergies"
              name="allergies"
              maxLength={300}
              enterKeyHint="done"
              placeholder="e.g. peanuts, dairy, shellfish"
              className="min-h-11 sm:min-h-10"
              value={allergies}
              disabled={submitting}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground text-pretty">
          <p>General fitness guidance, not medical advice.</p>
          <p>Your details are sent to the gym&apos;s AI provider to build the plan.</p>
        </div>
      </div>

      <SheetFooter className="border-t p-5">
        <Button
          type="submit"
          className="min-h-11 w-full touch-manipulation"
          disabled={submitting}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          <span>{submitting ? stageText || "Generating plans…" : "Generate my AI plans"}</span>
        </Button>
      </SheetFooter>
    </form>
  );
}

/**
 * Member-triggered AI workout and diet plan intake sheet.
 * Prefills from the member row and invokes `generate-plan` for workout and diet.
 */
export function AiPlanDialog({
  open,
  onOpenChange,
  member,
  onGenerated,
}: AiPlanDialogProps) {
  const titleId = useId();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto overscroll-contain data-[side=right]:w-full sm:max-w-lg data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader className="gap-1.5 border-b p-5 pe-12">
          <SheetTitle id={titleId}>Create your AI plans</SheetTitle>
          <SheetDescription className="text-pretty">
            Confirm your stats and preferences. Safety checks run automatically before saving.
          </SheetDescription>
        </SheetHeader>

        {open ? (
          <AiPlanDialogForm
            key={member.id}
            member={member}
            titleId={titleId}
            onOpenChange={onOpenChange}
            onGenerated={onGenerated}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
