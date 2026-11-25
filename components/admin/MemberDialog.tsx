"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  PauseCircle,
  Save,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "@/components/AdminContext";
import { PlanView } from "@/components/PlanView";
import { StatusBadge } from "@/components/StatusBadge";
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
import {
  dhakaToday,
  fmtDate,
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
 * shadcn `Sheet` drawer keyed per member so local form fields reset cleanly
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
  const { user, staff, templates, gymName, settings, reloadAll } = useAdmin();

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

  async function saveEmail() {
    if (busy) return;
    setBusy(true);
    try {
      const clean = email.trim().toLowerCase() || null;
      const { error } = await supabase
        .from("members")
        .update({ email: clean })
        .eq("id", member.id);
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
      const { error } = await supabase
        .from("members")
        .update({ trainer_id: trainerId || null })
        .eq("id", member.id);
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
      const { error } = await supabase
        .from("members")
        .update({ status: nextStatus })
        .eq("id", member.id);
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
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{member.name}</SheetTitle>
          <SheetDescription asChild>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>+{member.phone}</span>
              <StatusBadge member={member} />
              <span>
                {member.expiry_date
                  ? `Until ${fmtDate(member.expiry_date)}`
                  : "Never paid"}
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
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
                <MessageCircle className="size-4" aria-hidden="true" />
                <span>WhatsApp</span>
              </a>
            </Button>
          </div>

          <section className="flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-4">
            <h3 className="text-base font-medium text-foreground">Payments</h3>

            {owed ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
                <div className="text-sm text-foreground">
                  Pending <strong>{money(owed.amount)}</strong> via {owed.method ?? "—"}
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
                      <strong>{money(p.amount)}</strong> · {p.method ?? "cash"} ·{" "}
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
            <h3 className="text-base font-medium text-foreground">
              Member app access & trainer
            </h3>

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
                    <SelectValue placeholder="Choose workout template…" />
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
                    <SelectValue placeholder="Choose diet template…" />
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

        <SheetFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
