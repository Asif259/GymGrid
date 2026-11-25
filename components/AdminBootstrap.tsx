"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useGymStore } from "@/lib/stores/gym-store";
import type { Gym } from "@/types/gym";

/**
 * Mounts once in the admin layout to hydrate server-resolved tenant branding,
 * bootstrap the Supabase auth session, and enforce client-side onboarding redirects.
 */
export function AdminBootstrap({ initialGym }: { initialGym: Gym | null }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const checkSession = useAuthStore((s) => s.checkSession);
  const hydrateInitial = useGymStore((s) => s.hydrateInitial);

  useEffect(() => {
    hydrateInitial(initialGym);
  }, [initialGym, hydrateInitial]);

  useEffect(() => {
    const supabase = createClient();
    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.user) {
          useAuthStore.getState().setSignedOut();
        } else {
          void checkSession();
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkSession]);

  useEffect(() => {
    if (status === "no_gym") {
      router.replace("/onboarding");
    }
  }, [status, router]);

  return null;
}
