"use client";

import { useRouter } from "next/navigation";
import { duplicateWorkout, startEmptyWorkout, startFromTemplate, type Suggestion } from "@/lib/actions";
import { useStore } from "@/lib/store";
import { activeWorkout, sortedTemplates } from "@/lib/stats";
import { haptic } from "@/lib/format";
import { tr, useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { Sheet } from "./ui";

/** Hook with the ways to begin a session. */
export function useStartWorkout() {
  const router = useRouter();
  const active = useStore(activeWorkout);
  const go = (id: string) => {
    haptic(10);
    router.push(`/workout?id=${id}`);
  };
  return {
    active,
    resume: () => active && go(active.id),
    empty: () => go(active?.id ?? startEmptyWorkout()),
    fromTemplate: (templateId: string) => go(active?.id ?? startFromTemplate(templateId)),
    duplicate: (workoutId: string) => go(active?.id ?? duplicateWorkout(workoutId)),
    /** Start whatever was suggested: a plan, or a repeat of a past free workout. */
    suggested: (sg: Suggestion) =>
      sg.kind === "plan" ? go(active?.id ?? startFromTemplate(sg.template.id)) : go(active?.id ?? duplicateWorkout(sg.workout.id)),
  };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Your usual Sunday" when the suggestion comes from a weekly habit. */
export function habitLabel(sg: Suggestion | null) {
  return sg && sg.habitDay !== null ? tr(`Your usual ${WEEKDAYS[sg.habitDay]}`) : null;
}

/** Pick any plan and start it. */
export function PlanPickerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const start = useStartWorkout();
  const templates = useStore((s) => sortedTemplates(s));
  const router = useRouter();

  return (
    <Sheet open={open} onClose={onClose} title={t("Start from plan")}>
      <ul className="space-y-2 pb-3">
        {templates.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => {
                onClose();
                start.fromTemplate(p.id);
              }}
              className="press flex min-h-[60px] w-full items-center justify-between rounded-[16px] bg-card px-4 text-start text-[17px] font-medium"
            >
              <span dir="auto">{p.name}</span>
              <Icon name="arrowRight" size={20} className="text-accent" />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/plans?tab=plans");
            }}
            className="press flex min-h-[52px] w-full items-center justify-center gap-2 text-[16px] text-accent"
          >
            <Icon name="plus" size={18} /> {templates.length ? t("Manage plans") : t("Create a plan")}
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
