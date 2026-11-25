"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Mail, Send } from "lucide-react";
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
    try {
      const supabase = createClient();
      const result = await sendLoginLink(supabase, email, nextPath);
      setStatus({ text: result.message, ok: result.ok });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mx-auto mt-14 w-full max-w-[440px] rounded-3xl shadow-xs">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>

      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Email</Label>
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
                onChange={(e) => setEmail(e.target.value)}
                className="ps-8"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={sending}>
            <Send className="size-4" aria-hidden="true" />
            <span>{sending ? "Sending…" : buttonLabel}</span>
          </Button>

          {status.text ? (
            <div
              role="status"
              aria-live="polite"
              className={
                status.ok === true
                  ? "rounded-lg bg-status-lime-bg px-3 py-2 text-xs font-medium text-status-lime-fg"
                  : status.ok === false
                    ? "rounded-lg bg-status-rose-bg px-3 py-2 text-xs font-medium text-status-rose-fg"
                    : "rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
              }
            >
              {status.text}
            </div>
          ) : null}
        </form>

        {note ? (
          <p className="mt-3 text-xs text-muted-foreground">{note}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
