"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/types/gym";

export type AdminAuthStatus =
  | "loading"
  | "signed_out"
  | "no_gym"
  | "not_staff"
  | "ready";

interface AuthState {
  status: AdminAuthStatus;
  user: User | null;
  role: StaffRole | null;
  gymId: string | null;
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
  setSignedOut: () => void;
}

let inFlightSessionCheck: Promise<void> | null = null;

/**
 * Zustand store owning admin/staff authentication state and multi-tenant
 * gym membership resolution via `gym_staff`.
 */
export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      status: "loading",
      user: null,
      role: null,
      gymId: null,

      checkSession: async () => {
        if (inFlightSessionCheck) {
          return inFlightSessionCheck;
        }

        inFlightSessionCheck = (async () => {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            set(
              { user: null, role: null, gymId: null, status: "signed_out" },
              false,
              "auth/signedOut",
            );
            return;
          }

          const { data: staffRow, error } = await supabase
            .from("gym_staff")
            .select("gym_id, role")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (error || !staffRow) {
            const { data: memberRow } = await supabase
              .from("members")
              .select("id")
              .eq("auth_user_id", user.id)
              .limit(1)
              .maybeSingle();

            set(
              {
                user,
                role: null,
                gymId: null,
                status: memberRow ? "not_staff" : "no_gym",
              },
              false,
              memberRow ? "auth/notStaff" : "auth/noGym",
            );
            return;
          }

          const role = staffRow.role as StaffRole;
          const gymId = staffRow.gym_id as string;
          set(
            { user, role, gymId, status: "ready" },
            false,
            "auth/ready",
          );

          const [{ useGymStore }, { useMembersStore }] = await Promise.all([
            import("./gym-store"),
            import("./members-store"),
          ]);

          await Promise.all([
            useGymStore.getState().loadGymData(gymId, role),
            useMembersStore.getState().loadMembersData(gymId),
          ]);
        })();

        try {
          await inFlightSessionCheck;
        } finally {
          inFlightSessionCheck = null;
        }
      },

      signOut: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        set(
          { user: null, role: null, gymId: null, status: "signed_out" },
          false,
          "auth/signOut",
        );
        const [{ useGymStore }, { useMembersStore }] = await Promise.all([
          import("./gym-store"),
          import("./members-store"),
        ]);
        useGymStore.getState().reset();
        useMembersStore.getState().reset();
      },

      setSignedOut: () => {
        set(
          { user: null, role: null, gymId: null, status: "signed_out" },
          false,
          "auth/setSignedOut",
        );
      },
    }),
    { name: "auth-store" },
  ),
);
