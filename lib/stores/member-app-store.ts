"use client";

import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type {
  AttendanceStreak,
  DietPlanData,
  GymSettings,
  Member,
  WorkoutPlanData,
} from "@/types/gym";

export type MemberAppStatus = "loading" | "signed_out" | "no_member" | "ready";
export type MemberTab = "home" | "pay" | "plans" | "receipts" | "visits";

interface MemberAppPersistedState {
  _pendingCheckin: string | null;
  _pendingTab: MemberTab | null;
}

interface MemberAppState extends MemberAppPersistedState {
  status: MemberAppStatus;
  user: User | null;
  settings: Partial<GymSettings>;
  member: Member | null;
  workout: WorkoutPlanData | null;
  diet: DietPlanData | null;
  visits: { day: string; checked_in_at: string }[];
  trainerName: string;
  streak: AttendanceStreak | null;
  tab: MemberTab;
  checkinBanner: { ok: boolean; text: string } | null;

  loadMemberData: () => Promise<void>;
  signOut: () => Promise<void>;
  setTab: (tab: MemberTab) => void;
  setCheckinBanner: (banner: { ok: boolean; text: string } | null) => void;
  setUser: (user: User | null) => void;
  setStatus: (status: MemberAppStatus) => void;
  setGymName: (name: string) => void;
  setPendingCheckin: (token: string | null) => void;
  setPendingTab: (tab: MemberTab | null) => void;
}

const defaultGymName = getSupabaseEnv().gymName;

/**
 * Zustand store for the Member PWA portal (`/member`), persisting pending
 * QR check-in tokens and deep-linked tab targets across magic-link auth redirects.
 */
export const useMemberAppStore = create<MemberAppState>()(
  devtools(
    persist(
      (set, get) => ({
        status: "loading",
        user: null,
        settings: { name: defaultGymName, currency: "৳" },
        member: null,
        workout: null,
        diet: null,
        visits: [],
        trainerName: "",
        streak: null,
        tab: "home",
        checkinBanner: null,

        _pendingCheckin: null,
        _pendingTab: null,

        loadMemberData: async () => {
          const supabase = createClient();
          const [settingsRes, claimRes] = await Promise.all([
            supabase
              .from("gym_settings")
              .select("name, currency, bkash_number, nagad_number, app_url")
              .maybeSingle(),
            supabase.rpc("claim_member"),
          ]);

          if (settingsRes.data) {
            set(
              { settings: settingsRes.data as Partial<GymSettings> },
              false,
              "memberApp/settings",
            );
          }

          const memberId = claimRes.data as string | null;
          if (claimRes.error || !memberId) {
            set({ status: "no_member" }, false, "memberApp/noMember");
            return;
          }

          const pendingToken = get()._pendingCheckin;
          if (pendingToken) {
            set({ _pendingCheckin: null }, false, "memberApp/consumeCheckin");
            const { data: chkData, error: chkErr } = await supabase.rpc(
              "check_in",
              { token: pendingToken },
            );
            if (chkErr) {
              set(
                { checkinBanner: { ok: false, text: chkErr.message } },
                false,
                "memberApp/checkinError",
              );
            } else {
              const res = chkData as {
                paid_up?: boolean;
                message?: string;
              } | null;
              set(
                {
                  checkinBanner: {
                    ok: res?.paid_up !== false,
                    text: res?.message ?? "Checked in!",
                  },
                },
                false,
                "memberApp/checkinSuccess",
              );
            }
          }

          const colsWithPath =
            "id, amount, status, method, trx_id, receipt_no, receipt_path, paid_on, period_start, period_end, created_at";
          const colsBase =
            "id, amount, status, method, trx_id, receipt_no, paid_on, period_start, period_end, created_at";

          let memberRes = await supabase
            .from("members")
            .select(`*, plans(name, months, price), payments(${colsWithPath})`)
            .eq("id", memberId)
            .single();

          if (memberRes.error && /receipt_path/.test(memberRes.error.message)) {
            memberRes = await supabase
              .from("members")
              .select(`*, plans(name, months, price), payments(${colsBase})`)
              .eq("id", memberId)
              .single();
          }

          const [wRes, dRes, vRes, streakRes] = await Promise.all([
            supabase
              .from("workout_plans")
              .select("plan")
              .eq("member_id", memberId)
              .eq("verified", true)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("diet_plans")
              .select("plan")
              .eq("member_id", memberId)
              .eq("verified", true)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("attendance")
              .select("day, checked_in_at")
              .eq("member_id", memberId)
              .order("day", { ascending: false })
              .limit(60),
            supabase.rpc("my_streak"),
          ]);

          const loadedMember = memberRes.data as Member | null;
          let trainerName = "";
          if (loadedMember?.trainer_id) {
            const trRes = await supabase
              .from("staff")
              .select("display_name")
              .eq("user_id", loadedMember.trainer_id)
              .maybeSingle();
            trainerName = trRes.data?.display_name ?? "";
          }

          const savedTab = get()._pendingTab;
          const nextTab =
            savedTab &&
            ["home", "pay", "plans", "receipts", "visits"].includes(savedTab)
              ? savedTab
              : get().tab;

          set(
            {
              member: loadedMember,
              workout:
                (wRes.data?.[0]?.plan as WorkoutPlanData | undefined) ?? null,
              diet: (dRes.data?.[0]?.plan as DietPlanData | undefined) ?? null,
              visits:
                (vRes.data as { day: string; checked_in_at: string }[] | null) ??
                [],
              streak:
                !streakRes.error && streakRes.data
                  ? (streakRes.data as AttendanceStreak)
                  : null,
              trainerName,
              tab: nextTab,
              _pendingTab: null,
              status: "ready",
            },
            false,
            "memberApp/ready",
          );
        },

        signOut: async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          set(
            {
              user: null,
              member: null,
              workout: null,
              diet: null,
              visits: [],
              trainerName: "",
              streak: null,
              status: "signed_out",
            },
            false,
            "memberApp/signOut",
          );
        },

        setTab: (tab) => set({ tab }, false, "memberApp/setTab"),
        setCheckinBanner: (checkinBanner) =>
          set({ checkinBanner }, false, "memberApp/setCheckinBanner"),
        setUser: (user) => set({ user }, false, "memberApp/setUser"),
        setStatus: (status) => set({ status }, false, "memberApp/setStatus"),
        setGymName: (name) =>
          set(
            (state) => ({ settings: { ...state.settings, name } }),
            false,
            "memberApp/setGymName",
          ),
        setPendingCheckin: (_pendingCheckin) =>
          set({ _pendingCheckin }, false, "memberApp/setPendingCheckin"),
        setPendingTab: (_pendingTab) =>
          set({ _pendingTab }, false, "memberApp/setPendingTab"),
      }),
      {
        name: "member-app",
        storage: createJSONStorage(() => window.localStorage),
        partialize: (state) => ({
          _pendingCheckin: state._pendingCheckin,
          _pendingTab: state._pendingTab,
        }),
      },
    ),
    { name: "member-app-store" },
  ),
);
