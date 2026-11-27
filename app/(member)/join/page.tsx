"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Legacy `/join` entry point preserving any `#signup=` token hash while
 * redirecting to `/join/<defaultGymSlug>`.
 */
export default function LegacyJoinRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const { defaultGymSlug } = getSupabaseEnv();
    const hash = window.location.hash || "";
    router.replace(`/join/${encodeURIComponent(defaultGymSlug)}${hash}`);
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center p-6">
      <Skeleton className="h-64 rounded-xl" />
    </main>
  );
}
