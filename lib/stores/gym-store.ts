"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type {
  Gym,
  Plan,
  PlanTemplate,
  StaffMember,
  StaffRole,
} from "@/types/gym";

export const GYM_PUBLIC_COLUMNS =
  "id, owner_id, name, slug, logo_url, phone, address, currency, timezone, bkash_number, nagad_number, app_url, saas_status, created_at";

interface GymState {
  gym: Gym | null;
  gymId: string | null;
  gymName: string;
  currency: string;
  settings: Partial<Gym>;
  plans: Plan[];
  staff: StaffMember[];
  templates: PlanTemplate[];
  hydrateInitial: (gym: Gym | null) => void;
  loadGymData: (gymId: string, role: StaffRole) => Promise<void>;
  reset: () => void;
}

const defaultGymName = getSupabaseEnv().gymName;

/**
 * Zustand store holding the active tenant gym record, billing currency,
 * plans, staff roster, and plan templates.
 */
export const useGymStore = create<GymState>()(
  devtools(
    (set, get) => ({
      gym: null,
      gymId: null,
      gymName: defaultGymName,
      currency: "৳",
      settings: {},
      plans: [],
      staff: [],
      templates: [],

      hydrateInitial: (gym) => {
        if (!gym) return;
        const current = get().gym;
        if (current?.id === gym.id && current?.name === gym.name && current?.logo_url === gym.logo_url) {
          return;
        }
        set(
          {
            gym,
            gymId: gym.id,
            gymName: gym.name.trim() || defaultGymName,
            currency: gym.currency || "৳",
            settings: { ...get().settings, ...gym },
          },
          false,
          "gym/hydrateInitial",
        );
      },

      loadGymData: async (gymId, role) => {
        const supabase = createClient();

        const [gymRes, plansRes, staffRes, templatesRes] = await Promise.all([
          supabase
            .from("gyms")
            .select(GYM_PUBLIC_COLUMNS)
            .eq("id", gymId)
            .maybeSingle(),
          supabase
            .from("plans")
            .select("*")
            .eq("gym_id", gymId)
            .order("months"),
          supabase
            .from("gym_staff")
            .select("id, gym_id, user_id, role, display_name")
            .eq("gym_id", gymId)
            .order("created_at"),
          supabase
            .from("plan_templates")
            .select("id, gym_id, kind, name, plan")
            .eq("gym_id", gymId)
            .order("name"),
        ]);

        const baseGym = (gymRes.data as Gym | null) ?? get().gym;
        let fullSettings: Partial<Gym> = baseGym ? { ...baseGym } : {};

        if (role === "owner") {
          const autoRes = await supabase.rpc("automation_settings", {
            p_gym_id: gymId,
          });
          if (
            autoRes.error &&
            !["PGRST202", "42883", "42501"].includes(autoRes.error.code ?? "")
          ) {
            console.error(autoRes.error);
          } else if (autoRes.data && typeof autoRes.data === "object") {
            fullSettings = {
              ...fullSettings,
              ...(autoRes.data as Partial<Gym>),
            };
          }
        }

        const loadedName = baseGym?.name?.trim();
        set(
          {
            gym: baseGym ? ({ ...baseGym, ...fullSettings } as Gym) : null,
            gymId,
            settings: fullSettings,
            gymName: loadedName || defaultGymName,
            currency: baseGym?.currency || "৳",
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
            gym: null,
            gymId: null,
            gymName: getSupabaseEnv().gymName,
            currency: "৳",
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
