"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { addDays, attendancePulse, dhakaToday, hhmmDhaka } from "@/lib/logic";
import type {
  DailyReport,
  GymSettings,
  Member,
  Plan,
  PlanTemplate,
  PulsePoint,
  StaffMember,
  StaffRole,
} from "@/types/gym";

export type AdminAuthStatus = "loading" | "signed_out" | "not_staff" | "ready";

interface AdminContextValue {
  status: AdminAuthStatus;
  user: User | null;
  role: StaffRole | null;
  gymName: string;
  members: Member[];
  plans: Plan[];
  staff: StaffMember[];
  templates: PlanTemplate[];
  settings: Partial<GymSettings>;
  todayReport: DailyReport | null;
  pulse: PulsePoint[];
  lastSync: string;
  reloadAll: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

/**
 * Loads and shares authenticated staff/owner workspace state across admin routes.
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { gymName: defaultGymName } = useMemo(() => getSupabaseEnv(), []);

  const [status, setStatus] = useState<AdminAuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [gymName, setGymName] = useState<string>(defaultGymName);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [settings, setSettings] = useState<Partial<GymSettings>>({});
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [pulse, setPulse] = useState<PulsePoint[]>([]);
  const [lastSync, setLastSync] = useState<string>("");

  const loadWorkspaceData = useCallback(
    async (staffRole: StaffRole) => {
      const today = dhakaToday();
      const startIso = addDays(today, -6);

      const [
        settingsRes,
        plansRes,
        membersRes,
        reportRes,
        staffRes,
        templatesRes,
        attendanceRes,
      ] = await Promise.all([
        supabase
          .from("gym_settings")
          .select("name, currency, bkash_number, nagad_number, app_url")
          .maybeSingle(),
        supabase.from("plans").select("*").order("months"),
        supabase
          .from("members")
          .select(
            "*, plans(name, months, price), payments(id, member_id, amount, status, method, trx_id, receipt_no, paid_on, period_start, period_end, created_at)",
          )
          .order("name"),
        supabase.rpc("daily_report"),
        supabase.from("staff").select("user_id, role, display_name"),
        supabase.from("plan_templates").select("id, kind, name, plan").order("name"),
        supabase
          .from("attendance")
          .select("member_id, day")
          .gte("day", startIso)
          .lte("day", today),
      ]);

      let fullSettings: Partial<GymSettings> =
        (settingsRes.data as Partial<GymSettings> | null) ?? {};

      if (staffRole === "owner") {
        const autoRes = await supabase.rpc("automation_settings");
        if (autoRes.error && !["PGRST202", "42883"].includes(autoRes.error.code ?? "")) {
          console.error(autoRes.error);
        } else if (autoRes.data) {
          const row = Array.isArray(autoRes.data) ? autoRes.data[0] : autoRes.data;
          if (row && typeof row === "object") {
            fullSettings = { ...fullSettings, ...(row as Partial<GymSettings>) };
          }
        }
      }

      const loadedName = fullSettings.name?.trim();
      setSettings(fullSettings);
      if (loadedName) setGymName(loadedName);
      setPlans((plansRes.data as Plan[] | null) ?? []);
      setMembers((membersRes.data as Member[] | null) ?? []);
      setTodayReport((reportRes.data as DailyReport | null) ?? null);
      setStaff((staffRes.data as StaffMember[] | null) ?? []);
      setTemplates((templatesRes.data as PlanTemplate[] | null) ?? []);
      setPulse(
        attendancePulse(
          (attendanceRes.data as { day?: string | null }[] | null) ?? [],
          today,
        ),
      );
      setLastSync(hhmmDhaka(new Date().toISOString()));
    },
    [supabase],
  );

  const checkSession = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    setUser(authUser);

    if (!authUser) {
      setRole(null);
      setStatus("signed_out");
      return;
    }

    const { data: staffRow, error } = await supabase
      .from("staff")
      .select("role")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (error || !staffRow) {
      setRole(null);
      setStatus("not_staff");
      return;
    }

    const staffRole = staffRow.role as StaffRole;
    setRole(staffRole);
    await loadWorkspaceData(staffRole);
    setStatus("ready");
  }, [supabase, loadWorkspaceData]);

  useEffect(() => {
    let active = true;
    async function init() {
      const {
        data: { user: initialUser },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!initialUser) {
        setUser(null);
        setRole(null);
        setStatus("signed_out");
      } else {
        await checkSession();
      }
    }
    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        setRole(null);
        setStatus("signed_out");
      } else {
        void checkSession();
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, checkSession]);

  const reloadAll = useCallback(async () => {
    if (!role) return;
    await loadWorkspaceData(role);
  }, [role, loadWorkspaceData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setStatus("signed_out");
  }, [supabase]);

  return (
    <AdminContext.Provider
      value={{
        status,
        user,
        role,
        gymName,
        members,
        plans,
        staff,
        templates,
        settings,
        todayReport,
        pulse,
        lastSync,
        reloadAll,
        signOut,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

/** Returns shared authenticated admin state and actions. */
export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return ctx;
}
