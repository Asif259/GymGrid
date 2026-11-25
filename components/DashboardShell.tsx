"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, User, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { mobileNavGridCols } from "@/lib/member-helpers";
import { cn } from "@/lib/utils";

export interface DashboardNavItem {
  id: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  active: boolean;
  href?: string;
  onSelect?: () => void;
  badge?: string | number;
  badgeDot?: boolean;
}

export interface DashboardShellProps {
  brand: {
    name: string;
    logoUrl?: string | null;
    subtitle?: string;
  };
  navGroupLabel: string;
  navItems: DashboardNavItem[];
  header: {
    title: string;
    subtitle?: string;
    badge?: ReactNode;
    actions?: ReactNode;
  };
  account: {
    primaryLabel: string;
    secondaryLabel: string;
    onOpenProfile?: () => void;
    onSignOut: () => void;
  };
  children: ReactNode;
}

function deriveInitials(name: string, fallback = "G"): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || fallback
  );
}

function BrandAvatar({
  name,
  logoUrl,
  initials,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  initials: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8 shrink-0", className)}>
      {logoUrl ? <AvatarImage src={logoUrl} alt={name} /> : null}
      <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Shared responsive layout shell for Owner and Member dashboards:
 * floating collapsible sidebar on desktop (`md+`), sticky header and fixed
 * bottom navigation bar on mobile (`< md`).
 */
export function DashboardShell({
  brand,
  navGroupLabel,
  navItems,
  header,
  account,
  children,
}: DashboardShellProps) {
  const brandInitials = deriveInitials(brand.name);

  const accountSummary = (
    <>
      <div className="truncate text-xs font-medium text-foreground">
        {account.primaryLabel}
      </div>
      <div className="truncate text-xs text-muted-foreground capitalize">
        {account.secondaryLabel}
      </div>
    </>
  );

  return (
    <SidebarProvider>
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader className="gap-3 p-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <BrandAvatar
              name={brand.name}
              logoUrl={brand.logoUrl}
              initials={brandInitials}
            />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div
                translate="no"
                className="truncate text-sm font-medium text-sidebar-foreground"
              >
                {brand.name}
              </div>
              {brand.subtitle ? (
                <div className="truncate text-xs text-muted-foreground">
                  {brand.subtitle}
                </div>
              ) : null}
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{navGroupLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isLink = Boolean(item.href && !item.onSelect);
                  const navLabel = (
                    <>
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </>
                  );

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.active}
                        tooltip={item.label}
                        className={cn(
                          item.active &&
                            "bg-primary text-primary-foreground data-active:bg-primary data-active:text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                        )}
                      >
                        {isLink ? (
                          <Link
                            href={item.href!}
                            aria-current={item.active ? "page" : undefined}
                          >
                            {navLabel}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={item.onSelect}
                            aria-current={item.active ? "page" : undefined}
                          >
                            {navLabel}
                          </button>
                        )}
                      </SidebarMenuButton>
                      {item.badge != null ? (
                        <SidebarMenuBadge
                          className={cn(
                            "tabular-nums",
                            item.active &&
                              "text-primary-foreground peer-data-active/menu-button:text-primary-foreground",
                          )}
                        >
                          {item.badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-3 p-3">
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle compact={false} />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
            {account.onOpenProfile ? (
              <button
                type="button"
                onClick={account.onOpenProfile}
                className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left outline-hidden transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring touch-manipulation group-data-[collapsible=icon]:hidden"
              >
                {accountSummary}
                <span className="sr-only"> — open profile</span>
              </button>
            ) : (
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                {accountSummary}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Log out"
              onClick={account.onSignOut}
              className="touch-manipulation"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 px-4 pt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:p-6">
        <div className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col gap-5 md:gap-6">
          <header className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-md sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-b-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SidebarTrigger className="hidden md:inline-flex" />
              <BrandAvatar
                name={brand.name}
                logoUrl={brand.logoUrl}
                initials={brandInitials}
                className="md:hidden"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-lg font-medium tracking-tight text-foreground md:text-2xl">
                    {header.title}
                  </h1>
                  {header.badge ? (
                    <div className="shrink-0">{header.badge}</div>
                  ) : null}
                </div>
                {header.subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {header.subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {header.actions}
              <ThemeToggle className="size-11 touch-manipulation md:hidden" />
              {account.onOpenProfile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Account and profile"
                  onClick={account.onOpenProfile}
                  className="size-11 touch-manipulation md:hidden"
                >
                  <User aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Log out"
                  onClick={account.onSignOut}
                  className="size-11 touch-manipulation md:hidden"
                >
                  <LogOut aria-hidden="true" />
                </Button>
              )}
            </div>
          </header>

          <div className="flex min-w-0 flex-1 flex-col gap-5 md:gap-6">
            {children}
          </div>
        </div>
      </SidebarInset>

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] dark:shadow-[0_-4px_16px_rgb(0_0_0/0.25)] md:hidden"
      >
        <div
          className={cn(
            "mx-auto grid max-w-lg px-1",
            mobileNavGridCols(navItems.length),
          )}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isLink = Boolean(item.href && !item.onSelect);
            const itemClassName = cn(
              "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring touch-manipulation",
              item.active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            );
            const itemContent = (
              <>
                <span
                  className={cn(
                    "relative flex items-center justify-center rounded-full px-3 py-1 transition-colors",
                    item.active &&
                      "bg-primary/12 text-primary dark:bg-primary/20",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.badgeDot ? (
                    <span
                      className="absolute right-1.5 top-0.5 size-2 rounded-full bg-status-yellow-fg"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-[11px] leading-none",
                    item.active ? "font-semibold text-primary" : "font-medium",
                  )}
                >
                  {item.mobileLabel ?? item.label}
                </span>
              </>
            );

            if (isLink) {
              return (
                <Link
                  key={item.id}
                  href={item.href!}
                  aria-current={item.active ? "page" : undefined}
                  className={itemClassName}
                >
                  {itemContent}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onSelect}
                aria-current={item.active ? "page" : undefined}
                className={itemClassName}
              >
                {itemContent}
              </button>
            );
          })}
        </div>
      </nav>
    </SidebarProvider>
  );
}
