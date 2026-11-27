import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
  delta: string;
  deltaTone: "lime" | "yellow" | "rose" | "neutral";
  caption: string;
  icon: LucideIcon;
}

const DELTA_CLASSES: Record<StatItem["deltaTone"], string> = {
  lime: "border-transparent bg-status-lime-bg text-status-lime-fg",
  yellow: "border-transparent bg-status-yellow-bg text-status-yellow-fg",
  rose: "border-transparent bg-status-rose-bg text-status-rose-fg",
  neutral: "border-transparent bg-secondary text-muted-foreground",
};

export function StatCards({
  stats,
  className,
}: {
  stats: StatItem[];
  className?: string;
}) {
  return (
    <section
      aria-label="Key metrics"
      className={cn("dashboard-metrics w-full rounded-xl border border-border bg-card", className)}
    >
      <dl className="dashboard-metric-grid">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="dashboard-metric flex min-w-0 flex-col gap-2"
          >
            <dt className="min-w-0 text-sm leading-[1.35] font-medium text-muted-foreground text-pretty">
              {stat.label}
            </dt>

            <dd className="break-words text-[clamp(1.5rem,3vw,2rem)] leading-[1.08] font-medium tracking-[-0.02em] tabular-nums text-foreground">
              {stat.value}
            </dd>

            <dd className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
              <span className="min-w-0 text-xs leading-[1.4] text-muted-foreground text-pretty">
                {stat.caption}
              </span>
              <Badge
                className={cn(
                  "shrink-0 rounded-md text-xs font-medium tabular-nums",
                  DELTA_CLASSES[stat.deltaTone],
                )}
              >
                {stat.delta}
              </Badge>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
