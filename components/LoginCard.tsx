"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, Mail, MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { sendLoginLink } from "@/lib/auth-helpers";

interface LoginCardProps {
  title: string;
  subtitle: ReactNode;
  placeholder?: string;
  buttonLabel?: string;
  nextPath?: string;
  note?: string;
}

/**
 * shadcn/ui Supabase OTP magic-link sign-in card.
 */
export function LoginCard({
  title,
  subtitle,
  placeholder = "you@example.com",
  buttonLabel = "Email sign-in link",
  nextPath,
  note,
}: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ text: string; ok?: boolean }>({ text: "" });
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setStatus({ text: "" });
    try {
      const supabase = createClient();
      const result = await sendLoginLink(supabase, email, nextPath);
      setStatus({ text: result.message, ok: result.ok });
    } catch {
      setStatus({ text: "Could not send the sign-in link. Try again.", ok: false });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="auth-layout" aria-labelledby="auth-title">
      <div className="auth-panel">
        <h2 id="auth-title">{title}</h2>
        <p className="auth-description">{subtitle}</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Email address</Label>
            <div className="relative flex items-center">
              <Mail
                className="pointer-events-none absolute start-2.5 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="login-email"
                type="email"
                required
                placeholder={placeholder}
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (status.text) setStatus({ text: "" });
                }}
                readOnly={sending}
                className="h-11 ps-8 dark:bg-background"
              />
            </div>
          </div>

          <Button type="submit" className="min-h-11 w-full" disabled={sending}>
            <Send className="size-4" aria-hidden="true" />
            <span>{sending ? "Sending…" : buttonLabel}</span>
          </Button>

          <div role="status" aria-live="polite" aria-atomic="true">
            {status.text && (
              <div className={`flex items-start gap-2 rounded-lg px-3 py-3 text-sm font-medium ${status.ok
                ? "bg-status-lime-bg text-status-lime-fg"
                : "bg-status-rose-bg text-status-rose-fg"}`}>
                {status.ok
                  ? <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                <p>{status.text}{status.ok && <> Sent to <bdi>{email.trim()}</bdi>.</>}</p>
              </div>
            )}
          </div>

        </form>

        {note ? (
          <p className="mt-3 text-xs text-muted-foreground">{note}</p>
        ) : null}
      </div>
    </section>
  );
}
