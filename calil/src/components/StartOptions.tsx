"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { duplicateWorkout, startEmptyWorkout, startFromTemplate, type Suggestion } from "@/lib/actions";
import { useStore } from "@/lib/store";
import { activeWorkout, completedWorkouts, sortedTemplates } from "@/lib/stats";
import { haptic } from "@/lib/format";
import { tr, useT } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import { Sheet } from "./ui";

/** Hook with the three ways to begin a session, shared by Home and Workout. */
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

function Tile({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press flex min-h-[112px] flex-col justify-between rounded-[22px] bg-fill p-4 text-start disabled:opacity-45"
    >
      <Icon name={icon} size={24} className="text-ink-2" />
      <span className="flex items-end justify-between gap-1 text-[15px] leading-tight font-medium">
        {label}
        <Icon name="chevronRight" size={16} className="mb-0.5 shrink-0 text-ink-3" />
      </span>
    </button>
  );
}

/** From plan · Duplicate last · New workout */
export function StartTiles() {
  const t = useT();
  const start = useStartWorkout();
  const last = useStore((s) => completedWorkouts(s)[0] ?? null);
  const templates = useStore((s) => sortedTemplates(s));
  const [pick, setPick] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <Tile icon="calendar" label={t("From plan")} onClick={() => (templates.length ? setPick(true) : router.push("/plans"))} />
        <Tile icon="copy" label={t("Duplicate last workout")} disabled={!last} onClick={() => last && start.duplicate(last.id)} />
        <Tile icon="plus" label={t("New workout")} onClick={start.empty} />
      </div>
      <Sheet open={pick} onClose={() => setPick(false)} title={t("Start from plan")}>
        <ul className="space-y-2 pb-3">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setPick(false);
                  start.fromTemplate(t.id);
                }}
                className="press flex min-h-[60px] w-full items-center justify-between rounded-[16px] bg-card px-4 text-start text-[17px] font-medium"
              >
                {t.name}
                <Icon name="arrowRight" size={20} className="text-accent" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
