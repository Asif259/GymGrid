"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  MessageCircle,
  Monitor,
  QrCode,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "@/components/AdminContext";
import { SearchInput } from "@/components/SearchInput";
import { StatCards, type StatItem } from "@/components/StatCards";
import { StatusBadge } from "@/components/StatusBadge";
import { MemberDialog } from "@/components/admin/MemberDialog";
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
  const { user, members, todayReport, pulse, gymName, settings, reloadAll } = useAdmin();

  const [checkinQuery, setCheckinQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
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
      iconBgClass: "bg-chart-1",
      caption: `${members.length} registered total`,
    },
    {
      icon: CalendarCheck,
      label: "Today's attendance",
      value: String(attendanceToday),
      delta: `${weekVisits} / 7d`,
      deltaTone: "lime",
      iconBgClass: "bg-chart-2",
      caption: "Checked in today",
    },
    {
      icon: Coins,
      label: "Month revenue",
      value: money(revenueMonth),
      delta: money(revenueToday),
      deltaTone: revenueToday > 0 ? "lime" : "neutral",
      iconBgClass: "bg-chart-3",
      caption: "Collected today",
    },
    {
      icon: Clock,
      label: "Pending payments",
      value: money(pendingAmount),
      delta: `${pendingCount} waiting`,
      deltaTone: pendingAmount > 0 ? "rose" : "neutral",
      iconBgClass: pendingAmount > 0 ? "bg-chart-5" : "bg-chart-4",
      caption: "Awaiting confirmation",
    },
  ];

  const searchMatches = useMemo(() => {
    const q = checkinQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter(
        (m) => m.name.toLowerCase().includes(q) || m.phone.toLowerCase().includes(q),
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

  async function handleCheckIn(m: Member) {
    if (busyId || !user) return;
    const isWarning = m.status === "expired" || m.status === "frozen" || !m.expiry_date;
    if (isWarning && !window.confirm(`${m.name} is ${standing(m)}. Check in anyway?`)) {
      return;
    }

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
        reportMarkdown(todayReport, gymName, settings.app_url ?? null),
      );
      toast.success("Daily summary copied");
    } catch {
      toast.error("Could not copy report");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StatCards stats={kpiStats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl shadow-xs">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                7-day attendance pulse
              </p>
              <CardTitle className="text-2xl tabular-nums">
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
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-xs">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Check someone in</CardTitle>
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
              placeholder="Search name or phone…"
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
                      <StatusBadge member={m} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      +{m.phone}
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
                  Type a member name or phone number to log an instant front-desk visit.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {unpaidCheckins.length > 0 ? (
            <Card className="rounded-3xl border-destructive shadow-xs">
              <CardHeader className="flex flex-row items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
                <CardTitle className="text-lg">Trained without paying today</CardTitle>
                <Badge variant="secondary">{unpaidCheckins.length}</Badge>
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
                      <div className="text-xs text-muted-foreground">
                        +{u.phone} ·{" "}
                        {u.expiry_date ? `Ended ${fmtDate(u.expiry_date)}` : "Never paid"}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={renewalLink(u, gymName, today, settings.app_url ?? null)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="size-4" aria-hidden="true" />
                        <span>WhatsApp</span>
                      </a>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-3xl shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Pending approvals</CardTitle>
                <Badge variant="secondary">{pendingRows.length}</Badge>
              </div>
              <Link
                href="/members?filter=pending"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>

            <CardContent className="flex flex-col divide-y">
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
                      <div className="text-xs text-muted-foreground">
                        {owed ? `${money(owed.amount)} · ${owed.method ?? ""}` : ""}
                        {owed?.trx_id ? ` · TrxID ${owed.trx_id}` : ""}
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

        <div className="flex flex-col gap-6">
          <Card className="rounded-3xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-2">
              <CardTitle className="text-lg">Expiring in 2 days</CardTitle>
              <Badge variant="secondary">{expiringRows.length}</Badge>
            </CardHeader>

            <CardContent className="flex flex-col divide-y">
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
                      <MessageCircle className="size-4" aria-hidden="true" />
                      <span>WhatsApp</span>
                    </a>
                  </Button>
                </div>
              ))}

              {expiringRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No memberships ending in 48 hours.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {expiredRecent.length > 0 ? (
            <Card className="rounded-3xl shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Expired recently</CardTitle>
                  <Badge variant="secondary">{expiredRecent.length}</Badge>
                </div>
                <Link
                  href="/members?filter=expired"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>

              <CardContent className="flex flex-col divide-y">
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
                        <MessageCircle className="size-4" aria-hidden="true" />
                        <span>WhatsApp</span>
                      </a>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <MemberDialog
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}
