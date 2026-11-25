"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "@/components/AdminContext";
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
import { parseDiet, parseWorkout } from "@/lib/logic";
import type { PlanKind } from "@/types/gym";

export default function PlansPage() {
  const supabase = useMemo(() => createClient(), []);
  const { user, templates, reloadAll } = useAdmin();

  const [kind, setKind] = useState<PlanKind>("workout");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !user) return;

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

  return (
    <div className="flex flex-col gap-6">
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
