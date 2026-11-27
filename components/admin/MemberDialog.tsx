"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  PauseCircle,
  Save,
  UserCheck,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useGymStore } from "@/lib/stores/gym-store";
import { useMembersStore } from "@/lib/stores/members-store";
import { PlanView } from "@/components/PlanView";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dhakaToday,
  fmtDate,
  fmtDateTimeDhaka,
  GOAL_TYPE_LABELS,
  money,
  pendingPayment,
  renewalLink,
} from "@/lib/logic";
import type { DietPlanData, Member, WorkoutPlanData } from "@/types/gym";

interface MemberDialogProps {
  member: Member | null;
  onClose: () => void;
}

/**
 * Centered `Dialog` modal keyed per member so local form fields reset cleanly
 * without `setState` in an effect.
 */
export function MemberDialog({ member, onClose }: MemberDialogProps) {
  if (!member) return null;
  return <MemberDialogContent key={member.id} member={member} onClose={onClose} />;
}

function MemberDialogContent({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const user = useAuthStore((s) => s.user);
  const gymId = useGymStore((s) => s.gymId);
  const currency = useGymStore((s) => s.currency);
  const staff = useGymStore((s) => s.staff);
  const templates = useGymStore((s) => s.templates);
  const gymName = useGymStore((s) => s.gymName);
  const settings = useGymStore((s) => s.settings);
  const reloadAll = useMembersStore((s) => s.reloadAll);

  const [memberCode, setMemberCode] = useState(member.member_code ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [trainerId, setTrainerId] = useState(member.trainer_id ?? "");
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState(String(member.plans?.price ?? ""));
  const [payTrxId, setPayTrxId] = useState("");
  const [selectedWorkoutTpl, setSelectedWorkoutTpl] = useState("");
  const [selectedDietTpl, setSelectedDietTpl] = useState("");
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlanData | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlanData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [wRes, dRes] = await Promise.all([
        supabase
          .from("workout_plans")
          .select("plan")
          .eq("member_id", member.id)
          .eq("verified", true)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("diet_plans")
          .select("plan")
          .eq("member_id", member.id)
          .eq("verified", true)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      setWorkoutPlan((wRes.data?.[0]?.plan as WorkoutPlanData | undefined) ?? null);
      setDietPlan((dRes.data?.[0]?.plan as DietPlanData | undefined) ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [member.id, supabase]);

  const today = dhakaToday();
  const owed = pendingPayment(member.payments ?? []);
  const workoutTemplates = templates.filter((t) => t.kind === "workout");
  const dietTemplates = templates.filter((t) => t.kind === "diet");
  const paidPayments = (member.payments ?? []).filter((p) => p.status === "paid");

  async function saveMemberCode() {
    if (busy) return;
    const clean = memberCode.trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(clean)) {
      toast.error("Member ID must be 1–40 chars (letters, numbers, - and _)");
      return;
    }
    setBusy(true);
    try {
      let q = supabase
        .from("members")
        .update({ member_code: clean })
        .eq("id", member.id);
      if (gymId) q = q.eq("gym_id", gymId);
      const { error } = await q;
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success(`Member ID updated to ${clean}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveEmail() {
    if (busy) return;
    setBusy(true);
    try {
      const clean = email.trim().toLowerCase() || null;
      let q = supabase.from("members").update({ email: clean }).eq("id", member.id);
      if (gymId) q = q.eq("gym_id", gymId);
      const { error } = await q;
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success(clean ? "Email saved — member can now sign in" : "Email cleared");
    } finally {
      setBusy(false);
    }
  }

  async function saveTrainer() {
    if (busy) return;
    setBusy(true);
    try {
      let q = supabase
        .from("members")
        .update({ trainer_id: trainerId || null })
        .eq("id", member.id);
      if (gymId) q = q.eq("gym_id", gymId);
      const { error } = await q;
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success("Trainer assigned");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!owed || !user || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("payments")
        .update({ status: "paid", recorded_by: user.id })
        .eq("id", owed.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success(`${member.name}: payment confirmed`);
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment() {
    if (!user || busy) return;
    const amt = Number(payAmount) || member.plans?.price || 0;
    if (amt <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("payments").insert({
        member_id: member.id,
        amount: amt,
        method: payMethod,
        status: "paid",
        trx_id: payTrxId.trim() || null,
        recorded_by: user.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success(`${member.name}: payment recorded`);
    } finally {
      setBusy(false);
    }
  }

  async function checkInMember() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("attendance").insert({
        member_id: member.id,
        method: "staff",
        recorded_by: user.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success(`${member.name} checked in`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFreeze() {
    if (busy) return;
    setBusy(true);
    try {
      const nextStatus = member.status === "frozen" ? "due" : "frozen";
      let q = supabase
        .from("members")
        .update({ status: nextStatus })
        .eq("id", member.id);
      if (gymId) q = q.eq("gym_id", gymId);
      const { error } = await q;
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success(
        nextStatus === "frozen" ? "Membership frozen" : "Membership unfrozen",
      );
    } finally {
      setBusy(false);
    }
  }

  async function assignTemplate(kind: "workout" | "diet") {
    if (busy) return;
    const id = kind === "workout" ? selectedWorkoutTpl : selectedDietTpl;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) {
      toast.error(`Select a ${kind} template first`);
      return;
    }
    setBusy(true);
    try {
      const table = kind === "workout" ? "workout_plans" : "diet_plans";
      const { error } = await supabase.from(table).insert({
        member_id: member.id,
        plan: tpl.plan,
        verified: true,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (kind === "workout") {
        setWorkoutPlan(tpl.plan as WorkoutPlanData);
      } else {
        setDietPlan(tpl.plan as DietPlanData);
      }
      toast.success(
        `${kind === "workout" ? "Workout" : "Diet"} plan assigned to ${member.name}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4 pe-12">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{member.name}</DialogTitle>
            {member.member_code ? (
              <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                {member.member_code}
              </Badge>
            ) : null}
          </div>
          <DialogDescription asChild>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>+{member.phone}</span>
              <StatusBadge member={member} />
              <span>
                {member.expiry_date
                  ? `Until ${fmtDate(member.expiry_date)}`
                  : "Never paid"}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void checkInMember()}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>Check in</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void toggleFreeze()}
            >
              <PauseCircle className="size-4" aria-hidden="true" />
              <span>{member.status === "frozen" ? "Unfreeze" : "Freeze"}</span>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={renewalLink(member, gymName, today, settings.app_url ?? null)}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon className="size-4 text-[#008069] dark:text-[#25D366]" />
                <span>WhatsApp</span>
              </a>
            </Button>
          </div>

          <section className="flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-4">
            <h3 className="text-base font-medium text-foreground">Payments</h3>

            {owed ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
                <div className="text-sm text-foreground">
                  Pending <strong>{money(owed.amount, currency)}</strong> via {owed.method ?? "—"}
                  {owed.trx_id ? ` (TrxID ${owed.trx_id})` : ""}
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void confirmPending()}
                >
                  Confirm paid
                </Button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="md-pay-amount">Amount</Label>
                <Input
                  id="md-pay-amount"
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="md-pay-method">Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger id="md-pay-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bkash">bKash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="md-pay-trx">TrxID (optional)</Label>
                <Input
                  id="md-pay-trx"
                  placeholder="TrxID"
                  value={payTrxId}
                  onChange={(e) => setPayTrxId(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void recordPayment()}
              >
                Record payment
              </Button>
            </div>

            {paidPayments.length > 0 ? (
              <div className="flex flex-col divide-y rounded-xl border bg-card">
                {paidPayments.slice(0, 5).map((p) => (
                  <div
                    key={String(p.id)}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <span className="text-foreground">
                      <strong>{money(p.amount, currency)}</strong> · {p.method ?? "cash"} ·{" "}
                      {p.paid_on ? fmtDate(p.paid_on) : ""}
                    </span>
                    <Link
                      href={`/receipt?id=${encodeURIComponent(String(p.id))}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <span>Receipt {p.receipt_no ?? ""}</span>
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-medium text-foreground">
                Profile &amp; fitness details
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {member.details_updated_at
                  ? `Updated by member: ${fmtDateTimeDhaka(member.details_updated_at)}`
                  : "Not updated by member yet"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Goal</dt>
                <dd className="font-medium text-foreground break-words">
                  {member.goal_type
                    ? member.goal?.trim()
                      ? `${GOAL_TYPE_LABELS[member.goal_type]} (${member.goal.trim()})`
                      : GOAL_TYPE_LABELS[member.goal_type]
                    : member.goal?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Age</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {member.age != null ? member.age : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sex</dt>
                <dd className="font-medium text-foreground capitalize">
                  {member.sex?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Height</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {member.height_cm != null ? `${member.height_cm} cm` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Weight</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {member.weight_kg != null ? `${member.weight_kg} kg` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Goal weight</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {member.goal_weight_kg != null ? `${member.goal_weight_kg} kg` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Level</dt>
                <dd className="font-medium text-foreground capitalize">
                  {member.level?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Days / week</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {member.days_per_week != null ? `${member.days_per_week} days` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Equipment</dt>
                <dd className="font-medium text-foreground capitalize">
                  {member.equipment ? member.equipment.replace(/_/g, " ") : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Activity</dt>
                <dd className="font-medium text-foreground capitalize">
                  {member.activity?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Session</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {member.session_minutes != null ? `${member.session_minutes} min` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Running OK</dt>
                <dd className="font-medium text-foreground">
                  {member.run_ok === true ? "Yes" : member.run_ok === false ? "No" : "—"}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-muted-foreground">Injuries</dt>
                <dd className="font-medium text-foreground break-words">
                  {member.injuries?.trim() || "—"}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-muted-foreground">Diet pref</dt>
                <dd className="font-medium text-foreground break-words">
                  {member.diet_pref?.trim() || "—"}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <dt className="text-muted-foreground">Allergies</dt>
                <dd className="font-medium text-foreground break-words">
                  {member.allergies?.trim() || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-4">
            <h3 className="text-base font-medium text-foreground">
              Member ID, access &amp; trainer
            </h3>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="md-member-code">Member ID</Label>
                <Input
                  id="md-member-code"
                  dir="ltr"
                  maxLength={40}
                  autoCorrect="off"
                  spellCheck={false}
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void saveMemberCode()}
              >
                <Save className="size-4" aria-hidden="true" />
                <span>Save ID</span>
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="md-email">Member app email</Label>
                <Input
                  id="md-email"
                  type="email"
                  placeholder="member@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void saveEmail()}
              >
                <Save className="size-4" aria-hidden="true" />
                <span>Save email</span>
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="md-trainer">Assigned trainer</Label>
                <Select
                  value={trainerId || "none"}
                  onValueChange={(val) => setTrainerId(val === "none" ? "" : val)}
                >
                  <SelectTrigger id="md-trainer" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No trainer assigned</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>
                        {s.display_name || s.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void saveTrainer()}
              >
                <UserCheck className="size-4" aria-hidden="true" />
                <span>Save trainer</span>
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-4">
            <h3 className="text-base font-medium text-foreground">
              Workout & diet plans
            </h3>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="md-workout-tpl">Workout template</Label>
                <Select
                  value={selectedWorkoutTpl}
                  onValueChange={setSelectedWorkoutTpl}
                >
                  <SelectTrigger id="md-workout-tpl" className="w-full">
                    <SelectValue placeholder="Select workout template" />
                  </SelectTrigger>
                  <SelectContent>
                    {workoutTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={busy || !selectedWorkoutTpl}
                onClick={() => void assignTemplate("workout")}
              >
                Assign workout
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="md-diet-tpl">Diet template</Label>
                <Select value={selectedDietTpl} onValueChange={setSelectedDietTpl}>
                  <SelectTrigger id="md-diet-tpl" className="w-full">
                    <SelectValue placeholder="Select diet template" />
                  </SelectTrigger>
                  <SelectContent>
                    {dietTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={busy || !selectedDietTpl}
                onClick={() => void assignTemplate("diet")}
              >
                Assign diet
              </Button>
            </div>

            <PlanView workout={workoutPlan} diet={dietPlan} />
          </section>
        </div>

        <DialogFooter className="mx-0 mb-0 border-t bg-muted/40 px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
