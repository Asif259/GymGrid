import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { GYM_PUBLIC_COLUMNS } from "@/lib/stores/gym-store";
import { AdminBootstrap } from "@/components/AdminBootstrap";
import { AdminShell } from "@/components/AdminShell";
import type { Gym } from "@/types/gym";

/**
 * Server Layout loading the signed-in staff user's active gym once during SSR
 * to eliminate branding flicker before client Zustand stores synchronize.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  let initialGym: Gym | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: staffRow } = await supabase
        .from("gym_staff")
        .select("gym_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (staffRow?.gym_id) {
        const { data: gymRow } = await supabase
          .from("gyms")
          .select(GYM_PUBLIC_COLUMNS)
          .eq("id", staffRow.gym_id)
          .maybeSingle();
        if (gymRow) {
          initialGym = gymRow as Gym;
        }
      }
    }
  } catch {
    // Allow client AdminBootstrap to handle session/errors cleanly
  }

  return (
    <>
      <AdminBootstrap initialGym={initialGym} />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
