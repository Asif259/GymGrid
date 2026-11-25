"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/types/gym";

export type AdminAuthStatus = "loading" | "signed_out" | "not_staff" | "ready";

interface AuthState {
  status: AdminAuthStatus;
  user: User | null;
  role: StaffRole | null;
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
  setSignedOut: () => void;
}

let inFlightSessionCheck: Promise<void> | null = null;

/**
 * Zustand store owning admin/staff authentication state and session bootstrap.
 */
export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      status: "loading",
      user: null,
      role: null,

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
            set({ user: null, role: null, status: "signed_out" }, false, "auth/signedOut");
            return;
          }

          const { data: staffRow, error } = await supabase
            .from("staff")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (error || !staffRow) {
            set({ user, role: null, status: "not_staff" }, false, "auth/notStaff");
            return;
          }

          const role = staffRow.role as StaffRole;
          set({ user, role, status: "ready" }, false, "auth/ready");

          const [{ useGymStore }, { useMembersStore }] = await Promise.all([
            import("./gym-store"),
            import("./members-store"),
          ]);

          await Promise.all([
            useGymStore.getState().loadGymData(role),
            useMembersStore.getState().loadMembersData(),
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
        set({ user: null, role: null, status: "signed_out" }, false, "auth/signOut");
        const [{ useGymStore }, { useMembersStore }] = await Promise.all([
          import("./gym-store"),
          import("./members-store"),
        ]);
        useGymStore.getState().reset();
        useMembersStore.getState().reset();
      },

      setSignedOut: () => {
        set({ user: null, role: null, status: "signed_out" }, false, "auth/setSignedOut");
      },
    }),
    { name: "auth-store" },
  ),
);
