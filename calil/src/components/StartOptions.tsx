"use client";

import { useRouter } from "next/navigation";
import { createTemplate, duplicateWorkout, startEmptyWorkout, startFromStarter, startFromTemplate, templateFromStarter, type Suggestion } from "@/lib/actions";
import { STARTER_PLANS, type StarterPlan } from "@/lib/starters";
import { track } from "@/lib/track";
import { ExerciseIcon } from "./ExerciseIcon";
import { useStore } from "@/lib/store";
import { activeWorkout, sortedTemplates } from "@/lib/stats";
import { haptic } from "@/lib/format";
import { tr, useT } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
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
    starter: (p: StarterPlan) => go(active?.id ?? startFromStarter(p)),
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

function Option({ icon, title, sub, onClick }: { icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex min-h-[72px] w-full items-center gap-4 rounded-[18px] bg-card px-4 text-start">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-accent-soft text-accent">
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="block text-[14px] text-ink-2">{sub}</span>
      </span>
      <Icon name="chevronRight" size={18} className="text-ink-3" />
    </button>
  );
}

/** Every way to begin: your plans, Calil building one, a suggested plan, or from scratch. */
export function NewWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const start = useStartWorkout();
  const today = new Date().getDay();
  // A plan pinned to today comes first.
  const templates = [...useStore((s) => sortedTemplates(s))].sort(
    (a, b) => Number(!!b.weekdays?.includes(today)) - Number(!!a.weekdays?.includes(today)),
  );
  const router = useRouter();
  const go = (fn: () => void) => {
    onClose();
    fn();
  };
  const heading = (text: string) => <p className="px-1 pt-3 text-[14px] font-medium text-ink-2">{text}</p>;

  return (
    <Sheet open={open} onClose={onClose} title={t("New workout")}>
      <div className="space-y-2 pb-3">
        {templates.length > 0 && (
          <>
            <p className="px-1 pt-1 text-[14px] font-medium text-ink-2">{t("Your plans")}</p>
            <ul className="space-y-2">
              {templates.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => go(() => start.fromTemplate(p.id))}
                    className="press flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[16px] bg-card px-4 text-start text-[17px] font-medium"
                  >
                    <span className="truncate" dir="auto">
                      {p.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {p.weekdays?.includes(today) && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent-ink">{t("Today")}</span>
                      )}
                      <Icon name="arrowRight" size={20} className="text-accent" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          type="button"
          onClick={() => go(start.empty)}
          className={`press flex w-full items-center gap-4 rounded-[18px] bg-accent px-4 py-3.5 text-start text-white ${templates.length ? "mt-3" : ""}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white/18">
            <Icon name="sparkle" size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">{t("Ask Calil to build one")}</span>
            <span className="block text-[14px] text-white/85">{t("Any workout you can describe, and any question about training")}</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-white/80" />
        </button>

        {heading(t("Suggested plans"))}
        <ul className="space-y-2">
          {STARTER_PLANS.map((p) => (
            <li key={p.slug} className="flex items-center gap-1 rounded-[18px] bg-card pe-2">
              <button
                type="button"
                onClick={() =>
                  go(() => {
                    track("start_suggested");
                    start.starter(p);
                  })
                }
                className="press flex min-w-0 flex-1 items-center gap-3.5 p-3 text-start"
              >
                <ExerciseIcon kind={p.icon} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{p.name}</span>
                  <span className="block truncate text-[14px] text-ink-2">
                    {t("{n} exercises", { n: p.exercises.length })} · {t("~{n} min", { n: p.minutes })} · {t(p.focus)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={t("Add to my plans")}
                onClick={() => go(() => router.push(`/plan?id=${templateFromStarter(p)}&added=1`))}
                className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill text-accent-ink"
              >
                <Icon name="plus" size={18} />
              </button>
            </li>
          ))}
        </ul>

        {heading(t("Or"))}
        <Option icon="bolt" title={t("Empty workout")} sub={t("Start now and add exercises as you go")} onClick={() => go(start.empty)} />
        <Option
          icon="edit"
          title={t("Build a plan")}
          sub={t("Pick exercises, sets and reps")}
          onClick={() => go(() => router.push(`/plan?id=${createTemplate("")}&new=1`))}
        />
        <Option icon="copy" title={t("Import a program")} sub={t("Paste text, or choose an Excel file or screenshot")} onClick={() => go(() => router.push("/import"))} />
      </div>
    </Sheet>
  );
}
