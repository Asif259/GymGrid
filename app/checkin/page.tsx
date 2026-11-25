"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { useMemberAppStore } from "@/lib/stores/member-app-store";
import { LoginCard } from "@/components/LoginCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PublicGym } from "@/types/gym";

interface CheckinOutcome {
  ok: boolean;
  message: string;
  paidUp?: boolean;
}

function CheckinInner() {
  const searchParams = useSearchParams();
  const gymIdParam = searchParams.get("gym");
  const supabase = useMemo(() => createClient(), []);
  const { gymName: defaultGymName } = useMemo(() => getSupabaseEnv(), []);

  const setPendingCheckin = useMemberAppStore((s) => s.setPendingCheckin);
  const pendingToken = useMemberAppStore((s) => s._pendingCheckin);
  const pendingGymId = useMemberAppStore((s) => s._pendingCheckinGymId);

  const [gym, setGym] = useState<PublicGym | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<CheckinOutcome | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#checkin=") || hash.startsWith("#t=")) {
      const prefix = hash.startsWith("#checkin=") ? "#checkin=" : "#t=";
      const tok = decodeURIComponent(hash.slice(prefix.length));
      if (tok) setPendingCheckin(tok, gymIdParam);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    let cancelled = false;
    async function run() {
      const [gymRes, authRes] = await Promise.all([
        gymIdParam
          ? supabase.rpc("get_public_gym_by_id", { p_gym_id: gymIdParam })
          : Promise.resolve({ data: null }),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;

      if (gymRes.data && typeof gymRes.data === "object") {
        setGym(gymRes.data as PublicGym);
      }
      const authUser = authRes.data.user;
      setUser(authUser);

      if (!authUser) {
        setLoading(false);
        return;
      }

      const activeToken =
        useMemberAppStore.getState()._pendingCheckin ?? pendingToken;
      const activeGymId =
        gymIdParam ?? useMemberAppStore.getState()._pendingCheckinGymId ?? pendingGymId;

      if (!activeToken) {
        setOutcome({
          ok: false,
          message: "Scan the front-desk QR poster to check in.",
        });
        setLoading(false);
        return;
      }

      setPendingCheckin(null, null);
      const { data: chkData, error: chkErr } = await supabase.rpc("check_in", {
        token: activeToken,
        p_gym_id: activeGymId,
      });

      if (cancelled) return;
      if (chkErr) {
        setOutcome({ ok: false, message: chkErr.message, paidUp: false });
      } else {
        const res = chkData as {
          paid_up?: boolean;
          message?: string;
        } | null;
        setOutcome({
          ok: res?.paid_up !== false,
          paidUp: res?.paid_up !== false,
          message: res?.message ?? "Checked in!",
        });
      }
      setLoading(false);
    }

    void run();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          setUser(session.user);
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, gymIdParam, pendingToken, pendingGymId, setPendingCheckin]);

  const gymName = gym?.name || defaultGymName;
  const initials =
    gymName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "G";

  const memberHref = gym?.slug
    ? `/member?gym=${encodeURIComponent(gym.slug)}`
    : "/member";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9 shrink-0">
            {gym?.logo_url ? <AvatarImage src={gym.logo_url} alt={gymName} /> : null}
            <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-medium text-foreground">{gymName}</h1>
        </div>
        <ThemeToggle />
      </header>

      {loading ? <Skeleton className="h-64 rounded-3xl" /> : null}

      {!loading && !user ? (
        <LoginCard
          title={`Check in to ${gymName}`}
          subtitle="Sign in with your member email to complete check-in."
          placeholder="member@example.com"
          nextPath={gymIdParam ? `/checkin?gym=${encodeURIComponent(gymIdParam)}` : "/checkin"}
        />
      ) : null}

      {!loading && user && outcome ? (
        <Card
          className={cn(
            "rounded-3xl p-8 text-center shadow-xs",
            outcome.ok
              ? "bg-status-lime-bg text-status-lime-fg"
              : "border-destructive bg-status-rose-bg text-status-rose-fg",
          )}
        >
          <CardContent className="flex flex-col items-center gap-4 p-0">
            {outcome.ok ? (
              <CheckCircle2 className="size-12" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-12" aria-hidden="true" />
            )}
            <p className="text-xl font-semibold text-foreground">
              {outcome.message}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {outcome.paidUp === false ? (
                <Button asChild>
                  <Link href={`${memberHref}#pay`}>Renew membership</Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link href={memberHref}>
                  <Smartphone className="size-4" aria-hidden="true" />
                  <span>Open members app</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
          <Skeleton className="h-64 rounded-3xl" />
        </main>
      }
    >
      <CheckinInner />
    </Suspense>
  );
}
