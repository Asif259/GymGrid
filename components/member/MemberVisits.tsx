"use client";

import {
  CalendarCheck,
  CalendarDays,
  Flame,
  Trophy,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { StatCards, type StatItem } from "@/components/StatCards";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { attendancePulse, dhakaToday, fmtDate, hhmmDhaka } from "@/lib/logic";
import type { AttendanceStreak, PulsePoint } from "@/types/gym";

const PULSE_CHART_CONFIG: ChartConfig = {
  count: {
    label: "Visits",
    color: "var(--chart-1)",
  },
};

export interface MemberVisitsProps {
  visits: Array<{ day: string; checked_in_at: string }>;
  streak: AttendanceStreak | null;
}

function safeFormatDay(day: string, todayDate: Date): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return fmtDate(day, todayDate);
  }
  const parsed = Date.parse(day);
  if (Number.isNaN(parsed)) return "—";
  const dhakaDate = new Date(parsed).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  return fmtDate(dhakaDate, todayDate);
}

function safeFormatTime(iso: string): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—";
  return hhmmDhaka(iso);
}

/**
 * Member Visits view featuring 4 streak KPI cards, a 14-day attendance pulse
 * bar chart, and reverse-chronological check-in history.
 */
export function MemberVisits({ visits, streak }: MemberVisitsProps) {
  const todayIso = dhakaToday();
  const todayDate = new Date(`${todayIso}T00:00:00`);

  const currentStreak = streak?.current ?? 0;
  const bestStreak = streak?.best ?? 0;
  const visitsThisMonth = streak?.visits_month ?? 0;

  const sortedVisits = [...visits].sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      b.checked_in_at.localeCompare(a.checked_in_at),
  );
  const todayVisit = sortedVisits.find((v) => v.day === todayIso) ?? null;

  const pulse = attendancePulse(visits, todayIso, 14);
  const pulseVisits = pulse.reduce((sum, point) => sum + point.count, 0);
  const activeDaysInWindow = pulse.filter((point) => point.count > 0).length;

  const kpiStats: StatItem[] = [
    {
      icon: Flame,
      label: "Current streak",
      value: `${currentStreak}d`,
      delta: currentStreak > 0 ? "Active" : "Start today",
      deltaTone: currentStreak > 0 ? "lime" : "neutral",
      caption: todayVisit ? "Checked in today" : "Consecutive days",
    },
    {
      icon: Trophy,
      label: "Best streak",
      value: `${bestStreak}d`,
      delta:
        bestStreak === 0
          ? "No runs"
          : currentStreak > 0 && currentStreak >= bestStreak
            ? "At peak"
            : "All-time",
      deltaTone:
        bestStreak > 0 && currentStreak >= bestStreak ? "lime" : "neutral",
      caption: "Longest run",
    },
    {
      icon: CalendarCheck,
      label: "This month",
      value: String(visitsThisMonth),
      delta: todayVisit
        ? "In today"
        : visitsThisMonth > 0
          ? "Logged"
          : "No visits",
      deltaTone: todayVisit ? "lime" : "neutral",
      caption: todayVisit
        ? `At ${safeFormatTime(todayVisit.checked_in_at)}`
        : "Monthly check-ins",
    },
    {
      icon: CalendarDays,
      label: "Last 60d visits",
      value: String(visits.length),
      delta: `${pulseVisits} / 14d`,
      deltaTone: pulseVisits > 0 ? "lime" : "neutral",
      caption: "Recent check-ins",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StatCards stats={kpiStats} />

      <Card className="ring-0 dashboard-panel">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardDescription>14-day attendance pulse</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {pulseVisits} {pulseVisits === 1 ? "visit" : "visits"}
            </CardTitle>
          </div>
          <Badge variant="secondary" className="shrink-0 font-mono tabular-nums">
            {activeDaysInWindow}/14 days
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-2">
          <ChartContainer config={PULSE_CHART_CONFIG} className="h-48 w-full">
            <BarChart
              data={pulse}
              margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={10}
                className="text-xs tabular-nums"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                className="text-xs tabular-nums"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value, payload) => {
                      const point = payload?.[0]?.payload as
                        | PulsePoint
                        | undefined;
                      if (point?.day) {
                        return `${String(value ?? "")} · ${safeFormatDay(point.day, todayDate)}`;
                      }
                      return String(value ?? "");
                    }}
                  />
                }
              />
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
          {pulseVisits === 0 ? (
            <p className="text-xs text-muted-foreground">
              No check-ins logged in the last 14 days.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="ring-0 dashboard-panel">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-lg">Check-in history</CardTitle>
              <CardDescription>
                Your recent gym visits, newest first
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {visits.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {sortedVisits.length > 0 ? (
            <ul className="flex flex-col divide-y">
              {sortedVisits.map((v, idx) => (
                <li
                  key={`${v.day}-${v.checked_in_at}-${idx}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground tabular-nums">
                      {safeFormatDay(v.day, todayDate)}
                    </span>
                    {v.day === todayIso ? (
                      <Badge className="border-transparent bg-status-lime-bg text-status-lime-fg">
                        Today
                      </Badge>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {safeFormatTime(v.checked_in_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-secondary/30 p-6 text-center">
              <CalendarCheck
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-foreground">
                No visits recorded yet
              </p>
              <p className="max-w-xs text-xs text-muted-foreground break-words">
                Scan the front-desk QR poster when you arrive to log your first
                check-in.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
