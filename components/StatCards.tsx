import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
  delta: string;
  deltaTone: "lime" | "rose" | "neutral";
  caption: string;
  icon: LucideIcon;
  iconBgClass: string;
}

const DELTA_CLASSES: Record<StatItem["deltaTone"], string> = {
  lime: "border-transparent bg-status-lime-bg text-status-lime-fg",
  rose: "border-transparent bg-status-rose-bg text-status-rose-fg",
  neutral: "border-transparent bg-secondary text-muted-foreground",
};

const TONAL_ICON_CLASSES: Record<string, string> = {
  "bg-chart-1": "bg-accent/75 text-primary",
  "bg-chart-2": "bg-status-lime-bg text-status-lime-fg",
  "bg-chart-3": "bg-status-yellow-bg text-status-yellow-fg",
  "bg-chart-4": "bg-status-rose-bg text-status-rose-fg",
  "bg-chart-5": "bg-secondary text-foreground",
};

/**
 * Architectural 4-column KPI ledger strip with hairline dividers,
 * tonal Material 3 icon wells, and tabular numeric hierarchy.
 */
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
      className={cn(
        "grid w-full grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x",
        className,
      )}
    >
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        const iconTone =
          TONAL_ICON_CLASSES[stat.iconBgClass] ?? "bg-secondary text-foreground";
        return (
          <div
            key={stat.label}
            className={cn(
              "flex flex-col justify-between gap-4 p-4 sm:p-5",
              idx >= 2 && "sm:border-t sm:border-border xl:border-t-0",
              idx % 2 === 1 && "sm:border-l sm:border-border xl:border-l-0",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-muted-foreground">
                {stat.label}
              </span>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  iconTone,
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>

            <p className="text-2xl font-medium tracking-tight tabular-nums text-foreground sm:text-[1.875rem] sm:leading-9">
              {stat.value}
            </p>

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <span className="truncate text-xs text-muted-foreground">
                {stat.caption}
              </span>
              <Badge
                className={cn(
                  "rounded-md font-mono text-[11px] font-medium tabular-nums",
                  DELTA_CLASSES[stat.deltaTone],
                )}
              >
                {stat.delta}
              </Badge>
            </div>
          </div>
        );
      })}
    </section>
  );
}
