import { dietLines, workoutLines } from "@/lib/logic";
import type { DietPlanData, WorkoutPlanData } from "@/types/gym";

interface PlanViewProps {
  workout: WorkoutPlanData | null | undefined;
  diet: DietPlanData | null | undefined;
}

/**
 * Renders structured workout split days and diet meals with shadcn surface tokens.
 */
export function PlanView({ workout, diet }: PlanViewProps) {
  const wSections = workoutLines(workout);
  const dSections = dietLines(diet);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-foreground">Workout</h4>
        {wSections.length > 0 ? (
          <div className="flex flex-col gap-2">
            {wSections.map((section, idx) => (
              <div
                key={`w-${section.title}-${idx}`}
                className="rounded-xl border bg-card p-3"
              >
                <div className="text-sm font-medium text-foreground">
                  {section.title}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs text-muted-foreground">
                  {section.items.map((item, iIdx) => (
                    <li key={`wi-${idx}-${iIdx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None assigned yet</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-foreground">Diet</h4>
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
                    <li key={`di-${idx}-${iIdx}`}>{item}</li>
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
