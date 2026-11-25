"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type {
  GymSettings,
  Plan,
  PlanTemplate,
  StaffMember,
  StaffRole,
} from "@/types/gym";

interface GymState {
  gymName: string;
  settings: Partial<GymSettings>;
  plans: Plan[];
  staff: StaffMember[];
  templates: PlanTemplate[];
  loadGymData: (role: StaffRole) => Promise<void>;
  reset: () => void;
}

const defaultGymName = getSupabaseEnv().gymName;

/**
 * Zustand store holding gym-wide configuration, plans, staff roster, and templates.
 */
export const useGymStore = create<GymState>()(
  devtools(
    (set) => ({
      gymName: defaultGymName,
      settings: {},
      plans: [],
      staff: [],
      templates: [],

      loadGymData: async (role) => {
        const supabase = createClient();

        const [settingsRes, plansRes, staffRes, templatesRes] = await Promise.all([
          supabase
            .from("gym_settings")
            .select("name, currency, bkash_number, nagad_number, app_url")
            .maybeSingle(),
          supabase.from("plans").select("*").order("months"),
          supabase.from("staff").select("user_id, role, display_name"),
          supabase
            .from("plan_templates")
            .select("id, kind, name, plan")
            .order("name"),
        ]);

        let fullSettings: Partial<GymSettings> =
          (settingsRes.data as Partial<GymSettings> | null) ?? {};

        if (role === "owner") {
          const autoRes = await supabase.rpc("automation_settings");
          if (
            autoRes.error &&
            !["PGRST202", "42883"].includes(autoRes.error.code ?? "")
          ) {
            console.error(autoRes.error);
          } else if (autoRes.data) {
            const row = Array.isArray(autoRes.data)
              ? autoRes.data[0]
              : autoRes.data;
            if (row && typeof row === "object") {
              fullSettings = { ...fullSettings, ...(row as Partial<GymSettings>) };
            }
          }
        }

        const loadedName = fullSettings.name?.trim();
        set(
          {
            settings: fullSettings,
            gymName: loadedName || getSupabaseEnv().gymName,
            plans: (plansRes.data as Plan[] | null) ?? [],
            staff: (staffRes.data as StaffMember[] | null) ?? [],
            templates: (templatesRes.data as PlanTemplate[] | null) ?? [],
          },
          false,
          "gym/loadGymData",
        );
      },

      reset: () => {
        set(
          {
            gymName: getSupabaseEnv().gymName,
            settings: {},
            plans: [],
            staff: [],
            templates: [],
          },
          false,
          "gym/reset",
        );
      },
    }),
    { name: "gym-store" },
  ),
);
