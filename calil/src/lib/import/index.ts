"use client";

import { addAlias, addTemplateExercise, createExercise, createTemplate, findExerciseByName } from "../actions";
import { nowIso, uid } from "../format";
import { getState, putRows } from "../store";
import { aliasesOf } from "../stats";
import { supabase } from "../supabase";
import type { Equipment, WorkoutSet } from "../types";
import { tr } from "../i18n";
import { track } from "../track";

/* ───────────────────────────── shapes from /api/import ───────────────────────────── */

export interface ImportedSet {
  weight: number | null;
  reps: number | null;
  note: string | null;
}

export interface ImportedExercise {
  original_name: string;
  library_name: string;
  suggested_name: string;
  muscle_group: string | null;
  equipment: Equipment | null;
  is_warmup: boolean;
  target_sets: number | null;
  rep_min: number | null;
  rep_max: number | null;
  rest_seconds: number | null;
  note: string | null;
  performed: ImportedSet[];
}

export interface ImportedWorkout {
  name: string;
  block: string;
  date: string;
  exercises: ImportedExercise[];
}

export interface ImportResult {
  kind: "plan" | "log";
  workouts: ImportedWorkout[];
}

export type ImportInput = { text: string } | { image: Blob };

async function toBase64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function readProgram(input: ImportInput, signal?: AbortSignal): Promise<ImportResult> {
  const { data } = await supabase().auth.getSession();
  const s = getState();
  const library = Object.values(s.exercises).map((e) => ({ name: e.name, aliases: aliasesOf(s, e.id) }));
  const body =
    "text" in input
      ? { text: input.text, library }
      : { image: await toBase64(input.image), mime: input.image.type || "image/jpeg", library };
  track("import_file");
  const r = await fetch("/api/import", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  if (r.status === 401) throw new Error(tr("Please sign in again."));
  if (r.status === 429) throw new Error(tr("You’ve reached today’s import limit. Try again tomorrow."));
  if (r.status === 413) throw new Error(tr("That’s too long to read at once. Try one sheet or one week."));
  if (!r.ok) throw new Error(tr("Couldn’t read that. Try again, or paste it as text."));
  const out = (await r.json()) as ImportResult;
  if (!out.workouts.length) throw new Error(tr("This doesn’t look like a program or a workout. If it’s a spreadsheet, try another sheet."));
  return out;
}

/* ───────────────────────────── exercise names ───────────────────────────── */

/** How an imported exercise maps to the library. Decided in the preview. */
export type NameChoice =
  | { kind: "existing"; exerciseId: string }
  | { kind: "new"; name: string; alias: string | null };

/**
 * Default choice: the library match the model found; else an existing exercise
 * with the suggested name; else a new exercise under the standard name that
 * remembers what the user wrote as an alias.
 */
export function defaultChoice(e: ImportedExercise): NameChoice {
  const hit = findExerciseByName(e.library_name) ?? findExerciseByName(e.suggested_name) ?? findExerciseByName(e.original_name);
  if (hit) return { kind: "existing", exerciseId: hit.id };
  const alias = e.original_name && e.original_name.toLowerCase() !== e.suggested_name.toLowerCase() ? e.original_name : null;
  return { kind: "new", name: e.suggested_name || e.original_name, alias };
}

/** Resolves a choice to an exercise id, creating it once per name per import. */
function resolver() {
  const created = new Map<string, string>();
  return (choice: NameChoice, e: ImportedExercise) => {
    if (choice.kind === "existing") {
      if (e.original_name) addAlias(choice.exerciseId, e.original_name);
      return choice.exerciseId;
    }
    const key = choice.name.trim().toLowerCase();
    const existing = created.get(key) ?? findExerciseByName(choice.name)?.id;
    if (existing) {
      if (choice.alias) addAlias(existing, choice.alias);
      created.set(key, existing);
      return existing;
    }
    const id = createExercise(choice.name, e.muscle_group, e.equipment, choice.alias ? [choice.alias] : []);
    created.set(key, id);
    return id;
  };
}

/* ───────────────────────────── saving ───────────────────────────── */

export interface SaveOptions {
  workouts: { workout: ImportedWorkout; name: string; choices: NameChoice[] }[];
  includeWarmup: boolean;
  /** For logged workouts: the day it happened (YYYY-MM-DD). */
  date?: string;
  /** For logged workouts: also keep it as a reusable plan. */
  alsoPlan?: boolean;
}

export function savePlans({ workouts, includeWarmup }: SaveOptions): string[] {
  const resolve = resolver();
  return workouts.map(({ workout, name, choices }) => {
    const tid = createTemplate(name);
    workout.exercises.forEach((e, i) => {
      if (e.is_warmup && !includeWarmup) return;
      // A source with real numbers (e.g. a workout written down) keeps them as the plan's starting point.
      const done = e.performed.filter((p) => p.reps !== null || p.weight !== null);
      const reps = done.map((p) => p.reps ?? 0).filter(Boolean);
      const weights = done.map((p) => p.weight ?? 0).filter((w) => w > 0);
      addTemplateExercise(tid, resolve(choices[i], e), {
        target_sets: e.target_sets ?? (done.length || 3),
        rep_min: e.rep_min ?? (reps.length ? Math.min(...reps) : null),
        rep_max: e.rep_max ?? (reps.length ? Math.max(...reps) : null),
        default_rest_seconds: e.rest_seconds,
        note: e.note,
        target_weight: weights.length ? Math.max(...weights) : null,
      });
    });
    return tid;
  });
}

/** Saves performed workouts into history (and optionally as plans). Returns workout ids. */
export function saveLogs({ workouts, includeWarmup, date, alsoPlan }: SaveOptions): string[] {
  const userId = getState().userId!;
  const resolve = resolver();
  const ids: string[] = [];
  for (const { workout, name, choices } of workouts) {
    const day = workout.date || date;
    const started = day ? new Date(`${day}T12:00:00`).toISOString() : nowIso();
    const tid = alsoPlan ? createTemplate(name) : null;
    const wid = uid();
    putRows("workouts", [
      { id: wid, user_id: userId, template_id: tid, name, started_at: started, completed_at: started, duration_seconds: null, overall_note: null },
    ]);
    let pos = 0;
    workout.exercises.forEach((e, i) => {
      if (e.is_warmup && !includeWarmup) return;
      const exId = resolve(choices[i], e);
      const weId = uid();
      putRows("workout_exercises", [{ id: weId, workout_id: wid, exercise_id: exId, position: pos++ }]);
      const sets: WorkoutSet[] = e.performed.map((p, j) => ({
        id: uid(),
        workout_exercise_id: weId,
        set_number: j + 1,
        weight: p.weight,
        reps: p.reps,
        completed: p.reps !== null || p.weight !== null,
        note: p.note,
        completed_at: started,
      }));
      putRows("sets", sets);
      if (tid) {
        const reps = e.performed.map((p) => p.reps ?? 0).filter(Boolean);
        const weights = e.performed.map((p) => p.weight ?? 0).filter((w) => w > 0);
        addTemplateExercise(tid, exId, {
          target_weight: weights.length ? Math.max(...weights) : null,
          target_sets: e.performed.length || e.target_sets || 3,
          rep_min: reps.length ? Math.min(...reps) : e.rep_min,
          rep_max: reps.length ? Math.max(...reps) : e.rep_max,
          default_rest_seconds: e.rest_seconds,
          note: e.note,
        });
      }
    });
    ids.push(wid);
  }
  return ids;
}
