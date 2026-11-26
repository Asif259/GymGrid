"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { fmtDate, hhmmDhaka, money, pendingPayment } from "@/lib/logic";
import { resolvePaymentMethod } from "@/lib/member-helpers";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { GymSettings, Member, Plan } from "@/types/gym";

export interface MemberPayProps {
  member: Member;
  settings: GymSettings;
  gymPlans: Plan[];
  onSubmitted: () => Promise<void>;
  onRefresh: () => void;
  refreshing: boolean;
}

function formatSubmissionDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "Recently";
  const dhakaDate = new Date(parsed).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  return `${fmtDate(dhakaDate)} · ${hhmmDhaka(iso)}`;
}

/**
 * Member renewal and mobile-wallet TrxID submission view with current plan summary,
 * pending payment verification status, gym plan tiers, and copyable bKash/Nagad numbers.
 */
export function MemberPay({
  member,
  settings,
  gymPlans,
  onSubmitted,
  onRefresh,
  refreshing,
}: MemberPayProps) {
  const supabase = useMemo(() => createClient(), []);
  const bkashRadioRef = useRef<HTMLButtonElement>(null);
  const nagadRadioRef = useRef<HTMLButtonElement>(null);
  const trxInputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);

  const [selectedMethod, setSelectedMethod] = useState<"bkash" | "nagad">("bkash");
  const [trxId, setTrxId] = useState("");
  const [trxError, setTrxError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedMethod, setCopiedMethod] = useState<"bkash" | "nagad" | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const currency = settings.currency || "৳";
  const owed = pendingPayment(member.payments ?? []);
  const planPrice = member.plans?.price ?? null;
  const methodInfo = resolvePaymentMethod(
    settings.bkash_number,
    settings.nagad_number,
    selectedMethod,
  );
  const bkashNumber = settings.bkash_number?.trim() || "";
  const nagadNumber = settings.nagad_number?.trim() || "";
  const walletCards = [
    {
      id: "bkash" as const,
      label: "bKash",
      number: bkashNumber,
      available: methodInfo.hasBkash,
    },
    {
      id: "nagad" as const,
      label: "Nagad",
      number: nagadNumber,
      available: methodInfo.hasNagad,
    },
  ].filter((wallet) => wallet.available);
  const canSubmit = !submitting && planPrice != null && methodInfo.hasAny;

  async function copyNumber(
    num: string,
    label: string,
    wallet: "bkash" | "nagad",
  ) {
    try {
      await navigator.clipboard.writeText(num);
      setCopiedMethod(wallet);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedMethod(null);
      }, 1800);
      toast.success(`${label} number copied`);
    } catch {
      toast.error("Copy failed. Please copy the number manually.");
    }
  }

  function handleRadioKeyDown(
    e: KeyboardEvent<HTMLButtonElement>,
    current: "bkash" | "nagad",
  ) {
    if (
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "ArrowUp" &&
      e.key !== "ArrowDown"
    ) {
      return;
    }
    if (!methodInfo.hasBkash || !methodInfo.hasNagad) return;
    e.preventDefault();
    const next: "bkash" | "nagad" = current === "bkash" ? "nagad" : "bkash";
    setSelectedMethod(next);
    if (next === "bkash") {
      bkashRadioRef.current?.focus();
    } else {
      nagadRadioRef.current?.focus();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (!methodInfo.hasAny) {
      toast.error("Ask the front desk for the gym’s bKash or Nagad number.");
      return;
    }

    if (planPrice == null) {
      toast.error("Ask the front desk to assign a plan first.");
      return;
    }

    const trimmedTrxId = trxId.trim();
    if (!trimmedTrxId) {
      setTrxError("Enter the Transaction ID from your payment SMS.");
      trxInputRef.current?.focus();
      return;
    }

    setTrxError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.from("payments").insert({
        member_id: member.id,
        amount: planPrice,
        method: methodInfo.method,
        trx_id: trimmedTrxId,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setTrxId("");
      toast.success("Submitted! The gym will verify your TrxID.");
      await onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Card className="rounded-2xl shadow-xs">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-lg">Current plan &amp; renewal</CardTitle>
                <CardDescription className="text-pretty leading-[1.4]">
                  {member.plans ? member.plans.name : "No plan assigned"}
                </CardDescription>
              </div>
              <StatusBadge member={member} />
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {member.plans ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-secondary/40 p-3">
                  <span className="text-xs leading-[1.35] text-muted-foreground">Cycle fee</span>
                  <span className="break-words text-base leading-[1.3] font-medium text-foreground tabular-nums">
                    {money(member.plans.price, currency)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-secondary/40 p-3">
                  <span className="text-xs leading-[1.35] text-muted-foreground">Duration</span>
                  <span className="break-words text-base leading-[1.3] font-medium text-foreground tabular-nums">
                    {member.plans.months}{" "}
                    {member.plans.months === 1 ? "month" : "months"}
                  </span>
                </div>
                <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-xl border bg-secondary/40 p-3 sm:col-span-1">
                  <span className="text-xs leading-[1.35] text-muted-foreground">Valid until</span>
                  <span className="break-words text-base leading-[1.3] font-medium text-foreground tabular-nums">
                    {member.expiry_date ? fmtDate(member.expiry_date) : "Not active"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-secondary/40 p-3.5 text-sm leading-[1.45] text-muted-foreground">
                Ask the front desk to assign a plan first.
              </div>
            )}

            <p className="max-w-[65ch] rounded-xl border bg-secondary/30 p-3.5 text-xs leading-[1.5] text-muted-foreground text-pretty">
              Renewing early extends your cycle directly from your current expiry date.
              If your plan has already expired, your new cycle starts when the front desk
              confirms your TrxID.
            </p>
          </CardContent>
        </Card>

        {owed ? (
          <Card className="rounded-2xl border-transparent bg-status-yellow-bg text-status-yellow-fg shadow-xs">
            <CardHeader>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base text-foreground">
                    Pending TrxID verification
                  </CardTitle>
                  <CardDescription className="max-w-[65ch] text-foreground/85 text-pretty leading-[1.45]">
                    Your payment is in the desk queue—no need to pay again if you already
                    sent money.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-card/70 p-3.5 text-foreground">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Amount</dt>
                  <dd className="break-words text-sm leading-[1.35] font-medium tabular-nums">
                    {money(owed.amount, currency)}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Method</dt>
                  <dd className="break-words text-sm leading-[1.35] font-medium capitalize">
                    {owed.method ?? "Mobile wallet"}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">TrxID</dt>
                  <dd className="font-mono text-xs font-medium break-all" translate="no">
                    <bdi>{owed.trx_id || "—"}</bdi>
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Submitted</dt>
                  <dd className="break-words text-xs leading-[1.35] font-medium tabular-nums">
                    {formatSubmissionDate(owed.created_at)}
                  </dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="outline"
                disabled={refreshing}
                className="min-h-11 w-full bg-card/85 text-foreground hover:bg-card touch-manipulation sm:w-auto"
                onClick={onRefresh}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(refreshing && "animate-spin motion-reduce:animate-none")}
                  aria-hidden="true"
                />
                <span>{refreshing ? "Refreshing…" : "Refresh status"}</span>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {gymPlans.length > 0 ? (
          <Card className="rounded-2xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg">Gym plan tiers</CardTitle>
              <CardDescription>Ask the front desk to switch plans.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-2">
              {gymPlans.map((plan) => {
                const isCurrent = member.plan_id != null && plan.id === member.plan_id;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5",
                      isCurrent ? "border-primary/40 bg-accent/60" : "bg-secondary/30",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {plan.name}
                        </span>
                        {isCurrent ? <Badge variant="default">Current</Badge> : null}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {plan.months} {plan.months === 1 ? "month" : "months"}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                      {money(plan.price, currency)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">Submit mobile payment</CardTitle>
          <CardDescription>
            Pay with bKash or Nagad, then enter your Transaction ID below.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm text-muted-foreground">
            <li>
              Send{" "}
              <strong className="font-semibold text-foreground tabular-nums">
                {planPrice != null ? money(planPrice, currency) : "your exact plan fee"}
              </strong>{" "}
              to one of the gym’s wallet numbers below.
            </li>
            <li>Submit the bKash or Nagad TrxID below for front-desk verification.</li>
          </ol>

          {methodInfo.hasAny ? (
            <div className="flex flex-col gap-3">
              {walletCards.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-secondary/50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      {wallet.label}
                    </div>
                    <div
                      className="break-all font-mono text-base leading-[1.35] font-medium text-foreground tabular-nums"
                      translate="no"
                    >
                      <bdi>{wallet.number}</bdi>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0 touch-manipulation"
                    onClick={() =>
                      void copyNumber(wallet.number, wallet.label, wallet.id)
                    }
                  >
                    {copiedMethod === wallet.id ? (
                      <Check data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <Copy data-icon="inline-start" aria-hidden="true" />
                    )}
                    <span>{copiedMethod === wallet.id ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Alert className="rounded-2xl border-transparent bg-status-yellow-bg p-3.5 text-status-yellow-fg">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle className="font-medium text-foreground">
                Ask the front desk for the gym’s bKash or Nagad number.
              </AlertTitle>
              <AlertDescription className="text-xs text-foreground/85">
                Payment submission is unavailable until a mobile wallet number is
                configured.
              </AlertDescription>
            </Alert>
          )}

          {planPrice == null ? (
            <Alert
              variant="destructive"
              className="rounded-2xl border-destructive/30 bg-status-rose-bg p-3.5 text-status-rose-fg"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle className="font-medium text-foreground">
                Ask the front desk to assign a plan first.
              </AlertTitle>
              <AlertDescription className="text-xs text-foreground/85">
                A membership plan is required before you can submit a renewal TrxID.
              </AlertDescription>
            </Alert>
          ) : null}

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label id="member-pay-method-label">Method</Label>
              <div
                role="radiogroup"
                aria-labelledby="member-pay-method-label"
                className="grid grid-cols-2 gap-2 rounded-2xl border bg-secondary/40 p-1.5"
              >
                {(
                  [
                    { id: "bkash", label: "bKash", available: methodInfo.hasBkash },
                    { id: "nagad", label: "Nagad", available: methodInfo.hasNagad },
                  ] as const
                ).map((option) => {
                  const isSelected = methodInfo.hasAny && methodInfo.method === option.id;
                  const isDisabled = !option.available || submitting || planPrice == null;
                  return (
                    <button
                      key={option.id}
                      ref={option.id === "bkash" ? bkashRadioRef : nagadRadioRef}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={
                        isSelected || (!methodInfo.hasAny && option.id === "bkash")
                          ? 0
                          : -1
                      }
                      disabled={isDisabled}
                      onClick={() => setSelectedMethod(option.id)}
                      onKeyDown={(e) => handleRadioKeyDown(e, option.id)}
                      className={cn(
                        "inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium transition-colors outline-none touch-manipulation focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              {methodInfo.hasAny && (!methodInfo.hasBkash || !methodInfo.hasNagad) ? (
                <p className="text-xs text-muted-foreground">
                  Only {methodInfo.hasBkash ? "bKash" : "Nagad"} is enabled for this gym.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-pay-trx">Transaction ID (TrxID) *</Label>
              <Input
                ref={trxInputRef}
                id="member-pay-trx"
                name="trxId"
                type="text"
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="e.g. 9A7B2C3D4E…"
                className="min-h-11 font-mono text-base md:text-sm"
                aria-invalid={Boolean(trxError)}
                aria-describedby={
                  trxError ? "member-pay-trx-error" : "member-pay-trx-hint"
                }
                disabled={submitting || planPrice == null || !methodInfo.hasAny}
                value={trxId}
                onChange={(e) => {
                  setTrxId(e.target.value);
                  if (trxError) setTrxError(null);
                }}
              />
              {trxError ? (
                <p
                  id="member-pay-trx-error"
                  role="alert"
                  className="text-xs font-medium text-destructive"
                >
                  {trxError}
                </p>
              ) : (
                <p id="member-pay-trx-hint" className="text-xs text-muted-foreground">
                  Enter the exact uppercase TrxID from your bKash or Nagad SMS.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="min-h-11 w-full touch-manipulation"
              disabled={!canSubmit}
            >
              {submitting ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Send data-icon="inline-start" aria-hidden="true" />
              )}
              <span>{submitting ? "Submitting…" : "Send TrxID to gym"}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
