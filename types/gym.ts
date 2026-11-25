export type MemberStatus = 'active' | 'due' | 'expired' | 'frozen';
export type PaymentStatus = 'pending' | 'paid';
export type StaffRole = 'owner' | 'trainer';
export type PlanKind = 'workout' | 'diet';

export interface Plan {
  id: number;
  name: string;
  months: number;
  price: number;
}

export interface Payment {
  id: string | number;
  member_id?: string;
  amount: number | string;
  status: PaymentStatus;
  method: string | null;
  trx_id: string | null;
  receipt_no: string | null;
  receipt_path?: string | null;
  paid_on: string | null;
  period_start?: string | null;
  period_end: string | null;
  created_at: string;
}

export interface MemberPlanRef {
  name: string;
  months: number;
  price: number;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  plan_id?: number | null;
  trainer_id?: string | null;
  status: MemberStatus;
  expiry_date: string | null;
  goal?: string | null;
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  injuries?: string | null;
  diet_pref?: string | null;
  plans?: MemberPlanRef | null;
  payments?: Payment[];
}

export interface StaffMember {
  user_id: string;
  role: StaffRole;
  display_name: string | null;
}

export interface WorkoutExercise {
  name: string;
  sets?: number;
  reps?: string;
}

export interface WorkoutDay {
  day: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlanData {
  days: WorkoutDay[];
}

export interface DietItem {
  food: string;
  qty?: string;
  kcal?: number;
}

export interface DietMeal {
  name: string;
  items: DietItem[];
}

export interface DietPlanData {
  meals: DietMeal[];
}

export interface PlanTemplate {
  id: string;
  kind: PlanKind;
  name: string;
  plan: WorkoutPlanData | DietPlanData;
}

export interface GymSettings {
  name: string;
  currency: string;
  bkash_number?: string | null;
  nagad_number?: string | null;
  app_url?: string | null;
  sheet_id?: string | null;
  owner_digest_email?: string | null;
}

export interface ReportSummary {
  active: number;
  due: number;
  expired: number;
  frozen?: number;
  pending_payments: number;
  pending_amount: number;
  attendance_today?: number;
  revenue_today: number;
  revenue_month: number;
  revenue_total?: number;
}

export interface UnpaidCheckin {
  name: string;
  phone: string;
  expiry_date: string | null;
  checked_in_at?: string;
  time?: string;
}

export interface ReminderRow {
  name: string;
  phone: string;
  plan?: string | null;
  expiry_date: string;
}

export interface PendingReportRow {
  name: string;
  phone: string;
  amount: number;
  method?: string | null;
  trx_id?: string | null;
  days_waiting: number;
}

export interface DailyReport {
  date: string;
  summary: ReportSummary;
  expiring: ReminderRow[];
  expired_recent: ReminderRow[];
  pending: PendingReportRow[];
  unpaid_checkins?: UnpaidCheckin[];
}

export interface PulsePoint {
  day: string;
  label: string;
  count: number;
  isToday: boolean;
}

export interface AttendanceStreak {
  current: number;
  best: number;
  visits_month: number;
}

export interface FormattedPlanSection {
  title: string;
  items: string[];
}

export type MemberFilter =
  | 'all'
  | 'active'
  | 'due'
  | 'expired'
  | 'frozen'
  | 'pending'
  | 'expiring';

export type MemberSortKey = 'name' | 'status' | 'expiry' | 'amount';
export type SortDirection = 'asc' | 'desc';
