"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Dumbbell,
  ExternalLink,
  Flame,
  PauseCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { StatCards, type StatItem } from "@/components/StatCards";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  attendancePulse,
  computeMemberKpis,
  daysLeft,
  dhakaToday,
  fmtDate,
  hhmmDhaka,
  lastPaid,
  money,
  pendingPayment,
} from "@/lib/logic";
import type { MemberTab } from "@/lib/member-helpers";
import { cn } from "@/lib/utils";
import type {
  AttendanceStreak,
  DietPlanData,
  GymSettings,
  Member,
  Payment,
  WorkoutPlanData,
} from "@/types/gym";

const PULSE_CHART_CONFIG: ChartConfig = {
  count: {
    label: "Visits",
    color: "var(--chart-1)",
  },
};

export interface MemberOverviewProps {
  member: Member;
  settings: GymSettings;
  workout: WorkoutPlanData | null;
  diet: DietPlanData | null;
  visits: Array<{ day: string; checked_in_at: string }>;
  streak: AttendanceStreak | null;
  trainerName: string;
  checkinBanner: { ok: boolean; text: string } | null;
  onDismissCheckin: () => void;
  onNavigateTab: (tab: MemberTab) => void;
  onRefresh: () => void;
  onDownloadPdf: (payment: Payment) => void;
  refreshing: boolean;
}

/**
 * Interactive Member Overview dashboard mirroring the owner `TodayClient` hierarchy:
 * contextual alerts, 4-card KPI strip, 7-day attendance pulse, today's training &
 * quick actions, recent visits, and billing/profile summary.
 */
export function MemberOverview({
  member,
  settings,
  workout,
  diet,
  visits,
  streak,
  trainerName,
  checkinBanner,
  onDismissCheckin,
  onNavigateTab,
  onRefresh,
  onDownloadPdf,
  refreshing,
}: MemberOverviewProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const todayIso = dhakaToday();
  const currency = settings.currency || "৳";
  const payments = member.payments ?? [];
  const owed = pendingPayment(payments);
  const latestReceipt = lastPaid(payments);
  const kpis = computeMemberKpis(member, visits, streak, todayIso, currency);
  const pulse = attendancePulse(visits, todayIso, 7);
  const recentVisits = [...visits]
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) ||
        b.checked_in_at.localeCompare(a.checked_in_at),
    )
    .slice(0, 5);

  const workoutDays = workout?.days ?? [];
  const safeDayIdx =
    workoutDays.length > 0 ? Math.min(selectedDayIdx, workoutDays.length - 1) : 0;
  const activeDay = workoutDays[safeDayIdx] ?? null;
  const mealsCount = diet?.meals?.length ?? 0;
  const gymPhone = settings.phone?.trim() || null;

  const kpiStats: StatItem[] = [
    {
      icon: ShieldCheck,
      label: "Membership",
      value: kpis.standingLabel,
      delta: kpis.daysDelta,
      deltaTone: kpis.daysTone,
      caption: kpis.planCaption,
    },
    {
      icon: Calendar,
      label: "Valid until",
      value: kpis.expiryLabel,
      delta: kpis.billingDelta,
      deltaTone: kpis.billingTone,
      caption: kpis.billingCaption,
    },
    {
      icon: CalendarCheck,
      label: "Visits this month",
      value: String(kpis.visitsMonth),
      delta: kpis.todayVisitTime ? "In today" : `${kpis.weekVisits} / 7d`,
      deltaTone: kpis.todayVisitTime ? "lime" : "neutral",
      caption: kpis.todayVisitTime
        ? `Checked in at ${kpis.todayVisitTime}`
        : "Not checked in today",
    },
    {
      icon: Flame,
      label: "Current streak",
      value: `${kpis.currentStreak}d`,
      delta: kpis.currentStreak > 0 ? "Active" : "Start today",
      deltaTone: kpis.currentStreak > 0 ? "lime" : "neutral",
      caption: `Best: ${kpis.bestStreak}d`,
    },
  ];

  const daysRemaining = daysLeft(member.expiry_date, todayIso);
  const dueOrExpiredSummary =
    member.status === "expired"
      ? member.expiry_date
        ? `Your membership ended on ${fmtDate(member.expiry_date)}. Renew now to restore active standing.`
        : "No active payment is recorded yet. Pay your plan fee to activate your membership."
      : member.expiry_date
        ? daysRemaining === 0
          ? "Your membership ends today. Renew now to keep training without interruption."
          : daysRemaining === 1
            ? "Your membership ends tomorrow. Renew early to extend from your current expiry."
            : `Your membership ends on ${fmtDate(member.expiry_date)}. Renew early to extend seamlessly.`
        : "No payment has been recorded yet. Submit your plan payment to activate your membership.";

  const profileChips = [
    {
      label: "Member ID",
      value: member.member_code?.trim() || "—",
    },
    {
      label: "Goal",
      value: member.goal?.trim() || "—",
      capitalize: Boolean(member.goal?.trim()),
    },
    {
      label: "Weight",
      value: member.weight_kg != null ? `${member.weight_kg}\u00A0kg` : "—",
    },
    {
      label: "Height",
      value: member.height_cm != null ? `${member.height_cm}\u00A0cm` : "—",
    },
    {
      label: "Plan",
      value: member.plans?.name ?? "None",
    },
    {
      label: "Joined",
      value: member.join_date ? fmtDate(member.join_date) : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {checkinBanner ? (
        <Card
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-xl shadow-none",
            checkinBanner.ok
              ? "border-transparent bg-status-lime-bg text-status-lime-fg"
              : "border-destructive bg-status-rose-bg text-status-rose-fg",
          )}
        >
          <CardContent className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {checkinBanner.ok ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground break-words sm:text-base">
                  {checkinBanner.text}
                </p>
                {!checkinBanner.ok ? (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 w-full shrink-0 touch-manipulation sm:w-auto"
                    onClick={() => onNavigateTab("pay")}
                  >
                    Renew membership
                  </Button>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Dismiss check-in notice"
              className="size-11 shrink-0 text-foreground hover:bg-background/40 touch-manipulation"
              onClick={onDismissCheckin}
            >
              <X aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {owed ? (
        <Card className="rounded-xl border-transparent bg-status-yellow-bg text-status-yellow-fg shadow-none">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  Payment awaiting verification
                </p>
                <p className="text-xs text-foreground/85 break-words tabular-nums">
                  {money(owed.amount, currency)}
                  {owed.method ? ` via ${owed.method}` : ""}
                  {owed.trx_id ? (
                    <>
                      {" "}
                      · TrxID{" "}
                      <span className="font-mono break-all" translate="no">
                        {owed.trx_id}
                      </span>
                    </>
                  ) : null}{" "}
                  is waiting for front-desk confirmation.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 bg-card/80 text-foreground hover:bg-card touch-manipulation sm:min-h-9"
                onClick={() => onNavigateTab("pay")}
              >
                View payment
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={refreshing}
                className="min-h-11 touch-manipulation sm:min-h-9"
                onClick={onRefresh}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(refreshing && "animate-spin motion-reduce:animate-none")}
                  aria-hidden="true"
                />
                <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : member.status === "expired" || member.status === "due" ? (
        <Card
          className={cn(
            "rounded-xl shadow-none",
            member.status === "expired"
              ? "border-destructive/40 bg-status-rose-bg text-status-rose-fg"
              : "border-transparent bg-status-yellow-bg text-status-yellow-fg",
          )}
        >
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {member.status === "expired"
                    ? "Renewal due"
                    : member.expiry_date
                      ? "Ends soon"
                      : "Never paid"}
                </p>
                <p className="text-xs text-foreground/85 break-words">
                  {dueOrExpiredSummary}
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="min-h-11 w-full shrink-0 touch-manipulation sm:w-auto sm:min-h-9"
              onClick={() => onNavigateTab("pay")}
            >
              Renew now
            </Button>
          </CardContent>
        </Card>
      ) : member.status === "frozen" ? (
        <Card className="rounded-xl bg-muted shadow-none">
          <CardContent className="flex items-start gap-3">
            <PauseCircle
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Membership paused
              </p>
              <p className="text-xs text-muted-foreground break-words">
                Your membership is currently frozen. Ask the front desk when you are
                ready to resume your plan.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <StatCards stats={kpiStats} />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="ring-0 dashboard-panel dashboard-pass lg:col-span-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-medium">Member pass</CardTitle>
                {member.member_code ? (
                  <Badge variant="outline" className="rounded-md font-mono text-xs tabular-nums">
                    <bdi>{member.member_code}</bdi>
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="mt-1 text-pretty leading-[1.4]">
                Coach: {trainerName.trim() || "Not assigned"}
              </CardDescription>
            </div>
            <StatusBadge member={member} className="shrink-0" />
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-5 pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {profileChips
                .filter((chip) => chip.label !== "Member ID")
                .map((chip) => (
                  <div key={chip.label} className="min-w-0">
                    <dt className="text-xs leading-[1.3] font-medium text-muted-foreground">
                      {chip.label}
                    </dt>
                    <dd
                      className={cn(
                        "break-words text-xs leading-[1.4] font-medium text-foreground tabular-nums",
                        chip.capitalize && "capitalize",
                      )}
                    >
                      {chip.value}
                    </dd>
                  </div>
                ))}
            </dl>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  Today&apos;s training
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {mealsCount > 0
                    ? `${mealsCount} ${mealsCount === 1 ? "meal" : "meals"} planned`
                    : "No diet plan"}
                </span>
              </div>

              {workoutDays.length > 0 && activeDay ? (
                <div className="flex flex-col gap-3">
                  <div
                    role="group"
                    aria-label="Workout split days"
                    className="flex flex-wrap gap-1.5"
                  >
                    {workoutDays.map((day, idx) => (
                      <Button
                        key={`${day.day}-${idx}`}
                        type="button"
                        size="sm"
                        variant={safeDayIdx === idx ? "default" : "outline"}
                        aria-pressed={safeDayIdx === idx}
                        className="min-h-11 max-w-full rounded-lg px-3 touch-manipulation sm:min-h-8"
                        onClick={() => setSelectedDayIdx(idx)}
                      >
                        <span className="truncate">{day.day}</span>
                      </Button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border bg-secondary/40 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {activeDay.focus
                          ? `${activeDay.day} · ${activeDay.focus}`
                          : activeDay.day}
                      </span>
                      <Badge variant="secondary" className="shrink-0 rounded-md font-mono text-xs tabular-nums">
                        {activeDay.exercises.length}{" "}
                        {activeDay.exercises.length === 1 ? "exercise" : "exercises"}
                      </Badge>
                    </div>

                    {activeDay.exercises.length > 0 ? (
                      <ul className="flex flex-col divide-y">
                        {activeDay.exercises.slice(0, 4).map((ex, idx) => (
                          <li
                            key={`${ex.name}-${idx}`}
                            className="flex items-center justify-between gap-3 py-1.5 text-xs first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 truncate font-medium text-foreground">
                              {ex.name}
                            </span>
                            {ex.sets != null || ex.reps ? (
                              <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                                {ex.sets != null && ex.reps
                                  ? `${ex.sets}×${ex.reps}`
                                  : ex.sets != null
                                    ? `${ex.sets} sets`
                                    : ex.reps}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No exercises listed for this day.
                      </p>
                    )}

                    {activeDay.exercises.length > 4 ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        +{activeDay.exercises.length - 4} more in full plans
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-secondary/30 p-4 text-xs text-muted-foreground">
                  No verified workout plan assigned yet. Ask your coach to publish
                  your training split.
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="mt-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="min-h-11 flex-1 touch-manipulation sm:min-h-0 sm:flex-initial"
              onClick={() => onNavigateTab("pay")}
            >
              <CreditCard data-icon="inline-start" aria-hidden="true" />
              <span>{owed ? "View pending payment" : "Renew / Pay"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 touch-manipulation sm:min-h-0"
              onClick={() => onNavigateTab("plans")}
            >
              <Dumbbell data-icon="inline-start" aria-hidden="true" />
              <span>Plans</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 touch-manipulation sm:min-h-0"
              onClick={() => onNavigateTab(latestReceipt ? "receipts" : "visits")}
            >
              {latestReceipt
                ? <CreditCard data-icon="inline-start" aria-hidden="true" />
                : <CalendarCheck data-icon="inline-start" aria-hidden="true" />}
              <span>{latestReceipt ? "Receipts" : "Visit history"}</span>
            </Button>
            {gymPhone ? (
              <Button
                variant="outline"
                className="min-h-11 touch-manipulation sm:min-h-0"
                asChild
              >
                <a
                  href={`tel:${gymPhone.replace(/\s+/g, "")}`}
                  aria-label={`Call ${settings.name?.trim() || "gym"} at ${gymPhone}`}
                >
                  <Phone data-icon="inline-start" aria-hidden="true" />
                  <span>Call gym</span>
                </a>
              </Button>
            ) : null}
          </CardFooter>
        </Card>

        <Card className="ring-0 dashboard-panel lg:col-span-7">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                7-day attendance pulse
              </p>
              <CardTitle className="text-2xl font-medium tracking-tight tabular-nums">
                {kpis.weekVisits} visits
              </CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 shrink-0 touch-manipulation sm:min-h-8"
              onClick={() => onNavigateTab("visits")}
            >
              All visits
            </Button>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <ChartContainer config={PULSE_CHART_CONFIG} className="h-44 w-full">
                <BarChart
                  data={pulse}
                  margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    className="text-xs tabular-nums"
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    className="text-xs tabular-nums"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {pulse.map((pt, idx) => (
                      <Cell
                        key={pt.day}
                        fill={
                          idx === pulse.length - 1
                            ? "var(--color-count)"
                            : "color-mix(in oklch, var(--muted-foreground) 32%, transparent)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              {kpis.weekVisits === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No check-ins logged in the last 7 days.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Recent visits
                  </span>
                  <Badge variant="secondary" className="rounded-md font-mono text-xs tabular-nums">
                    {visits.length}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto min-h-11 shrink-0 px-2 text-xs touch-manipulation sm:min-h-0"
                  onClick={() => onNavigateTab("visits")}
                >
                  View all
                </Button>
              </div>

              <div className="flex flex-col divide-y">
                {recentVisits.map((v, idx) => (
                  <div
                    key={`${v.checked_in_at}-${idx}`}
                    className="flex items-center justify-between gap-3 py-2 text-xs first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm leading-[1.35] font-medium text-foreground tabular-nums">
                        {fmtDate(v.day)}
                      </span>
                      {v.day === todayIso ? (
                        <Badge className="rounded-md border-transparent bg-status-lime-bg text-status-lime-fg">
                          Today
                        </Badge>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {hhmmDhaka(v.checked_in_at)}
                    </span>
                  </div>
                ))}
                {recentVisits.length === 0 ? (
                  <p className="max-w-[65ch] py-2 text-xs leading-[1.45] text-muted-foreground text-pretty">
                    No visits recorded yet. Scan the desk QR poster when you arrive to log your first check-in.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  Latest receipt
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto min-h-11 shrink-0 px-2 text-xs touch-manipulation sm:min-h-0"
                  onClick={() => onNavigateTab("receipts")}
                >
                  All receipts
                </Button>
              </div>

              {latestReceipt ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-secondary/40 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-[1.35] font-medium text-foreground tabular-nums">
                      {money(latestReceipt.amount, currency)} ·{" "}
                      {latestReceipt.method ?? "cash"}
                    </div>
                    <div className="break-words text-xs leading-[1.4] text-muted-foreground tabular-nums">
                      {latestReceipt.paid_on
                        ? fmtDate(latestReceipt.paid_on)
                        : "Confirmed"}
                      {latestReceipt.receipt_no ? (
                        <>
                          {" "}
                          · <bdi>{latestReceipt.receipt_no}</bdi>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {latestReceipt.receipt_path ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 touch-manipulation sm:min-h-8"
                        onClick={() => onDownloadPdf(latestReceipt)}
                      >
                        <Download data-icon="inline-start" aria-hidden="true" />
                        <span>PDF</span>
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 touch-manipulation sm:min-h-8"
                      asChild
                    >
                      <Link
                        href={`/receipt?id=${encodeURIComponent(String(latestReceipt.id))}`}
                      >
                        <span>View</span>
                        <ExternalLink data-icon="inline-end" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No confirmed receipts yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
