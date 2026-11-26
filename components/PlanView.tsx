import { dietLines, estimateWorkoutDurationMin } from "@/lib/logic";
import type { DietPlanData, WorkoutPlanData } from "@/types/gym";

interface PlanViewProps {
  workout: WorkoutPlanData | null | undefined;
  diet: DietPlanData | null | undefined;
}

function formatMacroHeader(diet: DietPlanData | null | undefined): string | null {
  if (!diet) return null;
  const parts: string[] = [];
  if (diet.target_kcal != null) {
    parts.push(`${diet.target_kcal.toLocaleString("en-US")} kcal`);
  }
  if (diet.protein_g != null) parts.push(`P ${diet.protein_g}g`);
  if (diet.carbs_g != null) parts.push(`C ${diet.carbs_g}g`);
  if (diet.fat_g != null) parts.push(`F ${diet.fat_g}g`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Renders structured workout split days and diet meals with shadcn surface tokens.
 */
export function PlanView({ workout, diet }: PlanViewProps) {
  const days = workout?.days ?? [];
  const cardio = workout?.cardio ?? [];
  const dSections = dietLines(diet);
  const macroHeader = formatMacroHeader(diet);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-foreground">Workout</h4>
        {days.length > 0 || cardio.length > 0 ? (
          <div className="flex flex-col gap-2">
            {days.map((day, idx) => {
              const estMin = estimateWorkoutDurationMin(day);
              return (
                <div
                  key={`w-${day.day}-${idx}`}
                  className="rounded-xl border bg-card p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">
                      {day.focus ? `${day.day} - ${day.focus}` : day.day}
                    </div>
                    {estMin > 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ~{estMin} min
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-1 list-disc space-y-1 ps-4 text-xs text-muted-foreground">
                    {day.exercises.map((ex, iIdx) => {
                      const summary = ex.sets
                        ? `${ex.name} ${ex.sets}x${ex.reps ?? ""}`.trim()
                        : ex.name;
                      const rest =
                        ex.rest_sec != null && ex.rest_sec > 0
                          ? ` · Rest ${ex.rest_sec}s`
                          : "";
                      const rir = ex.rir != null ? ` · RIR ${ex.rir}` : "";
                      const muscles =
                        ex.muscles && ex.muscles.length > 0
                          ? ` · ${ex.muscles.join(", ")}`
                          : "";
                      const notes = ex.notes?.trim();
                      return (
                        <li key={`wi-${idx}-${iIdx}`} className="break-words">
                          <span>
                            {summary}
                            {rest}
                            {rir}
                            {muscles}
                          </span>
                          {notes ? (
                            <span className="block text-xs leading-[1.4] text-muted-foreground/85">
                              {notes}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {cardio.length > 0 ? (
              <div className="rounded-xl border bg-card p-3">
                <div className="text-sm font-medium text-foreground">Cardio</div>
                <ul className="mt-1 list-disc space-y-1 ps-4 text-xs text-muted-foreground">
                  {cardio.map((c, idx) => (
                    <li key={`wc-${c.day}-${c.type}-${idx}`} className="break-words">
                      <span>
                        <strong className="font-medium text-foreground">{c.day}</strong>:{" "}
                        <span className="capitalize">{c.type.replace(/_/g, " ")}</span> ·{" "}
                        {c.minutes} min
                        {c.incline_pct != null ? ` · ${c.incline_pct}% incline` : ""}
                      </span>
                      {c.intensity?.trim() ? (
                        <span className="block text-xs leading-[1.4] text-muted-foreground/85">
                          {c.intensity.trim()}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None assigned yet</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground">Diet</h4>
          {macroHeader ? (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {macroHeader}
            </span>
          ) : null}
        </div>
        {dSections.length > 0 ? (
          <div className="flex flex-col gap-2">
            {dSections.map((section, idx) => (
              <div
                key={`d-${section.title}-${idx}`}
                className="rounded-xl border bg-card p-3"
              >
                <div className="text-sm font-medium text-foreground">
                  {section.title}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs text-muted-foreground">
                  {section.items.map((item, iIdx) => (
                    <li key={`di-${idx}-${iIdx}`} className="break-words text-pretty">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None assigned yet</p>
        )}
      </div>
    </div>
  );
}
