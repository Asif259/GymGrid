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
  gymId: string | null;
  gymName: string;
  gymLogoUrl: string | null;
  userEmail: string;
  entries: DeskEntry[];
  liveOk: boolean;
  init: () => () => void;
}

const defaultGymName = getSupabaseEnv().gymName;
let activeRunId = 0;

/**
 * Zustand store managing the tenant-isolated live reception desk check-in monitor (`/desk`)
 * and its Supabase Realtime attendance subscription.
 */
export const useDeskStore = create<DeskState>()(
  devtools(
    (set) => ({
      status: "loading",
      gymId: null,
      gymName: defaultGymName,
      gymLogoUrl: null,
      userEmail: "",
      entries: [],
      liveOk: false,

      init: () => {
        const runId = ++activeRunId;
        const supabase = createClient();
        let channel: ReturnType<typeof supabase.channel> | null = null;

        const loadMemberSummary = async (memberId: string, gymId: string) => {
          const { data } = await supabase
            .from("members")
            .select("name, status, expiry_date")
            .eq("id", memberId)
            .eq("gym_id", gymId)
            .maybeSingle();
          return (
            (data as Pick<Member, "name" | "status" | "expiry_date"> | null) ??
            null
          );
        };

        void (async () => {
          const { data: auth } = await supabase.auth.getUser();
          if (runId !== activeRunId) return;

          const user = auth.user;
          if (!user) {
            set({ status: "denied" }, false, "desk/noUser");
            return;
          }
          set({ userEmail: user.email ?? "" }, false, "desk/userEmail");

          const { data: staffRow } = await supabase
            .from("gym_staff")
            .select("gym_id, role")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (runId !== activeRunId) return;
          if (!staffRow?.gym_id) {
            set({ status: "denied" }, false, "desk/notStaff");
            return;
          }

          const gymId = staffRow.gym_id as string;

          const [{ data: gymRow }, { data: rows }] = await Promise.all([
            supabase
              .from("gyms")
              .select("name, logo_url")
              .eq("id", gymId)
              .maybeSingle(),
            supabase
              .from("attendance")
              .select("member_id, checked_in_at, members!inner(gym_id)")
              .eq("members.gym_id", gymId)
              .order("checked_in_at", { ascending: false })
              .limit(10),
          ]);
          if (runId !== activeRunId) return;

          set(
            {
              gymId,
              gymName: gymRow?.name ?? defaultGymName,
              gymLogoUrl: gymRow?.logo_url ?? null,
            },
            false,
            "desk/gym",
          );

          const resolved = await Promise.all(
            ((rows as { member_id: string; checked_in_at: string }[] | null) ??
              []
            ).map(async (r) => ({
              member_id: r.member_id,
              checked_in_at: r.checked_in_at,
              member: await loadMemberSummary(r.member_id, gymId),
            })),
          );
          if (runId !== activeRunId) return;

          set({ entries: resolved, status: "ready" }, false, "desk/ready");

          channel = supabase
            .channel(`desk-attendance-${gymId}`)
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
                void loadMemberSummary(row.member_id, gymId).then((member) => {
                  if (runId !== activeRunId || !member) return;
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
