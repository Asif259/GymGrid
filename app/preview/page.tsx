"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  CalendarCheck,
  Clock,
  Coins,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { StatCards, type StatItem } from "@/components/StatCards";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  PREVIEW_GYM_NAME,
  PREVIEW_MEMBERS,
  PREVIEW_PULSE,
  PREVIEW_REPORT,
  PREVIEW_TODAY,
} from "@/lib/preview-data";
import { money } from "@/lib/logic";
import type { MemberFilter } from "@/types/gym";

const PREVIEW_CHART_CONFIG: ChartConfig = {
  count: {
    label: "Check-ins",
    color: "var(--chart-1)",
  },
};

export default function DesignPreviewPage() {
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [query, setQuery] = useState("");

  const s = PREVIEW_REPORT.summary;
  const stats: StatItem[] = [
    {
      icon: Users,
      label: "Active members",
      value: String(s.active),
      delta: `${s.due} due`,
      deltaTone: "neutral",
      iconBgClass: "bg-chart-1",
      caption: `${PREVIEW_MEMBERS.length} sample profiles`,
    },
    {
      icon: CalendarCheck,
      label: "Today's attendance",
      value: String(s.attendance_today ?? 0),
      delta: "143 / 7d",
      deltaTone: "lime",
      iconBgClass: "bg-chart-2",
      caption: "Sample desk scans",
    },
    {
      icon: Coins,
      label: "Month revenue",
      value: money(s.revenue_month),
      delta: money(s.revenue_today),
      deltaTone: "lime",
      iconBgClass: "bg-chart-3",
      caption: "Sample today total",
    },
    {
      icon: Clock,
      label: "Pending payments",
      value: money(s.pending_amount),
      delta: `${s.pending_payments} waiting`,
      deltaTone: "rose",
      iconBgClass: "bg-chart-5",
      caption: "Sample TrxIDs",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-medium text-foreground">
              {PREVIEW_GYM_NAME} — UI Preview
            </h1>
            <Badge variant="secondary">Sample data</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Interactive shadcn/ui preview without signing in
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Open Admin</span>
            </Link>
          </Button>
        </div>
      </header>

      <StatCards stats={stats} />

      <Card className="rounded-3xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            7-day attendance sample
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={PREVIEW_CHART_CONFIG} className="h-44 w-full">
            <BarChart
              data={PREVIEW_PULSE}
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
        <CardContent className="pt-6">
          <DataTable
            members={PREVIEW_MEMBERS}
            today={PREVIEW_TODAY}
            filter={filter}
            onFilterChange={setFilter}
            query={query}
            onQueryChange={setQuery}
            onOpen={(m) => toast.info(`Preview: open ${m.name}`)}
            onCheckIn={(m) => toast.success(`Preview: checked in ${m.name}`)}
            onQuickPay={(m) => toast.success(`Preview: paid ${m.name}`)}
            onConfirmPending={(m) => toast.success(`Preview: confirmed ${m.name}`)}
            onFreezeToggle={(m) =>
              toast.info(`Preview: toggled freeze for ${m.name}`)
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}
