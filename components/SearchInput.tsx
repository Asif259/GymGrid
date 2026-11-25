"use client";

import type { ComponentProps } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Accessible search field wrapping shadcn `Input` with leading Search icon,
 * Escape-to-clear shortcut, and trailing clear button.
 */
export function SearchInput({
  value,
  onValueChange,
  className,
  placeholder = "Search…",
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        className="pointer-events-none absolute start-2.5 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        {...props}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onValueChange("");
          }
          props.onKeyDown?.(e);
        }}
        className="ps-8 pe-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear search"
          onClick={() => onValueChange("")}
          className="absolute end-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
