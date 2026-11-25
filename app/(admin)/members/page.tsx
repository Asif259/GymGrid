import { MembersClient } from "@/components/admin/MembersClient";
import type { MemberFilter } from "@/types/gym";

const VALID_FILTERS = new Set<MemberFilter>([
  "all",
  "active",
  "due",
  "expiring",
  "expired",
  "pending",
  "frozen",
]);

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const candidate = params.filter as MemberFilter | undefined;
  const initialFilter =
    candidate && VALID_FILTERS.has(candidate) ? candidate : "all";

  return <MembersClient initialFilter={initialFilter} />;
}
