"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  Dumbbell,
  ExternalLink,
  Home,
  LogOut,
  Send,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { LoginCard } from "@/components/LoginCard";
import { PlanView } from "@/components/PlanView";
import { StatusBadge } from "@/components/StatusBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fmtDate,
  hhmmDhaka,
  money,
  pendingPayment,
  streakText,
} from "@/lib/logic";
import { cn } from "@/lib/utils";
import type {
  AttendanceStreak,
  DietPlanData,
  GymSettings,
  Member,
  Payment,
  WorkoutPlanData,
} from "@/types/gym";

type MemberTab = "home" | "pay" | "plans" | "receipts" | "visits";

const CHECKIN_KEY = "pendingCheckin";
const TAB_KEY = "openTab";

export default function MemberAppPage() {
  const supabase = useMemo(() => createClient(), []);
  const { gymName: defaultGymName } = useMemo(() => getSupabaseEnv(), []);

  const [status, setStatus] = useState<
    "loading" | "signed_out" | "no_member" | "ready"
  >("loading");
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Partial<GymSettings>>({
    name: defaultGymName,
    currency: "৳",
  });
  const [member, setMember] = useState<Member | null>(null);
  const [workout, setWorkout] = useState<WorkoutPlanData | null>(null);
  const [diet, setDiet] = useState<DietPlanData | null>(null);
  const [visits, setVisits] = useState<{ day: string; checked_in_at: string }[]>([]);
  const [trainerName, setTrainerName] = useState<string>("");
  const [streak, setStreak] = useState<AttendanceStreak | null>(null);

  const [tab, setTab] = useState<MemberTab>("home");
  const [checkinBanner, setCheckinBanner] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [payMethod, setPayMethod] = useState<"bkash" | "nagad">("bkash");
  const [trxId, setTrxId] = useState("");
  const [submittingTrx, setSubmittingTrx] = useState(false);

  const loadMemberData = useCallback(async () => {
    const [settingsRes, claimRes] = await Promise.all([
      supabase
        .from("gym_settings")
        .select("name, currency, bkash_number, nagad_number, app_url")
        .maybeSingle(),
      supabase.rpc("claim_member"),
    ]);

    if (settingsRes.data) {
      setSettings(settingsRes.data as Partial<GymSettings>);
    }

    const memberId = claimRes.data as string | null;
    if (claimRes.error || !memberId) {
      setStatus("no_member");
      return;
    }

    const pendingToken = window.localStorage.getItem(CHECKIN_KEY);
    if (pendingToken) {
      window.localStorage.removeItem(CHECKIN_KEY);
      const { data: chkData, error: chkErr } = await supabase.rpc("check_in", {
        token: pendingToken,
      });
      if (chkErr) {
        setCheckinBanner({ ok: false, text: chkErr.message });
      } else {
        const res = chkData as { paid_up?: boolean; message?: string } | null;
        setCheckinBanner({
          ok: res?.paid_up !== false,
          text: res?.message ?? "Checked in!",
        });
      }
    }

    const colsWithPath =
      "id, amount, status, method, trx_id, receipt_no, receipt_path, paid_on, period_start, period_end, created_at";
    const colsBase =
      "id, amount, status, method, trx_id, receipt_no, paid_on, period_start, period_end, created_at";

    let memberRes = await supabase
      .from("members")
      .select(`*, plans(name, months, price), payments(${colsWithPath})`)
      .eq("id", memberId)
      .single();

    if (memberRes.error && /receipt_path/.test(memberRes.error.message)) {
      memberRes = await supabase
        .from("members")
        .select(`*, plans(name, months, price), payments(${colsBase})`)
        .eq("id", memberId)
        .single();
    }

    const [wRes, dRes, vRes, streakRes] = await Promise.all([
      supabase
        .from("workout_plans")
        .select("plan")
        .eq("member_id", memberId)
        .eq("verified", true)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("diet_plans")
        .select("plan")
        .eq("member_id", memberId)
        .eq("verified", true)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("attendance")
        .select("day, checked_in_at")
        .eq("member_id", memberId)
        .order("day", { ascending: false })
        .limit(60),
      supabase.rpc("my_streak"),
    ]);

    const loadedMember = memberRes.data as Member | null;
    setMember(loadedMember);
    setWorkout((wRes.data?.[0]?.plan as WorkoutPlanData | undefined) ?? null);
    setDiet((dRes.data?.[0]?.plan as DietPlanData | undefined) ?? null);
    setVisits(
      (vRes.data as { day: string; checked_in_at: string }[] | null) ?? [],
    );
    if (!streakRes.error && streakRes.data) {
      setStreak(streakRes.data as AttendanceStreak);
    } else {
      setStreak(null);
    }

    if (loadedMember?.trainer_id) {
      const trRes = await supabase
        .from("staff")
        .select("display_name")
        .eq("user_id", loadedMember.trainer_id)
        .maybeSingle();
      setTrainerName(trRes.data?.display_name ?? "");
    } else {
      setTrainerName("");
    }

    const savedTab = window.localStorage.getItem(TAB_KEY) as MemberTab | null;
    if (
      savedTab &&
      ["home", "pay", "plans", "receipts", "visits"].includes(savedTab)
    ) {
      window.localStorage.removeItem(TAB_KEY);
      setTab(savedTab);
    }

    setStatus("ready");
  }, [supabase]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#checkin=")) {
      const tok = decodeURIComponent(hash.slice("#checkin=".length));
      if (tok) window.localStorage.setItem(CHECKIN_KEY, tok);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    } else if (hash === "#pay") {
      window.localStorage.setItem(TAB_KEY, "pay");
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    let cancelled = false;
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(authUser);
      if (!authUser) {
        const sRes = await supabase.from("gym_settings").select("name").maybeSingle();
        if (!cancelled && sRes.data?.name) {
          setSettings((prev) => ({ ...prev, name: sRes.data!.name }));
        }
        setStatus("signed_out");
        return;
      }
      await loadMemberData();
    }

    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.user) {
          setUser(null);
          setStatus("signed_out");
        } else {
          setUser(session.user);
          void loadMemberData();
        }
      },
    );
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, loadMemberData]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setMember(null);
    setStatus("signed_out");
  }

  async function copyNumber(num: string, label: string) {
    try {
      await navigator.clipboard.writeText(num);
      toast.success(`${label} number copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function submitTrx(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member || submittingTrx) return;
    const price = member.plans?.price;
    if (price == null) {
      toast.error("Ask the front desk to assign a plan first");
      return;
    }
    setSubmittingTrx(true);
    try {
      const { error } = await supabase.from("payments").insert({
        member_id: member.id,
        amount: price,
        method: payMethod,
        trx_id: trxId.trim(),
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setTrxId("");
      toast.success("Submitted! The gym will verify your TrxID.");
      await loadMemberData();
      setTab("home");
    } finally {
      setSubmittingTrx(false);
    }
  }

  async function downloadPdf(p: Payment) {
    if (!p.receipt_path) return;
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(p.receipt_path, 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open receipt PDF");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const gymName = settings.name || defaultGymName;
  const currency = settings.currency || "৳";
  const owed = member ? pendingPayment(member.payments ?? []) : null;
  const paidReceipts = (member?.payments ?? []).filter((p) => p.status === "paid");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-medium text-foreground">{gymName}</h1>
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

      {checkinBanner ? (
        <Card
          className={cn(
            "rounded-3xl p-6 text-center shadow-xs",
            checkinBanner.ok
              ? "bg-status-lime-bg text-status-lime-fg"
              : "border-destructive bg-status-rose-bg text-status-rose-fg",
          )}
        >
          <CardContent className="flex flex-col items-center gap-3 p-0">
            {checkinBanner.ok ? (
              <CheckCircle2 className="size-8" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-8" aria-hidden="true" />
            )}
            <p className="text-lg font-semibold text-foreground">
              {checkinBanner.text}
            </p>
            {!checkinBanner.ok ? (
              <Button onClick={() => setTab("pay")}>Renew membership</Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {status === "loading" ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </div>
      ) : null}

      {status === "signed_out" ? (
        <LoginCard
          title="Members app"
          subtitle="Use the email you gave the front desk. We'll email you a sign-in link."
          placeholder="member@example.com"
          nextPath="/member"
        />
      ) : null}

      {status === "no_member" ? (
        <Card className="rounded-3xl shadow-xs">
          <CardHeader>
            <CardTitle>Account not linked yet</CardTitle>
            <CardDescription>
              Ask the front desk to add your email to your member profile, or
              register with the gym signup link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/join">
                <UserPlus className="size-4" aria-hidden="true" />
                <span>Self-register</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {status === "ready" && member ? (
        <Tabs
          value={tab}
          onValueChange={(val) => setTab(val as MemberTab)}
          className="gap-5"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="home" className="gap-1.5">
                <Home className="size-4" aria-hidden="true" />
                <span>Home</span>
              </TabsTrigger>
              <TabsTrigger value="pay" className="gap-1.5">
                <CreditCard className="size-4" aria-hidden="true" />
                <span>Renew / Pay</span>
              </TabsTrigger>
              <TabsTrigger value="plans" className="gap-1.5">
                <Dumbbell className="size-4" aria-hidden="true" />
                <span>Plans</span>
              </TabsTrigger>
              <TabsTrigger value="receipts" className="gap-1.5">
                <ClipboardList className="size-4" aria-hidden="true" />
                <span>Receipts</span>
              </TabsTrigger>
              <TabsTrigger value="visits" className="gap-1.5">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                <span>Visits</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="home">
            <Card className="rounded-3xl shadow-xs">
              <CardHeader>
                <CardDescription>
                  {member.plans
                    ? `${member.plans.name} · ${money(member.plans.price, currency)}`
                    : "No plan assigned"}
                </CardDescription>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <StatusBadge member={member} />
                  <span className="text-sm font-medium text-foreground">
                    {member.expiry_date
                      ? `Valid until ${fmtDate(member.expiry_date)}`
                      : "No active expiry date yet."}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {owed ? (
                  <div className="rounded-xl bg-status-yellow-bg px-3 py-2 text-xs font-medium text-status-yellow-fg">
                    Payment of {money(owed.amount, currency)} ({owed.method}
                    {owed.trx_id ? `, TrxID ${owed.trx_id}` : ""}) is awaiting
                    confirmation.
                  </div>
                ) : null}

                {streak ? (
                  <p className="text-xs font-medium text-muted-foreground">
                    {streakText(streak)}
                  </p>
                ) : null}

                <Button className="w-full" onClick={() => setTab("pay")}>
                  Renew / pay
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pay">
            <Card className="rounded-3xl shadow-xs">
              <CardHeader>
                <CardTitle>Renew membership</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground">
                  <li>
                    Send{" "}
                    <strong className="text-foreground">
                      {member.plans
                        ? money(member.plans.price, currency)
                        : "your plan fee"}
                    </strong>{" "}
                    to the gym’s number below.
                  </li>
                  <li>Enter your bKash/Nagad TrxID below for desk verification.</li>
                </ol>

                <div className="flex flex-col divide-y rounded-2xl border bg-secondary/60 px-4">
                  {settings.bkash_number ? (
                    <div className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">
                          bKash
                        </div>
                        <span className="font-mono text-base font-medium text-foreground">
                          {settings.bkash_number}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void copyNumber(settings.bkash_number!, "bKash")
                        }
                      >
                        <Copy className="size-4" aria-hidden="true" />
                        <span>Copy</span>
                      </Button>
                    </div>
                  ) : null}
                  {settings.nagad_number ? (
                    <div className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">
                          Nagad
                        </div>
                        <span className="font-mono text-base font-medium text-foreground">
                          {settings.nagad_number}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void copyNumber(settings.nagad_number!, "Nagad")
                        }
                      >
                        <Copy className="size-4" aria-hidden="true" />
                        <span>Copy</span>
                      </Button>
                    </div>
                  ) : null}
                </div>

                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => void submitTrx(e)}
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="m-pay-method">Method</Label>
                    <Select
                      value={payMethod}
                      onValueChange={(v) => setPayMethod(v as "bkash" | "nagad")}
                    >
                      <SelectTrigger id="m-pay-method" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bkash">bKash</SelectItem>
                        <SelectItem value="nagad">Nagad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="m-pay-trx">Transaction ID (TrxID) *</Label>
                    <Input
                      id="m-pay-trx"
                      required
                      placeholder="e.g. 9A7B2C3D4E"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submittingTrx}
                  >
                    <Send className="size-4" aria-hidden="true" />
                    <span>
                      {submittingTrx ? "Submitting…" : "Send TrxID to gym"}
                    </span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans">
            <Card className="rounded-3xl shadow-xs">
              <CardHeader>
                <CardTitle>Your workout & diet plans</CardTitle>
                {trainerName ? (
                  <CardDescription>Coach: {trainerName}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                <PlanView workout={workout} diet={diet} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts">
            <Card className="rounded-3xl shadow-xs">
              <CardHeader>
                <CardTitle>Payment receipts</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {paidReceipts.map((p) => (
                  <div
                    key={String(p.id)}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {money(p.amount, currency)} · {p.method ?? "cash"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.paid_on ? fmtDate(p.paid_on) : ""}
                        {p.receipt_no ? ` · ${p.receipt_no}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.receipt_path ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void downloadPdf(p)}
                        >
                          <Download className="size-4" aria-hidden="true" />
                          <span>PDF</span>
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/receipt?id=${encodeURIComponent(String(p.id))}`}
                        >
                          <span>View</span>
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {paidReceipts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No receipts yet.</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visits">
            <Card className="rounded-3xl shadow-xs">
              <CardHeader>
                <CardTitle>Gym visits</CardTitle>
                <CardDescription>
                  {streak ? streakText(streak) : `${visits.length} recent visits`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {visits.map((v, idx) => (
                  <div
                    key={`${v.checked_in_at}-${idx}`}
                    className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="text-foreground">{fmtDate(v.day)}</span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {hhmmDhaka(v.checked_in_at)}
                    </span>
                  </div>
                ))}
                {visits.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No visits recorded yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </main>
  );
}
