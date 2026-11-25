import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Member App",
};

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
