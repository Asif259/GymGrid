"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  REALTIME_SUBSCRIBE_STATES,
  RealtimePostgresInsertPayload,
} from "@supabase/supabase-js";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deskState, dhakaToday, hhmmDhaka } from "@/lib/logic";
import { cn } from "@/lib/utils";
import type { Member } from "@/types/gym";

interface DeskEntry {
  member_id: string;
  checked_in_at: string;
  member: Pick<Member, "name" | "status" | "expiry_date"> | null;
}

export default function DeskPage() {
  const supabase = useMemo(() => createClient(), []);
  const { gymName: defaultGymName } = useMemo(() => getSupabaseEnv(), []);

  const [gymName, setGymName] = useState(defaultGymName);
  const [userEmail, setUserEmail] = useState("");
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [entries, setEntries] = useState<DeskEntry[]>([]);
  const [liveOk, setLiveOk] = useState(false);

  const loadMemberSummary = useCallback(
    async (memberId: string) => {
      const { data } = await supabase
        .from("members")
        .select("name, status, expiry_date")
        .eq("id", memberId)
        .maybeSingle();
      return (data as Pick<Member, "name" | "status" | "expiry_date"> | null) ?? null;
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const [{ data: settings }, { data: auth }] = await Promise.all([
        supabase.from("gym_settings").select("name").maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      if (settings?.name) setGymName(settings.name);

      const user = auth.user;
      if (!user) {
        setStatus("denied");
        return;
      }
      setUserEmail(user.email ?? "");

      const { data: staffRow } = await supabase
        .from("staff")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!staffRow) {
        setStatus("denied");
        return;
      }

      const { data: rows } = await supabase
        .from("attendance")
        .select("member_id, checked_in_at")
        .order("checked_in_at", { ascending: false })
        .limit(10);

      const resolved = await Promise.all(
        ((rows as { member_id: string; checked_in_at: string }[] | null) ?? []).map(
          async (r) => ({
            ...r,
            member: await loadMemberSummary(r.member_id),
          }),
        ),
      );
      if (cancelled) return;
      setEntries(resolved);
      setStatus("ready");

      channel = supabase
        .channel("desk-attendance")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "attendance",
          },
          (
            payload: RealtimePostgresInsertPayload<{
              member_id: string;
              checked_in_at: string;
            }>,
          ) => {
            const row = payload.new;
            void loadMemberSummary(row.member_id).then((member) => {
              setEntries((prev) => [{ ...row, member }, ...prev].slice(0, 10));
            });
          },
        )
        .subscribe((subStatus: REALTIME_SUBSCRIBE_STATES) => {
          setLiveOk(subStatus === "SUBSCRIBED");
        });
    }

    void init();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, loadMemberSummary]);

  const today = dhakaToday();
  const latest = entries[0] ?? null;
  const latestState = latest?.member ? deskState(latest.member, today) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-foreground">
            {gymName} · Live Desk
          </h1>
          <Badge
            className={
              liveOk
                ? "border-transparent bg-status-lime-bg text-status-lime-fg"
                : "border-transparent bg-muted text-muted-foreground"
            }
          >
            {liveOk ? "Live" : "Connecting"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {userEmail ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {userEmail}
            </span>
          ) : null}
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Admin</span>
            </Link>
          </Button>
        </div>
      </header>

      {status === "loading" ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : null}

      {status === "denied" ? (
        <Card className="rounded-3xl shadow-xs">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Staff only. Sign in on the admin page first.
          </CardContent>
        </Card>
      ) : null}

      {status === "ready" ? (
        <div className="flex flex-col gap-6">
          <Card
            aria-live="polite"
            className={cn(
              "rounded-3xl p-8 text-center shadow-xs",
              latestState
                ? latestState.ok
                  ? "bg-status-lime-bg"
                  : "border-destructive bg-status-rose-bg"
                : "",
            )}
          >
            <CardContent className="flex flex-col items-center justify-center gap-3 p-0">
              {latest && latest.member && latestState ? (
                <>
                  {latestState.ok ? (
                    <CheckCircle2
                      className="size-10 text-status-lime-fg"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertTriangle
                      className="size-10 text-status-rose-fg"
                      aria-hidden="true"
                    />
                  )}
                  <p className="text-xs font-medium text-muted-foreground">
                    Checked in at {hhmmDhaka(latest.checked_in_at)}
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {latest.member.name}
                  </p>
                  <Badge
                    className={
                      latestState.ok
                        ? "border-transparent bg-card text-status-lime-fg"
                        : "border-transparent bg-card text-status-rose-fg"
                    }
                  >
                    {latestState.text}
                  </Badge>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for the next check-in…
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">Last 10 check-ins</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {entries.map((entry, idx) => {
                const st = entry.member ? deskState(entry.member, today) : null;
                return (
                  <div
                    key={`${entry.member_id}-${entry.checked_in_at}-${idx}`}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {entry.member?.name ?? "Member"}
                      </span>
                      {st ? (
                        <Badge
                          className={
                            st.ok
                              ? "border-transparent bg-status-lime-bg text-status-lime-fg"
                              : "border-transparent bg-status-rose-bg text-status-rose-fg"
                          }
                        >
                          {st.ok ? "Valid" : "Not paid"}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {hhmmDhaka(entry.checked_in_at)}
                    </span>
                  </div>
                );
              })}
              {entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No check-ins recorded yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
