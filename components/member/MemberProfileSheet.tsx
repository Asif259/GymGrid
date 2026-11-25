"use client";

import { LogOut, Phone } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fmtDate } from "@/lib/logic";
import { cn } from "@/lib/utils";
import type { GymSettings, Member } from "@/types/gym";

export interface MemberProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  settings: GymSettings;
  trainerName: string;
  email?: string | null;
  onSignOut: () => void;
}

function deriveInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "M"
  );
}

/**
 * Responsive profile & gym contact drawer for the authenticated member,
 * displaying read-only fitness registration details, gym contact info, and logout.
 */
export function MemberProfileSheet({
  open,
  onOpenChange,
  member,
  settings,
  trainerName,
  email,
  onSignOut,
}: MemberProfileSheetProps) {
  const displayEmail = member.email?.trim() || email?.trim() || null;
  const gymName = settings.name?.trim() || "Your gym";
  const gymPhone = settings.phone?.trim() || null;
  const gymAddress = settings.address?.trim() || null;

  const details: Array<{ label: string; value: string; capitalize?: boolean; wide?: boolean }> = [
    { label: "Plan", value: member.plans?.name ?? "None" },
    { label: "Joined", value: member.join_date ? fmtDate(member.join_date) : "—" },
    { label: "Coach", value: trainerName.trim() || "Not assigned" },
    { label: "Goal", value: member.goal?.trim() || "—", capitalize: Boolean(member.goal?.trim()) },
    { label: "Age", value: member.age != null ? String(member.age) : "—" },
    { label: "Sex", value: member.sex?.trim() || "—", capitalize: Boolean(member.sex?.trim()) },
    {
      label: "Height",
      value: member.height_cm != null ? `${member.height_cm}\u00A0cm` : "—",
    },
    {
      label: "Weight",
      value: member.weight_kg != null ? `${member.weight_kg}\u00A0kg` : "—",
    },
    { label: "Diet pref", value: member.diet_pref?.trim() || "—", wide: true },
    { label: "Injuries", value: member.injuries?.trim() || "—", wide: true },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto overscroll-contain data-[side=right]:w-full sm:max-w-md data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="gap-3 p-5 pe-12">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-11 shrink-0">
              <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">
                {deriveInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <SheetTitle className="truncate">{member.name}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
                  {displayEmail ? (
                    <span className="truncate">{displayEmail}</span>
                  ) : null}
                  <span className="tabular-nums">+{member.phone}</span>
                </div>
              </SheetDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge member={member} />
            {member.expiry_date ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Until {fmtDate(member.expiry_date)}
              </span>
            ) : null}
          </div>
        </SheetHeader>

        <Separator />

        <div className="flex flex-1 flex-col gap-5 p-5">
          <section className="flex flex-col gap-3 rounded-2xl border bg-secondary/40 p-4">
            <h3 className="text-sm font-medium text-foreground">
              Member &amp; fitness details
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {details.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex min-w-0 flex-col gap-0.5",
                    item.wide && "col-span-2",
                  )}
                >
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd
                    className={cn(
                      "text-sm font-medium text-foreground break-words tabular-nums",
                      item.capitalize && "capitalize",
                    )}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-secondary/40 p-4">
            <h3 className="text-sm font-medium text-foreground">Gym contact</h3>
            <div className="flex flex-col gap-2 text-sm">
              <p translate="no" className="font-medium text-foreground break-words">
                {gymName}
              </p>
              {gymAddress ? (
                <p className="text-xs text-muted-foreground break-words">
                  {gymAddress}
                </p>
              ) : null}
              {gymPhone ? (
                <Button
                  variant="outline"
                  className="min-h-11 w-full justify-start touch-manipulation tabular-nums"
                  asChild
                >
                  <a href={`tel:${gymPhone.replace(/\s+/g, "")}`}>
                    <Phone data-icon="inline-start" aria-hidden="true" />
                    <span>{gymPhone}</span>
                  </a>
                </Button>
              ) : !gymAddress ? (
                <p className="text-xs text-muted-foreground">
                  Ask the front desk for gym contact details.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <Separator />

        <SheetFooter className="p-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full touch-manipulation"
            onClick={onSignOut}
          >
            <LogOut data-icon="inline-start" aria-hidden="true" />
            <span>Log out</span>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
