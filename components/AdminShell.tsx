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
import { DashboardShell, type DashboardNavItem } from "@/components/DashboardShell";
import { LoginCard } from "@/components/LoginCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/logic";

interface NavDef {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  ownerOnly: boolean;
}

const NAV_ITEMS: NavDef[] = [
  { href: "/", label: "Today", icon: LayoutDashboard, ownerOnly: false },
  { href: "/members", label: "Members", icon: Users, ownerOnly: false },
  {
    href: "/add",
    label: "Add member",
    mobileLabel: "Add",
    icon: UserPlus,
    ownerOnly: false,
  },
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
 * Responsive `DashboardShell` wrapper for `(admin)` routes, preserving the auth gate,
 * staff role check, desktop floating sidebar, and mobile bottom navbar.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);
  const gym = useGymStore((s) => s.gym);
  const gymName = useGymStore((s) => s.gymName);
  const membersCount = useMembersStore((s) => s.members.length);
  const lastSync = useMembersStore((s) => s.lastSync);

  const todayFormatted = fmtDate(new Date().toISOString().slice(0, 10));
  const pageTitle = VIEW_LABELS[pathname] ?? "Overview";
  const visibleNav = NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner");

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

          {status === "no_gym" ? (
            <Card className="mx-auto mt-12 w-full max-w-[460px] rounded-3xl">
              <CardHeader>
                <CardTitle>Complete gym setup</CardTitle>
                <CardDescription>
                  Create your gym workspace to unlock the dashboard, or visit the
                  member portal if you joined an existing gym.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/onboarding">Set up gym</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/member">Members app</Link>
                </Button>
              </CardContent>
            </Card>
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

  const navItems: DashboardNavItem[] = visibleNav.map((item) => ({
    id: item.href,
    label: item.label,
    mobileLabel: item.mobileLabel,
    icon: item.icon,
    active:
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href),
    href: item.href,
    badge: item.href === "/members" ? membersCount : undefined,
  }));

  const subtitle = `${gymName} · ${todayFormatted}${lastSync ? ` · synced ${lastSync}` : ""}`;

  return (
    <DashboardShell
      brand={{
        name: gymName,
        logoUrl: gym?.logo_url,
        subtitle: todayFormatted,
      }}
      navGroupLabel="Operations"
      navItems={navItems}
      header={{
        title: pageTitle,
        subtitle,
      }}
      account={{
        primaryLabel: user?.email ?? "Staff",
        secondaryLabel: role ?? "staff",
        onSignOut: () => void signOut(),
      }}
    >
      {children}
    </DashboardShell>
  );
}
