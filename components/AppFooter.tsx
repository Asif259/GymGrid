"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";

const SHELL_MANAGED_ROUTES = [
  "/",
  "/admin",
  "/members",
  "/add",
  "/plans",
  "/settings",
  "/member",
];

/**
 * Renders the shared footer on standalone routes whose layouts do not include
 * LandingShell or DashboardShell/AdminShell/MemberShell.
 */
export function AppFooter() {
  const pathname = usePathname() || "/";
  const managedByShell = SHELL_MANAGED_ROUTES.some((route) =>
    route === "/"
      ? pathname === "/"
      : pathname === route || pathname.startsWith(`${route}/`),
  );

  if (managedByShell) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 print:hidden">
      <SiteFooter />
    </div>
  );
}
