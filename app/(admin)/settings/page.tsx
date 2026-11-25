"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, Monitor, QrCode, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "@/components/AdminContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsDraft {
  name?: string;
  bkash_number?: string;
  nagad_number?: string;
  app_url?: string;
  sheet_id?: string;
  owner_digest_email?: string;
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { role, settings, staff, reloadAll } = useAdmin();

  const [draft, setDraft] = useState<SettingsDraft>({});
  const [staffDrafts, setStaffDrafts] = useState<Record<string, string>>({});
  const [signupLink, setSignupLink] = useState("");
  const [saving, setSaving] = useState(false);

  const name = draft.name ?? settings.name ?? "";
  const bkashNumber = draft.bkash_number ?? settings.bkash_number ?? "";
  const nagadNumber = draft.nagad_number ?? settings.nagad_number ?? "";
  const appUrl = draft.app_url ?? settings.app_url ?? "";
  const sheetId = draft.sheet_id ?? settings.sheet_id ?? "";
  const ownerDigestEmail =
    draft.owner_digest_email ?? settings.owner_digest_email ?? "";

  useEffect(() => {
    let cancelled = false;
    async function loadSignupLink() {
      const { data, error } = await supabase.rpc("signup_link_token");
      if (cancelled || error || !data) return;
      const base = (settings.app_url || window.location.origin).replace(/\/$/, "");
      setSignupLink(`${base}/join#signup=${encodeURIComponent(String(data))}`);
    }
    if (role === "owner") {
      void loadSignupLink();
    }
    return () => {
      cancelled = true;
    };
  }, [supabase, role, settings.app_url]);

  if (role !== "owner") {
    return (
      <Card className="rounded-3xl shadow-xs">
        <CardHeader>
          <CardTitle>Owner settings</CardTitle>
          <CardDescription>
            Only owners can manage gym settings and tokens.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("gym_settings")
        .update({
          name: name.trim(),
          bkash_number: bkashNumber.trim() || null,
          nagad_number: nagadNumber.trim() || null,
          app_url: appUrl.trim() || null,
          sheet_id: sheetId.trim() || null,
          owner_digest_email: ownerDigestEmail.trim() || null,
        })
        .eq("id", 1);
      if (error) {
        toast.error(error.message);
        return;
      }
      setDraft({});
      await reloadAll();
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  }

  async function copySignupLink() {
    if (!signupLink) return;
    try {
      await navigator.clipboard.writeText(signupLink);
      toast.success("Signup link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function rotateSignupToken() {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("rotate_signup_token");
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data) {
        const base = (appUrl || window.location.origin).replace(/\/$/, "");
        setSignupLink(`${base}/join#signup=${encodeURIComponent(String(data))}`);
      }
      toast.success("New signup link created");
    } finally {
      setSaving(false);
    }
  }

  async function rotateQrToken() {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("rotate_checkin_token");
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("New QR created — open the check-in QR page to print it");
    } finally {
      setSaving(false);
    }
  }

  async function saveStaffName(userId: string) {
    setSaving(true);
    try {
      const current =
        staffDrafts[userId] ??
        staff.find((s) => s.user_id === userId)?.display_name ??
        "";
      const { error } = await supabase
        .from("staff")
        .update({ display_name: current.trim() || null })
        .eq("user_id", userId);
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success("Name saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-3xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-xl">Gym settings</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={(e) => void saveSettings(e)}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-name">Gym name *</Label>
                <Input
                  id="set-name"
                  required
                  value={name}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-bkash">bKash number members pay to</Label>
                <Input
                  id="set-bkash"
                  placeholder="017XXXXXXXX"
                  value={bkashNumber}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, bkash_number: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-nagad">Nagad number</Label>
                <Input
                  id="set-nagad"
                  placeholder="017XXXXXXXX"
                  value={nagadNumber}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, nagad_number: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-url">App web address</Label>
                <Input
                  id="set-url"
                  type="url"
                  placeholder="https://your-gym.vercel.app"
                  value={appUrl}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, app_url: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-sheet">Google Sheet ID</Label>
                <Input
                  id="set-sheet"
                  autoComplete="off"
                  value={sheetId}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, sheet_id: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-email">Owner digest email</Label>
                <Input
                  id="set-email"
                  type="email"
                  value={ownerDigestEmail}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      owner_digest_email: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="set-signup-link">Member signup link</Label>
                <Input
                  id="set-signup-link"
                  readOnly
                  dir="ltr"
                  value={signupLink}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copySignupLink()}
              >
                <Copy className="size-4" aria-hidden="true" />
                <span>Copy link</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                <Save className="size-4" aria-hidden="true" />
                <span>Save settings</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void rotateSignupToken()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>Make a new signup link</span>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/desk" target="_blank">
                  <Monitor className="size-4" aria-hidden="true" />
                  <span>Open live desk screen</span>
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/desk-qr" target="_blank">
                  <QrCode className="size-4" aria-hidden="true" />
                  <span>Open check-in QR</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void rotateQrToken()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>Make a new QR</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">Staff names</CardTitle>
          <CardDescription>
            Members see the trainer’s name on their workout and diet plans.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {staff.map((s) => (
            <div key={s.user_id} className="flex flex-wrap items-center gap-3">
              <Badge variant={s.role === "owner" ? "default" : "secondary"}>
                {s.role}
              </Badge>
              <Input
                aria-label={`Display name for ${s.role}`}
                placeholder="Display name"
                value={staffDrafts[s.user_id] ?? s.display_name ?? ""}
                onChange={(e) =>
                  setStaffDrafts((prev) => ({
                    ...prev,
                    [s.user_id]: e.target.value,
                  }))
                }
                className="min-w-56 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void saveStaffName(s.user_id)}
              >
                Save
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
