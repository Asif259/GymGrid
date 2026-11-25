"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  REALTIME_SUBSCRIBE_STATES,
  RealtimePostgresInsertPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Member } from "@/types/gym";

export interface DeskEntry {
  member_id: string;
  checked_in_at: string;
  member: Pick<Member, "name" | "status" | "expiry_date"> | null;
}

interface DeskState {
  status: "loading" | "denied" | "ready";
  gymName: string;
  userEmail: string;
  entries: DeskEntry[];
  liveOk: boolean;
  init: () => () => void;
}

const defaultGymName = getSupabaseEnv().gymName;
let activeRunId = 0;

/**
 * Zustand store managing the live reception desk check-in monitor (`/desk`)
 * and its Supabase Realtime attendance subscription.
 */
export const useDeskStore = create<DeskState>()(
  devtools(
    (set) => ({
      status: "loading",
      gymName: defaultGymName,
      userEmail: "",
      entries: [],
      liveOk: false,

      init: () => {
        const runId = ++activeRunId;
        const supabase = createClient();
        let channel: ReturnType<typeof supabase.channel> | null = null;

        const loadMemberSummary = async (memberId: string) => {
          const { data } = await supabase
            .from("members")
            .select("name, status, expiry_date")
            .eq("id", memberId)
            .maybeSingle();
          return (
            (data as Pick<Member, "name" | "status" | "expiry_date"> | null) ??
            null
          );
        };

        void (async () => {
          const [{ data: settings }, { data: auth }] = await Promise.all([
            supabase.from("gym_settings").select("name").maybeSingle(),
            supabase.auth.getUser(),
          ]);
          if (runId !== activeRunId) return;
          if (settings?.name) {
            set({ gymName: settings.name }, false, "desk/gymName");
          }

          const user = auth.user;
          if (!user) {
            set({ status: "denied" }, false, "desk/noUser");
            return;
          }
          set({ userEmail: user.email ?? "" }, false, "desk/userEmail");

          const { data: staffRow } = await supabase
            .from("staff")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (runId !== activeRunId) return;
          if (!staffRow) {
            set({ status: "denied" }, false, "desk/notStaff");
            return;
          }

          const { data: rows } = await supabase
            .from("attendance")
            .select("member_id, checked_in_at")
            .order("checked_in_at", { ascending: false })
            .limit(10);

          const resolved = await Promise.all(
            ((rows as { member_id: string; checked_in_at: string }[] | null) ??
              []
            ).map(async (r) => ({
              ...r,
              member: await loadMemberSummary(r.member_id),
            })),
          );
          if (runId !== activeRunId) return;

          set({ entries: resolved, status: "ready" }, false, "desk/ready");

          channel = supabase
            .channel("desk-attendance")
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "attendance",
              },
              (
                payload: RealtimePostgresInsertPayload<{
                  member_id: string;
                  checked_in_at: string;
                }>,
              ) => {
                const row = payload.new;
                void loadMemberSummary(row.member_id).then((member) => {
                  if (runId !== activeRunId) return;
                  set(
                    (state) => ({
                      entries: [{ ...row, member }, ...state.entries].slice(
                        0,
                        10,
                      ),
                    }),
                    false,
                    "desk/realtimeInsert",
                  );
                });
              },
            )
            .subscribe((subStatus: REALTIME_SUBSCRIBE_STATES) => {
              if (runId !== activeRunId) return;
              set({ liveOk: subStatus === "SUBSCRIBED" }, false, "desk/liveOk");
            });
        })();

        return () => {
          if (runId === activeRunId) {
            activeRunId++;
          }
          if (channel) {
            void supabase.removeChannel(channel);
          }
        };
      },
    }),
    { name: "desk-store" },
  ),
);
