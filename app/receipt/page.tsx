"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate, money, receiptLink } from "@/lib/logic";
import type { Payment } from "@/types/gym";

interface ReceiptPayment extends Payment {
  members?: {
    name: string;
    phone: string;
    plans?: { name?: string | null } | null;
  } | null;
}

function ReceiptInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const supabase = useMemo(() => createClient(), []);
  const { gymName: defaultGymName } = useMemo(() => getSupabaseEnv(), []);

  const [gymName, setGymName] = useState(defaultGymName);
  const [currency, setCurrency] = useState("৳");
  const [payment, setPayment] = useState<ReceiptPayment | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setErrorMsg("Missing receipt ID.");
        setLoading(false);
        return;
      }
      const [settingsRes, payRes] = await Promise.all([
        supabase.from("gym_settings").select("name, currency").maybeSingle(),
        supabase
          .from("payments")
          .select("*, members(name, phone, plans(name))")
          .eq("id", id)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      if (settingsRes.data?.name) setGymName(settingsRes.data.name);
      if (settingsRes.data?.currency) setCurrency(settingsRes.data.currency);

      if (payRes.error || !payRes.data) {
        setErrorMsg(
          payRes.error?.message ?? "Receipt not found or sign in required.",
        );
      } else {
        setPayment(payRes.data as ReceiptPayment);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, supabase]);

  const member = payment?.members ?? { name: "Member", phone: "", plans: null };
  const waHref =
    payment && member.phone
      ? receiptLink(payment, member, gymName, currency)
      : "";

  const rows = payment
    ? [
        { id: "member", field: "Member", val: member.name },
        { id: "phone", field: "Phone", val: `+${member.phone}` },
        { id: "plan", field: "Plan", val: member.plans?.name ?? "—" },
        {
          id: "amount",
          field: "Amount",
          val: `${money(payment.amount, currency)} (${payment.method ?? "cash"})`,
        },
        ...(payment.trx_id
          ? [{ id: "trx", field: "TrxID", val: payment.trx_id }]
          : []),
        {
          id: "paid_on",
          field: "Paid on",
          val: payment.paid_on ? fmtDate(payment.paid_on) : "—",
        },
        {
          id: "valid",
          field: "Valid",
          val: `${payment.period_start ? fmtDate(payment.period_start) : "—"} to ${
            payment.period_end ? fmtDate(payment.period_end) : "—"
          }`,
        },
      ]
    : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-medium text-foreground">{gymName}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/member">
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Members app</span>
            </Link>
          </Button>
        </div>
      </header>

      {loading ? <Skeleton className="h-80 rounded-3xl" /> : null}

      {errorMsg ? (
        <Card className="rounded-3xl border-destructive shadow-xs">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">{errorMsg}</p>
          </CardContent>
        </Card>
      ) : null}

      {payment ? (
        <Card className="rounded-3xl shadow-xs print:border-0 print:shadow-none">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Payment receipt</p>
              <p className="font-mono text-2xl font-medium text-foreground">
                {payment.receipt_no ?? String(payment.id)}
              </p>
            </div>
            <Badge
              className={
                payment.status === "paid"
                  ? "border-transparent bg-status-lime-bg text-status-lime-fg"
                  : "border-transparent bg-status-yellow-bg text-status-yellow-fg"
              }
            >
              {payment.status}
            </Badge>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            <div className="overflow-hidden rounded-xl border">
              <Table aria-label="Receipt details">
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {item.field}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">
                        {item.val}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 print:hidden">
              <Button onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden="true" />
                <span>Print / save PDF</span>
              </Button>
              {waHref ? (
                <Button variant="outline" asChild>
                  <a href={waHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" aria-hidden="true" />
                    <span>Send on WhatsApp</span>
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-6">
          <Skeleton className="h-80 rounded-3xl" />
        </main>
      }
    >
      <ReceiptInner />
    </Suspense>
  );
}
