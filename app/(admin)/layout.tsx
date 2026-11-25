import type { ReactNode } from "react";
import { AdminBootstrap } from "@/components/AdminBootstrap";
import { AdminShell } from "@/components/AdminShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminBootstrap />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
