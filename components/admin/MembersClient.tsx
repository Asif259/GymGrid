"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useGymStore } from "@/lib/stores/gym-store";
import { useMembersStore } from "@/lib/stores/members-store";
import { DataTable } from "@/components/DataTable";
import { MemberDialog } from "@/components/admin/MemberDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dhakaToday, pendingPayment, standing } from "@/lib/logic";
import type { Member, MemberFilter } from "@/types/gym";

/**
 * Members directory view powered by shadcn `DataTable`, bulk plan template
 * assignment, and member action modal.
 */
export function MembersClient({ initialFilter }: { initialFilter?: MemberFilter }) {
  const supabase = useMemo(() => createClient(), []);
  const user = useAuthStore((s) => s.user);
  const gymId = useGymStore((s) => s.gymId);
  const currency = useGymStore((s) => s.currency);
  const templates = useGymStore((s) => s.templates);
  const members = useMembersStore((s) => s.members);
  const reloadAll = useMembersStore((s) => s.reloadAll);

  const [filter, setFilter] = useState<MemberFilter>(initialFilter ?? "all");
  const [query, setQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [confirmCheckinMember, setConfirmCheckinMember] = useState<Member | null>(null);
  const [assigning, setAssigning] = useState(false);

  const today = dhakaToday();

  async function performCheckIn(m: Member, isWarning: boolean) {
    if (!user) return;
    const { error } = await supabase.from("attendance").insert({
      member_id: m.id,
      method: "staff",
      recorded_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await reloadAll();
    if (isWarning) toast.error(`${m.name} checked in (${standing(m)})`);
    else toast.success(`${m.name} checked in`);
  }

  function handleCheckIn(m: Member) {
    if (!user) return;
    const isWarning = m.status === "expired" || m.status === "frozen" || !m.expiry_date;
    if (isWarning) {
      setConfirmCheckinMember(m);
      return;
    }
    void performCheckIn(m, false);
  }

  async function handleQuickPay(m: Member) {
    if (!user) return;
    const price = m.plans?.price;
    if (price == null) {
      setSelectedMember(m);
      return;
    }
    const { error } = await supabase.from("payments").insert({
      member_id: m.id,
      amount: price,
      method: "cash",
      status: "paid",
      recorded_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await reloadAll();
    toast.success(`${m.name}: renewed`);
  }

  async function handleConfirmPending(m: Member) {
    if (!user) return;
    const owed = pendingPayment(m.payments ?? []);
    if (!owed) {
      setSelectedMember(m);
      return;
    }
    const { error } = await supabase
      .from("payments")
      .update({ status: "paid", recorded_by: user.id })
      .eq("id", owed.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await reloadAll();
    toast.success(`${m.name}: payment confirmed`);
  }

  async function handleFreezeToggle(m: Member) {
    const nextStatus = m.status === "frozen" ? "due" : "frozen";
    let q = supabase.from("members").update({ status: nextStatus }).eq("id", m.id);
    if (gymId) q = q.eq("gym_id", gymId);
    const { error } = await q;
    if (error) {
      toast.error(error.message);
      return;
    }
    await reloadAll();
    toast.success(nextStatus === "frozen" ? `${m.name} frozen` : `${m.name} unfrozen`);
  }

  async function assignToShown() {
    if (!selectedTemplateId || visibleIds.length === 0 || assigning) return;
    setAssigning(true);
    try {
      const { error } = await supabase.rpc("assign_plan", {
        template_id: selectedTemplateId,
        member_ids: visibleIds,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadAll();
      toast.success(
        `Plan assigned to ${visibleIds.length} member${visibleIds.length === 1 ? "" : "s"}`,
      );
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="rounded-2xl shadow-xs">
        <CardContent className="flex flex-col gap-5 pt-6">
          {templates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-secondary/60 p-3">
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger
                  aria-label="Plan template for visible members"
                  className="min-w-60 flex-1 sm:max-w-sm"
                >
                  <SelectValue placeholder="Bulk assign template to shown" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      [{t.kind}] {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                disabled={!selectedTemplateId || visibleIds.length === 0 || assigning}
                onClick={() => void assignToShown()}
              >
                <Users className="size-4" aria-hidden="true" />
                <span>
                  {assigning ? "Assigning…" : `Assign to ${visibleIds.length} shown`}
                </span>
              </Button>
            </div>
          ) : null}

          <DataTable
            members={members}
            today={today}
            currency={currency}
            filter={filter}
            onFilterChange={setFilter}
            query={query}
            onQueryChange={setQuery}
            onOpen={(m) => setSelectedMember(m)}
            onCheckIn={(m) => void handleCheckIn(m)}
            onQuickPay={(m) => void handleQuickPay(m)}
            onConfirmPending={(m) => void handleConfirmPending(m)}
            onFreezeToggle={(m) => void handleFreezeToggle(m)}
            visibleIdsChange={setVisibleIds}
          />
        </CardContent>
      </Card>

      <MemberDialog
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />

      <AlertDialog
        open={Boolean(confirmCheckinMember)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmCheckinMember(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check in member with overdue status?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCheckinMember
                ? `${confirmCheckinMember.name} is ${standing(confirmCheckinMember)}. Check in anyway?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCheckinMember) {
                  void performCheckIn(confirmCheckinMember, true);
                  setConfirmCheckinMember(null);
                }
              }}
            >
              Check in anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
