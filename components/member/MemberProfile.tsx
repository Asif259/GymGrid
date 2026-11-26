"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Clock, Copy, LogOut, Phone, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate, fmtDateTimeDhaka, normalizePhone } from "@/lib/logic";
import type { GymSettings, Member } from "@/types/gym";

export interface MemberProfileProps {
  member: Member;
  settings: GymSettings;
  trainerName: string;
  email?: string | null;
  onUpdated: () => Promise<void>;
  onSignOut: () => void;
}

type ProfileFieldKey =
  | "name"
  | "phone"
  | "age"
  | "height_cm"
  | "weight_kg"
  | "goal_weight_kg";

function deriveInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "M"
  );
}

function validateField(field: ProfileFieldKey, raw: string): string | null {
  const trimmed = raw.trim();
  if (field === "name") {
    return trimmed.length < 2 || trimmed.length > 80
      ? "Enter your full name (2–80 characters)."
      : null;
  }
  if (field === "phone") {
    return normalizePhone(trimmed)
      ? null
      : "Enter phone with country code, e.g. 8801XXXXXXXXX.";
  }
  if (!trimmed) return null;
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
    return !Number.isFinite(n) || n < 25 || n > 300
      ? "Enter weight in kg (25–300)."
      : null;
  }
  return !Number.isFinite(n) || n < 25 || n > 300
    ? "Enter goal weight in kg (25–300)."
    : null;
}

function MemberProfileForm({
  member,
  onUpdated,
}: {
  member: Member;
  onUpdated: () => Promise<void>;
}) {
  const formHeadingId = useId();
  const alertRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const goalWeightRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(member.name ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [goalType, setGoalType] = useState(member.goal_type ?? "");
  const [goal, setGoal] = useState(member.goal ?? "");
  const [runOk, setRunOk] = useState<"" | "yes" | "no">(
    member.run_ok === true ? "yes" : member.run_ok === false ? "no" : "",
  );
  const [sessionMinutes, setSessionMinutes] = useState<"" | "45" | "60">(
    member.session_minutes === 45 ? "45" : member.session_minutes === 60 ? "60" : "",
  );
  const [age, setAge] = useState(member.age != null ? String(member.age) : "");
  const [sex, setSex] = useState(member.sex ?? "");
  const [heightCm, setHeightCm] = useState(
    member.height_cm != null ? String(member.height_cm) : "",
  );
  const [weightKg, setWeightKg] = useState(
    member.weight_kg != null ? String(member.weight_kg) : "",
  );
  const [goalWeightKg, setGoalWeightKg] = useState(
    member.goal_weight_kg != null ? String(member.goal_weight_kg) : "",
  );
  const [level, setLevel] = useState(member.level ?? "");
  const [daysPerWeek, setDaysPerWeek] = useState(
    member.days_per_week != null ? String(member.days_per_week) : "",
  );
  const [equipment, setEquipment] = useState(member.equipment ?? "");
  const [activity, setActivity] = useState(member.activity ?? "");
  const [injuries, setInjuries] = useState(member.injuries ?? "");
  const [dietPref, setDietPref] = useState(member.diet_pref ?? "");
  const [allergies, setAllergies] = useState(member.allergies ?? "");

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ProfileFieldKey, string>>
  >({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleBlur(field: ProfileFieldKey, raw: string) {
    const err = validateField(field, raw);
    setFieldErrors((prev) => ({ ...prev, [field]: err ?? undefined }));
  }

  function clearFieldErrorIfValid(field: ProfileFieldKey, raw: string) {
    if (!fieldErrors[field]) return;
    if (!validateField(field, raw)) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setErrorMsg(null);

    const nextErrors: Partial<Record<ProfileFieldKey, string>> = {
      name: validateField("name", name) ?? undefined,
      phone: validateField("phone", phone) ?? undefined,
      age: validateField("age", age) ?? undefined,
      height_cm: validateField("height_cm", heightCm) ?? undefined,
      weight_kg: validateField("weight_kg", weightKg) ?? undefined,
      goal_weight_kg: validateField("goal_weight_kg", goalWeightKg) ?? undefined,
    };
    setFieldErrors(nextErrors);

    const refs: Array<[ProfileFieldKey, React.RefObject<HTMLInputElement | null>]> = [
      ["name", nameRef],
      ["phone", phoneRef],
      ["age", ageRef],
      ["height_cm", heightRef],
      ["weight_kg", weightRef],
      ["goal_weight_kg", goalWeightRef],
    ];
    for (const [key, ref] of refs) {
      if (nextErrors[key]) {
        setErrorMsg(nextErrors[key]);
        ref.current?.focus();
        return;
      }
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      setErrorMsg("Enter phone with country code, e.g. 8801XXXXXXXXX.");
      phoneRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("update_my_profile", {
        p_member_id: member.id,
        p_name: name.trim(),
        p_phone: cleanPhone,
        p_goal: goal.trim() || null,
        p_goal_type: goalType || null,
        p_run_ok: runOk === "" ? null : runOk === "yes",
        p_session_minutes: sessionMinutes ? Number(sessionMinutes) : null,
        p_age: age.trim() ? Number(age) : null,
        p_sex: sex || null,
        p_height_cm: heightCm.trim() ? Number(heightCm) : null,
        p_weight_kg: weightKg.trim() ? Number(weightKg) : null,
        p_goal_weight_kg: goalWeightKg.trim() ? Number(goalWeightKg) : null,
        p_level: level || null,
        p_days_per_week: daysPerWeek ? Number(daysPerWeek) : null,
        p_equipment: equipment || null,
        p_activity: activity || null,
        p_injuries: injuries.trim() || null,
        p_diet_pref: dietPref.trim() || null,
        p_allergies: allergies.trim() || null,
      });
      if (error) {
        setErrorMsg(error.message);
        alertRef.current?.focus();
        return;
      }
      await onUpdated();
      toast.success("Profile updated");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl shadow-xs">
      <CardHeader>
        <CardTitle id={formHeadingId} className="text-lg text-balance">
          Personal &amp; fitness details
        </CardTitle>
        <CardDescription className="text-pretty">
          Update your contact info, measurements, and training preferences. Your gym owner can see when these details were last updated.
        </CardDescription>
      </CardHeader>

      <form
        aria-labelledby={formHeadingId}
        noValidate
        onSubmit={(e) => void handleSubmit(e)}
      >
        <CardContent className="flex flex-col gap-4">
          {errorMsg ? (
            <Alert
              ref={alertRef}
              tabIndex={-1}
              variant="destructive"
              className="border-destructive/30 bg-status-rose-bg text-status-rose-fg"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription className="text-xs font-medium text-status-rose-fg break-words">
                {errorMsg}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-name">Full name *</Label>
              <Input
                ref={nameRef}
                id="prof-name"
                name="name"
                required
                autoComplete="name"
                enterKeyHint="next"
                aria-invalid={fieldErrors.name ? true : false}
                aria-describedby={fieldErrors.name ? "prof-name-err" : undefined}
                className="min-h-11 user-invalid:border-destructive sm:min-h-10"
                value={name}
                disabled={saving}
                onBlur={() => handleBlur("name", name)}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldErrorIfValid("name", e.target.value);
                }}
              />
              {fieldErrors.name ? (
                <span id="prof-name-err" className="text-xs text-destructive">
                  {fieldErrors.name}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-phone">Phone with country code *</Label>
              <Input
                ref={phoneRef}
                id="prof-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                enterKeyHint="next"
                placeholder="8801XXXXXXXXX"
                aria-invalid={fieldErrors.phone ? true : false}
                aria-describedby={fieldErrors.phone ? "prof-phone-err" : undefined}
                className="min-h-11 user-invalid:border-destructive sm:min-h-10"
                value={phone}
                disabled={saving}
                onBlur={() => handleBlur("phone", phone)}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearFieldErrorIfValid("phone", e.target.value);
                }}
              />
              {fieldErrors.phone ? (
                <span id="prof-phone-err" className="text-xs text-destructive">
                  {fieldErrors.phone}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-age">Age</Label>
              <Input
                ref={ageRef}
                id="prof-age"
                name="age"
                type="number"
                inputMode="numeric"
                enterKeyHint="next"
                min={10}
                max={100}
                aria-invalid={fieldErrors.age ? true : false}
                aria-describedby={fieldErrors.age ? "prof-age-err" : undefined}
                className="min-h-11 user-invalid:border-destructive sm:min-h-10"
                value={age}
                disabled={saving}
                onBlur={() => handleBlur("age", age)}
                onChange={(e) => {
                  setAge(e.target.value);
                  clearFieldErrorIfValid("age", e.target.value);
                }}
              />
              {fieldErrors.age ? (
                <span id="prof-age-err" className="text-xs text-destructive">
                  {fieldErrors.age}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-sex">Sex</Label>
              <Select
                name="sex"
                value={sex || "none"}
                onValueChange={(v) => setSex(v === "none" ? "" : v)}
                disabled={saving}
              >
                <SelectTrigger id="prof-sex" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-height">Height (cm)</Label>
              <Input
                ref={heightRef}
                id="prof-height"
                name="height_cm"
                type="number"
                inputMode="numeric"
                enterKeyHint="next"
                min={100}
                max={250}
                aria-invalid={fieldErrors.height_cm ? true : false}
                aria-describedby={fieldErrors.height_cm ? "prof-height-err" : undefined}
                className="min-h-11 user-invalid:border-destructive sm:min-h-10"
                value={heightCm}
                disabled={saving}
                onBlur={() => handleBlur("height_cm", heightCm)}
                onChange={(e) => {
                  setHeightCm(e.target.value);
                  clearFieldErrorIfValid("height_cm", e.target.value);
                }}
              />
              {fieldErrors.height_cm ? (
                <span id="prof-height-err" className="text-xs text-destructive">
                  {fieldErrors.height_cm}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-weight">Weight (kg)</Label>
              <Input
                ref={weightRef}
                id="prof-weight"
                name="weight_kg"
                type="number"
                inputMode="decimal"
                enterKeyHint="next"
                step="0.1"
                min={25}
                max={300}
                aria-invalid={fieldErrors.weight_kg ? true : false}
                aria-describedby={fieldErrors.weight_kg ? "prof-weight-err" : undefined}
                className="min-h-11 user-invalid:border-destructive sm:min-h-10"
                value={weightKg}
                disabled={saving}
                onBlur={() => handleBlur("weight_kg", weightKg)}
                onChange={(e) => {
                  setWeightKg(e.target.value);
                  clearFieldErrorIfValid("weight_kg", e.target.value);
                }}
              />
              {fieldErrors.weight_kg ? (
                <span id="prof-weight-err" className="text-xs text-destructive">
                  {fieldErrors.weight_kg}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-goal-weight">Goal weight (kg)</Label>
              <Input
                ref={goalWeightRef}
                id="prof-goal-weight"
                name="goal_weight_kg"
                type="number"
                inputMode="decimal"
                enterKeyHint="next"
                step="0.1"
                min={25}
                max={300}
                placeholder="Optional"
                aria-invalid={fieldErrors.goal_weight_kg ? true : false}
                aria-describedby={
                  fieldErrors.goal_weight_kg ? "prof-goal-weight-err" : undefined
                }
                className="min-h-11 user-invalid:border-destructive sm:min-h-10"
                value={goalWeightKg}
                disabled={saving}
                onBlur={() => handleBlur("goal_weight_kg", goalWeightKg)}
                onChange={(e) => {
                  setGoalWeightKg(e.target.value);
                  clearFieldErrorIfValid("goal_weight_kg", e.target.value);
                }}
              />
              {fieldErrors.goal_weight_kg ? (
                <span id="prof-goal-weight-err" className="text-xs text-destructive">
                  {fieldErrors.goal_weight_kg}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-goal-type">Goal</Label>
              <Select
                name="goal_type"
                value={goalType || "none"}
                onValueChange={(v) => setGoalType(v === "none" ? "" : v)}
                disabled={saving}
              >
                <SelectTrigger id="prof-goal-type" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="muscle_gain">Build muscle (hypertrophy)</SelectItem>
                  <SelectItem value="strength">Get stronger</SelectItem>
                  <SelectItem value="fat_loss">Lose fat (cutting)</SelectItem>
                  <SelectItem value="maintain_lean">Stay lean</SelectItem>
                  <SelectItem value="general_fitness">General fitness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-session-minutes">Session length</Label>
              <Select
                name="session_minutes"
                value={sessionMinutes || "none"}
                onValueChange={(v) =>
                  setSessionMinutes(v === "45" || v === "60" ? v : "")
                }
                disabled={saving}
              >
                <SelectTrigger id="prof-session-minutes" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-run-ok">OK with running?</Label>
              <Select
                name="run_ok"
                value={runOk || "none"}
                onValueChange={(v) =>
                  setRunOk(v === "yes" || v === "no" ? v : "")
                }
                disabled={saving}
              >
                <SelectTrigger id="prof-run-ok" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="no">No (low-impact cardio only)</SelectItem>
                  <SelectItem value="yes">Yes (running is OK)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-goal-notes">Goal notes</Label>
              <Input
                id="prof-goal-notes"
                name="goal"
                maxLength={60}
                enterKeyHint="next"
                placeholder="Optional extra note"
                className="min-h-11 sm:min-h-10"
                value={goal}
                disabled={saving}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-level">Experience level</Label>
              <Select
                name="level"
                value={level || "none"}
                onValueChange={(v) => setLevel(v === "none" ? "" : v)}
                disabled={saving}
              >
                <SelectTrigger id="prof-level" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-days">Training days / week</Label>
              <Select
                name="days_per_week"
                value={daysPerWeek || "none"}
                onValueChange={(v) => setDaysPerWeek(v === "none" ? "" : v)}
                disabled={saving}
              >
                <SelectTrigger id="prof-days" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="2">2 days / week</SelectItem>
                  <SelectItem value="3">3 days / week</SelectItem>
                  <SelectItem value="4">4 days / week</SelectItem>
                  <SelectItem value="5">5 days / week</SelectItem>
                  <SelectItem value="6">6 days / week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-equipment">Equipment</Label>
              <Select
                name="equipment"
                value={equipment || "none"}
                onValueChange={(v) => setEquipment(v === "none" ? "" : v)}
                disabled={saving}
              >
                <SelectTrigger id="prof-equipment" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="full_gym">Full gym</SelectItem>
                  <SelectItem value="dumbbells">Dumbbells</SelectItem>
                  <SelectItem value="bodyweight">Bodyweight</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-activity">Daily activity</Label>
              <Select
                name="activity"
                value={activity || "none"}
                onValueChange={(v) => setActivity(v === "none" ? "" : v)}
                disabled={saving}
              >
                <SelectTrigger id="prof-activity" className="min-h-11 w-full sm:min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="prof-injuries">Injuries or pain areas</Label>
              <Input
                id="prof-injuries"
                name="injuries"
                maxLength={300}
                enterKeyHint="next"
                placeholder="e.g. left knee, lower back"
                className="min-h-11 sm:min-h-10"
                value={injuries}
                disabled={saving}
                onChange={(e) => setInjuries(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-diet">Diet preference</Label>
              <Input
                id="prof-diet"
                name="diet_pref"
                maxLength={300}
                enterKeyHint="next"
                placeholder="e.g. halal, vegetarian, vegan"
                className="min-h-11 sm:min-h-10"
                value={dietPref}
                disabled={saving}
                onChange={(e) => setDietPref(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prof-allergies">Food allergies</Label>
              <Input
                id="prof-allergies"
                name="allergies"
                maxLength={300}
                enterKeyHint="done"
                placeholder="e.g. peanuts, dairy, shellfish"
                className="min-h-11 sm:min-h-10"
                value={allergies}
                disabled={saving}
                onChange={(e) => setAllergies(e.target.value)}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="mt-4 border-t pt-4">
          <Button
            type="submit"
            disabled={saving}
            className="min-h-11 w-full touch-manipulation sm:min-h-10 sm:w-auto"
          >
            <Save className="size-4" aria-hidden="true" />
            <span>{saving ? "Saving…" : "Save changes"}</span>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/**
 * Dedicated member Profile tab page: membership summary, editable profile & fitness form
 * (updating `details_updated_at`), gym contact details, and sign-out control.
 */
export function MemberProfile({
  member,
  settings,
  trainerName,
  email,
  onUpdated,
  onSignOut,
}: MemberProfileProps) {
  const displayEmail = member.email?.trim() || email?.trim() || null;
  const gymName = settings.name?.trim() || "Your gym";
  const gymPhone = settings.phone?.trim() || null;
  const gymAddress = settings.address?.trim() || null;
  const lastUpdatedText = fmtDateTimeDhaka(member.details_updated_at);

  async function copyMemberCode() {
    if (!member.member_code) return;
    try {
      await navigator.clipboard.writeText(member.member_code);
      toast.success(`Member ID ${member.member_code} copied`);
    } catch {
      toast.error("Could not copy Member ID");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl shadow-xs">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar className="size-12 shrink-0">
              <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">
                {deriveInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg break-words text-balance">
                  {member.name}
                </CardTitle>
                {member.member_code ? (
                  <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                    {member.member_code}
                  </Badge>
                ) : null}
                <StatusBadge member={member} />
              </div>
              <CardDescription className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 break-words">
                {displayEmail ? <span>{displayEmail}</span> : null}
                <span className="tabular-nums">+{member.phone}</span>
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {member.member_code ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 touch-manipulation sm:min-h-8"
                onClick={() => void copyMemberCode()}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                <span>Copy ID</span>
              </Button>
            ) : null}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {lastUpdatedText
                  ? `Last updated ${lastUpdatedText}`
                  : "Details not updated yet"}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl border bg-secondary/40 p-3.5 sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Membership plan</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground break-words">
                {member.plans?.name ?? "None"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Valid until</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                {member.expiry_date ? fmtDate(member.expiry_date) : "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Joined</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                {member.join_date ? fmtDate(member.join_date) : "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Coach</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground break-words">
                {trainerName.trim() || "Not assigned"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MemberProfileForm
            key={`${member.id}:${member.details_updated_at ?? "init"}`}
            member={member}
            onUpdated={onUpdated}
          />
        </div>

        <Card className="rounded-2xl shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg">Gym contact &amp; account</CardTitle>
            <CardDescription translate="no" className="break-words">
              {gymName}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {gymAddress ? (
              <p className="text-xs text-muted-foreground break-words text-pretty">
                {gymAddress}
              </p>
            ) : null}
            {gymPhone ? (
              <Button
                variant="outline"
                className="min-h-11 w-full justify-start touch-manipulation tabular-nums"
                asChild
              >
                <a href={`tel:${gymPhone.replace(/\s+/g, "")}`}>
                  <Phone data-icon="inline-start" aria-hidden="true" />
                  <span>{gymPhone}</span>
                </a>
              </Button>
            ) : !gymAddress ? (
              <p className="text-xs text-muted-foreground">
                Ask the front desk for gym contact details.
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full touch-manipulation"
              onClick={onSignOut}
            >
              <LogOut data-icon="inline-start" aria-hidden="true" />
              <span>Log out</span>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
