"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useGymStore } from "@/lib/stores/gym-store";
import { useMembersStore } from "@/lib/stores/members-store";
import { LoginCard } from "@/components/LoginCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/logic";

interface NavDef {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly: boolean;
}

const NAV_ITEMS: NavDef[] = [
  { href: "/", label: "Today", icon: LayoutDashboard, ownerOnly: false },
  { href: "/members", label: "Members", icon: Users, ownerOnly: false },
  { href: "/add", label: "Add member", icon: UserPlus, ownerOnly: false },
  { href: "/plans", label: "Plans", icon: ClipboardList, ownerOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

const VIEW_LABELS: Record<string, string> = {
  "/": "Today overview",
  "/members": "Members directory",
  "/add": "New member",
  "/plans": "Workout & diet plans",
  "/settings": "Gym settings",
};

/**
 * shadcn/ui `SidebarProvider` + floating `Sidebar` shell wrapping `(admin)` routes,
 * preserving the auth gate, staff role check, and responsive mobile drawer.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);
  const gymName = useGymStore((s) => s.gymName);
  const membersCount = useMembersStore((s) => s.members.length);
  const lastSync = useMembersStore((s) => s.lastSync);

  const todayFormatted = fmtDate(new Date().toISOString().slice(0, 10));
  const pageTitle = VIEW_LABELS[pathname] ?? "Overview";
  const visibleNav = NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner");
  const initials =
    gymName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "G";

  if (status !== "ready") {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
          <h1 className="text-2xl font-medium text-foreground">{gymName}</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>Log out</span>
              </Button>
            ) : null}
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-6">
          {status === "loading" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
              </div>
              <Skeleton className="h-64 rounded-3xl" />
            </div>
          ) : null}

          {status === "signed_out" ? (
            <LoginCard
              title="Staff sign in"
              subtitle={
                <>
                  We will email you a sign-in link. Members can use{" "}
                  <Link
                    href="/member"
                    className="text-primary underline underline-offset-2"
                  >
                    the members app
                  </Link>
                  .
                </>
              }
              nextPath={pathname || "/"}
            />
          ) : null}

          {status === "not_staff" ? (
            <Card className="mx-auto mt-12 w-full max-w-[460px] rounded-3xl">
              <CardHeader>
                <CardTitle>Account is not staff</CardTitle>
                <CardDescription>
                  You are signed in, but the owner has not added this account to the
                  staff list. Members use{" "}
                  <Link
                    href="/member"
                    className="text-primary underline underline-offset-2"
                  >
                    the members app
                  </Link>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Give the owner this ID:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                    {user?.id ?? ""}
                  </code>
                </p>
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader className="gap-3 p-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {gymName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {todayFormatted}
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={
                          active
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                            : undefined
                        }
                      >
                        <Link href={item.href}>
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.href === "/members" ? (
                        <SidebarMenuBadge>{membersCount}</SidebarMenuBadge>
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
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-xs font-medium text-foreground">
                {user?.email ?? "Staff"}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {role ?? "staff"}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Log out"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-2xl font-medium tracking-tight text-foreground">
                  {pageTitle}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {gymName} · {todayFormatted}
                  {lastSync ? ` · synced ${lastSync}` : ""}
                </p>
              </div>
            </div>

            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </header>

          <div className="flex flex-col gap-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
