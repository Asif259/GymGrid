import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  QrCode,
  Smartphone,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-between gap-12 p-6 sm:p-10">
      <header className="flex items-center justify-between gap-3">
        <span className="text-lg font-semibold text-foreground">GymGrid</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/preview">Live preview</Link>
          </Button>
        </div>
      </header>

      <section className="flex flex-col items-start gap-6">
        <Badge className="bg-accent text-accent-foreground">
          shadcn/ui + Supabase Operations
        </Badge>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground">
          Every member, payment, QR scan, and plan in one calm workspace.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Run the front desk, spot expiring or unpaid memberships before anyone slips
          through, and let members check in and renew from their phone.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button asChild>
            <Link href="/admin">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span>Open Admin Dashboard</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Smartphone className="size-4" aria-hidden="true" />
              <span>Members App</span>
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/desk">
              <QrCode className="size-4" aria-hidden="true" />
              <span>Live Desk Screen</span>
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-3xl shadow-xs">
          <CardHeader className="gap-2">
            <LayoutDashboard className="size-6 text-primary" aria-hidden="true" />
            <CardTitle className="text-lg">Owner & Front Desk</CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Live KPIs, bKash/Nagad verification queue, 2-day expiry WhatsApp
            links, and one-click workout & diet template assignment.
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-xs">
          <CardHeader className="gap-2">
            <QrCode className="size-6 text-primary" aria-hidden="true" />
            <CardTitle className="text-lg">QR Check-In & Desk Guardrails</CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Realtime reception monitor flashes instant paid-up or unpaid/expired
            alerts as soon as a member scans in.
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-xs">
          <CardHeader className="gap-2">
            <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
            <CardTitle className="text-lg">Automated Backend Engine</CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Native Supabase Edge Functions & cron jobs handle expiry reminders,
            receipts, Google Sheets sync, and the 8 AM owner digest.
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
