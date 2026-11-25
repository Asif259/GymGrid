import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes Supabase PKCE email magic-link authentication and redirects
 * to the caller's target path, respecting `x-forwarded-host` behind Vercel.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const baseUrl =
    !isLocalEnv && forwardedHost ? `https://${forwardedHost}` : origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  const sep = next.includes("?") ? "&" : "?";
  return NextResponse.redirect(`${baseUrl}${next}${sep}auth_error=1`);
}
