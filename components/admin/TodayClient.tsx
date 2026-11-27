"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Monitor,
  QrCode,
  Users,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useGymStore } from "@/lib/stores/gym-store";
import { useMembersStore } from "@/lib/stores/members-store";
import { SearchInput } from "@/components/SearchInput";
import { StatCards, type StatItem } from "@/components/StatCards";
import { StatusBadge } from "@/components/StatusBadge";
import { MemberDialog } from "@/components/admin/MemberDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  dhakaToday,
  fmtDate,
  money,
  pendingPayment,
  renewalLink,
  reportMarkdown,
  standing,
} from "@/lib/logic";
import type { Member } from "@/types/gym";

const PULSE_CHART_CONFIG: ChartConfig = {
  count: {
    label: "Check-ins",
    color: "var(--chart-1)",
  },
};

/**
 * Interactive Today dashboard powered by shadcn `StatCards`, `ChartContainer`,
 * `SearchInput` check-in desk, and guardrail feeds.
 */
export function TodayClient() {
  const supabase = useMemo(() => createClient(), []);
  const user = useAuthStore((s) => s.user);
  const gymName = useGymStore((s) => s.gymName);
  const currency = useGymStore((s) => s.currency);
  const settings = useGymStore((s) => s.settings);
  const members = useMembersStore((s) => s.members);
  const todayReport = useMembersStore((s) => s.todayReport);
  const pulse = useMembersStore((s) => s.pulse);
  const reloadAll = useMembersStore((s) => s.reloadAll);

  const [checkinQuery, setCheckinQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [confirmCheckinMember, setConfirmCheckinMember] = useState<Member | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = dhakaToday();
  const summary = todayReport?.summary;

  const activeCount =
    summary?.active ?? members.filter((m) => m.status === "active").length;
  const attendanceToday = summary?.attendance_today ?? 0;
  const revenueToday = summary?.revenue_today ?? 0;
  const revenueMonth = summary?.revenue_month ?? 0;
  const pendingCount = summary?.pending_payments ?? 0;
  const pendingAmount = summary?.pending_amount ?? 0;
  const weekVisits = pulse.reduce((sum, p) => sum + p.count, 0);

  const kpiStats: StatItem[] = [
    {
      icon: Users,
      label: "Active members",
      value: String(activeCount),
      delta: `${summary?.due ?? 0} due`,
      deltaTone: (summary?.due ?? 0) > 0 ? "neutral" : "lime",
      caption: `${members.length} registered total`,
    },
    {
      icon: CalendarCheck,
      label: "Today's attendance",
      value: String(attendanceToday),
      delta: `${weekVisits} / 7d`,
      deltaTone: "lime",
      caption: "Checked in today",
    },
    {
      icon: Coins,
      label: "Month revenue",
      value: money(revenueMonth, currency),
      delta: money(revenueToday, currency),
      deltaTone: revenueToday > 0 ? "lime" : "neutral",
      caption: "Collected today",
    },
    {
      icon: Clock,
      label: "Pending payments",
      value: money(pendingAmount, currency),
      delta: `${pendingCount} waiting`,
      deltaTone: pendingCount > 0 ? "yellow" : "neutral",
      caption: "Awaiting confirmation",
    },
  ];

  const searchMatches = useMemo(() => {
    const q = checkinQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.member_code ?? "").toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [members, checkinQuery]);

  const unpaidCheckins = todayReport?.unpaid_checkins ?? [];
  const pendingRows = useMemo(
    () => members.filter((m) => (m.payments ?? []).some((p) => p.status === "pending")),
    [members],
  );
  const expiringRows = todayReport?.expiring ?? [];
  const expiredRecent = todayReport?.expired_recent ?? [];

  async function performCheckIn(m: Member, isWarning: boolean) {
    if (busyId || !user) return;

    setBusyId(m.id);
    try {
      const { error } = await supabase.from("attendance").insert({
        member_id: m.id,
        method: "staff",
        recorded_by: user.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setCheckinQuery("");
      await reloadAll();
      if (isWarning) {
        toast.error(`${m.name} checked in (${standing(m)})`);
      } else {
        toast.success(`${m.name} checked in`);
      }
    } finally {
      setBusyId(null);
    }
  }

  function handleCheckIn(m: Member) {
    if (busyId || !user) return;
    const isWarning = m.status === "expired" || m.status === "frozen" || !m.expiry_date;
    if (isWarning) {
      setConfirmCheckinMember(m);
      return;
    }
    void performCheckIn(m, false);
  }

  async function handleConfirmPending(m: Member) {
    const owed = pendingPayment(m.payments ?? []);
    if (!owed || !user || busyId) return;
    setBusyId(m.id);
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
      toast.success(`${m.name}: payment confirmed`);
    } finally {
      setBusyId(null);
    }
  }

  async function copyReport() {
    if (!todayReport) {
      toast.error("Report not loaded yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        reportMarkdown(todayReport, gymName, settings.app_url ?? null, currency),
      );
      toast.success("Daily summary copied");
    } catch {
      toast.error("Could not copy report");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Front desk shortcuts" className="flex flex-wrap items-center gap-2">
        <Button asChild className="min-h-11">
          <a href="#staff-check-in">
            <CalendarCheck aria-hidden="true" />
            Check in a member
          </a>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <a href="#payment-approvals">
            <Clock aria-hidden="true" />
            Review payments
            {pendingRows.length > 0 && <Badge variant="secondary">{pendingRows.length}</Badge>}
          </a>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <a href="#renewals-watchlist">
            <WhatsAppIcon className="size-4" />
            View renewals
          </a>
        </Button>
      </nav>

      <StatCards stats={kpiStats} />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="ring-0 dashboard-panel lg:col-span-7">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                7-day attendance pulse
              </p>
              <CardTitle className="text-2xl font-medium tracking-tight tabular-nums">
                {weekVisits} visits
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyReport()}
            >
              <Copy className="size-4" aria-hidden="true" />
              <span>Copy summary</span>
            </Button>
          </CardHeader>

          <CardContent>
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
          </CardContent>
        </Card>

        <Card id="staff-check-in" tabIndex={-1} className="ring-0 dashboard-panel dashboard-workbench dashboard-workflow lg:col-span-5">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">Check someone in</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/desk" target="_blank">
                  <Monitor className="size-4" aria-hidden="true" />
                  <span>Desk screen</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/desk-qr" target="_blank">
                  <QrCode className="size-4" aria-hidden="true" />
                  <span>QR poster</span>
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <SearchInput
              aria-label="Find a member to check in"
              placeholder="Search name, ID, or phone"
              value={checkinQuery}
              onValueChange={setCheckinQuery}
            />

            <div className="flex flex-col divide-y">
              {searchMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {m.name}
                      </span>
                      {m.member_code ? (
                        <Badge variant="outline" className="rounded-md font-mono text-xs tabular-nums">
                          <bdi>{m.member_code}</bdi>
                        </Badge>
                      ) : null}
                      <StatusBadge member={m} />
                    </div>
                    <p className="text-xs leading-[1.4] text-muted-foreground">
                      <bdi>+{m.phone}</bdi>
                      {m.expiry_date ? ` · Until ${fmtDate(m.expiry_date)}` : ""}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={m.status === "active" ? "default" : "outline"}
                    disabled={busyId === m.id}
                    onClick={() => void handleCheckIn(m)}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    <span>{busyId === m.id ? "…" : "Check in"}</span>
                  </Button>
                </div>
              ))}

              {checkinQuery.trim() && searchMatches.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground">
                  No matching member found.
                </p>
              ) : null}

              {!checkinQuery.trim() ? (
                <p className="py-3 text-xs text-muted-foreground">
                  Type a member name, ID, or phone number to log a front-desk visit.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          {unpaidCheckins.length > 0 ? (
            <Card className="rounded-xl border-destructive/50 bg-status-rose-bg/25 shadow-none">
              <CardHeader className="flex flex-row items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                <CardTitle className="text-base font-medium">Trained without paying today</CardTitle>
                <Badge variant="secondary" className="rounded-md font-mono text-xs tabular-nums">
                  {unpaidCheckins.length}
                </Badge>
              </CardHeader>

              <CardContent className="flex flex-col divide-y">
                {unpaidCheckins.map((u, idx) => (
                  <div
                    key={`${u.phone}-${idx}`}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {u.name}
                      </div>
                      <div className="text-xs leading-[1.4] text-muted-foreground">
                        <bdi>+{u.phone}</bdi> ·{" "}
                        {u.expiry_date ? `Ended ${fmtDate(u.expiry_date)}` : "Never paid"}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={renewalLink(u, gymName, today, settings.app_url ?? null)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <WhatsAppIcon className="size-4 text-[#008069] dark:text-[#25D366]" />
                        <span>WhatsApp</span>
                      </a>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card id="payment-approvals" tabIndex={-1} className="ring-0 dashboard-panel dashboard-workflow">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-medium">Pending approvals</CardTitle>
                <Badge variant="secondary" className="rounded-md font-mono text-xs tabular-nums">
                  {pendingRows.length}
                </Badge>
              </div>
              <Link
                href="/members?filter=pending"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>

            <CardContent className="flex flex-col divide-y">
              {pendingRows.length > 0 && (
                <p className="pb-3 text-sm text-muted-foreground">
                  Match the amount and TrxID in your wallet before confirming.
                </p>
              )}
              {pendingRows.map((m) => {
                const owed = pendingPayment(m.payments ?? []);
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {m.name}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {owed ? `${money(owed.amount, currency)} · ${owed.method ?? ""}` : ""}
                        {owed?.trx_id ? (
                          <>
                            {" "}
                            · TrxID{" "}
                            <bdi className="font-mono text-foreground">{owed.trx_id}</bdi>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === m.id}
                        onClick={() => void handleConfirmPending(m)}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedMember(m)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}

              {pendingRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No TrxIDs waiting for verification.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <Card id="renewals-watchlist" tabIndex={-1} className="ring-0 dashboard-panel dashboard-workflow">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-medium">Renewals watchlist</CardTitle>
                <Badge variant="secondary" className="rounded-md font-mono text-xs tabular-nums">
                  {expiringRows.length + expiredRecent.length}
                </Badge>
              </div>
              {expiredRecent.length > 0 ? (
                <Link
                  href="/members?filter=expired"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View expired
                </Link>
              ) : null}
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Expiring in 2 days</span>
                  <span className="font-mono tabular-nums">{expiringRows.length}</span>
                </div>
                <div className="flex flex-col divide-y">
                  {expiringRows.map((m) => (
                    <div
                      key={`${m.phone}-${m.expiry_date}`}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {m.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.plan ?? "No plan"} · Ends {fmtDate(m.expiry_date)}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={renewalLink(
                            { ...m, plans: { name: m.plan } },
                            gymName,
                            today,
                            settings.app_url ?? null,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <WhatsAppIcon className="size-4 text-[#008069] dark:text-[#25D366]" />
                          <span>WhatsApp</span>
                        </a>
                      </Button>
                    </div>
                  ))}
                  {expiringRows.length === 0 ? (
                    <p className="py-1 text-xs text-muted-foreground">
                      No memberships ending in 48 hours.
                    </p>
                  ) : null}
                </div>
              </div>

              {expiredRecent.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>Expired recently</span>
                    <span className="font-mono tabular-nums">{expiredRecent.length}</span>
                  </div>
                  <div className="flex flex-col divide-y">
                    {expiredRecent.slice(0, 5).map((m) => (
                      <div
                        key={`exp-${m.phone}`}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">
                            {m.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Ended {fmtDate(m.expiry_date)}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={renewalLink(
                              { ...m, plans: { name: m.plan } },
                              gymName,
                              today,
                              settings.app_url ?? null,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <WhatsAppIcon className="size-4 text-[#008069] dark:text-[#25D366]" />
                            <span>WhatsApp</span>
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <MemberDialog
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />

      <AlertDialog
        open={Boolean(confirmCheckinMember)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmCheckinMember(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check in member with overdue status?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCheckinMember
                ? `${confirmCheckinMember.name} is ${standing(confirmCheckinMember)}. Check in anyway?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCheckinMember) {
                  void performCheckIn(confirmCheckinMember, true);
                  setConfirmCheckinMember(null);
                }
              }}
            >
              Check in anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
