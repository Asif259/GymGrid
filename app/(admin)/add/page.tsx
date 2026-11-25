"use client";

import { useMemo, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "@/components/AdminContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, normalizePhone } from "@/lib/logic";

export default function AddMemberPage() {
  const supabase = useMemo(() => createClient(), []);
  const { user, plans, reloadAll } = useAdmin();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [goal, setGoal] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [injuries, setInjuries] = useState("");
  const [dietPref, setDietPref] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [method, setMethod] = useState("cash");
  const [trxId, setTrxId] = useState("");
  const [saving, setSaving] = useState(false);

  const effectivePlanId = planId || (plans[0] ? String(plans[0].id) : "");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !user) return;

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      toast.error("Enter phone with country code, e.g. 8801XXXXXXXXX");
      return;
    }

    const chosenPlan = plans.find((p) => String(p.id) === effectivePlanId);
    if (!chosenPlan) {
      toast.error("Select a plan");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim().toLowerCase() || null,
        plan_id: chosenPlan.id,
        goal: goal || null,
        age: age ? Number(age) : null,
        sex: sex || null,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        injuries: injuries.trim() || null,
        diet_pref: dietPref.trim() || null,
      };

      const { data: created, error } = await supabase
        .from("members")
        .insert(payload)
        .select("id")
        .single();

      if (error || !created) {
        toast.error(error?.message ?? "Could not add member");
        return;
      }

      if (paidNow) {
        const { error: payErr } = await supabase.from("payments").insert({
          member_id: created.id,
          amount: chosenPlan.price,
          method,
          status: "paid",
          trx_id: trxId.trim() || null,
          recorded_by: user.id,
        });
        if (payErr) {
          toast.error(`Member added, but payment failed: ${payErr.message}`);
          await reloadAll();
          return;
        }
      }

      setName("");
      setPhone("");
      setEmail("");
      setGoal("");
      setAge("");
      setSex("");
      setHeightCm("");
      setWeightKg("");
      setInjuries("");
      setDietPref("");
      setTrxId("");
      await reloadAll();
      toast.success(`${payload.name} added`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-3xl shadow-xs">
      <CardHeader>
        <CardTitle className="text-xl">New member</CardTitle>
        <CardDescription>
          Register a member, assign a plan, and optionally log their first payment.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="flex flex-col gap-6" onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-name">Name *</Label>
              <Input
                id="add-name"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-phone">Phone with country code *</Label>
              <Input
                id="add-phone"
                type="tel"
                required
                autoComplete="tel"
                placeholder="8801XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-email">Email for the members app</Label>
              <Input
                id="add-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-plan">Plan *</Label>
              <Select value={effectivePlanId} onValueChange={setPlanId}>
                <SelectTrigger id="add-plan" className="w-full">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={String(p.id)} value={String(p.id)}>
                      {p.name} ({money(p.price)} / {p.months} mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-goal">Goal</Label>
              <Select
                value={goal || "none"}
                onValueChange={(v) => setGoal(v === "none" ? "" : v)}
              >
                <SelectTrigger id="add-goal" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="fat loss">fat loss</SelectItem>
                  <SelectItem value="muscle">muscle</SelectItem>
                  <SelectItem value="fitness">fitness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-age">Age</Label>
              <Input
                id="add-age"
                type="number"
                min={10}
                max={100}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-sex">Sex</Label>
              <Select
                value={sex || "none"}
                onValueChange={(v) => setSex(v === "none" ? "" : v)}
              >
                <SelectTrigger id="add-sex" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="male">male</SelectItem>
                  <SelectItem value="female">female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-height">Height (cm)</Label>
              <Input
                id="add-height"
                type="number"
                min={100}
                max={250}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-weight">Weight (kg)</Label>
              <Input
                id="add-weight"
                type="number"
                step="0.1"
                min={25}
                max={300}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-injuries">Injuries</Label>
              <Input
                id="add-injuries"
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-diet">Diet preference or allergies</Label>
              <Input
                id="add-diet"
                value={dietPref}
                onChange={(e) => setDietPref(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-4">
            <h3 className="text-base font-medium text-foreground">First payment</h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-paid-now"
                  checked={paidNow}
                  onCheckedChange={(checked) => setPaidNow(checked === true)}
                />
                <Label htmlFor="add-paid-now" className="cursor-pointer">
                  Paid now
                </Label>
              </div>

              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger aria-label="Payment method" className="w-36">
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

              <Input
                aria-label="Transaction ID"
                placeholder="TrxID for bKash or Nagad"
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                className="min-w-52 flex-1"
              />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={saving}>
              <UserPlus className="size-4" aria-hidden="true" />
              <span>{saving ? "Adding…" : "Add member"}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
