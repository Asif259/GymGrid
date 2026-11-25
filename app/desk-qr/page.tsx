"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeskQrPage() {
  const supabase = useMemo(() => createClient(), []);
  const { gymName: defaultGymName } = useMemo(() => getSupabaseEnv(), []);

  const [gymName, setGymName] = useState(defaultGymName);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setErrorMsg("Staff only. Sign in on Admin to view this QR.");
        return;
      }

      const { data: staffRow } = await supabase
        .from("gym_staff")
        .select("gym_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!staffRow?.gym_id) {
        setErrorMsg("Staff only. Sign in on Admin to view this QR.");
        return;
      }

      const [gymRes, tokenRes] = await Promise.all([
        supabase
          .from("gyms")
          .select("id, name, logo_url, app_url")
          .eq("id", staffRow.gym_id)
          .maybeSingle(),
        supabase.rpc("checkin_qr_token", { p_gym_id: staffRow.gym_id }),
      ]);
      if (cancelled) return;

      if (gymRes.data?.name) setGymName(gymRes.data.name);
      if (gymRes.data?.logo_url) setLogoUrl(gymRes.data.logo_url);
      if (tokenRes.error || !tokenRes.data) {
        setErrorMsg(
          tokenRes.error?.message ?? "Staff only. Sign in on Admin to view this QR.",
        );
        return;
      }

      const base = (gymRes.data?.app_url || window.location.origin).replace(
        /\/$/,
        "",
      );
      const url = `${base}/checkin?gym=${encodeURIComponent(staffRow.gym_id)}#checkin=${encodeURIComponent(String(tokenRes.data))}`;
      setQrUrl(url);

      const png = await QRCode.toDataURL(url, { width: 360, margin: 2 });
      if (!cancelled) setDataUrl(png);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const initials =
    gymName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "G";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-6">
      {errorMsg ? (
        <Card className="rounded-3xl border-destructive shadow-xs">
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="text-sm font-medium text-destructive">{errorMsg}</p>
            <div>
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  <span>Go to Admin</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {dataUrl ? (
        <Card className="rounded-3xl shadow-xs print:border-0 print:shadow-none">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-9">
                {logoUrl ? <AvatarImage src={logoUrl} alt={gymName} /> : null}
                <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-xl font-medium text-foreground">{gymName}</h1>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              Scan to check in
            </p>
            <div className="rounded-2xl border bg-background p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={`Check-in QR code for ${gymName}`}
                className="size-72"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Open your phone camera, scan, and sign in to the members app once.
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground print:hidden">
              {qrUrl}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 print:hidden">
              <Button onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden="true" />
                <span>Print poster</span>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/settings">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  <span>Back to settings</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !errorMsg ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : null}
    </main>
  );
}
