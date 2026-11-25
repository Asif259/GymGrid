import { Badge } from "@/components/ui/badge";
import { standing } from "@/lib/logic";
import { cn } from "@/lib/utils";
import type { Member, MemberStatus } from "@/types/gym";

const STATUS_STYLES: Record<MemberStatus, { badge: string; dot: string }> = {
  active: {
    badge: "border-transparent bg-status-lime-bg text-status-lime-fg",
    dot: "bg-status-lime-fg",
  },
  due: {
    badge: "border-transparent bg-status-yellow-bg text-status-yellow-fg",
    dot: "bg-status-yellow-fg",
  },
  expired: {
    badge: "border-transparent bg-status-rose-bg text-status-rose-fg",
    dot: "bg-status-rose-fg",
  },
  frozen: {
    badge: "border-transparent bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

/**
 * Consistent semantic membership status badge used across directory rows,
 * member drawers, quick check-in, and the member portal.
 */
export function StatusBadge({
  member,
  className,
}: {
  member: Pick<Member, "status" | "expiry_date">;
  className?: string;
}) {
  const tone = STATUS_STYLES[member.status];
  return (
    <Badge className={cn("gap-1.5", tone.badge, className)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden="true" />
      <span>{standing(member)}</span>
    </Badge>
  );
}
