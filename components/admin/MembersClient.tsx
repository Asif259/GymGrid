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
 * assignment, and member `Sheet` drawer.
 */
export function MembersClient({ initialFilter }: { initialFilter?: MemberFilter }) {
  const supabase = useMemo(() => createClient(), []);
  const user = useAuthStore((s) => s.user);
  const templates = useGymStore((s) => s.templates);
  const members = useMembersStore((s) => s.members);
  const reloadAll = useMembersStore((s) => s.reloadAll);

  const [filter, setFilter] = useState<MemberFilter>(initialFilter ?? "all");
  const [query, setQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [assigning, setAssigning] = useState(false);

  const today = dhakaToday();

  async function handleCheckIn(m: Member) {
    if (!user) return;
    const isWarning = m.status === "expired" || m.status === "frozen" || !m.expiry_date;
    if (isWarning && !window.confirm(`${m.name} is ${standing(m)}. Check in anyway?`)) {
      return;
    }
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
    const { error } = await supabase
      .from("members")
      .update({ status: nextStatus })
      .eq("id", m.id);
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
      <Card className="rounded-3xl shadow-xs">
        <CardContent className="flex flex-col gap-5 pt-6">
          {templates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-secondary/60 p-3">
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger
                  aria-label="Plan template for visible members"
                  className="min-w-60 flex-1 sm:max-w-sm"
                >
                  <SelectValue placeholder="Bulk assign template to shown…" />
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
    </div>
  );
}
