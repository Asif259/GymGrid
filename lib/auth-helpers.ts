import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthResult {
  ok: boolean;
  message: string;
}

/**
 * Sends a Supabase OTP magic link using the PKCE `/auth/callback` route,
 * preserving the current path and search parameters.
 */
export async function sendLoginLink(
  supabase: SupabaseClient,
  email: string,
  nextPath?: string,
): Promise<AuthResult> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter your email address" };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fallbackNext =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";
  const next = nextPath ?? fallbackNext;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo },
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Check your email for the sign-in link." };
}
