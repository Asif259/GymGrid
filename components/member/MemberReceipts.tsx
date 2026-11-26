"use client";

import Link from "next/link";
import { Clock, Download, ExternalLink, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate, hhmmDhaka, money } from "@/lib/logic";
import type { Payment } from "@/types/gym";

export interface MemberReceiptsProps {
  payments: Payment[];
  currency: string;
  onDownloadPdf: (payment: Payment) => void;
}

function formatMethod(method: string | null | undefined): string {
  const clean = method?.trim();
  if (!clean) return "Cash";
  const lower = clean.toLowerCase();
  if (lower === "bkash") return "bKash";
  if (lower === "nagad") return "Nagad";
  if (lower === "rocket") return "Rocket";
  if (lower === "cash") return "Cash";
  return clean;
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fmtDate(iso);
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "—";
  const dhakaDate = new Date(parsed).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  return fmtDate(dhakaDate);
}

function formatDhakaTimestamp(iso: string | null | undefined): string {
  if (!iso) return "Submitted recently";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "Submitted recently";
  const dhakaDate = new Date(parsed).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  return `${fmtDate(dhakaDate)} · ${hhmmDhaka(iso)}`;
}

function formatPeriod(payment: Payment): string {
  const start = formatDateOnly(payment.period_start);
  const end = formatDateOnly(payment.period_end);
  if (payment.period_start && payment.period_end) {
    return `${start} – ${end}`;
  }
  if (payment.period_end) return `Until ${end}`;
  if (payment.period_start) return `From ${start}`;
  return "—";
}

function ReceiptActions({
  payment,
  receiptLabel,
  onDownloadPdf,
  mobile = false,
}: {
  payment: Payment;
  receiptLabel: string;
  onDownloadPdf: (payment: Payment) => void;
  mobile?: boolean;
}) {
  const buttonClass = mobile ? "min-h-11 flex-1 touch-manipulation" : undefined;
  const buttonSize = mobile ? "default" : "sm";

  return (
    <>
      {payment.receipt_path ? (
        <Button
          type="button"
          variant="outline"
          size={buttonSize}
          className={buttonClass}
          aria-label={`PDF receipt ${receiptLabel}`}
          onClick={() => onDownloadPdf(payment)}
        >
          <Download data-icon="inline-start" aria-hidden="true" />
          <span>PDF</span>
        </Button>
      ) : null}
      <Button
        variant="outline"
        size={buttonSize}
        className={buttonClass}
        asChild
      >
        <Link
          href={`/receipt?id=${encodeURIComponent(String(payment.id))}`}
          aria-label={`View receipt ${receiptLabel}`}
        >
          <span>View</span>
          <ExternalLink data-icon="inline-end" aria-hidden="true" />
        </Link>
      </Button>
    </>
  );
}

/**
 * Member Receipts view displaying pending mobile-wallet TrxID submissions
 * awaiting front-desk verification and a responsive table/list of paid receipts.
 */
export function MemberReceipts({
  payments,
  currency,
  onDownloadPdf,
}: MemberReceiptsProps) {
  const resolvedCurrency = currency || "৳";

  const pendingPayments = [...payments]
    .filter((p) => p.status === "pending")
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const paidReceipts = [...payments]
    .filter((p) => p.status === "paid")
    .sort(
      (a, b) =>
        (b.paid_on ?? "").localeCompare(a.paid_on ?? "") ||
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );

  return (
    <div className="flex flex-col gap-6">
      {pendingPayments.length > 0 ? (
        <Card className="rounded-2xl border-transparent bg-status-yellow-bg text-status-yellow-fg shadow-xs">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base text-foreground">
                    Pending verification
                  </CardTitle>
                  <Badge variant="secondary" className="tabular-nums">
                    {pendingPayments.length}
                  </Badge>
                </div>
                <CardDescription className="text-foreground/85">
                  Submitted mobile payments stay here until confirmed by the
                  front desk.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-2.5">
            {pendingPayments.map((p) => (
              <div
                key={String(p.id)}
                className="flex flex-col gap-2.5 rounded-2xl bg-card/85 p-3.5 text-foreground sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold tabular-nums">
                    <span>{money(p.amount, resolvedCurrency)}</span>
                    <span className="text-muted-foreground" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-medium">{formatMethod(p.method)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                    {p.trx_id ? (
                      <span className="break-all">
                        TrxID{" "}
                        <span className="font-mono text-foreground" translate="no">
                          {p.trx_id}
                        </span>
                      </span>
                    ) : null}
                    {p.trx_id ? (
                      <span aria-hidden="true">·</span>
                    ) : null}
                    <span>{formatDhakaTimestamp(p.created_at)}</span>
                  </div>
                </div>
                <Badge className="shrink-0 border-transparent bg-status-yellow-bg text-status-yellow-fg">
                  Awaiting verification
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-lg">Payment receipts</CardTitle>
              <CardDescription>
                Confirmed membership payments and PDF receipts
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {paidReceipts.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {paidReceipts.length > 0 ? (
            <>
              <div className="hidden md:block">
                <div className="overflow-hidden rounded-xl border">
                  <Table aria-label="Confirmed payment receipts">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Paid on</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-end">Amount</TableHead>
                        <TableHead className="text-end">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidReceipts.map((p) => {
                        const receiptLabel = p.receipt_no?.trim() || `#${p.id}`;
                        return (
                          <TableRow key={String(p.id)}>
                            <TableCell
                              className="font-mono text-xs font-medium text-foreground tabular-nums"
                              translate="no"
                            >
                              {receiptLabel}
                            </TableCell>
                            <TableCell className="text-sm text-foreground tabular-nums">
                              {formatDateOnly(p.paid_on)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground tabular-nums">
                              {formatPeriod(p)}
                            </TableCell>
                            <TableCell className="text-sm text-foreground">
                              <div className="flex flex-col">
                                <span>{formatMethod(p.method)}</span>
                                {p.trx_id ? (
                                  <span
                                    className="font-mono text-xs text-muted-foreground"
                                    translate="no"
                                  >
                                    {p.trx_id}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-end font-semibold text-foreground tabular-nums">
                              {money(p.amount, resolvedCurrency)}
                            </TableCell>
                            <TableCell className="text-end">
                              <div className="inline-flex items-center justify-end gap-2">
                                <ReceiptActions
                                  payment={p}
                                  receiptLabel={receiptLabel}
                                  onDownloadPdf={onDownloadPdf}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <ul className="flex flex-col divide-y md:hidden">
                {paidReceipts.map((p) => {
                  const receiptLabel = p.receipt_no?.trim() || `#${p.id}`;
                  return (
                    <li
                      key={String(p.id)}
                      className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-semibold text-foreground tabular-nums">
                            {money(p.amount, resolvedCurrency)} ·{" "}
                            {formatMethod(p.method)}
                          </span>
                          <span className="truncate text-xs text-muted-foreground tabular-nums">
                            <span className="font-mono" translate="no">
                              {receiptLabel}
                            </span>{" "}
                            · {formatDateOnly(p.paid_on)}
                          </span>
                        </div>
                        <Badge className="shrink-0 border-transparent bg-status-lime-bg text-status-lime-fg">
                          Paid
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        <span className="break-words tabular-nums">
                          Period:{" "}
                          <span className="text-foreground">
                            {formatPeriod(p)}
                          </span>
                        </span>
                        {p.trx_id ? (
                          <span className="break-all">
                            TrxID:{" "}
                            <span
                              className="font-mono text-foreground"
                              translate="no"
                            >
                              {p.trx_id}
                            </span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <ReceiptActions
                          payment={p}
                          receiptLabel={receiptLabel}
                          onDownloadPdf={onDownloadPdf}
                          mobile
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-secondary/30 p-6 text-center">
              <Receipt
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-foreground">
                No confirmed receipts yet
              </p>
              <p className="max-w-xs text-xs text-muted-foreground break-words">
                {pendingPayments.length > 0
                  ? "Your submitted payment is waiting for front-desk verification."
                  : "Confirmed receipts and downloadable PDFs will appear here after payment verification."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
