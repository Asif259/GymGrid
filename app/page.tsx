"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  QrCode,
  ShieldAlert,
  CheckCircle2,
  CreditCard,
  MessageSquare,
  Sun,
  Moon,
  ArrowRight,
  Smartphone,
  Check,
  X,
  Receipt,
  Clock,
  ChevronDown,
  Sparkles,
  Play,
} from "lucide-react";

type ActId = 1 | 2 | 3 | 4;
type WalletProvider = "bKash" | "Nagad";
type BillingCycle = "monthly" | "yearly";

interface CheckInLog {
  id: string;
  name: string;
  plan: string;
  status: "active" | "expired";
  time: string;
}

const ACTS: { id: ActId; number: string; title: string; subtitle: string; icon: typeof QrCode }[] = [
  { id: 1, number: "01", title: "QR Desk Guardrail", subtitle: "Instant walk-in scan vs. expired alert", icon: QrCode },
  { id: 2, number: "02", title: "bKash & Nagad TrxID", subtitle: "Zero fees, human confirmation", icon: CreditCard },
  { id: 3, number: "03", title: "WhatsApp & Digest", subtitle: "Tap-to-remind & 07:04 AM digest", icon: MessageSquare },
  { id: 4, number: "04", title: "Multi-tenant Brand", subtitle: "Live gym branding in 60 seconds", icon: Sparkles },
];

const FAQS = [
  {
    q: "Do I need a merchant account or payment gateway like SSLCommerz?",
    a: "No. You use your existing personal or agent bKash and Nagad numbers. Members send money directly to your number and enter their TrxID in the app. You verify it with zero transaction deductions.",
  },
  {
    q: "Do members have to download an app from Google Play Store or App Store?",
    a: "No. The member app is a Progressive Web App (PWA). Members simply scan the front-desk QR poster or open your link. They can tap 'Add to Home Screen' without an app store account.",
  },
  {
    q: "How does the desk check-in prevent unpaid members from training?",
    a: "When a member scans your printed desk poster, their phone confirms check-in while your reception screen (/desk) displays their live photo and status. If their membership has expired, an unmistakable crimson banner alerts your staff immediately.",
  },
  {
    q: "What happens if our gym loses internet connection temporarily?",
    a: "Members with open sessions can still access their cached workout and diet cards. As soon as the desk connection restores, all attendance records and submitted TrxIDs synchronize automatically.",
  },
  {
    q: "Can I manage multiple trainers and staff with restricted access?",
    a: "Yes. Staff and trainers log in to /admin with designated roles. They can check in members, assign workout and diet templates, and view attendance without seeing your confidential revenue and owner settings.",
  },
  {
    q: "Can I export member data to Excel or Google Sheets?",
    a: "Yes. Every member record, payment receipt, and check-in log exports directly to CSV, and the system can continuously synchronize with your private Google Sheet for peace of mind.",
  },
];

export default function LandingPage() {
  const [dark, setDark] = useState(false);
  const [activeAct, setActiveAct] = useState<ActId>(1);
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [modalOpen, setModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Act 1: Check-in state
  const [checkIns, setCheckIns] = useState<CheckInLog[]>([
    { id: "1", name: "Tanvir Ahmed", plan: "Quarterly Pro", status: "active", time: "07:12 AM" },
    { id: "2", name: "Farhana Islam", plan: "Monthly Standard", status: "active", time: "07:18 AM" },
  ]);

  // Act 2: TrxID state
  const [wallet, setWallet] = useState<WalletProvider>("bKash");
  const [trxId, setTrxId] = useState("BKH94K28LP");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "approved">("idle");
  const [todayRevenue, setTodayRevenue] = useState(14500);

  // Act 4: Branding state
  const [brandName, setBrandName] = useState("IronHouse Dhaka");
  const [brandPhone, setBrandPhone] = useState("01711-000000");
  const [brandAccent, setBrandAccent] = useState("#10B981");

  // Onboarding Modal state
  const [gymInput, setGymInput] = useState("");
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Tagline word reveal scroll observer
  const taglineRef = useRef<HTMLDivElement>(null);
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!taglineRef.current) return;
      const rect = taglineRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const start = windowHeight * 0.85;
      const end = windowHeight * 0.25;
      const progress = Math.min(Math.max((start - rect.top) / (start - end), 0), 1);
      setRevealProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard navigation for Stageshow acts (1, 2, 3, 4)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "1") setActiveAct(1);
      if (e.key === "2") setActiveAct(2);
      if (e.key === "3") setActiveAct(3);
      if (e.key === "4") setActiveAct(4);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const simulateScan = (type: "active" | "expired") => {
    const newEntry: CheckInLog =
      type === "active"
        ? {
            id: String(Date.now()),
            name: "Nadia Rahman",
            plan: "Monthly Standard",
            status: "active",
            time: "Just now",
          }
        : {
            id: String(Date.now()),
            name: "Sajid Hasan",
            plan: "Expired 3 days ago",
            status: "expired",
            time: "Just now",
          };
    setCheckIns((prev) => [newEntry, ...prev.slice(0, 3)]);
  };

  const generatedSlug =
    (gymInput || "ironhouse-dhaka")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "my-gym";

  const handleCopySlug = () => {
    navigator.clipboard.writeText(`https://gymgrid.app/join/${generatedSlug}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const taglineWords = "Stop chasing expired memberships. Let members check in with QR, pay with bKash, and access their routine in one calm workspace.".split(" ");

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-[#F7F7F4] text-[#111315] antialiased transition-colors duration-300 dark:bg-[#000000] dark:text-[#F4F5F6] selection:bg-emerald-500/20">
        
        {/* Floating Top Navigation */}
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 pointer-events-none">
          <nav className="pointer-events-auto flex h-14 w-full max-w-4xl items-center justify-between rounded-2xl border border-black/10 bg-[#F7F7F4]/80 px-4 py-2 backdrop-blur-md shadow-xs dark:border-white/10 dark:bg-[#181818]/80 sm:px-6">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <div className="grid grid-cols-2 gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-[1px] bg-white" />
                  <span className="h-1.5 w-1.5 rounded-[1px] bg-white/50" />
                  <span className="h-1.5 w-1.5 rounded-[1px] bg-white/50" />
                  <span className="h-1.5 w-1.5 rounded-[1px] bg-white" />
                </div>
              </div>
              <span className="text-base font-semibold tracking-tight">
                Gym<span className="text-emerald-600 dark:text-emerald-400">Grid</span>
              </span>
            </Link>

            <div className="hidden items-center gap-6 text-sm font-medium text-neutral-600 dark:text-neutral-400 md:flex">
              <a href="#demo" className="transition-colors hover:text-black dark:hover:text-white">
                Live Stageshow
              </a>
              <a href="#how-it-works" className="transition-colors hover:text-black dark:hover:text-white">
                How It Works
              </a>
              <a href="#benefits" className="transition-colors hover:text-black dark:hover:text-white">
                Benefits
              </a>
              <a href="#pricing" className="transition-colors hover:text-black dark:hover:text-white">
                Pricing
              </a>
              <a href="#faq" className="transition-colors hover:text-black dark:hover:text-white">
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle visual theme"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5 transition-colors touch-manipulation"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#000000] dark:hover:bg-emerald-400 touch-manipulation"
              >
                Start Free Trial
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </nav>
        </div>

        {/* HERO SECTION */}
        <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 border-b border-black/10 dark:border-white/10 overflow-hidden">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Built for Neighbourhood Gyms in Bangladesh
            </div>

            <h1 className="mt-8 max-w-[680px] text-4xl font-semibold tracking-tight text-balance sm:text-6xl text-foreground">
              Run your entire gym from one phone without paper.
            </h1>

            <p className="mt-6 max-w-[640px] text-base leading-relaxed text-pretty text-neutral-600 dark:text-neutral-400 sm:text-lg">
              Automate front desk QR check-ins, bKash and Nagad payment verifications with zero gateway deductions, and send renewal reminders via WhatsApp.
            </p>

            {/* Hero CTAs */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-98 dark:bg-emerald-500 dark:text-[#000000] dark:hover:bg-emerald-400 touch-manipulation"
              >
                Launch Your Gym in 60s
                <ArrowRight className="h-4 w-4" />
              </button>

              <a
                href="#demo"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-black/15 bg-white px-6 text-sm font-semibold transition-all hover:bg-black/5 active:scale-98 dark:border-white/15 dark:bg-[#181818] dark:hover:bg-white/5 touch-manipulation"
              >
                <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Explore Stageshow Demo
              </a>
            </div>

            {/* Proof Metric Signals */}
            <div className="mt-14 grid w-full max-w-4xl grid-cols-2 gap-4 border-t border-black/10 pt-10 text-left dark:border-white/10 sm:grid-cols-4">
              <div className="p-2">
                <span className="block text-2xl font-semibold tabular-nums text-foreground">
                  ৳0
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  Payment gateway fees
                </span>
              </div>
              <div className="p-2">
                <span className="block text-2xl font-semibold tabular-nums text-foreground">
                  07:04 AM
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  Dhaka morning digest
                </span>
              </div>
              <div className="p-2">
                <span className="block text-2xl font-semibold tabular-nums text-foreground">
                  1 Tap
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  WhatsApp renewal dispatch
                </span>
              </div>
              <div className="p-2">
                <span className="block text-2xl font-semibold tabular-nums text-foreground">
                  100% PWA
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  Zero app store install friction
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* MANDATORY TAGLINE REVEAL SECTION (B11) */}
        <section ref={taglineRef} className="py-24 sm:py-32 border-b border-black/10 dark:border-white/10 bg-white/50 dark:bg-[#181818]/40">
          <div className="mx-auto max-w-[680px] px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              The Paperless Standard
            </p>
            <div className="mt-6 text-3xl font-semibold leading-relaxed tracking-tight sm:text-4xl">
              {taglineWords.map((word, index) => {
                const wordProgress = (index + 1) / taglineWords.length;
                const isRevealed = revealProgress >= wordProgress;
                return (
                  <span
                    key={index}
                    className="inline-block mr-2 transition-colors duration-300"
                    style={{
                      color: isRevealed
                        ? dark ? "#F4F5F6" : "#111315"
                        : dark ? "rgba(244, 245, 246, 0.25)" : "rgba(17, 19, 21, 0.28)",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        {/* STAGESHOW: 4-ACT FAUX PRODUCT DEMO */}
        <section id="demo" className="py-20 sm:py-28 border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span>Interactive Stageshow</span>
                  <span className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">Keys 1–4</span>
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl text-balance">
                  Experience the exact gym workflow.
                </h2>
              </div>
              <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-400">
                Click between acts below to interact with real simulated desk check-ins, bKash TrxID verification, and multi-tenant branding.
              </p>
            </div>

            {/* Act Navigation Grid */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACTS.map((act) => {
                const isActive = activeAct === act.id;
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActiveAct(act.id)}
                    className={`min-h-16 rounded-2xl border p-3.5 text-left transition-all touch-manipulation ${
                      isActive
                        ? "border-emerald-600 bg-emerald-600/10 dark:border-emerald-400 dark:bg-emerald-400/10 shadow-xs"
                        : "border-black/10 bg-white hover:border-black/20 dark:border-white/10 dark:bg-[#181818] dark:hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{act.number}</span>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-1 text-sm font-semibold truncate text-foreground">{act.title}</div>
                    <div className="text-[11px] text-neutral-500 truncate">{act.subtitle}</div>
                  </button>
                );
              })}
            </div>

            {/* Simulated Product Stage Frame */}
            <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#181818] shadow-sm sm:p-8">
              
              {/* ACT 1: QR GUARDRAIL */}
              {activeAct === 1 && (
                <div className="grid gap-8 lg:grid-cols-2 items-center">
                  <div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Act 01 · Zero Unpaid Walk-ins
                    </span>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      Members scan the desk QR. Staff screen catches unpaid visitors immediately.
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      Print one QR poster for your reception counter. When members scan with their camera, active members are registered in seconds, while expired memberships flash in bright crimson.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => simulateScan("active")}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 active:scale-98"
                      >
                        <QrCode className="h-4 w-4" />
                        Simulate Active Member Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => simulateScan("expired")}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 active:scale-98"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Simulate Expired Walk-in
                      </button>
                    </div>
                  </div>

                  {/* Faux Screen: /desk live feed */}
                  <div className="rounded-2xl border border-black/10 bg-[#F7F7F4] p-4 dark:border-white/10 dark:bg-[#000000]">
                    <div className="mb-3 flex items-center justify-between border-b border-black/10 pb-2 text-xs font-semibold text-neutral-600 dark:border-white/10 dark:text-neutral-400">
                      <span>RECEPTION MONITOR (/desk)</span>
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Feed
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {checkIns.map((log) => (
                        <div
                          key={log.id}
                          className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                            log.status === "expired"
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200"
                              : "border-black/10 bg-white dark:border-white/10 dark:bg-[#181818]"
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold">{log.name}</div>
                            <div className="text-xs text-neutral-500">{log.plan}</div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                log.status === "expired"
                                  ? "bg-rose-600 text-white"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {log.status === "expired" ? "UNPAID / DUE" : "ACTIVE"}
                            </span>
                            <div className="mt-1 text-[11px] tabular-nums text-neutral-500">
                              {log.time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ACT 2: BKASH/NAGAD TRXID VERIFICATION */}
              {activeAct === 2 && (
                <div className="grid gap-8 lg:grid-cols-2 items-center">
                  <div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Act 02 · Truth in Revenue
                    </span>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      bKash & Nagad Send Money verified by your staff without deductions.
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      Members send money to your gym wallet number and paste their TrxID. The owner or trainer verifies the SMS notification and taps confirm in one second.
                    </p>

                    <div className="mt-6 rounded-2xl border border-black/10 p-4 dark:border-white/10 bg-[#F7F7F4] dark:bg-[#000000]">
                      <div className="flex gap-2">
                        {(["bKash", "Nagad"] as WalletProvider[]).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setWallet(w)}
                            className={`min-h-10 flex-1 rounded-xl border text-xs font-semibold transition-all ${
                              wallet === w
                                ? "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                                : "border-black/10 bg-white dark:border-white/10 dark:bg-[#181818]"
                            }`}
                          >
                            {w} Send Money
                          </button>
                        ))}
                      </div>

                      <div className="mt-3">
                        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          MEMBER TRXID SUBMISSION (৳1,500 MONTHLY)
                        </label>
                        <input
                          type="text"
                          value={trxId}
                          onChange={(e) => setTrxId(e.target.value)}
                          className="mt-1 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 font-mono text-sm uppercase dark:border-white/15 dark:bg-[#181818]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setPaymentStatus("pending")}
                        className="mt-3 min-h-11 w-full rounded-xl bg-[#111315] text-xs font-semibold text-white shadow-xs transition-colors hover:bg-neutral-800 dark:bg-white dark:text-[#000000]"
                      >
                        1. Submit TrxID as Member
                      </button>
                    </div>
                  </div>

                  {/* Faux Screen: Admin Verification */}
                  <div className="rounded-2xl border border-black/10 bg-[#F7F7F4] p-5 dark:border-white/10 dark:bg-[#000000]">
                    <div className="flex items-center justify-between border-b border-black/10 pb-3 text-xs font-semibold text-neutral-600 dark:border-white/10 dark:text-neutral-400">
                      <span>ADMIN VERIFICATION QUEUE (/admin)</span>
                      <span className="tabular-nums font-bold text-foreground">
                        Today: ৳{todayRevenue.toLocaleString()}
                      </span>
                    </div>

                    <div className="py-6">
                      {paymentStatus === "idle" && (
                        <p className="text-center text-xs text-neutral-500 py-4">
                          Click &quot;Submit TrxID as Member&quot; on the left to simulate a pending submission.
                        </p>
                      )}
                      {paymentStatus === "pending" && (
                        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">Rafiqul Islam</span>
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              PENDING VERIFICATION
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300 tabular-nums">
                            {wallet} · TrxID: {trxId} · ৳1,500
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentStatus("approved");
                              setTodayRevenue((r) => r + 1500);
                            }}
                            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            2. Confirm &amp; Extend +30 Days
                          </button>
                        </div>
                      )}
                      {paymentStatus === "approved" && (
                        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            <Receipt className="h-4 w-4" />
                            Receipt Generated (/receipt?id=GG-8841)
                          </div>
                          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300 tabular-nums">
                            Paid ৳1,500 via {wallet} ({trxId}). Membership valid for next 30 days.
                          </p>
                          <button
                            type="button"
                            onClick={() => setPaymentStatus("idle")}
                            className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 underline"
                          >
                            Reset Demo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ACT 3: WHATSAPP REMINDERS & 07:04 AM DIGEST */}
              {activeAct === 3 && (
                <div className="grid gap-8 lg:grid-cols-2 items-center">
                  <div className="rounded-2xl border border-black/10 bg-[#F7F7F4] p-5 dark:border-white/10 dark:bg-[#000000]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <MessageSquare className="h-4 w-4" />
                      1-TAP WHATSAPP EXPIRY REMINDER (৳0 SMS COST)
                    </div>
                    <div className="mt-4 rounded-xl border border-black/10 bg-white p-4 text-xs leading-relaxed text-neutral-700 dark:border-white/10 dark:bg-[#181818] dark:text-neutral-300">
                      &quot;Assalamu Alaikum <strong>Sajid</strong>, your gym membership at{" "}
                      <strong>{brandName}</strong> ends in <strong>2 days</strong>. Please renew via
                      bKash ({brandPhone}) and submit your TrxID here: gymgrid.app&quot;
                    </div>
                    <p className="mt-3 text-[11px] text-neutral-500">
                      No bulk SMS fees. The system pre-fills personalized WhatsApp messages with member names and exact balances.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-[#F7F7F4] p-5 dark:border-white/10 dark:bg-[#000000]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      <Clock className="h-4 w-4" />
                      07:04 AM ASIA/DHAKA OWNER REVENUE DIGEST
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs tabular-nums">
                      <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#181818]">
                        <span className="text-neutral-500 text-[11px]">Active Members</span>
                        <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">114</div>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#181818]">
                        <span className="text-neutral-500 text-[11px]">Expiring (48 Hours)</span>
                        <div className="mt-1 text-xl font-semibold text-amber-500">6</div>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#181818]">
                        <span className="text-neutral-500 text-[11px]">Pending TrxIDs</span>
                        <div className="mt-1 text-xl font-semibold text-foreground">3</div>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#181818]">
                        <span className="text-neutral-500 text-[11px]">Month Revenue</span>
                        <div className="mt-1 text-xl font-semibold text-foreground">৳1,71,000</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACT 4: 60-SECOND BRANDING */}
              {activeAct === 4 && (
                <div className="grid gap-8 lg:grid-cols-2 items-center">
                  <div className="space-y-4">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Act 04 · Multi-tenant White Label
                    </span>
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                      Your gym name, your wallet numbers, your branding.
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        GYM NAME
                      </label>
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#000000]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        BKASH / NAGAD RECEPTION NUMBER
                      </label>
                      <input
                        type="text"
                        value={brandPhone}
                        onChange={(e) => setBrandPhone(e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 font-mono text-sm dark:border-white/15 dark:bg-[#000000]"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {["#10B981", "#2563EB", "#F97316", "#E11D48"].map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setBrandAccent(hex)}
                          aria-label={`Select accent color ${hex}`}
                          className={`h-8 w-8 rounded-full border-2 transition-transform ${
                            brandAccent === hex ? "border-black scale-110 dark:border-white" : "border-transparent"
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-[#F7F7F4] p-5 dark:border-white/10 dark:bg-[#000000]">
                    <div className="flex items-center justify-between border-b border-black/10 pb-3 dark:border-white/10">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: brandAccent }}
                        >
                          {brandName.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{brandName || "Your Gym"}</span>
                      </div>
                      <span className="text-xs text-neutral-500">MEMBER PORTAL</span>
                    </div>

                    <div className="mt-4 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#181818]">
                      <div className="text-[11px] font-semibold text-neutral-500">DESK QR PREVIEW</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        Scan to check in at {brandName || "Your Gym"}
                      </div>
                      <div className="mt-2 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                        Send Money: {brandPhone}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>

        {/* HOW IT WORKS (3 STEPS) */}
        <section id="how-it-works" className="py-20 sm:py-28 border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Simple 3-Step Setup
              </span>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Ready to replace your notebook in under 5 minutes.
              </h2>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-3">
              <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  1
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Print your desk poster
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Open your printable QR page (/desk-qr) and print your customized gym poster with bKash and Nagad numbers.
                </p>
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  2
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Members scan to check in
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Members point their phone camera, open the app, and log their visit without standing in a registration queue.
                </p>
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  3
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Confirm payments in one tap
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Receive TrxID submissions on your phone, match the SMS confirmation, and tap verify to extend their membership.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CORE BENEFITS */}
        <section id="benefits" className="py-20 sm:py-28 border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Measurable Impact
              </span>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Built specifically for how Bangladeshi gyms run.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
                <ShieldAlert className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Zero unpaid walk-ins
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  The live reception monitor catches expired members on entry, eliminating awkward payment confrontations.
                </p>
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
                <CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Zero gateway deductions
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Keep 100% of your membership fees without losing 2 to 3% to commercial payment aggregator cuts.
                </p>
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
                <Smartphone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Works on low-end Androids
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Lightweight web technology loads instantaneously on 3G and 4G mobile networks with zero app store delays.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" className="py-20 sm:py-28 border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Honest Pricing
                </span>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Simple plans in Bangladeshi Taka.
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  No hidden card fees. No setup charges. 14 days completely free.
                </p>
              </div>

              <div className="inline-flex rounded-xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-[#181818]">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition-colors ${
                    billing === "monthly" ? "bg-[#111315] text-white dark:bg-white dark:text-[#000000]" : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("yearly")}
                  className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition-colors ${
                    billing === "yearly" ? "bg-[#111315] text-white dark:bg-white dark:text-[#000000]" : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  Yearly (-20%)
                </button>
              </div>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-[#181818]">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Starter Gym
                </div>
                <div className="mt-3 flex items-baseline gap-1 tabular-nums">
                  <span className="text-4xl font-semibold text-foreground">
                    ৳{billing === "monthly" ? "990" : "790"}
                  </span>
                  <span className="text-xs text-neutral-500">/month</span>
                </div>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Ideal for neighbourhood single-branch gyms with up to 150 active members.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Up to 150 active members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Front desk QR poster and /desk monitor
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    bKash and Nagad TrxID verification
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Downloadable PDF payment receipts
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-8 min-h-12 w-full rounded-xl border border-black/15 text-xs font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5 transition-colors touch-manipulation"
                >
                  Start 14-Day Free Trial
                </button>
              </div>

              <div className="rounded-3xl border-2 border-emerald-600 bg-white p-8 dark:border-emerald-400 dark:bg-[#181818] shadow-md">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Pro Multi-branch
                </div>
                <div className="mt-3 flex items-baseline gap-1 tabular-nums">
                  <span className="text-4xl font-semibold text-foreground">
                    ৳{billing === "monthly" ? "1,990" : "1,590"}
                  </span>
                  <span className="text-xs text-neutral-500">/month</span>
                </div>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  For growing facilities that need staff permissions and automatic spreadsheet backups.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Unlimited active members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Multiple staff and trainer logins
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Daily 07:04 AM revenue email and WhatsApp digest
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Real-time Google Sheets backup synchronization
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-8 min-h-12 w-full rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#000000] dark:hover:bg-emerald-400 transition-colors touch-manipulation"
                >
                  Launch Pro Workspace
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-20 sm:py-28 border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Frequently Asked Questions
              </span>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Everything you need to know.
              </h2>
            </div>

            <div className="mt-12 space-y-3">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#181818] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex min-h-14 w-full items-center justify-between p-5 text-left text-sm font-semibold text-foreground transition-colors touch-manipulation"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-emerald-600" : "text-neutral-500"
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-black/5 dark:border-white/5 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FINAL CONVERSION CTA */}
        <section className="py-20 sm:py-28 text-center bg-white dark:bg-[#181818]">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl text-balance">
              Start your 14-day free trial today.
            </h2>
            <p className="mt-4 text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
              Join gym owners in Dhaka who have eliminated paper registers and never missed an expiring membership.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-8 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-98 dark:bg-emerald-500 dark:text-[#000000] dark:hover:bg-emerald-400 touch-manipulation"
              >
                Launch Your Gym in 60s
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-black/10 py-8 text-center text-xs text-neutral-500 dark:border-white/10 dark:text-neutral-500">
          <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>© {new Date().getFullYear()} GymGrid. All rights reserved.</div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
              <Link href="/terms" className="hover:underline">Terms of Service</Link>
              <Link href="/admin" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                Owner Login (/admin)
              </Link>
            </div>
          </div>
        </footer>

        {/* 60-SECOND ONBOARDING MODAL */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#181818]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Set up your gym in 60s</h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close dialog"
                  className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                Enter your gym name to generate your dedicated member registration link.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  GYM NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. IronHouse Dhaka"
                  value={gymInput}
                  onChange={(e) => setGymInput(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-black/15 bg-transparent px-3 text-sm dark:border-white/15"
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-black/10 bg-[#F7F7F4] px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-[#000000]">
                <span className="truncate font-mono text-neutral-600 dark:text-neutral-400">
                  gymgrid.app/join/{generatedSlug}
                </span>
                <button
                  type="button"
                  onClick={handleCopySlug}
                  className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  {copiedSlug ? <Check className="h-3.5 w-3.5" /> : null}
                  {copiedSlug ? "Copied" : "Copy"}
                </button>
              </div>

              <Link
                href={`/onboarding?name=${encodeURIComponent(gymInput || "IronHouse Dhaka")}`}
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#000000] dark:hover:bg-emerald-400"
              >
                Continue to Setup
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
