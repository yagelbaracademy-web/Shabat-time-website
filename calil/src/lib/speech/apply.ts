"use client";

import { addExercise, addSet, addWarmupSet, completeSet, createExercise, findExerciseByName, restFor, skipRest, startRest } from "../actions";
import { fmtCardio, fmtNum } from "../format";
import { exName, tr } from "../i18n";
import { getState, putRows, removeRows } from "../store";
import { aliasesOf, setsOf, workoutExercises, type PRKind } from "../stats";
import type { Exercise, WorkoutExercise, WorkoutSet } from "../types";
import { workoutParser } from "./parser";
import { interpreter, type DictationContext, type DictationOp, type DictationSet, type Interpretation } from "./provider";

export interface ApplyResult {
  ok: boolean;
  transcript: string;
  summary: string;
  pr?: PRKind | null;
  undo?: () => void;
}

/* ───────────────────────────── understanding ───────────────────────────── */

function buildContext(workoutId: string, focusWeId: string | null): DictationContext {
  const s = getState();
  return {
    library: Object.values(s.exercises).map((e) => e.name),
    aliases: Object.fromEntries(Object.values(s.exercises).flatMap((e) => aliasesOf(s, e.id).map((a) => [a, e.name]))),
    unit: s.profile?.weight_unit ?? "kg",
    workout: workoutExercises(s, workoutId).map((we) => ({
      exercise: s.exercises[we.exercise_id]?.name ?? "",
      focused: we.id === focusWeId,
      sets: setsOf(s, we.id).map((x) => ({ n: x.set_number, weight: x.weight, reps: x.reps, done: x.completed })),
    })),
  };
}

/** Offline fallback: the local rule parser, mapped onto the same operation shape. */
async function localInterpret(text: string, workoutId: string): Promise<Interpretation> {
  const s = getState();
  const p = await workoutParser.parse(text, {
    exercises: Object.values(s.exercises).map((e) => ({ id: e.id, name: e.name })),
    inWorkout: new Set(workoutExercises(s, workoutId).map((we) => we.exercise_id)),
  });
  const hasNumbers = p.weight !== null || p.reps !== null;
  if (!hasNumbers && !p.note && !p.exerciseId) return { transcript: text, operations: [] };
  return {
    transcript: text,
    operations: [
      {
        exercise: p.exerciseId ? s.exercises[p.exerciseId]?.name ?? "" : "",
        is_new_exercise: false,
        muscle_group: null,
        mode: hasNumbers ? "log" : "note",
        sets: hasNumbers ? [{ set_number: p.setNumber, weight: p.weight, reps: p.reps }] : [],
        note: p.note,
      },
    ],
  };
}

/** Understands audio or text without changing anything yet (the user reviews it first). */
export async function interpret(input: { audio: Blob } | { text: string }, workoutId: string, focusWeId: string | null): Promise<Interpretation> {
  try {
    return await interpreter.interpret(input, buildContext(workoutId, focusWeId));
  } catch (e) {
    if ("text" in input) return localInterpret(input.text, workoutId);
    throw e;
  }
}

/** Audio or text in, changes applied to the workout out. */
export async function dictate(input: { audio: Blob } | { text: string }, workoutId: string, focusWeId: string | null): Promise<ApplyResult> {
  let interp: Interpretation;
  try {
    interp = await interpreter.interpret(input, buildContext(workoutId, focusWeId));
  } catch (e) {
    if ("text" in input) interp = await localInterpret(input.text, workoutId);
    else throw e;
  }
  return applyInterpretation(interp, workoutId, focusWeId);
}

/* ───────────────────────────── applying ───────────────────────────── */

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9א-ת]+/g, " ").trim();

function findExercise(name: string): Exercise | null {
  const byName = findExerciseByName(name);
  if (byName) return byName;
  const all = Object.values(getState().exercises);
  const n = norm(name);
  return (
    all.find((e) => norm(e.name) === n) ??
    all.find((e) => norm(e.name).replace(/s\b/g, "") === n.replace(/s\b/g, "")) ??
    null
  );
}

function resolveWe(op: DictationOp, workoutId: string, focusWeId: string | null): WorkoutExercise | null {
  const s = getState();
  const wes = workoutExercises(s, workoutId);
  if (!op.exercise) {
    if (focusWeId && s.workout_exercises[focusWeId]) return s.workout_exercises[focusWeId];
    return wes.find((we) => setsOf(s, we.id).some((x) => !x.completed)) ?? wes[wes.length - 1] ?? null;
  }
  let ex = findExercise(op.exercise);
  if (!ex && op.exercise.length > 1) {
    // Create first, then read the store: indexing getState() with the call inline reads the old snapshot.
    const id = createExercise(op.exercise, op.muscle_group, null);
    ex = getState().exercises[id] ?? null;
  }
  if (!ex) return null;
  const existing = [...wes].reverse().find((we) => we.exercise_id === ex.id);
  if (existing) return existing;
  // New in this workout: start empty when we were told the sets, otherwise prefill from last time.
  const weId = addExercise(workoutId, ex.id, undefined, { prefill: op.sets.length === 0 });
  return getState().workout_exercises[weId];
}

/** Adds a set and returns it (read the store *after* adding). */
function newSet(weId: string): WorkoutSet {
  const id = addSet(weId);
  return getState().sets[id];
}

function setAt(weId: string, n: number): WorkoutSet {
  let sets = setsOf(getState(), weId);
  while (sets.length < n) {
    addSet(weId);
    sets = setsOf(getState(), weId);
  }
  return sets[n - 1];
}

function write(x: WorkoutSet, weight: number | null, reps: number | null, cardio?: DictationSet): WorkoutSet {
  const next = { ...getState().sets[x.id] };
  if (weight !== null) next.weight = weight;
  if (reps !== null) next.reps = reps;
  if (cardio?.minutes) next.duration_seconds = Math.round(cardio.minutes * 60);
  if (cardio?.distance) next.distance = cardio.distance;
  putRows("sets", [next]);
  return next;
}

const fmtSet = (w: number | null, r: number | null) => `${w !== null ? fmtNum(w) : "–"} × ${r ?? "–"}`;
const distUnit = () => tr(getState().profile?.weight_unit === "lb" ? "mi" : "km");
/** One set for the summary line: time and distance for cardio, weight × reps otherwise. */
const fmtAny = (x: { weight: number | null; reps: number | null; duration_seconds?: number | null; distance?: number | null }) =>
  x.duration_seconds || x.distance ? fmtCardio(x, distUnit()) : fmtSet(x.weight, x.reps);

export function applyInterpretation(interp: Interpretation, workoutId: string, focusWeId: string | null): ApplyResult {
  const transcript = interp.transcript;
  if (!interp.operations.length) return { ok: false, transcript, summary: tr("Didn’t find workout data in that.") };

  const s0 = getState();
  const wes0 = workoutExercises(s0, workoutId);
  const beforeWe = new Map(wes0.map((we) => [we.id, we]));
  const beforeSets = new Map(wes0.flatMap((we) => setsOf(s0, we.id)).map((x) => [x.id, x]));
  const exercisesBefore = new Set(Object.keys(s0.exercises));

  const lines: string[] = [];
  let pr: PRKind | null = null;
  let restWe: string | null = null;

  for (const op of interp.operations) {
    const we = resolveWe(op, workoutId, focusWeId);
    if (!we) continue;
    const name = exName(getState().exercises[we.exercise_id]);
    const touched: WorkoutSet[] = [];

    if (op.mode === "plan" && op.sets.length) {
      // Warm-ups are added as warm-up sets; the rest fill the open working sets.
      for (const p of op.sets.filter((x) => x.warmup)) {
        const id = addWarmupSet(we.id, p.weight, p.reps); // add first, then read the store
        touched.push(getState().sets[id]);
      }
      const workingPlan = op.sets.filter((x) => !x.warmup);
      const open = setsOf(getState(), we.id).filter((x) => !x.completed && !x.is_warmup);
      workingPlan.forEach((p, i) => {
        const target = open[i] ?? newSet(we.id);
        touched.push(write(target, p.weight, p.reps, p));
      });
      // The user said how many sets they want: drop extra un-done ones.
      if (workingPlan.length) removeRows("sets", open.slice(workingPlan.length).map((x) => x.id));
      const left = setsOf(getState(), we.id);
      putRows("sets", left.map((x, i) => ({ ...x, set_number: i + 1 })).filter((x, i) => x.set_number !== left[i].set_number));
      const same = op.sets.every((p) => p.weight === op.sets[0].weight && p.reps === op.sets[0].reps && !p.minutes && !p.distance);
      lines.push(
        same
          ? `${name} · ${tr("{n} sets of {set}", { n: op.sets.length, set: fmtSet(op.sets[0].weight, op.sets[0].reps) })}`
          : `${name} · ${touched.map(fmtAny).join(", ")}`,
      );
    } else if (op.mode === "log" && op.sets.length) {
      for (const p of op.sets) {
        if (p.warmup) {
          const id = addWarmupSet(we.id, p.weight, p.reps); // add first, then read the store
          completeSet(id);
          touched.push(getState().sets[id]);
          continue;
        }
        const target =
          p.set_number !== null
            ? setAt(we.id, p.set_number)
            : setsOf(getState(), we.id).find((x) => !x.completed && !x.is_warmup) ?? newSet(we.id);
        const done = write(target, p.weight, p.reps, p);
        if (done.reps !== null || done.weight !== null || done.duration_seconds || done.distance) {
          pr = completeSet(done.id).pr || pr;
          if (!done.duration_seconds && !done.distance) restWe = we.id; // no rest timer after cardio
        }
        touched.push(getState().sets[done.id]);
      }
      lines.push(`${name} · ${touched.map((x) => `${tr("Set {n}", { n: x.set_number })} ${fmtAny(x)}`).join(", ")}`);
    }

    if (op.note) {
      const sets = setsOf(getState(), we.id);
      const target = touched[touched.length - 1] ?? [...sets].reverse().find((x) => x.completed) ?? sets[0] ?? newSet(we.id);
      const cur = getState().sets[target.id];
      putRows("sets", [{ ...cur, note: cur.note ? `${cur.note} · ${op.note}` : op.note }]);
      lines.push(`${op.mode === "note" ? `${name} · ` : ""}“${op.note}”`);
    }
  }

  if (!lines.length) return { ok: false, transcript, summary: tr("Didn’t find workout data in that.") };
  if (restWe) startRest(restFor(restWe));

  const undo = () => {
    const now = getState();
    const nowWes = workoutExercises(now, workoutId);
    const nowSets = nowWes.flatMap((we) => setsOf(now, we.id));
    removeRows("sets", nowSets.filter((x) => !beforeSets.has(x.id)).map((x) => x.id));
    removeRows("workout_exercises", nowWes.filter((we) => !beforeWe.has(we.id)).map((we) => we.id));
    putRows(
      "workout_exercises",
      [...beforeWe.values()].filter((we) => JSON.stringify(we) !== JSON.stringify(now.workout_exercises[we.id])),
    );
    putRows("sets", [...beforeSets.values()].filter((x) => JSON.stringify(x) !== JSON.stringify(now.sets[x.id])));
    removeRows("exercises", Object.keys(getState().exercises).filter((id) => !exercisesBefore.has(id)));
    if (restWe) skipRest();
  };

  return { ok: true, transcript, summary: lines.join("\n"), pr, undo };
}
