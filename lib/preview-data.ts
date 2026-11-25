import type { DailyReport, Member, PulsePoint } from "@/types/gym";

export const PREVIEW_GYM_NAME = "Our Gym";
export const PREVIEW_TODAY = "2026-11-26";

export const PREVIEW_REPORT: DailyReport = {
  date: PREVIEW_TODAY,
  summary: {
    active: 42,
    due: 4,
    expired: 3,
    frozen: 2,
    pending_payments: 2,
    pending_amount: 3000,
    attendance_today: 18,
    revenue_today: 4500,
    revenue_month: 68500,
    revenue_total: 412000,
  },
  expiring: [
    {
      name: "Nadia Rahman",
      phone: "8801712345678",
      plan: "Monthly",
      expiry_date: "2026-11-28",
    },
    {
      name: "Tariqul Islam",
      phone: "8801812345678",
      plan: "Quarterly",
      expiry_date: "2026-11-28",
    },
  ],
  expired_recent: [
    {
      name: "Faisal Ahmed",
      phone: "8801912345678",
      plan: "Monthly",
      expiry_date: "2026-11-22",
    },
  ],
  pending: [
    {
      name: "Samira Hossain",
      phone: "8801612345678",
      amount: 1500,
      method: "bkash",
      trx_id: "9A7B2C3D",
      days_waiting: 1,
    },
    {
      name: "Arif Hasan",
      phone: "8801512345678",
      amount: 1500,
      method: "nagad",
      trx_id: "4F8E1A2B",
      days_waiting: 0,
    },
  ],
  unpaid_checkins: [
    {
      name: "Faisal Ahmed",
      phone: "8801912345678",
      expiry_date: "2026-11-22",
    },
  ],
};

export const PREVIEW_PULSE: PulsePoint[] = [
  { day: "2026-11-20", label: "Fri", count: 14, isToday: false },
  { day: "2026-11-21", label: "Sat", count: 22, isToday: false },
  { day: "2026-11-22", label: "Sun", count: 19, isToday: false },
  { day: "2026-11-23", label: "Mon", count: 25, isToday: false },
  { day: "2026-11-24", label: "Tue", count: 21, isToday: false },
  { day: "2026-11-25", label: "Wed", count: 24, isToday: false },
  { day: "2026-11-26", label: "Thu", count: 18, isToday: true },
];

export const PREVIEW_MEMBERS: Member[] = [
  {
    id: "m1",
    name: "Nadia Rahman",
    phone: "8801712345678",
    status: "due",
    expiry_date: "2026-11-28",
    plans: { name: "Monthly", months: 1, price: 1500 },
    payments: [],
  },
  {
    id: "m2",
    name: "Samira Hossain",
    phone: "8801612345678",
    status: "active",
    expiry_date: "2026-12-20",
    plans: { name: "Monthly", months: 1, price: 1500 },
    payments: [
      {
        id: "p1",
        amount: 1500,
        status: "pending",
        method: "bkash",
        trx_id: "9A7B2C3D",
        receipt_no: null,
        paid_on: null,
        period_end: null,
        created_at: "2026-11-25T10:00:00Z",
      },
    ],
  },
  {
    id: "m3",
    name: "Faisal Ahmed",
    phone: "8801912345678",
    status: "expired",
    expiry_date: "2026-11-22",
    plans: { name: "Monthly", months: 1, price: 1500 },
    payments: [],
  },
  {
    id: "m4",
    name: "Tariqul Islam",
    phone: "8801812345678",
    status: "due",
    expiry_date: "2026-11-28",
    plans: { name: "Quarterly", months: 3, price: 4000 },
    payments: [],
  },
  {
    id: "m5",
    name: "Rashedul Karim",
    phone: "8801312345678",
    status: "frozen",
    expiry_date: "2026-12-30",
    plans: { name: "Yearly", months: 12, price: 14000 },
    payments: [],
  },
];
