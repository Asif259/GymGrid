"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import {
  Copy,
  ImagePlus,
  Monitor,
  QrCode,
  RefreshCw,
  Save,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { uploadGymLogo } from "@/lib/uploadLogo";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useGymStore } from "@/lib/stores/gym-store";
import { useMembersStore } from "@/lib/stores/members-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StaffRole } from "@/types/gym";

interface SettingsDraft {
  name?: string;
  phone?: string;
  address?: string;
  currency?: string;
  timezone?: string;
  bkash_number?: string;
  nagad_number?: string;
  app_url?: string;
  sheet_id?: string;
  owner_digest_email?: string;
}

const CURRENCIES = [
  { value: "৳", label: "৳ BDT" },
  { value: "$", label: "$ USD" },
  { value: "€", label: "€ EUR" },
  { value: "£", label: "£ GBP" },
  { value: "₹", label: "₹ INR" },
  { value: "RM", label: "RM MYR" },
  { value: "AED ", label: "AED" },
];

const TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Kuala_Lumpur",
  "Europe/London",
  "America/New_York",
  "UTC",
];

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const role = useAuthStore((s) => s.role);
  const gym = useGymStore((s) => s.gym);
  const gymId = useGymStore((s) => s.gymId);
  const settings = useGymStore((s) => s.settings);
  const staff = useGymStore((s) => s.staff);
  const reloadAll = useMembersStore((s) => s.reloadAll);

  const [draft, setDraft] = useState<SettingsDraft>({});
  const [staffDrafts, setStaffDrafts] = useState<Record<string, string>>({});
  const [newStaffId, setNewStaffId] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>("trainer");
  const [newStaffName, setNewStaffName] = useState("");
  const [signupLink, setSignupLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const name = draft.name ?? settings.name ?? "";
  const phone = draft.phone ?? settings.phone ?? "";
  const address = draft.address ?? settings.address ?? "";
  const currency = draft.currency ?? settings.currency ?? "৳";
  const timezone = draft.timezone ?? settings.timezone ?? "Asia/Dhaka";
  const bkashNumber = draft.bkash_number ?? settings.bkash_number ?? "";
  const nagadNumber = draft.nagad_number ?? settings.nagad_number ?? "";
  const appUrl = draft.app_url ?? settings.app_url ?? "";
  const sheetId = draft.sheet_id ?? settings.sheet_id ?? "";
  const ownerDigestEmail =
    draft.owner_digest_email ?? settings.owner_digest_email ?? "";

  useEffect(() => {
    let cancelled = false;
    async function loadSignupLink() {
      if (!gymId || !gym?.slug) return;
      const { data, error } = await supabase.rpc("signup_link_token", {
        p_gym_id: gymId,
      });
      if (cancelled || error || !data) return;
      const base = (settings.app_url || window.location.origin).replace(/\/$/, "");
      setSignupLink(
        `${base}/join/${encodeURIComponent(gym.slug)}#signup=${encodeURIComponent(String(data))}`,
      );
    }
    if (role === "owner" && gymId && gym?.slug) {
      void loadSignupLink();
    }
    return () => {
      cancelled = true;
    };
  }, [supabase, role, gymId, gym?.slug, settings.app_url]);

  if (role !== "owner" || !gymId) {
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
    if (saving || !gymId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("gyms")
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          currency,
          timezone,
          bkash_number: bkashNumber.trim() || null,
          nagad_number: nagadNumber.trim() || null,
          app_url: appUrl.trim() || null,
          sheet_id: sheetId.trim() || null,
          owner_digest_email: ownerDigestEmail.trim().toLowerCase() || null,
        })
        .eq("id", gymId);
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

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !gymId) return;
    setUploadingLogo(true);
    try {
      await uploadGymLogo(supabase, gymId, file, { updateGymRow: true });
      await reloadAll();
      toast.success("Logo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function copyText(val: string, label: string) {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function rotateSignupToken() {
    if (!gymId || !gym?.slug) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("rotate_signup_token", {
        p_gym_id: gymId,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data) {
        const base = (appUrl || window.location.origin).replace(/\/$/, "");
        setSignupLink(
          `${base}/join/${encodeURIComponent(gym.slug)}#signup=${encodeURIComponent(String(data))}`,
        );
      }
      toast.success("New signup link created");
    } finally {
      setSaving(false);
    }
  }

  async function rotateQrToken() {
    if (!gymId) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("rotate_checkin_token", {
        p_gym_id: gymId,
      });
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
    if (!gymId) return;
    setSaving(true);
    try {
      const current =
        staffDrafts[userId] ??
        staff.find((s) => s.user_id === userId)?.display_name ??
        "";
      const { error } = await supabase
        .from("gym_staff")
        .update({ display_name: current.trim() || null })
        .eq("gym_id", gymId)
        .eq("user_id", userId);
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success("Staff name saved");
    } finally {
      setSaving(false);
    }
  }

  async function addStaffMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!gymId || saving) return;
    const uid = newStaffId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(uid)) {
      toast.error("Enter a valid user UUID");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("gym_staff").insert({
        gym_id: gymId,
        user_id: uid,
        role: newStaffRole,
        display_name: newStaffName.trim() || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setNewStaffId("");
      setNewStaffName("");
      await reloadAll();
      toast.success("Team member added");
    } finally {
      setSaving(false);
    }
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "G";

  const publicJoinUrl =
    gym?.slug && typeof window !== "undefined"
      ? `${(appUrl || window.location.origin).replace(/\/$/, "")}/join/${gym.slug}`
      : "";

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-3xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-xl">Gym settings</CardTitle>
          <CardDescription>
            Customize your gym branding, currency, payment numbers, desk links, and
            automation settings.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-secondary/60 p-4">
            <div className="flex items-center gap-4">
              <Avatar size="lg" className="size-14">
                {gym?.logo_url ? (
                  <AvatarImage src={gym.logo_url} alt={name || "Gym logo"} />
                ) : null}
                <AvatarFallback className="bg-primary text-base font-medium text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium text-foreground">Gym logo</div>
                <div className="text-xs text-muted-foreground">
                  Shown in sidebar, check-in screen, receipts, and join page.
                </div>
              </div>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">
              <ImagePlus className="size-4" aria-hidden="true" />
              <span>{uploadingLogo ? "Uploading…" : "Upload new logo"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadingLogo}
                onChange={(e) => void handleLogoChange(e)}
                className="sr-only"
              />
            </label>
          </div>

          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => void saveSettings(e)}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-name">Gym name</Label>
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
                <Label htmlFor="set-slug">Public slug</Label>
                <Input
                  id="set-slug"
                  readOnly
                  dir="ltr"
                  value={gym?.slug ?? ""}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-currency">Currency</Label>
                <Select
                  value={currency}
                  onValueChange={(val) =>
                    setDraft((prev) => ({ ...prev, currency: val }))
                  }
                >
                  <SelectTrigger id="set-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-tz">Timezone</Label>
                <Select
                  value={timezone}
                  onValueChange={(val) =>
                    setDraft((prev) => ({ ...prev, timezone: val }))
                  }
                >
                  <SelectTrigger id="set-tz" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-phone">Gym phone</Label>
                <Input
                  id="set-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-address">Gym address</Label>
                <Input
                  id="set-address"
                  value={address}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, address: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-bkash">bKash number (11–13 digits)</Label>
                <Input
                  id="set-bkash"
                  type="tel"
                  placeholder="017XXXXXXXX"
                  value={bkashNumber}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, bkash_number: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-nagad">Nagad number (11–13 digits)</Label>
                <Input
                  id="set-nagad"
                  type="tel"
                  placeholder="018XXXXXXXX"
                  value={nagadNumber}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, nagad_number: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="set-url">App URL (for WhatsApp & email links)</Label>
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

            {publicJoinUrl ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="set-join-url">Public gym page</Label>
                  <Input
                    id="set-join-url"
                    readOnly
                    dir="ltr"
                    value={publicJoinUrl}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyText(publicJoinUrl, "Public page link")}
                >
                  <Copy className="size-4" aria-hidden="true" />
                  <span>Copy URL</span>
                </Button>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="set-signup-link">Member signup invite link</Label>
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
                onClick={() => void copyText(signupLink, "Signup link")}
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
          <CardTitle className="text-lg">Staff & trainers</CardTitle>
          <CardDescription>
            Members see their trainer’s name on workout and diet plans. Add team
            members by their Auth User ID.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
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
          </div>

          <form
            className="grid gap-3 rounded-2xl border bg-secondary/60 p-4 sm:grid-cols-4 sm:items-end"
            onSubmit={(e) => void addStaffMember(e)}
          >
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="staff-uid">Team member User ID</Label>
              <Input
                id="staff-uid"
                dir="ltr"
                placeholder="UUID from onboarding/account screen"
                value={newStaffId}
                onChange={(e) => setNewStaffId(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <Select
                value={newStaffRole}
                onValueChange={(v) => setNewStaffRole(v as StaffRole)}
              >
                <SelectTrigger id="staff-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Input
                aria-label="Staff display name"
                placeholder="Name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
              />
              <Button type="submit" disabled={saving}>
                <UserPlus className="size-4" aria-hidden="true" />
                <span>Add</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
