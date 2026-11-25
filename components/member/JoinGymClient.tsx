"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { LoginCard } from "@/components/LoginCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { Plan, PublicGym } from "@/types/gym";

export function JoinGymClient({
  gymSlug,
  initialGym,
}: {
  gymSlug: string;
  initialGym: PublicGym | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const tokenStorageKey = `signupToken:${gymSlug}`;

  const [gym, setGym] = useState<PublicGym | null>(initialGym);
  const [plans, setPlans] = useState<Plan[]>(initialGym?.plans ?? []);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState(
    initialGym?.plans?.[0] ? String(initialGym.plans[0].id) : "",
  );
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
      if (tok) window.localStorage.setItem(tokenStorageKey, tok);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    const storedToken = window.localStorage.getItem(tokenStorageKey) ?? "";

    let cancelled = false;
    async function init() {
      const [gymRes, authRes] = await Promise.all([
        initialGym
          ? Promise.resolve({ data: initialGym })
          : supabase.rpc("get_public_gym_by_slug", { p_slug: gymSlug }),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;

      setToken(storedToken);
      const loadedGym = (gymRes.data as PublicGym | null) ?? null;
      setGym(loadedGym);
      const loadedPlans = loadedGym?.plans ?? [];
      setPlans(loadedPlans);
      if (loadedPlans[0]) setPlanId((prev) => prev || String(loadedPlans[0].id));
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
  }, [supabase, gymSlug, initialGym, tokenStorageKey]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !gym) return;

    const tok = token || window.localStorage.getItem(tokenStorageKey) || "";
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
        p_gym_id: gym.id,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      window.localStorage.removeItem(tokenStorageKey);
      toast.success("Registered! Opening your members app…");
      router.push(`/member?gym=${encodeURIComponent(gymSlug)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !gym) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 p-4 sm:p-6">
        <Card className="rounded-3xl border-destructive shadow-xs">
          <CardHeader>
            <CardTitle>Gym not found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We couldn’t find an active gym matching <code className="font-mono">{gymSlug}</code>.
            Ask the front desk for a fresh signup link.
          </CardContent>
        </Card>
      </main>
    );
  }

  const gymName = gym?.name ?? "Gym";
  const currency = gym?.currency ?? "৳";
  const initials =
    gymName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "G";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9 shrink-0">
            {gym?.logo_url ? <AvatarImage src={gym.logo_url} alt={gymName} /> : null}
            <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-medium text-foreground">{gymName}</h1>
            {gym?.address ? (
              <p className="text-xs text-muted-foreground">{gym.address}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" aria-hidden="true" />
              <span>Log out</span>
            </Button>
          ) : null}
        </div>
      </header>

      {loading ? <Skeleton className="h-96 rounded-3xl" /> : null}

      {!loading && !user ? (
        <LoginCard
          title={`Join ${gymName}`}
          subtitle="First verify your email. We'll send a sign-in link to this page."
          placeholder="you@example.com"
          nextPath={`/join/${encodeURIComponent(gymSlug)}`}
        />
      ) : null}

      {!loading && user ? (
        <Card className="rounded-3xl shadow-xs">
          <CardHeader>
            <CardTitle className="text-xl">Member registration</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {!token ? (
              <div className="rounded-xl bg-status-rose-bg px-3 py-2 text-xs font-medium text-status-rose-fg">
                Open the invite link sent by {gymName} so your registration is
                verified.
              </div>
            ) : null}

            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => void handleSubmit(e)}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-name">Full name *</Label>
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
                      <SelectValue placeholder="Choose a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={String(p.id)} value={String(p.id)}>
                          {p.name} ({money(p.price, currency)} / {p.months} mo)
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
                    min={10}
                    max={100}
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
                    min={100}
                    max={250}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="join-weight">Weight (kg)</Label>
                  <Input
                    id="join-weight"
                    type="number"
                    step="0.1"
                    min={25}
                    max={300}
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
