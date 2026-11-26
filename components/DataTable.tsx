"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCheck,
  CheckCircle2,
  CircleDollarSign,
  MoreVertical,
  PauseCircle,
  User,
} from "lucide-react";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fmtDate,
  lastPaid,
  matchesFilter,
  memberAmount,
  memberExpiryLabel,
  money,
  sortMembers,
} from "@/lib/logic";
import type {
  Member,
  MemberFilter,
  MemberSortKey,
  SortDirection,
} from "@/types/gym";

export interface MemberRowActionHandlers {
  onOpen: (member: Member) => void;
  onCheckIn: (member: Member) => void;
  onQuickPay: (member: Member) => void;
  onConfirmPending: (member: Member) => void;
  onFreezeToggle: (member: Member) => void;
}

interface DataTableProps extends MemberRowActionHandlers {
  members: Member[];
  today: string;
  currency?: string;
  filter: MemberFilter;
  onFilterChange: (filter: MemberFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  visibleIdsChange?: (ids: string[]) => void;
}

const FILTERS: { key: MemberFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expiring", label: "Expiring 2d" },
  { key: "due", label: "Due" },
  { key: "expired", label: "Expired" },
  { key: "pending", label: "Pending" },
  { key: "frozen", label: "Frozen" },
];

const PAGE_SIZE = 15;

/**
 * shadcn/ui member directory table with status `Tabs` filters, `SearchInput`,
 * `Select` sort control, `DropdownMenu` row actions, and `Pagination`.
 */
export function DataTable({
  members,
  today,
  currency = "৳",
  filter,
  onFilterChange,
  query,
  onQueryChange,
  onOpen,
  onCheckIn,
  onQuickPay,
  onConfirmPending,
  onFreezeToggle,
  visibleIdsChange,
}: DataTableProps) {
  const [sortOption, setSortOption] = useState("status:asc");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const out: Record<MemberFilter, number> = {
      all: members.length,
      active: 0,
      expiring: 0,
      due: 0,
      expired: 0,
      pending: 0,
      frozen: 0,
    };
    for (const m of members) {
      for (const f of FILTERS) {
        if (f.key !== "all" && matchesFilter(m, f.key, today)) {
          out[f.key] += 1;
        }
      }
    }
    return out;
  }, [members, today]);

  const rows = useMemo(() => {
    const [sortKey, sortDir] = sortOption.split(":") as [MemberSortKey, SortDirection];
    const q = query.trim().toLowerCase();
    const filtered = members.filter((m) => {
      if (!matchesFilter(m, filter, today)) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.member_code ?? "").toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.plans?.name ?? "").toLowerCase().includes(q)
      );
    });
    return sortMembers(filtered, sortKey, sortDir);
  }, [members, today, filter, query, sortOption]);

  useEffect(() => {
    visibleIdsChange?.(rows.map((r) => r.id));
  }, [rows, visibleIdsChange]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    for (let i = 1; i <= totalPages; i++) nums.push(i);
    return nums;
  }, [totalPages]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto pb-1">
          <Tabs
            value={filter}
            onValueChange={(val) => {
              onFilterChange(val as MemberFilter);
              setPage(1);
            }}
          >
            <TabsList>
              {FILTERS.map((f) => (
                <TabsTrigger key={f.key} value={f.key} className="gap-1.5">
                  <span>{f.label}</span>
                  <Badge variant="secondary" className="px-1.5 text-[11px]">
                    {counts[f.key]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            aria-label="Search members"
            placeholder="Search name, ID, phone, plan"
            value={query}
            onValueChange={(val) => {
              onQueryChange(val);
              setPage(1);
            }}
            className="sm:w-60"
          />

          <Select
            value={sortOption}
            onValueChange={(val) => {
              setSortOption(val);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Sort members" className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status:asc">Sort: Status</SelectItem>
              <SelectItem value="name:asc">Sort: Name (A–Z)</SelectItem>
              <SelectItem value="name:desc">Sort: Name (Z–A)</SelectItem>
              <SelectItem value="amount:desc">Sort: Amount (high–low)</SelectItem>
              <SelectItem value="amount:asc">Sort: Amount (low–high)</SelectItem>
              <SelectItem value="expiry:asc">Sort: Expiry (soonest)</SelectItem>
              <SelectItem value="expiry:desc">Sort: Expiry (latest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          No members match this filter{query.trim() ? ` for “${query.trim()}”` : ""}.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border">
            <Table aria-label="Members directory">
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last paid</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((m) => {
                  const amt = memberAmount(m);
                  const expText = memberExpiryLabel(m);
                  const paid = lastPaid(m.payments ?? []);
                  const primaryLabel = amt.pending
                    ? "Confirm"
                    : m.status === "expired" || !m.expiry_date
                      ? "Paid"
                      : "Details";
                  const initials =
                    m.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("") || "M";

                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onOpen(m)}
                          className="flex items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-medium text-foreground">
                                {m.name}
                              </span>
                              {m.member_code ? (
                                <Badge variant="outline" className="font-mono text-[11px] tabular-nums">
                                  {m.member_code}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              +{m.phone}
                              {m.plans?.name ? ` · ${m.plans.name}` : ""}
                            </div>
                          </div>
                        </button>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span
                            className={
                              amt.isOwed
                                ? "font-medium tabular-nums text-destructive"
                                : "font-medium tabular-nums text-foreground"
                            }
                          >
                            {amt.amount != null ? money(amt.amount, currency) : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {amt.label}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm text-foreground">{expText}</span>
                      </TableCell>

                      <TableCell>
                        <StatusBadge member={m} />
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {paid?.paid_on ? fmtDate(paid.paid_on) : "—"}
                        </span>
                      </TableCell>

                      <TableCell className="text-end">
                        <div className="inline-flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={amt.isOwed ? "default" : "outline"}
                            onClick={() => {
                              if (amt.pending) onConfirmPending(m);
                              else if (m.status === "expired" || !m.expiry_date)
                                onQuickPay(m);
                              else onOpen(m);
                            }}
                          >
                            {primaryLabel}
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                aria-label={`More actions for ${m.name}`}
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => onOpen(m)}>
                                  <User className="size-4" />
                                  <span>Open profile & plans</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onCheckIn(m)}>
                                  <CheckCircle2 className="size-4" />
                                  <span>Check in now</span>
                                </DropdownMenuItem>
                                {amt.pending ? (
                                  <DropdownMenuItem
                                    onClick={() => onConfirmPending(m)}
                                  >
                                    <CheckCheck className="size-4" />
                                    <span>Confirm pending payment</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => onQuickPay(m)}>
                                    <CircleDollarSign className="size-4" />
                                    <span>Record cash payment</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onFreezeToggle(m)}>
                                <PauseCircle className="size-4" />
                                <span>
                                  {m.status === "frozen"
                                    ? "Unfreeze membership"
                                    : "Freeze membership"}
                                </span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length} members
            </span>
            {totalPages > 1 ? (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#prev"
                      onClick={(e) => {
                        e.preventDefault();
                        if (safePage > 1) setPage(safePage - 1);
                      }}
                    />
                  </PaginationItem>
                  {pageNumbers.map((num) => (
                    <PaginationItem key={num}>
                      <PaginationLink
                        href={`#page-${num}`}
                        isActive={num === safePage}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(num);
                        }}
                      >
                        {num}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#next"
                      onClick={(e) => {
                        e.preventDefault();
                        if (safePage < totalPages) setPage(safePage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
