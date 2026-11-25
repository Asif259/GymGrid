import type { ReactNode } from "react";
import { AdminProvider } from "@/components/AdminContext";
import { AdminShell } from "@/components/AdminShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
