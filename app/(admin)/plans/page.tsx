"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useGymStore } from "@/lib/stores/gym-store";
import { useMembersStore } from "@/lib/stores/members-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { money, parseDiet, parseWorkout } from "@/lib/logic";
import type { PlanKind } from "@/types/gym";

export default function PlansPage() {
  const supabase = useMemo(() => createClient(), []);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const gymId = useGymStore((s) => s.gymId);
  const currency = useGymStore((s) => s.currency);
  const plans = useGymStore((s) => s.plans);
  const templates = useGymStore((s) => s.templates);
  const reloadAll = useMembersStore((s) => s.reloadAll);

  const [kind, setKind] = useState<PlanKind>("workout");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const [tierName, setTierName] = useState("");
  const [tierMonths, setTierMonths] = useState("1");
  const [tierPrice, setTierPrice] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !user || !gymId) return;

    let plan;
    try {
      plan = kind === "workout" ? parseWorkout(text) : parseDiet(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid plan format");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("plan_templates").insert({
        gym_id: gymId,
        kind,
        name: name.trim(),
        plan,
        created_by: user.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setName("");
      setText("");
      await reloadAll();
      toast.success("Template saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingPlan || !gymId || role !== "owner") return;
    const months = Number(tierMonths);
    const price = Number(tierPrice);
    if (!tierName.trim() || !months || months <= 0 || Number.isNaN(price) || price < 0) {
      toast.error("Enter valid plan name, months, and price");
      return;
    }

    setSavingPlan(true);
    try {
      const { error } = await supabase.from("plans").insert({
        gym_id: gymId,
        name: tierName.trim(),
        months,
        price,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setTierName("");
      setTierMonths("1");
      setTierPrice("");
      await reloadAll();
      toast.success("Membership plan added");
    } finally {
      setSavingPlan(false);
    }
  }

  async function savePlanPrice(planId: number) {
    if (!gymId || role !== "owner" || savingPlan) return;
    const raw = priceDrafts[planId];
    const price = Number(raw);
    if (raw == null || Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    setSavingPlan(true);
    try {
      const { error } = await supabase
        .from("plans")
        .update({ price })
        .eq("id", planId)
        .eq("gym_id", gymId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      await reloadAll();
      toast.success("Plan price updated");
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-3xl shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl">Membership plans</CardTitle>
            <CardDescription>
              Subscription tiers shown on member registration and billing.
            </CardDescription>
          </div>
          <Badge variant="secondary">{plans.length}</Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col divide-y">
            {plans.map((p) => (
              <div
                key={String(p.id)}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <span className="ms-2 text-xs text-muted-foreground">
                    {p.months} {p.months === 1 ? "month" : "months"}
                  </span>
                </div>

                {role === "owner" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      aria-label={`Price for ${p.name}`}
                      value={priceDrafts[p.id] ?? String(p.price)}
                      onChange={(e) =>
                        setPriceDrafts((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="w-28 tabular-nums"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingPlan || priceDrafts[p.id] === undefined}
                      onClick={() => void savePlanPrice(p.id)}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <span className="font-mono text-sm font-medium text-foreground tabular-nums">
                    {money(p.price, currency)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {role === "owner" ? (
            <form
              className="grid gap-3 rounded-2xl border bg-secondary/60 p-4 sm:grid-cols-4 sm:items-end"
              onSubmit={(e) => void handleCreatePlan(e)}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tier-name">New tier name</Label>
                <Input
                  id="tier-name"
                  placeholder="Half-Yearly"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tier-months">Months</Label>
                <Input
                  id="tier-months"
                  type="number"
                  min={1}
                  value={tierMonths}
                  onChange={(e) => setTierMonths(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tier-price">Price ({currency.trim()})</Label>
                <Input
                  id="tier-price"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="7500"
                  value={tierPrice}
                  onChange={(e) => setTierPrice(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={savingPlan}>
                <Plus className="size-4" aria-hidden="true" />
                <span>Add tier</span>
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-xl">Plan templates</CardTitle>
          <CardDescription>
            Write a plan once, then assign it to any member or bulk-assign it to a
            group. Workout, one day per line:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              Mon - Legs: Squat 3x10, Lunges 3x12
            </code>
            . Diet, one meal per line:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              Breakfast: Oats 60g, 2 eggs
            </code>
            .
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-kind">Type</Label>
                <Select
                  value={kind}
                  onValueChange={(val) => setKind(val as PlanKind)}
                >
                  <SelectTrigger id="tpl-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workout">Workout</SelectItem>
                    <SelectItem value="diet">Diet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-name">Name *</Label>
                <Input
                  id="tpl-name"
                  required
                  placeholder="Beginner 3-day"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-text">Plan *</Label>
              <Textarea
                id="tpl-text"
                required
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div>
              <Button type="submit" disabled={saving}>
                <Save className="size-4" aria-hidden="true" />
                <span>{saving ? "Saving…" : "Save template"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-xs">
        <CardHeader className="flex flex-row items-center gap-2">
          <CardTitle className="text-lg">Saved templates</CardTitle>
          <Badge variant="secondary">{templates.length}</Badge>
        </CardHeader>

        <CardContent className="flex flex-col divide-y">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm font-medium text-foreground">{t.name}</span>
              <Badge variant="secondary">{t.kind}</Badge>
            </div>
          ))}
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved templates yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
