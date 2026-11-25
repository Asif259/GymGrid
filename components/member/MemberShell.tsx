"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { useMemberAppStore } from "@/lib/stores/member-app-store";
import {
  buildMemberUrl,
  memberTabParam,
  parseMemberTab,
  resolveInitialTabAndHash,
  type MemberTab,
} from "@/lib/member-helpers";
import { DashboardShell, type DashboardNavItem } from "@/components/DashboardShell";
import { LoginCard } from "@/components/LoginCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { MemberProfileSheet } from "@/components/member/MemberProfileSheet";

/** Shared dashboard-shaped loading skeleton used by both the shell pre-ready
 * state and app/(member)/loading.tsx */
export function DashboardLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-muted/50" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-3xl bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

function MemberShellInner({
  children,
}: {
  children: (ctx: { openProfile: () => void }) => React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const gymSlugParam = searchParams.get("gym");
  const { gymName: defaultGymName } = getSupabaseEnv();

  const {
    status,
    member,
    trainerName,
    settings,
    tab,
    setTab,
    loadMemberData,
    refreshMemberData,
    refreshing,
    signOut,
    setUser,
    setStatus,
    setGymBranding,
    setPendingCheckin,
    user,
  } = useMemberAppStore();

  const [profileOpen, setProfileOpen] = useState(false);

  // Auth bootstrap + initial hash/tab resolution
  useEffect(() => {
    // Resolve initial tab and check-in token from URL hash/search
    const { tab: resolvedTab, checkinToken } = resolveInitialTabAndHash(
      window.location.hash,
      window.location.search,
    );

    if (checkinToken) {
      setPendingCheckin(checkinToken, null);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    } else if (window.location.hash === "#pay") {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    if (resolvedTab) {
      setTab(resolvedTab);
    }

    let cancelled = false;

    async function resolvePreferredGym(): Promise<string | null> {
      if (!gymSlugParam) return null;
      const supabase = createClient();
      const { data } = await supabase.rpc("get_public_gym_by_slug", {
        p_slug: gymSlugParam,
      });
      if (!cancelled && data && typeof data === "object") {
        const pub = data as { id: string; name: string; slug: string; logo_url: string | null; currency: string };
        setGymBranding(pub);
        return pub.id;
      }
      return null;
    }

    async function init() {
      const supabase = createClient();
      const [preferredGymId, authRes] = await Promise.all([
        resolvePreferredGym(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      const authUser = authRes.data.user;
      setUser(authUser);
      if (!authUser) {
        setStatus("signed_out");
        return;
      }
      await loadMemberData(preferredGymId);
    }

    void init();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        setStatus("signed_out");
      } else {
        setUser(session.user);
        void resolvePreferredGym().then((gid) => loadMemberData(gid));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [
    gymSlugParam,
    loadMemberData,
    setGymBranding,
    setPendingCheckin,
    setStatus,
    setTab,
    setUser,
  ]);

  // popstate listener for browser back/forward
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const parsed = parseMemberTab(params.get("tab"));
      setTab(parsed ?? "home");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setTab]);

  const gymName = settings.name || defaultGymName;

  const joinHref = settings.slug
    ? `/join/${encodeURIComponent(settings.slug)}`
    : "/join";

  // Pre-ready states
  if (status === "idle" as string || status === "loading") {
    return <DashboardLoadingSkeleton />;
  }

  if (status === "signed_out") {
    const nextParams = new URLSearchParams();
    if (gymSlugParam) nextParams.set("gym", gymSlugParam);
    if (tab && tab !== "home") nextParams.set("tab", memberTabParam(tab));
    const qs = nextParams.toString();
    const basePath = typeof window !== "undefined" && window.location.pathname.startsWith("/member")
      ? "/member"
      : "/";
    const nextPath = qs ? `${basePath}?${qs}` : basePath;
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoginCard
          title="Members app"
          subtitle="Use the email you gave the front desk. We'll email you a sign-in link."
          placeholder="member@example.com"
          nextPath={nextPath}
        />
      </div>
    );
  }

  if (status === "no_member") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 flex flex-col items-center gap-6">
        <Card className="rounded-3xl shadow-xs w-full">
          <CardHeader>
            <CardTitle>Not registered as a member</CardTitle>
            <CardDescription>
              You&apos;re not registered as a member at this gym.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={joinHref}>
                <UserPlus className="size-4" aria-hidden="true" />
                <span>Join this gym</span>
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void signOut()}>
              Switch account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // status === "ready"
  const payments = member?.payments ?? [];
  const pendingOrExpired = member
    ? member.status === "expired" ||
      member.status === "frozen" ||
      payments.some((p) => p.status === "pending")
    : false;

  const selectTab = (next: MemberTab) => {
    setTab(next);
    window.history.replaceState(
      null,
      "",
      buildMemberUrl(window.location.pathname, window.location.search, next),
    );
  };

  const navItems: DashboardNavItem[] = [
    {
      id: "home",
      label: "Overview",
      mobileLabel: "Home",
      icon: LayoutDashboard,
      active: tab === "home",
      onSelect: () => selectTab("home"),
    },
    {
      id: "plans",
      label: "Plans",
      icon: Dumbbell,
      active: tab === "plans",
      onSelect: () => selectTab("plans"),
    },
    {
      id: "pay",
      label: "Renew / Pay",
      mobileLabel: "Pay",
      icon: CreditCard,
      active: tab === "pay",
      badgeDot: pendingOrExpired,
      onSelect: () => selectTab("pay"),
    },
    {
      id: "visits",
      label: "Visits",
      icon: CalendarCheck,
      active: tab === "visits",
      onSelect: () => selectTab("visits"),
    },
    {
      id: "receipts",
      label: "Receipts",
      icon: ClipboardList,
      active: tab === "receipts",
      onSelect: () => selectTab("receipts"),
    },
  ];

  return (
    <>
      <DashboardShell
        brand={{
          name: gymName,
          logoUrl: settings.logo_url ?? null,
        }}
        navGroupLabel="Member portal"
        navItems={navItems}
        header={{
          title: member?.name ?? "Member",
          badge: member ? <StatusBadge member={member} /> : undefined,
          actions: (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Refresh data"
              disabled={refreshing}
              className="touch-manipulation"
              onClick={() => void refreshMemberData()}
            >
              <RefreshCw
                className={refreshing ? "animate-spin motion-reduce:animate-none" : ""}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {refreshing ? "Refreshing…" : "Refresh"}
              </span>
            </Button>
          ),
        }}
        account={{
          primaryLabel: member?.name ?? member?.phone ?? "Member",
          secondaryLabel: member?.status ?? "member",
          onOpenProfile: () => setProfileOpen(true),
          onSignOut: () => void signOut(),
        }}
      >
        {children({ openProfile: () => setProfileOpen(true) })}
      </DashboardShell>

      {member ? (
        <MemberProfileSheet
          open={profileOpen}
          onOpenChange={setProfileOpen}
          member={member}
          settings={settings}
          trainerName={trainerName}
          email={user?.email ?? null}
          onSignOut={() => void signOut()}
        />
      ) : null}
    </>
  );
}

/**
 * Unified responsive shell for the Member portal (`/member`).
 * Handles auth bootstrap, URL-driven tab routing, and renders the
 * DashboardShell with member-specific nav, header, and profile sheet.
 */
export function MemberShell({
  children,
}: {
  children: (ctx: { openProfile: () => void }) => React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <MemberShellInner>{children}</MemberShellInner>
    </Suspense>
  );
}
