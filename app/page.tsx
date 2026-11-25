"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  QrCode,
  Receipt,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type StageAct = "desk" | "pay" | "member" | "ai";
type WalletChoice = "bKash" | "Nagad";
type SplitGoal = "Strength" | "Muscle gain" | "Fat loss";
type SplitDays = 3 | 4 | 5;

interface DeskScanRow {
  id: string;
  name: string;
  plan: string;
  status: "active" | "expired";
  time: string;
}

const INITIAL_SCANS: DeskScanRow[] = [
  {
    id: "scan-1",
    name: "Tanvir Ahmed",
    plan: "Quarterly plan",
    status: "active",
    time: "07:12 AM",
  },
  {
    id: "scan-2",
    name: "Farhana Islam",
    plan: "Monthly plan",
    status: "active",
    time: "07:18 AM",
  },
];

const AI_SPLITS: Record<SplitGoal, Record<SplitDays, string[]>> = {
  Strength: {
    3: [
      "Day 1: Squat, bench press, barbell row",
      "Day 2: Deadlift, overhead press, chin-ups",
      "Day 3: Front squat, incline press, farmer carry",
    ],
    4: [
      "Day 1: Heavy squat and hamstring accessories",
      "Day 2: Heavy bench press and upper back",
      "Day 3: Deadlift and core bracing",
      "Day 4: Overhead press and weighted dips",
    ],
    5: [
      "Day 1: Squat focus",
      "Day 2: Bench press focus",
      "Day 3: Posterior chain and pulls",
      "Day 4: Overhead press and arms",
      "Day 5: Pause squats and conditioning",
    ],
  },
  "Muscle gain": {
    3: [
      "Day 1: Full body push emphasis",
      "Day 2: Full body pull emphasis",
      "Day 3: Lower body and shoulders",
    ],
    4: [
      "Day 1: Upper body strength and volume",
      "Day 2: Lower body quads and calves",
      "Day 3: Chest, shoulders, and triceps",
      "Day 4: Back, biceps, and hamstrings",
    ],
    5: [
      "Day 1: Chest and triceps",
      "Day 2: Back and biceps",
      "Day 3: Quads and calves",
      "Day 4: Shoulders and upper chest",
      "Day 5: Hamstrings and arms",
    ],
  },
  "Fat loss": {
    3: [
      "Day 1: Compound circuit and brisk incline walk",
      "Day 2: Upper pull, core, and rowing intervals",
      "Day 3: Lower body supersets and sled work",
    ],
    4: [
      "Day 1: Upper body density circuit",
      "Day 2: Lower body and steady cardio",
      "Day 3: Push and pull supersets",
      "Day 4: Conditioning intervals and mobility",
    ],
    5: [
      "Day 1: Upper strength and walk",
      "Day 2: Lower strength and core",
      "Day 3: Zone 2 cardio and mobility",
      "Day 4: Full body circuit",
      "Day 5: Conditioning intervals",
    ],
  },
};

const FAQ_ITEMS = [
  {
    q: "Do I need a merchant payment gateway to collect bKash or Nagad?",
    a: "No. Members send money directly to your gym's existing bKash or Nagad number and submit the TrxID in their portal. Staff verify the SMS and approve in one tap with zero gateway deductions.",
  },
  {
    q: "Do members have to install an app from Google Play or the App Store?",
    a: "No. The member portal runs in any mobile browser and can be added to the home screen as a web app after scanning your front-desk QR poster.",
  },
  {
    q: "How does the desk screen catch unpaid or expired walk-ins?",
    a: "When a member scans the desk QR poster, their visit appears on your reception screen (/desk). Expired or unpaid memberships are highlighted in red immediately.",
  },
  {
    q: "Can trainers use the admin portal without seeing owner revenue?",
    a: "Yes. Staff accounts can check members in, confirm payments, and assign workout or diet plans while owner-only settings remain restricted.",
  },
  {
    q: "Are the AI coach and workout split builder live today?",
    a: "Those features are planned next. Today, trainers write and assign custom workout and diet templates directly, and the stage above previews how the AI split builder will fit in.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [signedInRoute, setSignedInRoute] = useState<string | null>(null);

  // Interactive Stage state
  const [act, setAct] = useState<StageAct>("desk");
  const [scans, setScans] = useState<DeskScanRow[]>(INITIAL_SCANS);
  const [wallet, setWallet] = useState<WalletChoice>("bKash");
  const [trxId, setTrxId] = useState("BKH94K28LP");
  const [payState, setPayState] = useState<"idle" | "pending" | "approved">("idle");
  const [sampleRevenue, setSampleRevenue] = useState(14500);
  const [splitGoal, setSplitGoal] = useState<SplitGoal>("Strength");
  const [splitDays, setSplitDays] = useState<SplitDays>(4);

  // Redirect signed-in visitors straight to their dashboard unless ?stay=1
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const stay = new URLSearchParams(window.location.search).get("stay") === "1";
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: staffRows } = await supabase
          .from("gym_staff")
          .select("gym_id")
          .eq("user_id", user.id)
          .limit(1);

        const target = staffRows && staffRows.length > 0 ? "/admin" : "/member";
        if (cancelled) return;
        setSignedInRoute(target);
        if (!stay) {
          router.replace(target);
        }
      } catch {
        // Public landing stays visible if auth check fails
      }
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const simulateScan = (kind: "active" | "expired") => {
    const nextRow: DeskScanRow =
      kind === "active"
        ? {
            id: `${Date.now()}-a`,
            name: "Nadia Rahman",
            plan: "Monthly plan",
            status: "active",
            time: "Just now",
          }
        : {
            id: `${Date.now()}-e`,
            name: "Sajid Hasan",
            plan: "Expired 3 days ago",
            status: "expired",
            time: "Just now",
          };
    setScans((prev) => [nextRow, ...prev.slice(0, 3)]);
  };

  return (
    <div className="hl-page">
      {signedInRoute ? (
        <div
          role="status"
          className="border-b border-(--hl-rule) bg-(--hl-accent-soft) text-(--hl-accent-soft-ink)"
        >
          <div className="hl-container flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
            <span>You are signed in.</span>
            <Link href={signedInRoute} className="font-medium underline">
              Open your dashboard
            </Link>
          </div>
        </div>
      ) : null}

      {/* Edge-aligned top navigation */}
      <header className="border-b border-(--hl-rule) bg-(--hl-paper)">
        <div className="hl-container flex h-18 items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-(--hl-ink) no-underline">
            GymGrid
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
            <a href="#stage" className="hl-nav-link">
              Product stage
            </a>
            <a href="#portals" className="hl-nav-link">
              Portals
            </a>
            <a href="#faq" className="hl-nav-link">
              Questions
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/member" className="hl-nav-link">
              Member<span className="hidden sm:inline">&nbsp;sign in</span>
            </Link>
            <Link href="/admin" className="hl-btn-secondary min-h-11 px-3 text-sm sm:px-4">
              Owner<span className="hidden sm:inline">&nbsp;portal</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO: Stage posture */}
        <section className="py-12 md:py-20">
          <div className="hl-container">
            <div className="hl-hero-grid">
              <div className="flex flex-col items-start gap-6">
                <h1 className="hl-h1">One ledger for your entire gym.</h1>
                <p className="hl-lead">
                  QR desk check-ins, bKash verification, and member routines without paper.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link href="/onboarding" className="hl-btn-primary">
                    <span>Set up your gym</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <a href="#stage" className="hl-btn-secondary">
                    Explore live stage
                  </a>
                </div>
              </div>

              <figure
                className="hl-screen-frame"
                data-slot="hero"
                data-kind="product"
                data-alt="Live GymGrid owner dashboard showing active members, attendance, and payment status"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/screens/preview-desktop.png"
                  alt="GymGrid owner dashboard showing active members, attendance, and pending bKash payments"
                  width={1440}
                  height={900}
                  fetchPriority="high"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* SIGNATURE: Interactive Four-Act Product Stage */}
        <section
          id="stage"
          className="border-y border-(--hl-rule) bg-(--hl-paper-2) py-16 md:py-24"
        >
          <div className="hl-container flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <h2 className="hl-h2">Try the floor and desk workflows.</h2>
              <p className="hl-lead">
                Switch between the reception check-in screen, bKash TrxID queue, member phone portal, and upcoming AI split builder.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Interactive product stage"
              className="flex flex-wrap gap-2"
            >
              {[
                { id: "desk" as const, label: "Desk QR guardrail", icon: QrCode },
                { id: "pay" as const, label: "bKash and Nagad queue", icon: CreditCard },
                { id: "member" as const, label: "Member phone portal", icon: Smartphone },
                { id: "ai" as const, label: "AI split builder (planned)", icon: Sparkles },
              ].map((item) => {
                const Icon = item.icon;
                const active = act === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAct(item.id)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
                      active
                        ? "border-(--hl-accent-soft) bg-(--hl-accent-soft) text-(--hl-accent-soft-ink)"
                        : "border-(--hl-rule) bg-(--hl-paper) text-(--hl-ink-2) hover:bg-(--hl-paper-3)"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ACT 1: QR Guardrail */}
            {act === "desk" ? (
              <div className="hl-stage-grid rounded-2xl border border-(--hl-rule) bg-(--hl-paper) p-6 md:p-8">
                <div className="flex flex-col gap-5">
                  <h3 className="hl-h3">Catch expired walk-ins at the desk.</h3>
                  <p className="text-base text-(--hl-ink-2)">
                    Print the desk QR poster once. Active members log their visit in one scan, while expired memberships trigger an immediate alert on the reception monitor.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => simulateScan("active")}
                      className="hl-btn-primary min-h-11 px-4 text-sm"
                    >
                      Simulate active scan
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateScan("expired")}
                      className="hl-btn-secondary min-h-11 px-4 text-sm"
                    >
                      Simulate expired walk-in
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-(--hl-rule) bg-(--hl-paper-2) p-4">
                  <div className="flex items-center justify-between border-b border-(--hl-rule) pb-3 text-sm font-medium text-(--hl-ink-2)">
                    <span>Reception feed (/desk)</span>
                    <span className="text-(--hl-success)">Live sample</span>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {scans.map((row) => (
                      <li
                        key={row.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                          row.status === "expired"
                            ? "border-(--hl-error) bg-(--hl-error-bg) text-(--hl-ink)"
                            : "border-(--hl-rule) bg-(--hl-paper)"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{row.name}</div>
                          <div className="text-xs text-(--hl-muted)">{row.plan}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className={`text-xs font-medium ${
                              row.status === "expired"
                                ? "text-(--hl-error)"
                                : "text-(--hl-success)"
                            }`}
                          >
                            {row.status === "expired" ? "Renewal due" : "Active"}
                          </div>
                          <div className="hl-mono text-xs text-(--hl-muted)">{row.time}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {/* ACT 2: bKash & Nagad TrxID */}
            {act === "pay" ? (
              <div className="hl-stage-grid rounded-2xl border border-(--hl-rule) bg-(--hl-paper) p-6 md:p-8">
                <div className="flex flex-col gap-4">
                  <h3 className="hl-h3">Confirm bKash and Nagad TrxIDs in one tap.</h3>
                  <p className="text-base text-(--hl-ink-2)">
                    Members send money to your gym number and enter the TrxID. Staff verify the SMS and issue a receipt without payment gateway fees.
                  </p>
                  <div className="flex gap-2">
                    {(["bKash", "Nagad"] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setWallet(choice)}
                        className={`min-h-11 flex-1 rounded-lg border text-sm font-medium transition-colors ${
                          wallet === choice
                            ? "border-(--hl-accent-soft) bg-(--hl-accent-soft) text-(--hl-accent-soft-ink)"
                            : "border-(--hl-rule) bg-(--hl-paper-2) text-(--hl-ink)"
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="demo-trx" className="text-sm font-medium text-(--hl-ink-2)">
                      Sample TrxID
                    </label>
                    <input
                      id="demo-trx"
                      type="text"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      className="hl-input hl-mono uppercase"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayState("pending")}
                    className="hl-btn-primary min-h-11 text-sm"
                  >
                    Submit sample TrxID
                  </button>
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-xl border border-(--hl-rule) bg-(--hl-paper-2) p-5">
                  <div className="flex items-center justify-between border-b border-(--hl-rule) pb-3 text-sm">
                    <span className="font-medium text-(--hl-ink-2)">Owner queue (/admin)</span>
                    <span className="hl-num font-semibold">
                      Today sample: ৳{sampleRevenue.toLocaleString()}
                    </span>
                  </div>

                  {payState === "idle" ? (
                    <p className="py-6 text-sm text-(--hl-muted)">
                      Submit the sample TrxID to preview how it appears in the owner verification queue.
                    </p>
                  ) : null}

                  {payState === "pending" ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-(--hl-warning) bg-(--hl-warning-bg) p-4">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Rafiqul Islam</span>
                        <span className="text-(--hl-warning)">Awaiting check</span>
                      </div>
                      <p className="hl-mono text-xs text-(--hl-ink-2)">
                        {wallet} | TrxID {trxId} | ৳1,500 sample
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPayState("approved");
                          setSampleRevenue((r) => r + 1500);
                        }}
                        className="hl-btn-primary min-h-11 text-sm"
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        <span>Verify and issue receipt</span>
                      </button>
                    </div>
                  ) : null}

                  {payState === "approved" ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-(--hl-success) bg-(--hl-success-bg) p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-(--hl-success)">
                        <Receipt className="size-4" aria-hidden="true" />
                        <span>Sample receipt issued</span>
                      </div>
                      <p className="text-sm text-(--hl-ink-2)">
                        Membership extended by 30 days and logged in the receipt ledger.
                      </p>
                      <button
                        type="button"
                        onClick={() => setPayState("idle")}
                        className="self-start text-sm font-medium underline"
                      >
                        Reset sample
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* ACT 3: Member Phone Portal */}
            {act === "member" ? (
              <div className="hl-stage-grid rounded-2xl border border-(--hl-rule) bg-(--hl-paper) p-6 md:p-8">
                <div className="flex flex-col gap-4">
                  <h3 className="hl-h3">Five focused views for every member phone.</h3>
                  <p className="text-base text-(--hl-ink-2)">
                    Members open the app on mobile with a thumb-friendly bottom navigation bar. No app store install required.
                  </p>
                  <dl className="grid gap-3 pt-2 text-sm">
                    <div className="border-t border-(--hl-rule) pt-3">
                      <dt className="font-medium text-(--hl-ink)">Overview and visits</dt>
                      <dd className="text-(--hl-ink-2)">
                        Membership standing, days remaining, 14-day attendance chart, and streak count.
                      </dd>
                    </div>
                    <div className="border-t border-(--hl-rule) pt-3">
                      <dt className="font-medium text-(--hl-ink)">Plans and trainer</dt>
                      <dd className="text-(--hl-ink-2)">
                        Assigned workout routine, diet plan, and gym membership options.
                      </dd>
                    </div>
                    <div className="border-t border-(--hl-rule) pt-3">
                      <dt className="font-medium text-(--hl-ink)">Renew and receipts</dt>
                      <dd className="text-(--hl-ink-2)">
                        bKash or Nagad TrxID submission and downloadable PDF receipts.
                      </dd>
                    </div>
                  </dl>
                  <div className="pt-2">
                    <Link href="/member" className="hl-btn-secondary min-h-11 px-4 text-sm">
                      Open member portal
                    </Link>
                  </div>
                </div>

                <figure
                  className="hl-screen-frame mx-auto max-w-80"
                  data-slot="stage-phone"
                  data-kind="product"
                  data-alt="Mobile layout of the GymGrid dashboard showing stacked cards"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/screens/preview-phone.png"
                    alt="Mobile responsive layout of GymGrid dashboard"
                    width={390}
                    height={844}
                    loading="lazy"
                  />
                </figure>
              </div>
            ) : null}

            {/* ACT 4: Upcoming AI Coach & Split Builder */}
            {act === "ai" ? (
              <div className="hl-stage-grid rounded-2xl border border-(--hl-rule) bg-(--hl-paper) p-6 md:p-8">
                <div className="flex flex-col gap-4">
                  <div className="inline-flex self-start rounded-md border border-(--hl-rule) bg-(--hl-paper-2) px-2.5 py-1 text-xs font-medium text-(--hl-ink-2)">
                    Planned feature preview
                  </div>
                  <h3 className="hl-h3">AI coach and custom workout split builder.</h3>
                  <p className="text-base text-(--hl-ink-2)">
                    Preview how trainers and members will draft tailored weekly splits before assigning them to a member profile.
                  </p>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-(--hl-ink-2)">Training goal</span>
                    <div className="flex flex-wrap gap-2">
                      {(["Strength", "Muscle gain", "Fat loss"] as const).map((goal) => (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => setSplitGoal(goal)}
                          className={`min-h-11 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
                            splitGoal === goal
                              ? "border-(--hl-accent-soft) bg-(--hl-accent-soft) text-(--hl-accent-soft-ink)"
                              : "border-(--hl-rule) bg-(--hl-paper-2) text-(--hl-ink)"
                          }`}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-(--hl-ink-2)">Days per week</span>
                    <div className="flex gap-2">
                      {([3, 4, 5] as const).map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setSplitDays(days)}
                          className={`min-h-11 flex-1 rounded-lg border text-sm font-medium transition-colors ${
                            splitDays === days
                              ? "border-(--hl-accent-soft) bg-(--hl-accent-soft) text-(--hl-accent-soft-ink)"
                              : "border-(--hl-rule) bg-(--hl-paper-2) text-(--hl-ink)"
                          }`}
                        >
                          {days} days
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-(--hl-rule) bg-(--hl-paper-2) p-5">
                  <div className="flex items-center justify-between border-b border-(--hl-rule) pb-3 text-sm">
                    <span className="font-medium text-(--hl-ink)">
                      Sample {splitDays}-day {splitGoal.toLowerCase()} split
                    </span>
                    <span className="text-xs text-(--hl-muted)">Draft preview</span>
                  </div>
                  <ol className="flex flex-col gap-2.5 text-sm text-(--hl-ink-2)">
                    {AI_SPLITS[splitGoal][splitDays].map((line, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-(--hl-rule) bg-(--hl-paper) px-3.5 py-2.5"
                      >
                        {line}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* STATEMENT */}
        <section className="py-16 md:py-24">
          <div className="hl-container">
            <h2 className="hl-h2 max-w-[26ch]">
              Money truth first. Every scan, TrxID, and renewal sits in one ledger.
            </h2>
          </div>
        </section>

        {/* PORTALS: Owner vs Member */}
        <section id="portals" className="border-t border-(--hl-rule) py-16 md:py-24">
          <div className="hl-container flex flex-col gap-10">
            <h2 className="hl-h2">Built for the front desk and the gym floor.</h2>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col justify-between gap-6 rounded-2xl border border-(--hl-rule) bg-(--hl-paper-2) p-6 md:p-8">
                <div className="flex flex-col gap-4">
                  <h3 className="hl-h3">Owner and trainer portal</h3>
                  <p className="text-base text-(--hl-ink-2)">
                    Run daily check-ins, approve mobile wallet payments, and send WhatsApp expiry reminders from one workspace.
                  </p>
                  <ul className="flex flex-col gap-2.5 border-t border-(--hl-rule) pt-4 text-sm text-(--hl-ink-2)">
                    <li>Live desk monitor flagging unpaid or expired scans</li>
                    <li>One-tap bKash and Nagad TrxID approval queue</li>
                    <li>Filterable member directory with CSV and Google Sheets backup</li>
                    <li>Printable QR poster generator for your reception counter</li>
                  </ul>
                </div>
                <div>
                  <Link href="/admin" className="hl-btn-primary">
                    <span>Open owner dashboard</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-6 rounded-2xl border border-(--hl-rule) bg-(--hl-paper-2) p-6 md:p-8">
                <div className="flex flex-col gap-4">
                  <h3 className="hl-h3">Member portal</h3>
                  <p className="text-base text-(--hl-ink-2)">
                    Give members instant clarity on their membership expiry, attendance streaks, training plans, and payment receipts.
                  </p>
                  <ul className="flex flex-col gap-2.5 border-t border-(--hl-rule) pt-4 text-sm text-(--hl-ink-2)">
                    <li>QR check-in confirmation and 14-day attendance pulse</li>
                    <li>Workout routine and diet plan assigned by gym trainers</li>
                    <li>Direct bKash or Nagad TrxID renewal submission</li>
                    <li>Confirmed payment history with PDF receipt downloads</li>
                  </ul>
                </div>
                <div>
                  <Link href="/member" className="hl-btn-secondary">
                    <span>Open member portal</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-(--hl-rule) bg-(--hl-paper-2) py-16 md:py-24">
          <div className="hl-container grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="hl-h2">Common questions.</h2>
            </div>

            <div className="flex flex-col divide-y divide-(--hl-rule) lg:col-span-8">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="group py-4 first:pt-0">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-(--hl-ink)">
                    <span>{item.q}</span>
                    <span className="shrink-0 text-sm text-(--hl-muted) group-open:hidden">
                      Show
                    </span>
                    <span className="hidden shrink-0 text-sm text-(--hl-muted) group-open:inline">
                      Hide
                    </span>
                  </summary>
                  <p className="pt-3 text-base text-(--hl-ink-2)">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CLOSING BAND */}
        <section className="border-t border-(--hl-rule) py-16 md:py-20">
          <div className="hl-container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex flex-col gap-2">
              <h2 className="hl-h2">Start your gym workspace.</h2>
              <p className="hl-lead">
                Set up your gym name, bKash and Nagad numbers, and QR poster in minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/onboarding" className="hl-btn-primary">
                <span>Set up your gym</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/preview" className="hl-btn-secondary">
                View UI preview
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* STATEMENT FOOTER */}
      <footer className="border-t border-(--hl-rule) py-10">
        <div className="hl-container flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold text-(--hl-ink)">GymGrid</span>
            <span className="text-sm text-(--hl-muted)">
              Gym operations and member portal for Bangladesh.
            </span>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--hl-ink-2)">
            <Link href="/member" className="hover:underline">
              Member portal
            </Link>
            <Link href="/admin" className="hover:underline">
              Owner dashboard
            </Link>
            <Link href="/join" className="hover:underline">
              Self-register
            </Link>
            <Link href="/preview" className="hover:underline">
              UI preview
            </Link>
            <Link href="/onboarding" className="hover:underline">
              Gym setup
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
