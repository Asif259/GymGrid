"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { LoginCard } from "@/components/LoginCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { money, normalizePhone } from "@/lib/logic";
import type { Plan } from "@/types/gym";

const SIGNUP_TOKEN_KEY = "signupToken";

export default function JoinPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { gymName: defaultGymName } = useMemo(() => getSupabaseEnv(), []);

  const [gymName, setGymName] = useState(defaultGymName);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState("");
  const [goal, setGoal] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [injuries, setInjuries] = useState("");
  const [dietPref, setDietPref] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#signup=")) {
      const tok = decodeURIComponent(hash.slice("#signup=".length));
      if (tok) window.localStorage.setItem(SIGNUP_TOKEN_KEY, tok);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    const storedToken = window.localStorage.getItem(SIGNUP_TOKEN_KEY) ?? "";

    let cancelled = false;
    async function init() {
      const [settingsRes, plansRes, authRes] = await Promise.all([
        supabase.from("gym_settings").select("name").maybeSingle(),
        supabase.from("plans").select("id, name, months, price").order("months"),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;

      setToken(storedToken);
      if (settingsRes.data?.name) setGymName(settingsRes.data.name);
      const loadedPlans = (plansRes.data as Plan[] | null) ?? [];
      setPlans(loadedPlans);
      if (loadedPlans[0]) setPlanId(String(loadedPlans[0].id));
      setUser(authRes.data.user);
      setLoading(false);
    }

    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
      },
    );
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    const tok = token || window.localStorage.getItem(SIGNUP_TOKEN_KEY) || "";
    if (!tok) {
      toast.error("Missing signup invite link from the gym");
      return;
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      toast.error("Enter phone with country code, e.g. 8801XXXXXXXXX");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("self_register", {
        token: tok,
        name: name.trim(),
        phone: cleanPhone,
        plan_id: Number(planId),
        goal: goal || null,
        age: age ? Number(age) : null,
        sex: sex || null,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        injuries: injuries.trim() || null,
        diet_pref: dietPref.trim() || null,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      window.localStorage.removeItem(SIGNUP_TOKEN_KEY);
      toast.success("Registered! Opening your members app…");
      router.push("/member");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-medium text-foreground">Join {gymName}</h1>
        <div className="flex items-center gap-2">
          {user?.email ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user.email}
            </span>
          ) : null}
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" aria-hidden="true" />
              <span>Log out</span>
            </Button>
          ) : null}
        </div>
      </header>

      {loading ? <Skeleton className="h-72 rounded-3xl" /> : null}

      {!loading && !user ? (
        <LoginCard
          title="Sign up"
          subtitle="Enter your email. We'll send a sign-in link, then you fill in your details."
          placeholder="you@example.com"
          nextPath="/join"
        />
      ) : null}

      {!loading && user ? (
        <Card className="rounded-3xl shadow-xs">
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {!token ? (
              <div className="rounded-xl bg-status-rose-bg px-3 py-2 text-xs font-medium text-status-rose-fg">
                Open the exact signup invite link provided by the front desk so your
                registration token is attached.
              </div>
            ) : null}

            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => void handleSubmit(e)}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-name">Name *</Label>
                  <Input
                    id="join-name"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-phone">Phone with country code *</Label>
                  <Input
                    id="join-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="8801XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-plan">Plan *</Label>
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger id="join-plan" className="w-full">
                      <SelectValue placeholder="Choose plan" />
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
                  <Label htmlFor="join-goal">Goal</Label>
                  <Select
                    value={goal || "none"}
                    onValueChange={(v) => setGoal(v === "none" ? "" : v)}
                  >
                    <SelectTrigger id="join-goal" className="w-full">
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
                  <Label htmlFor="join-age">Age</Label>
                  <Input
                    id="join-age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-sex">Sex</Label>
                  <Select
                    value={sex || "none"}
                    onValueChange={(v) => setSex(v === "none" ? "" : v)}
                  >
                    <SelectTrigger id="join-sex" className="w-full">
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
                  <Label htmlFor="join-height">Height (cm)</Label>
                  <Input
                    id="join-height"
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-weight">Weight (kg)</Label>
                  <Input
                    id="join-weight"
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-injuries">Injuries</Label>
                  <Input
                    id="join-injuries"
                    value={injuries}
                    onChange={(e) => setInjuries(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-diet">Diet preference or allergies</Label>
                  <Input
                    id="join-diet"
                    value={dietPref}
                    onChange={(e) => setDietPref(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={saving || !token}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                <span>{saving ? "Registering…" : "Join"}</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
