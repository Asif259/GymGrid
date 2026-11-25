import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

const ADMIN_PATHS = new Set(["/", "/members", "/add", "/plans", "/settings"]);

function isAdminRoute(pathname: string): boolean {
  if (ADMIN_PATHS.has(pathname)) return true;
  return (
    pathname.startsWith("/members/") ||
    pathname.startsWith("/add/") ||
    pathname.startsWith("/plans/") ||
    pathname.startsWith("/settings/")
  );
}

/**
 * Refreshes the Supabase auth session and enforces the SaaS Onboarding Gate:
 * authenticated admin visitors with no `gym_staff` row (and not a member-only account)
 * are redirected to `/onboarding`, while existing staff on `/onboarding` return to `/`.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user && (isAdminRoute(pathname) || pathname === "/onboarding")) {
    const { data: staffRows } = await supabase
      .from("gym_staff")
      .select("gym_id")
      .eq("user_id", user.id)
      .limit(1);

    const hasGym = Boolean(staffRows && staffRows.length > 0);

    if (!hasGym && isAdminRoute(pathname)) {
      const { data: memberRows } = await supabase
        .from("members")
        .select("id")
        .eq("auth_user_id", user.id)
        .limit(1);

      if (!memberRows || memberRows.length === 0) {
        const target = request.nextUrl.clone();
        target.pathname = "/onboarding";
        target.search = "";
        return NextResponse.redirect(target);
      }
    } else if (hasGym && pathname === "/onboarding") {
      const target = request.nextUrl.clone();
      target.pathname = "/";
      target.search = "";
      return NextResponse.redirect(target);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|manifest\\.webmanifest|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ttf|otf)$).*)",
  ],
};
