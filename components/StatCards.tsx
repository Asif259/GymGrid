import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
  neutral: "border-transparent bg-muted text-muted-foreground",
};

/**
 * KPI stat card row built on shadcn `Card` and `Badge`, preserving the 4-column
 * metric layout and footer band with status delta pill.
 */
export function StatCards({
  stats,
  className,
}: {
  stats: StatItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.label}
            className="gap-3 rounded-2xl bg-secondary/70 py-3 shadow-xs"
          >
            <CardHeader className="flex flex-row items-center gap-3 px-4 pb-0">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
                  stat.iconBgClass,
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="truncate text-sm font-medium text-muted-foreground">
                {stat.label}
              </span>
            </CardHeader>

            <CardContent className="px-4 py-0">
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {stat.value}
              </p>
            </CardContent>

            <CardFooter className="mx-3 mt-auto flex items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-1.5">
              <span className="truncate text-xs text-muted-foreground">
                {stat.caption}
              </span>
              <Badge className={cn("tabular-nums", DELTA_CLASSES[stat.deltaTone])}>
                {stat.delta}
              </Badge>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
