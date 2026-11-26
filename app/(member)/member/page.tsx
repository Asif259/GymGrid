"use client";

import { Suspense } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { buildMemberUrl, type MemberTab } from "@/lib/member-helpers";
import { useMemberAppStore } from "@/lib/stores/member-app-store";
import { MemberShell, DashboardLoadingSkeleton } from "@/components/member/MemberShell";
import { MemberOverview } from "@/components/member/MemberOverview";
import { MemberPlans } from "@/components/member/MemberPlans";
import { MemberPay } from "@/components/member/MemberPay";
import { MemberVisits } from "@/components/member/MemberVisits";
import { MemberReceipts } from "@/components/member/MemberReceipts";
import type { Payment } from "@/types/gym";

async function downloadPdf(payment: Payment) {
  if (!payment.receipt_path) return;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(payment.receipt_path, 60);
  if (error || !data?.signedUrl) {
    toast.error("Could not generate PDF link. Please try again.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function MemberPageInner() {
  const {
    member,
    settings,
    workout,
    diet,
    gymPlans,
    visits,
    streak,
    trainerName,
    tab,
    setTab,
    checkinBanner,
    setCheckinBanner,
    loadMemberData,
    refreshMemberData,
    refreshing,
  } = useMemberAppStore();

  const navigateTab = (next: MemberTab) => {
    setTab(next);
    window.history.replaceState(
      null,
      "",
      buildMemberUrl(window.location.pathname, window.location.search, next),
    );
  };

  const payments = member?.payments ?? [];

  return (
    <MemberShell>
      {({ openProfile, openAiPlan }) => {
        switch (tab) {
          case "plans":
            return member ? (
              <MemberPlans
                member={member}
                workout={workout}
                diet={diet}
                trainerName={trainerName}
                onOpenAiPlan={openAiPlan}
              />
            ) : null;

          case "pay":
            return member ? (
              <MemberPay
                member={member}
                settings={settings}
                gymPlans={gymPlans}
                onSubmitted={async () => {
                  await loadMemberData(member.gym_id ?? null);
                }}
                onRefresh={() => void refreshMemberData()}
                refreshing={refreshing}
              />
            ) : null;

          case "visits":
            return <MemberVisits visits={visits} streak={streak} />;

          case "receipts":
            return (
              <MemberReceipts
                payments={payments}
                currency={
                  (settings as { currency?: string }).currency ?? "৳"
                }
                onDownloadPdf={(payment) => void downloadPdf(payment)}
              />
            );

          default: // "home"
            return member ? (
              <MemberOverview
                member={member}
                settings={settings}
                workout={workout}
                diet={diet}
                visits={visits}
                streak={streak}
                trainerName={trainerName}
                checkinBanner={checkinBanner}
                onDismissCheckin={() => setCheckinBanner(null)}
                onNavigateTab={navigateTab}
                onOpenProfile={openProfile}
                onRefresh={() => void refreshMemberData()}
                onDownloadPdf={(payment) => void downloadPdf(payment)}
                refreshing={refreshing}
              />
            ) : null;
        }
      }}
    </MemberShell>
  );
}

export default function MemberAppPage() {
  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <MemberPageInner />
    </Suspense>
  );
}
