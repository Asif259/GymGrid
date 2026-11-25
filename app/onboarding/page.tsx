"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Building2, CheckCircle2, ImagePlus, LogOut, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { uploadGymLogo } from "@/lib/uploadLogo";
import { slugifyGymName } from "@/lib/logic";
import { LoginCard } from "@/components/LoginCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Skeleton } from "@/components/ui/skeleton";

const CURRENCIES = [
  { value: "৳", label: "৳ BDT (Bangladeshi Taka)" },
  { value: "$", label: "$ USD (US Dollar)" },
  { value: "€", label: "€ EUR (Euro)" },
  { value: "£", label: "£ GBP (British Pound)" },
  { value: "₹", label: "₹ INR (Indian Rupee)" },
  { value: "RM", label: "RM MYR (Malaysian Ringgit)" },
  { value: "AED ", label: "AED (UAE Dirham)" },
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

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugCheck, setSlugCheck] = useState<{
    slug: string;
    available: boolean;
  } | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("৳");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(authUser);

      if (authUser) {
        const { data: staffRow } = await supabase
          .from("gym_staff")
          .select("gym_id")
          .eq("user_id", authUser.id)
          .limit(1)
          .maybeSingle();

        if (!cancelled && staffRow?.gym_id) {
          router.replace("/admin");
          return;
        }
      }
      setChecking(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  useEffect(() => {
    const clean = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,60}$/.test(clean)) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_gym_slug_available", {
        p_slug: clean,
      });
      if (!cancelled && !error) {
        setSlugCheck({ slug: clean, available: Boolean(data) });
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, supabase]);

  const cleanSlugInput = slug.trim().toLowerCase();
  const slugAvailable =
    /^[a-z0-9-]{3,60}$/.test(cleanSlugInput) && slugCheck?.slug === cleanSlugInput
      ? slugCheck.available
      : null;

  function handleNameChange(val: string) {
    setName(val);
    if (!slugTouched) {
      setSlug(slugifyGymName(val));
    }
  }

  function handleSlugChange(val: string) {
    setSlugTouched(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  function handleLogoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !user) return;

    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase();
    if (cleanName.length < 2) {
      toast.error("Enter a gym name");
      return;
    }
    if (!/^[a-z0-9-]{3,60}$/.test(cleanSlug)) {
      toast.error("Slug must be 3–60 lowercase letters, numbers, or hyphens");
      return;
    }

    setSubmitting(true);
    try {
      const { data: gymId, error } = await supabase.rpc("create_gym", {
        p_name: cleanName,
        p_slug: cleanSlug,
        p_currency: currency,
        p_timezone: timezone,
        p_phone: phone.trim() || null,
        p_address: address.trim() || null,
        p_logo_url: null,
      });

      if (error || !gymId) {
        toast.error(error?.message ?? "Could not create gym");
        return;
      }

      if (logoFile) {
        try {
          await uploadGymLogo(supabase, String(gymId), logoFile, {
            updateGymRow: true,
          });
        } catch (uploadErr) {
          toast.error(
            `Gym created, but logo upload failed: ${
              uploadErr instanceof Error ? uploadErr.message : "unknown error"
            }`,
          );
        }
      }

      toast.success(`${cleanName} is ready!`);
      router.replace("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "G";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" aria-hidden="true" />
          <span className="text-base font-medium text-foreground">
            Gym Setup
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span>Log out</span>
            </Button>
          ) : null}
        </div>
      </header>

      {checking ? (
        <Skeleton className="h-[520px] rounded-3xl" />
      ) : null}

      {!checking && !user ? (
        <LoginCard
          title="Launch your gym dashboard"
          subtitle="Sign in with your email to register your gym, customize branding, and start managing members."
          nextPath="/onboarding"
        />
      ) : null}

      {!checking && user ? (
        <>
          <Card className="rounded-3xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-xl">Create your gym workspace</CardTitle>
              <CardDescription>
                Your gym gets an isolated dashboard, member app, QR check-in code,
                and branded signup link.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form
                className="flex flex-col gap-5"
                onSubmit={(e) => void handleSubmit(e)}
              >
                <div className="flex items-center gap-4 rounded-2xl border bg-secondary/60 p-4">
                  <Avatar size="lg" className="size-14">
                    {logoPreview ? (
                      <AvatarImage src={logoPreview} alt="Gym logo preview" />
                    ) : null}
                    <AvatarFallback className="bg-primary text-base font-medium text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor="ob-logo">Gym logo (optional)</Label>
                    <label
                      htmlFor="ob-logo"
                      className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <ImagePlus className="size-3.5" aria-hidden="true" />
                      <span>{logoFile ? logoFile.name : "Upload logo"}</span>
                    </label>
                    <input
                      id="ob-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoSelect}
                      className="sr-only"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ob-name">Gym name *</Label>
                  <Input
                    id="ob-name"
                    required
                    placeholder="Iron Pulse Fitness"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="ob-slug">Unique URL slug *</Label>
                    {slugAvailable === true ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-lime-fg">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Available
                      </span>
                    ) : slugAvailable === false ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <XCircle className="size-3.5" aria-hidden="true" />
                        Already taken
                      </span>
                    ) : null}
                  </div>
                  <Input
                    id="ob-slug"
                    required
                    dir="ltr"
                    placeholder="iron-pulse-fitness"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Member join URL:{" "}
                    <span className="font-mono text-foreground">
                      /join/{slug || "your-gym"}
                    </span>
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ob-currency">Currency *</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger id="ob-currency" className="w-full">
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
                    <Label htmlFor="ob-tz">Timezone *</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger id="ob-tz" className="w-full">
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
                    <Label htmlFor="ob-phone">Contact phone</Label>
                    <Input
                      id="ob-phone"
                      type="tel"
                      placeholder="017XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ob-address">Address</Label>
                    <Input
                      id="ob-address"
                      placeholder="House 12, Road 4, Dhaka"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || slugAvailable === false}
                >
                  <span>{submitting ? "Creating workspace…" : "Create gym workspace"}</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-xs">
            <CardContent className="flex flex-col gap-2 pt-6 text-xs text-muted-foreground">
              <p>
                Signed in as <strong className="text-foreground">{user.email}</strong>.
                Joining an existing gym team instead? Give your owner this User ID:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                  {user.id}
                </code>
              </p>
              <div>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href="/">
                    <Smartphone className="size-3.5" aria-hidden="true" />
                    <span>Open the member portal instead</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
