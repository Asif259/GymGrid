"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Dumbbell,
  Salad,
  Target,
  UserCheck,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DietPlanData, Member, WorkoutPlanData } from "@/types/gym";

export interface MemberPlansProps {
  member: Member;
  workout: WorkoutPlanData | null;
  diet: DietPlanData | null;
  trainerName: string;
}

function formatSetsAndReps(sets?: number, reps?: string): string | null {
  const cleanReps = reps?.trim();
  if (sets != null && cleanReps) return `${sets} × ${cleanReps}`;
  if (sets != null) return `${sets} ${sets === 1 ? "set" : "sets"}`;
  if (cleanReps) return cleanReps;
  return null;
}

/**
 * Full member workout split and daily diet view with coach context,
 * fitness profile pills, and mobile-friendly split-day filtering.
 */
export function MemberPlans({
  member,
  workout,
  diet,
  trainerName,
}: MemberPlansProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | "all">("all");

  const coachName = trainerName.trim() || "Not assigned";
  const goal = member.goal?.trim() || "";
  const dietPref = member.diet_pref?.trim() || "";
  const injuries = member.injuries?.trim() || "";
  const hasContextPills = Boolean(goal || dietPref || injuries);

  const workoutDays = workout?.days ?? [];
  const meals = diet?.meals ?? [];

  const activeDayFilter =
    selectedDayIdx === "all" ||
    workoutDays.length <= 3 ||
    selectedDayIdx >= workoutDays.length
      ? "all"
      : selectedDayIdx;

  const visibleDays =
    activeDayFilter === "all"
      ? workoutDays.map((day, idx) => ({ day, idx }))
      : [{ day: workoutDays[activeDayFilter], idx: activeDayFilter }];

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-3xl shadow-xs">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
              <UserCheck className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate">Coach: {coachName}</CardTitle>
              <CardDescription className="truncate">
                {member.plans?.name
                  ? `${member.plans.name} · Verified training & nutrition`
                  : "Verified training & nutrition"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {hasContextPills ? (
          <CardContent className="flex flex-wrap items-center gap-2">
            {goal ? (
              <Badge
                variant="secondary"
                className="h-auto max-w-full gap-1.5 rounded-xl px-2.5 py-1 text-left whitespace-normal break-words"
              >
                <Target aria-hidden="true" />
                <span className="capitalize">Goal: {goal}</span>
              </Badge>
            ) : null}
            {dietPref ? (
              <Badge
                variant="outline"
                className="h-auto max-w-full gap-1.5 rounded-xl px-2.5 py-1 text-left whitespace-normal break-words"
              >
                <Salad aria-hidden="true" />
                <span>Diet: {dietPref}</span>
              </Badge>
            ) : null}
            {injuries ? (
              <Badge className="h-auto max-w-full gap-1.5 rounded-xl border-transparent bg-status-yellow-bg px-2.5 py-1 text-left text-status-yellow-fg whitespace-normal break-words">
                <AlertTriangle aria-hidden="true" />
                <span>Notes: {injuries}</span>
              </Badge>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-lg">Workout split</CardTitle>
                <CardDescription>
                  {workoutDays.length > 0
                    ? `${workoutDays.length} ${workoutDays.length === 1 ? "training day" : "training days"}`
                    : "Verified coach workout routine"}
                </CardDescription>
              </div>
              {workoutDays.length > 0 ? (
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {workoutDays.reduce((sum, d) => sum + d.exercises.length, 0)} exercises
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {workoutDays.length > 3 ? (
              <div
                role="group"
                aria-label="Filter workout split by day"
                className="flex flex-wrap gap-1.5"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={activeDayFilter === "all" ? "default" : "outline"}
                  aria-pressed={activeDayFilter === "all"}
                  className="min-h-11 rounded-full px-3.5 touch-manipulation sm:min-h-10"
                  onClick={() => setSelectedDayIdx("all")}
                >
                  All
                </Button>
                {workoutDays.map((day, idx) => (
                  <Button
                    key={`${day.day}-${idx}`}
                    type="button"
                    size="sm"
                    variant={activeDayFilter === idx ? "default" : "outline"}
                    aria-pressed={activeDayFilter === idx}
                    className="min-h-11 max-w-full rounded-full px-3.5 touch-manipulation sm:min-h-10"
                    onClick={() => setSelectedDayIdx(idx)}
                  >
                    <span className="truncate">{day.day}</span>
                  </Button>
                ))}
              </div>
            ) : null}

            {workoutDays.length > 0 ? (
              <div className="flex flex-col gap-3">
                {visibleDays.map(({ day, idx }) => (
                  <section
                    key={`${day.day}-${idx}`}
                    className="flex flex-col gap-3 rounded-2xl border bg-secondary/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h3 className="text-sm font-semibold text-foreground break-words">
                          {day.day}
                        </h3>
                        {day.focus?.trim() ? (
                          <p className="text-xs text-muted-foreground break-words">
                            {day.focus.trim()}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {day.exercises.length}{" "}
                        {day.exercises.length === 1 ? "exercise" : "exercises"}
                      </Badge>
                    </div>

                    {day.exercises.length > 0 ? (
                      <ul className="flex flex-col divide-y">
                        {day.exercises.map((ex, exIdx) => {
                          const setsReps = formatSetsAndReps(ex.sets, ex.reps);
                          return (
                            <li
                              key={`${ex.name}-${exIdx}`}
                              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                            >
                              <span className="min-w-0 flex-1 text-sm font-medium text-foreground break-words">
                                {ex.name}
                              </span>
                              {setsReps ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 font-mono tabular-nums"
                                >
                                  {setsReps}
                                </Badge>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No exercises listed for this day.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-secondary/30 p-6 text-center">
                <Dumbbell className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">
                  No verified workout plan yet
                </p>
                <p className="max-w-xs text-xs text-muted-foreground break-words">
                  Ask your coach or the front desk to publish and verify your training
                  split.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-lg">Diet plan</CardTitle>
                <CardDescription>
                  {meals.length > 0
                    ? `${meals.length} ${meals.length === 1 ? "meal" : "meals"} planned daily`
                    : "Verified coach nutrition guide"}
                </CardDescription>
              </div>
              {meals.length > 0 ? (
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {meals.reduce((sum, m) => sum + m.items.length, 0)} items
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            {meals.length > 0 ? (
              meals.map((meal, mealIdx) => {
                const hasCalories = meal.items.some((i) => i.kcal != null);
                const mealKcal = meal.items.reduce((sum, i) => sum + (i.kcal ?? 0), 0);

                return (
                  <section
                    key={`${meal.name}-${mealIdx}`}
                    className="flex flex-col gap-3 rounded-2xl border bg-secondary/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground break-words">
                        {meal.name}
                      </h3>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {hasCalories
                          ? `${mealKcal.toLocaleString("en-US")}\u00A0kcal`
                          : `${meal.items.length} ${meal.items.length === 1 ? "item" : "items"}`}
                      </Badge>
                    </div>

                    {meal.items.length > 0 ? (
                      <ul className="flex flex-col divide-y">
                        {meal.items.map((item, itemIdx) => (
                          <li
                            key={`${item.food}-${itemIdx}`}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 flex-1 text-sm font-medium text-foreground break-words">
                              {item.food}
                            </span>
                            {item.qty?.trim() || item.kcal != null ? (
                              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                {item.qty?.trim() ? (
                                  <Badge variant="secondary" className="tabular-nums">
                                    {item.qty.trim()}
                                  </Badge>
                                ) : null}
                                {item.kcal != null ? (
                                  <Badge
                                    variant="outline"
                                    className="font-mono tabular-nums"
                                  >
                                    {item.kcal.toLocaleString("en-US")}&nbsp;kcal
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No food items listed for this meal.
                      </p>
                    )}
                  </section>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-secondary/30 p-6 text-center">
                <UtensilsCrossed
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  No verified diet plan yet
                </p>
                <p className="max-w-xs text-xs text-muted-foreground break-words">
                  Ask your coach or the front desk to publish and verify your meal plan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
