"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { addDays, attendancePulse, dhakaToday, hhmmDhaka } from "@/lib/logic";
import type { DailyReport, Member, PulsePoint } from "@/types/gym";

interface MembersState {
  members: Member[];
  todayReport: DailyReport | null;
  pulse: PulsePoint[];
  lastSync: string;
  loadMembersData: (gymId?: string) => Promise<void>;
  reloadAll: () => Promise<void>;
  reset: () => void;
}

/**
 * Zustand store owning tenant-scoped member directory records,
 * 7-day attendance pulse, and daily KPI report.
 */
export const useMembersStore = create<MembersState>()(
  devtools(
    (set, get) => ({
      members: [],
      todayReport: null,
      pulse: [],
      lastSync: "",

      loadMembersData: async (gymId) => {
        const { useGymStore } = await import("./gym-store");
        const activeGymId = gymId ?? useGymStore.getState().gymId;
        if (!activeGymId) return;

        const supabase = createClient();
        const today = dhakaToday();
        const startIso = addDays(today, -6);

        const [membersRes, reportRes, attendanceRes] = await Promise.all([
          supabase
            .from("members")
            .select(
              "*, plans(name, months, price), payments(id, member_id, amount, status, method, trx_id, receipt_no, paid_on, period_start, period_end, created_at)",
            )
            .eq("gym_id", activeGymId)
            .order("name"),
          supabase.rpc("daily_report", { p_gym_id: activeGymId }),
          supabase
            .from("attendance")
            .select("member_id, day, members!inner(gym_id)")
            .eq("members.gym_id", activeGymId)
            .gte("day", startIso)
            .lte("day", today),
        ]);

        set(
          {
            members: (membersRes.data as Member[] | null) ?? [],
            todayReport: (reportRes.data as DailyReport | null) ?? null,
            pulse: attendancePulse(
              (attendanceRes.data as { day?: string | null }[] | null) ?? [],
              today,
            ),
            lastSync: hhmmDhaka(new Date().toISOString()),
          },
          false,
          "members/loadMembersData",
        );
      },

      reloadAll: async () => {
        const [{ useAuthStore }, { useGymStore }] = await Promise.all([
          import("./auth-store"),
          import("./gym-store"),
        ]);
        const role = useAuthStore.getState().role;
        const gymId = useAuthStore.getState().gymId ?? useGymStore.getState().gymId;
        if (!gymId) return;

        await Promise.all([
          get().loadMembersData(gymId),
          role
            ? useGymStore.getState().loadGymData(gymId, role)
            : Promise.resolve(),
        ]);
      },

      reset: () => {
        set(
          {
            members: [],
            todayReport: null,
            pulse: [],
            lastSync: "",
          },
          false,
          "members/reset",
        );
      },
    }),
    { name: "members-store" },
  ),
);
