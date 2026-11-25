"use client";

import { useEffect } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * Mounts once in the admin layout to bootstrap the Supabase auth session
 * and synchronize auth state transitions into Zustand stores.
 */
export function AdminBootstrap() {
  const checkSession = useAuthStore((s) => s.checkSession);

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

  return null;
}
