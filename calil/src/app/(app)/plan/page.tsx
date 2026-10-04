"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  setPlanDays,
  addTemplateExercise,
  deleteTemplate,
  moveTemplateExercise,
  removeTemplateExercise,
  renameTemplate,
  updateTemplateExercise,
} from "@/lib/actions";
import { haptic, parseNum } from "@/lib/format";
import { weekdayName } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { exName, locale, useLang, useT } from "@/lib/i18n";
import { byPosition, isCardio } from "@/lib/stats";
import type { TemplateExercise } from "@/lib/types";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { EditExerciseSheet } from "@/components/ChangeExercise";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Icon } from "@/components/icons";
import { useStartWorkout } from "@/components/StartOptions";
import { BackLink, Button, Card, Empty, IconButton, Screen, Skeleton } from "@/components/ui";

export default function PlanPage() {
  return (
    <Suspense>
      <PlanEditor />
    </Suspense>
  );
}

function PlanEditor() {
  const t = useT();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const router = useRouter();
  const start = useStartWorkout();
  const loaded = useStore((s) => s.loaded);
  const plan = useStore((s) => s.workout_templates[id], [id]);
  const items = useStore(
    (s) => Object.values(s.template_exercises).filter((te) => te.template_id === id).sort(byPosition),
    [id],
  );
  const [picker, setPicker] = useState(false);

  if (!loaded) return <Screen><Skeleton className="mt-16 h-80" /></Screen>;
  if (!plan)
    return (
      <Screen>
        <BackLink href="/plans" label="Plans" />
        <Empty icon="list" title={t("Plan not found")} />
      </Screen>
    );

  return (
    <Screen>
      <div className="flex items-center justify-between pt-2">
        <BackLink href="/plans" label="Plans" />
        <IconButton
          icon="trash"
          label={t("Delete plan")}
          className="text-ink-3"
          onClick={() => {
            if (!confirm(t("Delete “{name}”? Past workouts stay in your history.", { name: plan.name }))) return;
            deleteTemplate(id);
            router.replace("/plans");
          }}
        />
      </div>

      <input
        key={plan.id}
        defaultValue={plan.name}
        autoFocus={params.get("new") === "1"}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => renameTemplate(id, e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label={t("Plan name")}
        dir="auto"
        className="mt-4 mb-1 w-full bg-transparent text-[32px]! leading-tight font-semibold tracking-[-0.02em] outline-none"
      />
      <p className="mb-4 text-[16px] text-ink-2">
        {items.length === 1 ? t("1 exercise") : t("{n} exercises", { n: items.length })} · {t("targets are optional")}
      </p>

      <DaysPicker id={id} days={plan.weekdays ?? []} />

      <ul className="space-y-2.5">
        {items.map((te, i) => (
          <PlanRow key={te.id} te={te} first={i === 0} last={i === items.length - 1} />
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setPicker(true)}
        className="press mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-ink-3/40 text-[17px] font-medium"
      >
        <Icon name="plus" size={20} /> {t("Add exercise")}
      </button>

      {items.length > 0 && (
        <Button className="mt-5 w-full" icon="bolt" onClick={() => start.fromTemplate(id)}>
          {start.active ? t("Continue current workout") : t("Start this workout")}
        </Button>
      )}

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exclude={items.map((x) => x.exercise_id)}
        onPick={(exId) => addTemplateExercise(id, exId)}
      />
    </Screen>
  );
}

function PlanRow({ te, first, last }: { te: TemplateExercise; first: boolean; last: boolean }) {
  const t = useT();
  const ex = useStore((s) => s.exercises[te.exercise_id], [te.exercise_id]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const cardio = isCardio(ex);
  const reps = te.rep_min != null ? (te.rep_max && te.rep_max !== te.rep_min ? `${te.rep_min}–${te.rep_max}` : `${te.rep_min}`) : "–";
  const r = te.default_rest_seconds ?? 0;
  const rest = r ? t("{time} rest", { time: r < 120 ? t("{n}s", { n: r }) : `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}` }) : "";

  return (
    <li>
      <Card as="div" className="p-3.5">
        <div className="flex items-center gap-3">
          <ExerciseIcon kind={cardio ? "cardio" : ex?.equipment ?? null} size={48} />
          <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-start" aria-expanded={open}>
            <p className="flex items-center gap-1 text-[17px] font-semibold">
              <span className="truncate" dir="auto">
                {ex ? exName(ex) : t("Exercise")}
              </span>
              <Icon name="chevronDown" size={16} className={`shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </p>
            <p className="tnum text-[15px] text-ink-2">
              {cardio ? (
                <>
                  {t("Cardio")}
                  {te.target_minutes ? ` · ${t("Goal {n} min", { n: te.target_minutes })}` : ""}
                </>
              ) : (
                <>
                  {t("{n} sets", { n: te.target_sets ?? "–" })} · {t("{n} reps", { n: reps })}
                  {rest ? ` · ${rest}` : ""}
                </>
              )}
            </p>
            {te.note && !open && (
              <p className="line-clamp-1 text-[13px] text-ink-3" dir="auto">
                {te.note}
              </p>
            )}
          </button>
          <div className="flex">
            <IconButton icon="up" label={t("Move up")} disabled={first} size={40} iconSize={18} className="text-ink-2 disabled:opacity-25" onClick={() => moveTemplateExercise(te.id, -1)} />
            <IconButton icon="down" label={t("Move down")} disabled={last} size={40} iconSize={18} className="text-ink-2 disabled:opacity-25" onClick={() => moveTemplateExercise(te.id, 1)} />
          </div>
        </div>
        {open && (
          <div className="rise mt-3 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="press col-span-4 flex h-11 items-center justify-center gap-1.5 rounded-[12px] bg-accent-soft text-[15px] font-medium text-accent-ink"
            >
              <Icon name="edit" size={17} /> {t("Edit exercise")}
            </button>
            {cardio ? (
              <Field label={t("Goal (min)")} min={1} max={600} value={te.target_minutes ?? null} onChange={(v) => updateTemplateExercise(te.id, { target_minutes: v })} />
            ) : (
              <>
                <Field label={t("Sets")} min={1} max={20} value={te.target_sets} onChange={(v) => updateTemplateExercise(te.id, { target_sets: v })} />
                <Field label={t("Min reps")} value={te.rep_min} onChange={(v) => updateTemplateExercise(te.id, { rep_min: v })} />
                <Field label={t("Max reps")} value={te.rep_max} onChange={(v) => updateTemplateExercise(te.id, { rep_max: v })} />
                <Field label={t("Rest (s)")} max={900} value={te.default_rest_seconds} onChange={(v) => updateTemplateExercise(te.id, { default_rest_seconds: v })} />
              </>
            )}
            <label className="col-span-4 rounded-[12px] bg-fill px-3 pt-1.5 pb-2">
              <span className="block text-[12px] text-ink-2">{t("Note")}</span>
              <textarea
                defaultValue={te.note ?? ""}
                rows={2}
                dir="auto"
                placeholder={t("Tempo, RPE, setup… (optional)")}
                onChange={(e) => updateTemplateExercise(te.id, { note: e.target.value.trim() ? e.target.value : null })}
                className="w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-ink-3"
              />
            </label>
            <button
              type="button"
              onClick={() => removeTemplateExercise(te.id)}
              className="press col-span-4 mt-1 flex h-11 items-center justify-center gap-2 rounded-[12px] text-[15px] text-danger"
            >
              <Icon name="trash" size={17} /> {t("Remove")}
            </button>
          </div>
        )}
      </Card>
      <EditExerciseSheet
        open={editing}
        onClose={() => setEditing(false)}
        target={{ table: "template_exercises", id: te.id }}
        exerciseId={te.exercise_id}
        where="plan"
      />
    </li>
  );
}

function Field({ label, value, onChange, min = 0, max = 200 }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number }) {
  return (
    <label className="rounded-[12px] bg-fill px-2 pt-1.5 pb-1 text-center">
      <span className="block text-[12px] text-ink-2">{label}</span>
      <input
        inputMode="numeric"
        defaultValue={value ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = parseNum(e.target.value);
          onChange(n === null ? null : Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="tnum h-9 w-full bg-transparent text-center text-[18px]! outline-none"
      />
    </label>
  );
}

/** Optional fixed days. None = the plan takes its turn in the rotation. */
function DaysPicker({ id, days }: { id: string; days: number[] }) {
  const t = useT();
  const lang = useLang();
  const toggle = (d: number) => {
    setPlanDays(id, days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
    haptic(8);
  };
  return (
    <section className="mb-5" aria-label={t("Training days")}>
      <p className="mb-2 px-1 text-[14px] text-ink-2">
        {days.length ? t("Shows up on Today on these days") : t("Training days (optional). Without them it comes up in turn.")}
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={weekdayName(d, "long", locale(lang))}
              onClick={() => toggle(d)}
              className={`press h-11 rounded-[12px] text-[15px] font-medium ${on ? "bg-accent text-white" : "bg-fill text-ink-2"}`}
            >
              {weekdayName(d, "narrow", locale(lang))}
            </button>
          );
        })}
      </div>
    </section>
  );
}
