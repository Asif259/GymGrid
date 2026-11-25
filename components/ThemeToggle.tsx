"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

const subscribe = () => () => {};

/**
 * Light/dark theme switcher powered by `next-themes` and shadcn `Button`.
 */
export function ThemeToggle({ compact = true, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === "dark";

  if (compact) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={className}
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 rounded-lg bg-muted p-1",
        className,
      )}
    >
      <Button
        type="button"
        size="sm"
        variant={!isDark ? "secondary" : "ghost"}
        onClick={() => setTheme("light")}
        className={cn("h-7 text-xs", !isDark && "bg-background shadow-xs")}
      >
        <Sun className="size-3.5" />
        Light
      </Button>
      <Button
        type="button"
        size="sm"
        variant={isDark ? "secondary" : "ghost"}
        onClick={() => setTheme("dark")}
        className={cn("h-7 text-xs", isDark && "bg-background shadow-xs")}
      >
        <Moon className="size-3.5" />
        Dark
      </Button>
    </div>
  );
}
