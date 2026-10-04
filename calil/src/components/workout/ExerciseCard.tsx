"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import {
  addSet,
  deleteSet,
  MACHINE_SEP,
  duplicateSet,
  moveExercise,
  removeExercise,
  restFor,
  restoreSet,
  setExerciseRest,
  toggleWarmup,
  startRest,
  toggleSet,
  updateSet,
} from "@/lib/actions";
import { fmtCardio, fmtNum, haptic, parseNum } from "@/lib/format";
import { getState, useStore } from "@/lib/store";
import { exName, tr, useT } from "@/lib/i18n";
import { e1rm, isCardio, lastSession, PR_TITLE, setsOf } from "@/lib/stats";
import type { WorkoutSet } from "@/lib/types";
import { ExerciseIcon } from "../ExerciseIcon";
import { EditExerciseSheet } from "../ChangeExercise";
import { MachineSheet } from "./MachineSheet";
import { CardioRows } from "./CardioRows";
import { SwipeRow } from "../SwipeRow";
import { Icon } from "../icons";
import { Sheet, SheetAction, toast } from "../ui";

interface Props {
  weId: string;
  index: number;
  count: number;
  expanded: boolean;
  onExpand: () => void;
  onExerciseDone: () => void;
}

export const ExerciseCard = memo(function ExerciseCard({
  weId,
  index,
  count,
  expanded,
  onExpand,
  onExerciseDone,
}: Props) {
  const we = useStore((s) => s.workout_exercises[weId], [weId]);
  const exercise = useStore(
    (s) => (we ? s.exercises[we.exercise_id] : undefined),
    [we?.exercise_id],
  );
  const sets = useStore((s) => setsOf(s, weId), [weId]);
  const workout = useStore(
    (s) => (we ? s.workouts[we.workout_id] : undefined),
    [we?.workout_id],
  );
  const plan = useStore(
    (s) =>
      workout?.template_id
        ? Object.values(s.template_exercises).find(
            (t) =>
              t.template_id === workout.template_id &&
              t.exercise_id === we?.exercise_id,
          )
        : undefined,
    [workout?.template_id, we?.exercise_id],
  );
  const last = useStore(
    (s) => (we ? lastSession(s, we.exercise_id, we.workout_id) : null),
    [we?.exercise_id, we?.workout_id],
  );
  const unit = useStore((s) => s.profile?.weight_unit ?? "kg");
  const t = useT();

  const [menu, setMenu] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const ownRest = useStore(
    (s) => (we ? s.profile?.rest_by_exercise?.[we.exercise_id] : undefined),
    [we?.exercise_id],
  );
  const [setSheet, setSetSheet] = useState<string | null>(null);

  if (!we || !exercise) return null;

  const repHint =
    plan?.rep_min != null
      ? plan.rep_max && plan.rep_max !== plan.rep_min
        ? `${plan.rep_min}–${plan.rep_max}`
        : `${plan.rep_min}`
      : null;
  const doneCount = sets.filter((x) => x.completed && !x.is_warmup).length;
  const workingCount = sets.filter((x) => !x.is_warmup).length;
  // Visible labels: warm-ups get "W", working sets are numbered 1, 2, 3…
  const labels = new Map<string, string>();
  let n = 0;
  for (const x of sets) labels.set(x.id, x.is_warmup ? t("W") : String(++n));
  const lastWork = last?.sets.filter((x) => x.completed && !x.is_warmup) ?? [];
  const lastWarm = last?.sets.filter((x) => x.completed && x.is_warmup) ?? [];
  const cardio = isCardio(exercise);
  const distUnit = t(unit === "lb" ? "mi" : "km");
  const lastLine = last?.sets
    .filter((x) => x.completed && !x.is_warmup)
    .map((x) =>
      cardio
        ? fmtCardio(x, distUnit)
        : `${fmtNum(x.weight) || t("BW")}×${x.reps}`,
    )
    .join("  ·  ");
  const cardioTotal = sets.reduce(
    (a, x) => a + (x.completed ? (x.duration_seconds ?? 0) : 0),
    0,
  );
  const isLive = !workout?.completed_at;

  const onToggle = (x: WorkoutSet) => {
    const { done, pr } = toggleSet(x.id);
    if (!done) return;
    haptic(12);
    if (pr) {
      const what = x.weight
        ? `${fmtNum(x.weight)} ${t(unit)} × ${x.reps}`
        : t("{n} reps", { n: x.reps ?? 0 });
      const est =
        pr === "set"
          ? ` · ${t("est. max {n} {unit}", { n: fmtNum(Math.round(e1rm(x))), unit: t(unit) })}`
          : "";
      toast(
        {
          title: t(PR_TITLE[pr]),
          sub: `${exName(exercise)} · ${what}${est}`,
          icon: "trophy",
          tone: "pr",
        },
        4500,
      );
      haptic(40);
    }
    if (isLive) startRest(restFor(weId));
    const after = setsOf(getState(), weId);
    if (after.every((y) => y.completed)) onExerciseDone();
  };

  // "Lat Pulldown · heavy one": the machine goes on the second line so the name stays readable.
  const fullName = exName(exercise);
  const cut = fullName.indexOf(MACHINE_SEP);
  const title = cut > 0 ? fullName.slice(0, cut) : fullName;
  const machine = cut > 0 ? fullName.slice(cut + MACHINE_SEP.length) : null;
  // Accordion header: the whole row opens and closes the card; ⋯ keeps the other actions.
  const header = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 items-center gap-3.5 text-start"
      >
        <ExerciseIcon
          kind={cardio ? "cardio" : exercise.equipment}
          size={expanded ? 56 : 48}
        />
        <span className="block min-w-0 flex-1">
          <span
            dir="auto"
            className="block truncate text-start text-[19px] font-semibold tracking-[-0.01em]"
          >
            {title}
          </span>
          <span className="tnum block truncate text-[15px] text-ink-2">
            {machine && (
              <span dir="auto" className="font-medium text-ink">
                {machine} ·{" "}
              </span>
            )}
            {cardio
              ? cardioTotal
                ? fmtCardio({ duration_seconds: cardioTotal }, distUnit)
                : t("Cardio")
              : workingCount === 1
                ? t("1 set")
                : t("{n} sets", { n: workingCount })}
            {workingCount !== sets.length ? ` · ${t("+ warm-up")}` : ""}
            {repHint ? ` · ${t("{n} reps", { n: repHint })}` : ""}
            {!expanded && doneCount > 0
              ? ` · ${t("{n} done", { n: doneCount })}`
              : ""}
            {ownRest !== undefined
              ? ` · ${ownRest ? t("{time} rest", { time: fmtRest(ownRest) }) : t("No rest timer")}`
              : ""}
          </span>
        </span>
        {!expanded && (
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-2"
          >
            <Icon name="chevronRight" size={18} />
          </span>
        )}
      </button>
      {expanded && (
        <button
          type="button"
          aria-label={t("{name} options", { name: exName(exercise) })}
          onClick={() => setMenu(true)}
          className="press -me-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2"
        >
          <Icon name="more" size={22} />
        </button>
      )}
    </div>
  );

  return (
    <article className="rounded-[24px] border border-line bg-card p-4 shadow-card transition-shadow">
      {header}

      {expanded ? (
        <div className="mt-3">
          {plan?.note && <CoachNote text={plan.note} />}
          {lastLine && (
            <p className="tnum mb-2 truncate px-1 text-[13px] text-ink-3">
              {t("Last time")}{" "}
              <span className="text-ink-2" dir="ltr">
                {lastLine}
              </span>
            </p>
          )}
          {cardio ? (
            <CardioRows
              weId={weId}
              sets={sets}
              distUnit={distUnit}
              live={isLive} goalMinutes={plan?.target_minutes ?? null} />
          ) : (
            <>
              {/* The set table keeps one layout in every language: Set · Weight · Reps · Done (Done on the right). */}
              <div
                className="grid grid-cols-[48px_1fr_1fr_56px] px-1 pb-1 text-[13px] text-ink-3"
                dir="ltr"
              >
                <span className="text-center">{t("Set")}</span>
                <span className="text-center">
                  {t("Weight ({unit})", { unit: t(unit) })}
                </span>
                <span className="text-center">{t("Reps")}</span>
                <span className="text-center">{t("Done")}</span>
              </div>
              <ul className="space-y-1.5" dir="ltr">
                {sets.map((x) => (
                  <SetRow
                    key={x.id}
                    set={x}
                    label={labels.get(x.id) ?? ""}
                    weightHint={
                      (x.is_warmup
                        ? lastWarm[sets.filter((y) => y.is_warmup).indexOf(x)]
                        : lastWork[Number(labels.get(x.id)) - 1]
                      )?.weight ?? null
                    }
                    repHint={repHint}
                    onToggle={() => onToggle(x)}
                    onMenu={() => setSetSheet(x.id)}
                    onDelete={() => {
                      const removed = deleteSet(x.id);
                      if (removed)
                        toast({
                          title: t("Set {n} deleted", {
                            n: removed.set_number,
                          }),
                          icon: "trash",
                          action: {
                            label: t("Undo"),
                            run: () => restoreSet(removed),
                          },
                        });
                    }}
                  />
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  addSet(weId);
                  haptic();
                }}
                className="press mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-fill text-[16px] font-medium text-ink"
              >
                <Icon name="plus" size={19} /> {t("Add set")}
              </button>
            </>
          )}
        </div>
      ) : (
        sets.length > 0 && (
          <button
            type="button"
            onClick={onExpand}
            className="mt-3 flex w-full gap-1.5 overflow-x-auto no-scrollbar"
            tabIndex={-1}
            dir="ltr"
          >
            {sets.map((x) => (
              <span
                key={x.id}
                className="tnum flex shrink-0 items-center gap-1.5 rounded-full bg-fill py-1.5 pe-1.5 ps-3 text-[14px] text-ink-2"
              >
                <span className="text-ink-3">{labels.get(x.id)}</span>
                {cardio
                  ? fmtCardio(x, distUnit) || "—"
                  : x.weight !== null || x.reps !== null
                    ? `${fmtNum(x.weight) || "–"} × ${x.reps ?? "–"}`
                    : "—"}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${x.completed ? "bg-accent text-white" : "border-[1.5px] border-ink-3/60"}`}
                >
                  {x.completed && <Icon name="check" size={12} stroke={3} />}
                </span>
              </span>
            ))}
          </button>
        )
      )}

      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title={exName(exercise)}
      >
        <div className="space-y-2 pb-3">
          <SheetAction
            icon="up"
            onClick={() => {
              moveExercise(weId, -1);
              setMenu(false);
            }}
          >
            {t("Move up")}
            {index === 0 ? ` ${t("(already first)")}` : ""}
          </SheetAction>
          <SheetAction
            icon="down"
            onClick={() => {
              moveExercise(weId, 1);
              setMenu(false);
            }}
          >
            {t("Move down")}
            {index === count - 1 ? ` ${t("(already last)")}` : ""}
          </SheetAction>
          <SheetAction
            icon="edit"
            onClick={() => {
              setMenu(false);
              setReplacing(true);
            }}
          >
            {t("Edit exercise")}
          </SheetAction>
          <SheetAction
            icon="swap"
            onClick={() => {
              setMenu(false);
              setMachineOpen(true);
            }}
          >
            {t("Different machine")}
          </SheetAction>
          <SheetAction
            icon="clock"
            onClick={() => {
              setMenu(false);
              setRestOpen(true);
            }}
          >
            {t("Rest time")}
          </SheetAction>
          <Link
            href={`/exercise?id=${exercise.id}`}
            className="press flex min-h-[56px] items-center gap-3.5 rounded-[16px] bg-card px-4 text-[17px]"
          >
            <Icon name="chart" size={21} className="text-ink-2" />{" "}
            {t("History")}
          </Link>
          <SheetAction
            icon="trash"
            danger
            onClick={() => {
              removeExercise(weId);
              setMenu(false);
              toast({
                title: t("Removed {name}", { name: exName(exercise) }),
                icon: "trash",
              });
            }}
          >
            {t("Remove from workout")}
          </SheetAction>
        </div>
      </Sheet>

      <EditExerciseSheet
        open={replacing}
        onClose={() => setReplacing(false)}
        target={{ table: "workout_exercises", id: weId }}
        exerciseId={exercise.id}
        where="workout"
      />

      <SetSheet setId={setSheet} onClose={() => setSetSheet(null)} />
      <MachineSheet
        open={machineOpen}
        onClose={() => setMachineOpen(false)}
        weId={weId}
        exercise={exercise}
      />
      <RestSheet
        open={restOpen}
        onClose={() => setRestOpen(false)}
        exerciseId={exercise.id}
        current={ownRest}
      />
    </article>
  );
});

/** The coach's cue for this exercise: one quiet line, tap to read it all. */
function CoachNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      dir="auto"
      className="mb-2 flex w-full items-start gap-2 rounded-[12px] px-1 text-start text-[13px] leading-snug text-ink-2"
    >
      <Icon name="note" size={14} className="mt-[2px] shrink-0 text-ink-3" />
      <span className={open ? "" : "line-clamp-1"}>{text}</span>
    </button>
  );
}

/* ───────────────────────────── set row ───────────────────────────── */

function NumberCell({
  value,
  onCommit,
  placeholder,
  decimal,
  label,
  done,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder: string;
  decimal?: boolean;
  label: string;
  done: boolean;
}) {
  const [text, setText] = useState(fmtNum(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmtNum(value));
  }, [value]);

  return (
    <input
      aria-label={label}
      inputMode={decimal ? "decimal" : "numeric"}
      enterKeyHint="next"
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true;
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,]/g, "");
        setText(v);
        const n = parseNum(v);
        if (v === "" || n !== null)
          onCommit(n === null ? null : decimal ? n : Math.round(n));
      }}
      onBlur={() => {
        focused.current = false;
        setText(fmtNum(value));
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const inputs = [
          ...document.querySelectorAll<HTMLInputElement>("input[data-cell]"),
        ];
        const i = inputs.indexOf(e.currentTarget);
        if (inputs[i + 1]) inputs[i + 1].focus();
        else e.currentTarget.blur();
      }}
      data-cell
      className={`tnum h-12 w-full min-w-0 rounded-[12px] bg-transparent text-center text-[19px] outline-none transition-colors placeholder:text-ink-3/70 focus:bg-card focus:shadow-[0_0_0_2px_var(--accent)] ${
        done ? "font-semibold text-ink" : "text-ink"
      }`}
    />
  );
}

const SetRow = memo(function SetRow({
  set,
  label,
  weightHint,
  repHint,
  onToggle,
  onMenu,
  onDelete,
}: {
  set: WorkoutSet;
  label: string;
  weightHint: number | null;
  repHint: string | null;
  onToggle: () => void;
  onMenu: () => void;
  onDelete: () => void;
}) {
  return (
    <li>
      <SwipeRow radius={16} onDelete={onDelete}>
        {/* Opaque backgrounds: the red Delete sits behind the row while swiping. */}
        <div
          className={`rounded-[16px] transition-colors duration-200 ${set.completed ? "bg-[#eef5fe]" : "bg-fill"} ${set.is_warmup ? "opacity-70" : ""}`}
        >
          <div className="grid grid-cols-[48px_1fr_1fr_56px] items-center">
            <button
              type="button"
              onClick={onMenu}
              aria-label={tr("Set {n} options", { n: set.set_number })}
              className={`press tnum flex h-12 items-center justify-center rounded-[12px] text-[17px] ${set.is_warmup ? "font-semibold text-gold" : "text-ink-2"}`}
            >
              {label}
            </button>
            <NumberCell
              label={tr("Set {n} weight", { n: set.set_number })}
              value={set.weight}
              decimal
              done={set.completed}
              placeholder={weightHint !== null ? fmtNum(weightHint) : "–"}
              onCommit={(v) => updateSet(set.id, { weight: v })}
            />
            <NumberCell
              label={tr("Set {n} reps", { n: set.set_number })}
              value={set.reps}
              done={set.completed}
              placeholder={repHint ?? "–"}
              onCommit={(v) => updateSet(set.id, { reps: v })}
            />
            <div className="flex items-center justify-center">
              <button
                type="button"
                role="checkbox"
                aria-checked={set.completed}
                aria-label={tr("Set {n} done", { n: set.set_number })}
                onClick={onToggle}
                className="press flex h-12 w-12 items-center justify-center"
              >
                <span
                  key={String(set.completed)}
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-full ${
                    set.completed
                      ? "pop bg-accent text-white"
                      : "border-2 border-ink-3/50 bg-card"
                  }`}
                >
                  {set.completed && (
                    <Icon name="check" size={17} stroke={2.8} />
                  )}
                </span>
              </button>
            </div>
          </div>
          {set.note && (
            <button
              type="button"
              onClick={onMenu}
              dir="auto"
              className="flex w-full items-start gap-2 px-4 pb-2.5 text-start text-[14px] text-ink-2"
            >
              <Icon
                name="note"
                size={16}
                className="mt-0.5 shrink-0 text-ink-3"
              />
              <span className="line-clamp-2" dir="auto">
                {set.note}
              </span>
            </button>
          )}
        </div>
      </SwipeRow>
    </li>
  );
});

/* ───────────────────────────── rest per exercise ───────────────────────────── */

const fmtRest = (sec: number) =>
  sec < 120
    ? tr("{n}s", { n: sec })
    : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const REST_CHOICES = [60, 90, 120, 150, 180, 240, 300];

/** One tap to set how long you rest between sets of this exercise, remembered for next time. */
function RestSheet({
  open,
  onClose,
  exerciseId,
  current,
}: {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  current: number | undefined;
}) {
  const t = useT();
  const fallback = useStore((s) => s.profile?.default_rest_seconds ?? 90);
  const pick = (v: number | null) => {
    setExerciseRest(exerciseId, v);
    haptic(10);
    onClose();
  };
  const pill = (active: boolean) =>
    `press min-h-[48px] rounded-[14px] px-3 text-[16px] font-medium ${active ? "bg-accent text-white" : "bg-card text-ink"}`;
  return (
    <Sheet open={open} onClose={onClose} title={t("Rest time")}>
      <div className="pb-3">
        <p className="mb-3 px-1 text-[15px] text-ink-2">
          {t("Saved for this exercise in every workout.")}
        </p>
        <div className="grid grid-cols-4 gap-2" dir="ltr">
          {REST_CHOICES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => pick(v)}
              className={`${pill(current === v)} tnum`}
            >
              {fmtRest(v)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => pick(0)}
            className={pill(current === 0)}
          >
            {t("Off")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => pick(null)}
          className={`mt-2 w-full ${pill(current === undefined)}`}
        >
          {t("Default ({time})", { time: fmtRest(fallback) })}
        </button>
      </div>
    </Sheet>
  );
}

/* ───────────────────────────── set options ───────────────────────────── */

function SetSheet({
  setId,
  onClose,
}: {
  setId: string | null;
  onClose: () => void;
}) {
  const set = useStore((s) => (setId ? s.sets[setId] : undefined), [setId]);
  const [note, setNote] = useState("");
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (set && lastId.current !== set.id) {
      lastId.current = set.id;
      setNote(set.note ?? "");
    }
    if (!setId) lastId.current = null;
  }, [set, setId]);
  const t = useT();

  return (
    <Sheet
      open={!!setId && !!set}
      onClose={onClose}
      title={
        set
          ? set.is_warmup
            ? t("Warm-up set")
            : t("Set {n}", { n: set.set_number })
          : ""
      }
    >
      {set && (
        <div className="space-y-2 pb-3">
          <label className="block rounded-[16px] bg-card p-4">
            <span className="mb-1 flex items-center gap-2 text-[14px] text-ink-2">
              <Icon name="note" size={16} /> {t("Note")}
            </span>
            <textarea
              value={note}
              rows={2}
              placeholder={t("e.g. Slight discomfort in left shoulder")}
              dir="auto"
              onChange={(e) => {
                setNote(e.target.value);
                updateSet(set.id, {
                  note: e.target.value.trim() ? e.target.value : null,
                });
              }}
              className="w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-ink-3"
            />
          </label>
          <SheetAction
            icon="bolt"
            onClick={() => {
              toggleWarmup(set.id);
              onClose();
            }}
          >
            {set.is_warmup ? t("Make it a working set") : t("Warm-up set")}
          </SheetAction>
          <SheetAction
            icon="copy"
            onClick={() => {
              duplicateSet(set.id);
              onClose();
            }}
          >
            {t("Duplicate set")}
          </SheetAction>
          <SheetAction
            icon="trash"
            danger
            onClick={() => {
              const removed = deleteSet(set.id);
              onClose();
              if (removed)
                toast({
                  title: t("Set {n} deleted", { n: removed.set_number }),
                  icon: "trash",
                  action: { label: t("Undo"), run: () => restoreSet(removed) },
                });
            }}
          >
            {t("Delete set")}
          </SheetAction>
        </div>
      )}
    </Sheet>
  );
}
