"use client";

import { getState, patchRow, putRows, removeRows, saveProfile, setState } from "./store";
import { activeWorkout, aliasesOf, isCardio, byPosition, completedWorkouts, prKindOf, type PRKind, lastSession, setsOf, sortedTemplates, workoutExercises } from "./stats";
import { nowIso, uid } from "./format";
import { tr } from "./i18n";
import type { StarterPlan } from "./starters";
import type { Equipment, TemplateExercise, Workout, WorkoutSet, WorkoutTemplate } from "./types";
import { track } from "./track";

/* Every function here is synchronous and optimistic: it updates the local
 * store and the sync outbox takes care of the server. */

const me = () => {
  const id = getState().userId;
  if (!id) throw new Error("Not signed in");
  return id;
};

/* ───────────────────────────── workouts ───────────────────────────── */

function createWorkout(name: string, templateId: string | null = null) {
  const id = uid();
  putRows("workouts", [
    {
      id,
      user_id: me(),
      template_id: templateId,
      name,
      started_at: nowIso(),
      completed_at: null,
      duration_seconds: null,
      overall_note: null,
    },
  ]);
  return id;
}

export function startEmptyWorkout() {
  const h = new Date().getHours();
  return createWorkout(tr(h < 12 ? "Morning workout" : h < 17 ? "Afternoon workout" : "Evening workout"));
}

export function startFromTemplate(templateId: string) {
  const s = getState();
  const t = s.workout_templates[templateId];
  if (!t) return startEmptyWorkout();
  const id = createWorkout(t.name, t.id);
  Object.values(s.template_exercises)
    .filter((te) => te.template_id === templateId)
    .sort(byPosition)
    .forEach((te) => addExercise(id, te.exercise_id, te));
  return id;
}

export function duplicateWorkout(sourceId: string) {
  const s = getState();
  const src = s.workouts[sourceId];
  if (!src) return startEmptyWorkout();
  const id = createWorkout(src.name, src.template_id);
  workoutExercises(s, sourceId).forEach((we, i) => {
    const weId = uid();
    putRows("workout_exercises", [{ id: weId, workout_id: id, exercise_id: we.exercise_id, position: i }]);
    const srcSets = setsOf(s, we.id).filter((x) => x.completed || x.reps !== null);
    putRows(
      "sets",
      srcSets.map((x, j) => blankSet(weId, j + 1, x.weight, x.reps, !!x.is_warmup)),
    );
  });
  return id;
}

export type Suggestion =
  | { kind: "plan"; template: WorkoutTemplate; name: string; habitDay: number | null; scheduled?: boolean }
  | { kind: "repeat"; workout: Workout; name: string; habitDay: number };

const habitKey = (w: Workout) => w.template_id ?? `name:${w.name.trim().toLowerCase()}`;

/**
 * What to suggest next.
 * 1. Your habit: the workout you do on this weekday. One week is enough as long
 *    as the history doesn't disagree (it must be ≥60% of this weekday's workouts
 *    over the last 8 weeks). Works for plans and for free workouts (repeat it).
 * 2. Otherwise rotate plans: the one after the plan used most recently.
 * Anything already done today is skipped, so a second session moves on.
 */
export function nextPlan(now = new Date()): Suggestion | null {
  const s = getState();
  const templates = sortedTemplates(s);
  const done = completedWorkouts(s).filter((w) => !w.template_id || s.workout_templates[w.template_id]);
  const today = now.toDateString();
  const doneToday = new Set(done.filter((w) => new Date(w.started_at).toDateString() === today).map(habitKey));

  // A plan the user pinned to this weekday comes first.
  const pinned = templates.find((t) => t.weekdays?.includes(now.getDay()) && !doneToday.has(t.id));
  if (pinned) return { kind: "plan", template: pinned, name: pinned.name, habitDay: null, scheduled: true };

  const since = now.getTime() - 56 * 86400000;
  const groups = new Map<string, { n: number; latest: Workout }>();
  let sameDay = 0;
  for (const w of done) {
    const d = new Date(w.started_at);
    if (d.getTime() < since || d.getDay() !== now.getDay() || d.toDateString() === today) continue;
    sameDay++;
    const g = groups.get(habitKey(w));
    if (g) g.n++;
    else groups.set(habitKey(w), { n: 1, latest: w }); // done is newest first
  }
  const top = [...groups.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  if (top && top[1].n / sameDay >= 0.6 && !doneToday.has(top[0])) {
    const w = top[1].latest;
    if (w.template_id) {
      const t = s.workout_templates[w.template_id];
      return { kind: "plan", template: t, name: t.name, habitDay: now.getDay() };
    }
    return { kind: "repeat", workout: w, name: w.name, habitDay: now.getDay() };
  }

  if (!templates.length) return null;
  const last = done.find((w) => w.template_id);
  const start = last ? templates.findIndex((t) => t.id === last.template_id) + 1 : 0;
  for (let k = 0; k < templates.length; k++) {
    const t = templates[(start + k) % templates.length];
    if (!doneToday.has(t.id)) return { kind: "plan", template: t, name: t.name, habitDay: null };
  }
  const t = templates[start % templates.length];
  return { kind: "plan", template: t, name: t.name, habitDay: null };
}

/** Kept for callers that only need the plan. */
export function nextTemplate() {
  const n = nextPlan();
  return n?.kind === "plan" ? n.template : null;
}

export function lastCompletedWorkout() {
  return completedWorkouts(getState())[0] ?? null;
}

export function renameWorkout(id: string, name: string) {
  patchRow("workouts", id, { name: name.trim() || "Workout" });
}

export function setWorkoutNote(id: string, note: string) {
  patchRow("workouts", id, { overall_note: note.trim() || null });
}

/**
 * Ends a workout. `incomplete` decides what happens to sets not marked done:
 * "discard" removes them, "complete" marks them done.
 */
export function finishWorkout(id: string, incomplete: "discard" | "complete" = "discard") {
  const s = getState();
  const w = s.workouts[id];
  if (!w) return;
  for (const we of workoutExercises(s, id)) {
    const sets = setsOf(s, we.id);
    const open = sets.filter((x) => !x.completed);
    if (incomplete === "complete") {
      putRows(
        "sets",
        open.filter((x) => x.reps !== null).map((x) => ({ ...x, completed: true, completed_at: nowIso() })),
      );
      removeRows("sets", open.filter((x) => x.reps === null).map((x) => x.id));
    } else removeRows("sets", open.map((x) => x.id));
    const left = setsOf(getState(), we.id);
    if (!left.length) removeRows("workout_exercises", [we.id]);
    else renumber(we.id);
  }
  const end = new Date();
  patchRow("workouts", id, {
    completed_at: end.toISOString(),
    duration_seconds: Math.round((end.getTime() - new Date(w.started_at).getTime()) / 1000),
  });
  setState({ rest: null });
}

export function deleteWorkout(id: string) {
  const s = getState();
  const wes = workoutExercises(s, id);
  removeRows(
    "sets",
    wes.flatMap((we) => setsOf(s, we.id).map((x) => x.id)),
    { sync: false },
  );
  removeRows("workout_exercises", wes.map((we) => we.id), { sync: false });
  removeRows("workouts", [id]); // cascades server-side
  if (activeWorkout(getState()) === null) setState({ rest: null });
}

/* ───────────────────────────── exercises in a workout ───────────────────────────── */

function blankSet(weId: string, n: number, weight: number | null = null, reps: number | null = null, warmup = false): WorkoutSet {
  return {
    id: uid(),
    workout_exercise_id: weId,
    set_number: n,
    weight,
    reps,
    completed: false,
    is_warmup: warmup,
    note: null,
    completed_at: null,
  };
}

/** Adds an exercise pre-filled with what you did last time, so you only change what's different. */
export function addExercise(workoutId: string, exerciseId: string, plan?: TemplateExercise, { prefill = true } = {}) {
  const s = getState();
  const existing = workoutExercises(s, workoutId);
  const weId = uid();
  putRows("workout_exercises", [
    {
      id: weId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      position: existing.length ? existing[existing.length - 1].position + 1 : 0,
    },
  ]);
  const last = lastSession(s, exerciseId, workoutId);
  const done = last?.sets.filter((x) => x.completed) ?? [];
  const lastWarm = prefill ? done.filter((x) => x.is_warmup) : [];
  const lastWork = done.filter((x) => !x.is_warmup);
  const cardio = isCardio(s.exercises[exerciseId]);
  // Cardio starts with one empty round: the time is measured, not copied.
  const count = cardio ? 1 : prefill ? plan?.target_sets ?? (lastWork.length || 3) : 0;
  if (cardio) {
    putRows("sets", Array.from({ length: count }, (_, i) => blankSet(weId, i + 1)));
    return weId;
  }
  // Same shape as last time: its warm-ups first, then the working sets.
  const sets: WorkoutSet[] = lastWarm.map((x, i) => blankSet(weId, i + 1, x.weight, x.reps, true));
  for (let i = 0; i < count; i++) {
    const ref = lastWork[i] ?? lastWork[lastWork.length - 1];
    sets.push(blankSet(weId, sets.length + 1, ref?.weight ?? null, ref?.reps ?? null));
  }
  putRows("sets", sets);
  return weId;
}

export function removeExercise(weId: string) {
  const s = getState();
  const we = s.workout_exercises[weId];
  if (!we) return;
  removeRows("sets", setsOf(s, weId).map((x) => x.id), { sync: false });
  removeRows("workout_exercises", [weId]);
}

export function moveExercise(weId: string, dir: -1 | 1) {
  const s = getState();
  const we = s.workout_exercises[weId];
  if (!we) return;
  const list = workoutExercises(s, we.workout_id);
  const i = list.findIndex((x) => x.id === weId);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  putRows(
    "workout_exercises",
    list.map((x, k) => ({ ...x, position: k })).filter((x) => x.position !== s.workout_exercises[x.id].position),
  );
}

/* ───────────────────────────── fixing exercise identity ───────────────────────────── */

/** Where an exercise is used, so the UI can offer "change everywhere". */
export function exerciseUsage(exerciseId: string) {
  const s = getState();
  const workouts = new Set(
    Object.values(s.workout_exercises).filter((we) => we.exercise_id === exerciseId).map((we) => we.workout_id),
  );
  const plans = new Set(
    Object.values(s.template_exercises).filter((te) => te.exercise_id === exerciseId).map((te) => te.template_id),
  );
  return { workouts: workouts.size, plans: plans.size };
}

/** Removes one of the user's own exercises once nothing points to it any more. */
export function dropIfUnused(exerciseId: string) {
  const s = getState();
  const e = s.exercises[exerciseId];
  if (!e?.user_id) return;
  const { workouts, plans } = exerciseUsage(exerciseId);
  if (workouts || plans) return;
  removeRows("exercise_aliases", Object.values(s.exercise_aliases).filter((a) => a.exercise_id === exerciseId).map((a) => a.id), { sync: false });
  removeRows("exercises", [exerciseId]); // server cascades its alias rows
}

/**
 * "This is actually <newId>". Points one row (or every row) at another exercise,
 * moves the user's names for the old one over, and cleans up the old one if unused.
 */
export function changeExercise(
  target: { table: "workout_exercises" | "template_exercises"; id: string },
  newId: string,
  everywhere: boolean,
) {
  const s = getState();
  const row = s[target.table][target.id];
  if (!row || row.exercise_id === newId) return;
  const oldId = row.exercise_id;
  const names = aliasesOf(s, oldId);
  if (everywhere) {
    putRows(
      "workout_exercises",
      Object.values(s.workout_exercises).filter((we) => we.exercise_id === oldId).map((we) => ({ ...we, exercise_id: newId })),
    );
    putRows(
      "template_exercises",
      Object.values(s.template_exercises).filter((te) => te.exercise_id === oldId).map((te) => ({ ...te, exercise_id: newId })),
    );
  } else if (target.table === "workout_exercises") {
    patchRow("workout_exercises", target.id, { exercise_id: newId });
  } else {
    patchRow("template_exercises", target.id, { exercise_id: newId });
  }
  const stillUsed = exerciseUsage(oldId);
  if (everywhere || (!stillUsed.workouts && !stillUsed.plans)) names.forEach((n) => addAlias(newId, n));
  dropIfUnused(oldId);
}

export function replaceExercise(weId: string, exerciseId: string) {
  changeExercise({ table: "workout_exercises", id: weId }, exerciseId, false);
}

/** Only the user's own exercises can be renamed; built-ins are shared. */
export function renameExercise(exerciseId: string, name: string) {
  const e = getState().exercises[exerciseId];
  const n = name.trim();
  if (!e?.user_id || !n || n === e.name) return;
  patchRow("exercises", exerciseId, { name: n });
}

/* ───────────────────────────── sets ───────────────────────────── */

function renumber(weId: string) {
  const sets = setsOf(getState(), weId);
  const changed = sets.map((x, i) => ({ ...x, set_number: i + 1 })).filter((x, i) => x.set_number !== sets[i].set_number);
  putRows("sets", changed);
}

export function addSet(weId: string) {
  const sets = setsOf(getState(), weId);
  const ref = [...sets].reverse().find((x) => !x.is_warmup) ?? sets[sets.length - 1];
  const x = blankSet(weId, (sets[sets.length - 1]?.set_number ?? 0) + 1, ref?.weight ?? null, ref?.reps ?? null);
  putRows("sets", [x]);
  return x.id;
}

/** Keeps warm-ups at the top of an exercise and renumbers everything in order. */
function orderWarmupsFirst(weId: string) {
  const sets = setsOf(getState(), weId);
  const ordered = [...sets.filter((x) => x.is_warmup), ...sets.filter((x) => !x.is_warmup)];
  const changed = ordered.filter((x, i) => x.set_number !== i + 1).map((x) => ({ ...x, set_number: ordered.indexOf(x) + 1 }));
  putRows("sets", changed);
}

/** Marks a set as a warm-up (or back to a working set). */
export function toggleWarmup(setId: string) {
  const x = getState().sets[setId];
  if (!x) return;
  patchRow("sets", setId, { is_warmup: !x.is_warmup });
  if (!x.is_warmup) track("warmup_set");
  orderWarmupsFirst(x.workout_exercise_id);
}

/** Adds a warm-up set right after the existing warm-ups. */
export function addWarmupSet(weId: string, weight: number | null, reps: number | null) {
  const sets = setsOf(getState(), weId);
  const x = blankSet(weId, sets.length + 1, weight, reps, true);
  putRows("sets", [x]);
  track("warmup_set");
  orderWarmupsFirst(weId);
  return x.id;
}

export function duplicateSet(setId: string) {
  const s = getState();
  const src = s.sets[setId];
  if (!src) return;
  const sets = setsOf(s, src.workout_exercise_id);
  const shifted = sets
    .filter((x) => x.set_number > src.set_number)
    .map((x) => ({ ...x, set_number: x.set_number + 1 }));
  putRows("sets", [...shifted, blankSet(src.workout_exercise_id, src.set_number + 1, src.weight, src.reps, !!src.is_warmup)]);
}

export function deleteSet(setId: string) {
  const x = getState().sets[setId];
  if (!x) return null;
  removeRows("sets", [setId]);
  renumber(x.workout_exercise_id);
  return x;
}

export function restoreSet(x: WorkoutSet) {
  const sets = setsOf(getState(), x.workout_exercise_id);
  const shifted = sets.filter((y) => y.set_number >= x.set_number).map((y) => ({ ...y, set_number: y.set_number + 1 }));
  putRows("sets", [...shifted, x]);
}

export function updateSet(setId: string, patch: Partial<Pick<WorkoutSet, "weight" | "reps" | "note">>) {
  patchRow("sets", setId, patch);
}

/** Toggles completion. Returns whether the set is now done and the record it makes, if any. */
export function toggleSet(setId: string): { done: boolean; pr: PRKind | null } {
  const s = getState();
  const x = s.sets[setId];
  if (!x) return { done: false, pr: null };
  const done = !x.completed;
  patchRow("sets", setId, { completed: done, completed_at: done ? nowIso() : null });
  const pr = done ? prOf(setId) : null;
  if (pr) track("pr");
  return { done, pr };
}

export function completeSet(setId: string): { done: boolean; pr: PRKind | null } {
  const x = getState().sets[setId];
  if (!x || x.completed) return { done: true, pr: null };
  return toggleSet(setId);
}

export function prOf(setId: string) {
  const s = getState();
  const x = s.sets[setId];
  return x ? prKindOf(s, x) : null;
}

/** Saves a cardio round's time and/or distance. */
export function setCardio(setId: string, patch: { duration_seconds?: number | null; distance?: number | null }) {
  if (!getState().sets[setId]) return;
  patchRow("sets", setId, patch);
}

/* ───────────────────────────── rest timer ───────────────────────────── */

export function startRest(seconds: number) {
  if (seconds <= 0) return;
  setState({ rest: { endsAt: Date.now() + seconds * 1000, pausedLeft: null, total: seconds } });
}
export function pauseRest() {
  const r = getState().rest;
  if (!r?.endsAt) return;
  setState({ rest: { ...r, endsAt: null, pausedLeft: Math.max(0, r.endsAt - Date.now()) } });
}
export function resumeRest() {
  const r = getState().rest;
  if (!r || r.pausedLeft === null) return;
  setState({ rest: { ...r, endsAt: Date.now() + r.pausedLeft, pausedLeft: null } });
}
export function addRest(seconds: number) {
  const r = getState().rest;
  if (!r) return;
  setState({
    rest: {
      ...r,
      total: r.total + seconds,
      endsAt: r.endsAt ? r.endsAt + seconds * 1000 : null,
      pausedLeft: r.pausedLeft !== null ? r.pausedLeft + seconds * 1000 : null,
    },
  });
}
export function skipRest() {
  setState({ rest: null });
}

/** Rest length for an exercise: the user's choice for it → plan value → profile default. */
export function restFor(weId: string) {
  const s = getState();
  if (!s.profile?.rest_timer_enabled) return 0;
  const we = s.workout_exercises[weId];
  const own = we ? s.profile.rest_by_exercise?.[we.exercise_id] : undefined;
  if (own !== undefined) return own;
  const w = we && s.workouts[we.workout_id];
  if (w?.template_id) {
    const te = Object.values(s.template_exercises).find(
      (t) => t.template_id === w.template_id && t.exercise_id === we.exercise_id,
    );
    if (te?.default_rest_seconds) return te.default_rest_seconds;
  }
  return s.profile.default_rest_seconds;
}

/** Remembers a rest time for one exercise across all workouts; null = back to the default. */
export function setExerciseRest(exerciseId: string, seconds: number | null) {
  const p = getState().profile;
  if (!p) return;
  if (seconds !== null) track("rest_custom");
  const next = { ...(p.rest_by_exercise ?? {}) };
  if (seconds === null) delete next[exerciseId];
  else next[exerciseId] = seconds;
  saveProfile({ rest_by_exercise: next });
}

/* ───────────────────────────── exercise library ───────────────────────────── */

export function createExercise(name: string, muscle: string | null, equipment: Equipment | null, aliases: string[] = []) {
  const id = uid();
  putRows("exercises", [
    { id, user_id: me(), name: name.trim(), muscle_group: muscle, equipment, aliases, created_at: nowIso() },
  ]);
  return id;
}

/* ───────────────────────────── machines ─────────────────────────────
 * The same exercise on another machine is its own exercise ("Lat Pulldown · heavy one"),
 * so each machine keeps its own weights and history. Only this workout's row moves. */

export const MACHINE_SEP = " · ";

/** Points this workout's row at another machine. Typed weights stay. */
export function switchMachine(weId: string, exerciseId: string) {
  if (getState().workout_exercises[weId]?.exercise_id === exerciseId) return;
  patchRow("workout_exercises", weId, { exercise_id: exerciseId });
}

/** A new machine variant of `baseId` named "<base> · <label>", used for this row. */
export function addMachine(weId: string, baseId: string, baseStoredName: string, label: string) {
  const base = getState().exercises[baseId];
  const name = `${baseStoredName}${MACHINE_SEP}${label.trim()}`;
  const id = findExerciseByName(name)?.id ?? createExercise(name, base?.muscle_group ?? null, base?.equipment ?? null);
  track("machine_add");
  switchMachine(weId, id);
  return id;
}

/** Exact match on the name or on one of the user's names for it (case-insensitive). */
export function findExerciseByName(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const s = getState();
  const all = Object.values(s.exercises);
  const personal = Object.values(s.exercise_aliases ?? {}).find((a) => a.alias.toLowerCase() === n);
  return (
    all.find((e) => e.name.toLowerCase() === n) ??
    all.find((e) => (e.aliases ?? []).some((a) => a.toLowerCase() === n)) ??
    (personal ? s.exercises[personal.exercise_id] ?? null : null)
  );
}

/**
 * Remembers what the user calls an exercise. Their own exercises keep it on the
 * row; shared built-ins get a personal alias row.
 */
export function addAlias(exerciseId: string, alias: string) {
  const s = getState();
  const e = s.exercises[exerciseId];
  const a = alias.trim();
  if (!e || !a || a.length > 60 || a.toLowerCase() === e.name.toLowerCase()) return;
  if (aliasesOf(s, exerciseId).some((x) => x.toLowerCase() === a.toLowerCase())) return;
  if (e.user_id) {
    patchRow("exercises", exerciseId, { aliases: [...(e.aliases ?? []), a] });
  } else {
    // Another exercise may already own this name; the newest choice wins.
    const old = Object.values(s.exercise_aliases ?? {}).filter((x) => x.alias.toLowerCase() === a.toLowerCase());
    removeRows("exercise_aliases", old.map((x) => x.id));
    putRows("exercise_aliases", [{ id: uid(), user_id: me(), exercise_id: exerciseId, alias: a, created_at: nowIso() }]);
  }
}

/* ───────────────────────────── plans ───────────────────────────── */

export function createTemplate(name: string) {
  const id = uid();
  const last = sortedTemplates(getState()).at(-1);
  const position = last?.position != null ? last.position + 1 : null; // new plans go to the end
  putRows("workout_templates", [{ id, user_id: me(), name: name.trim() || tr("New plan"), created_at: nowIso(), position }]);
  return id;
}

/** Saves a new order of plans (from drag to reorder). */
export function reorderTemplates(ids: string[]) {
  track("reorder_plans");
  const s = getState();
  const changed = ids
    .map((id, position) => ({ t: s.workout_templates[id], position }))
    .filter(({ t, position }) => t && t.position !== position)
    .map(({ t, position }) => ({ ...t, position }));
  putRows("workout_templates", changed);
}

/** Pins a plan to weekdays (0 = Sunday). An empty list means no fixed days. */
export function setPlanDays(id: string, weekdays: number[]) {
  patchRow("workout_templates", id, { weekdays: [...new Set(weekdays)].sort((a, b) => a - b) });
  track("plan_days");
}

export function renameTemplate(id: string, name: string) {
  patchRow("workout_templates", id, { name: name.trim() || "Plan" });
}

export function templateExercises(templateId: string) {
  return Object.values(getState().template_exercises)
    .filter((te) => te.template_id === templateId)
    .sort(byPosition);
}

export function addTemplateExercise(
  templateId: string,
  exerciseId: string,
  opts: Partial<Pick<TemplateExercise, "target_sets" | "rep_min" | "rep_max" | "default_rest_seconds" | "note">> = {},
) {
  const list = templateExercises(templateId);
  putRows("template_exercises", [
    {
      id: uid(),
      template_id: templateId,
      exercise_id: exerciseId,
      position: list.length ? list[list.length - 1].position + 1 : 0,
      target_sets: opts.target_sets ?? 3,
      rep_min: opts.rep_min ?? 8,
      rep_max: opts.rep_max ?? 12,
      default_rest_seconds: opts.default_rest_seconds ?? null,
      note: opts.note ?? null,
    },
  ]);
}

export function updateTemplateExercise(id: string, patch: Partial<TemplateExercise>) {
  patchRow("template_exercises", id, patch);
}

export function moveTemplateExercise(id: string, dir: -1 | 1) {
  const te = getState().template_exercises[id];
  if (!te) return;
  const list = templateExercises(te.template_id);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  putRows("template_exercises", list.map((x, k) => ({ ...x, position: k })));
}

export function removeTemplateExercise(id: string) {
  removeRows("template_exercises", [id]);
}

export function deleteTemplate(id: string) {
  removeRows("template_exercises", templateExercises(id).map((x) => x.id), { sync: false });
  removeRows("workout_templates", [id]);
}

export function templateFromStarter(starter: StarterPlan) {
  const id = createTemplate(starter.name);
  for (const e of starter.exercises) {
    const ex = findExerciseByName(e.name);
    if (!ex) continue;
    addTemplateExercise(id, ex.id, {
      target_sets: e.sets,
      rep_min: e.min,
      rep_max: e.max,
      default_rest_seconds: e.rest ?? null,
    });
  }
  return id;
}

/** Turns a logged workout into a reusable plan. */
export function templateFromWorkout(workoutId: string) {
  const s = getState();
  const w = s.workouts[workoutId];
  if (!w) return null;
  const id = createTemplate(w.name);
  for (const we of workoutExercises(s, workoutId)) {
    const sets = setsOf(s, we.id).filter((x) => x.completed);
    const reps = sets.map((x) => x.reps ?? 0).filter(Boolean);
    addTemplateExercise(id, we.exercise_id, {
      target_sets: sets.length || 3,
      rep_min: reps.length ? Math.min(...reps) : 8,
      rep_max: reps.length ? Math.max(...reps) : 12,
    });
  }
  return id;
}
