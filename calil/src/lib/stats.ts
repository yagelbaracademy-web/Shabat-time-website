import type { State } from "./store";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet, WorkoutTemplate } from "./types";
import { locale } from "./i18n";

/* Pure read helpers over the store. Everything is computed on the client from
 * the user's full history, which stays small enough to scan in a few ms. */

export const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
export const bySetNumber = (a: WorkoutSet, b: WorkoutSet) => a.set_number - b.set_number;

export function workoutExercises(s: State, workoutId: string): WorkoutExercise[] {
  return Object.values(s.workout_exercises)
    .filter((we) => we.workout_id === workoutId)
    .sort(byPosition);
}

export function setsOf(s: State, weId: string): WorkoutSet[] {
  return Object.values(s.sets)
    .filter((x) => x.workout_exercise_id === weId)
    .sort(bySetNumber);
}

/** Index built once per state version: weId → sets. */
export function setsIndex(s: State): Map<string, WorkoutSet[]> {
  const m = new Map<string, WorkoutSet[]>();
  for (const x of Object.values(s.sets)) {
    const arr = m.get(x.workout_exercise_id);
    if (arr) arr.push(x);
    else m.set(x.workout_exercise_id, [x]);
  }
  m.forEach((arr) => arr.sort(bySetNumber));
  return m;
}

export function activeWorkout(s: State): Workout | null {
  let best: Workout | null = null;
  for (const w of Object.values(s.workouts)) {
    if (w.completed_at) continue;
    if (!best || w.started_at > best.started_at) best = w;
  }
  return best;
}

export function completedWorkouts(s: State): Workout[] {
  return Object.values(s.workouts)
    .filter((w) => w.completed_at)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

/** Every name the user has for an exercise: on their own exercise, plus personal names for built-ins. */
export function aliasesOf(s: State, exerciseId: string): string[] {
  const own = s.exercises[exerciseId]?.aliases ?? [];
  const personal = Object.values(s.exercise_aliases ?? {})
    .filter((a) => a.exercise_id === exerciseId)
    .map((a) => a.alias);
  return [...own, ...personal];
}

/** Plans in the user's order: dragged position first, then creation date. */
export function sortedTemplates(s: State): WorkoutTemplate[] {
  return Object.values(s.workout_templates).sort((a, b) => {
    const pa = a.position ?? Number.MAX_SAFE_INTEGER;
    const pb = b.position ?? Number.MAX_SAFE_INTEGER;
    return pa !== pb ? pa - pb : a.created_at < b.created_at ? -1 : 1;
  });
}

export function sortedExercises(s: State): Exercise[] {
  return Object.values(s.exercises).sort((a, b) => a.name.localeCompare(b.name));
}

/** Cardio is marked by its muscle group; its sets hold time and distance instead of weight × reps. */
export const isCardio = (ex: Pick<Exercise, "muscle_group"> | null | undefined) => ex?.muscle_group === "Cardio";

/** Working sets only: warm-ups are logged but never count toward volume, records or progress. */
export const working = (sets: WorkoutSet[]) => sets.filter((x) => !x.is_warmup);

/** Volume of the given sets; `sides` = 2 when the weight is logged per side (two dumbbells). */
export const volumeOf = (sets: WorkoutSet[], sides = 1) =>
  sets.reduce((v, x) => v + (x.completed && !x.is_warmup ? (x.weight ?? 0) * (x.reps ?? 0) * sides : 0), 0);

/* Weight per side: two dumbbells (or two cable stacks) are logged as the weight in each hand. */
const ONE_WEIGHT = new Set(["Goblet Squat", "Kettlebell Swing"]);
const PER_SIDE_BUILTIN = new Set(["Cable Crossover"]);

export function isPerSide(s: State, ex: Exercise | null | undefined): boolean {
  if (!ex) return false;
  const own = s.profile?.per_side?.[ex.id];
  if (own !== undefined) return own;
  const base = ex.name.split(" · ")[0]; // a machine variant follows its base exercise
  if (PER_SIDE_BUILTIN.has(base)) return true;
  return ex.equipment === "dumbbell" && !ONE_WEIGHT.has(base);
}

export const sidesOf = (s: State, exerciseId: string) => (isPerSide(s, s.exercises[exerciseId]) ? 2 : 1);

/** Heaviest completed set; ties go to more reps. Body-weight work ranks by reps. */
export function topSet(sets: WorkoutSet[]): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  for (const x of sets) {
    if (!x.completed || x.reps === null || x.is_warmup) continue;
    if (!best || better(x, best)) best = x;
  }
  return best;
}

export function better(a: Pick<WorkoutSet, "weight" | "reps">, b: Pick<WorkoutSet, "weight" | "reps">) {
  const wa = a.weight ?? 0;
  const wb = b.weight ?? 0;
  if (wa !== wb) return wa > wb;
  return (a.reps ?? 0) > (b.reps ?? 0);
}

/* ───────────── personal records ─────────────
 * Three kinds, so a record is never ambiguous:
 *  weight: heavier than ever before.
 *  set:    best set by estimated one-rep max (more reps at a weight you've done, etc.).
 *  reps:   body-weight work, more reps than ever. */
export type PRKind = "weight" | "set" | "reps";
export const PR_LABEL: Record<PRKind, string> = { weight: "Weight PR", set: "Best set", reps: "Rep PR" };
export const PR_TITLE: Record<PRKind, string> = { weight: "New weight PR", set: "Your best set yet", reps: "New rep PR" };

const E1RM_MAX_REPS = 12; // past this the estimate stops meaning much

/** Estimated one-rep max (Epley). 0 when it can't be estimated. */
export function e1rm(x: Pick<WorkoutSet, "weight" | "reps">) {
  const w = x.weight ?? 0;
  const r = x.reps ?? 0;
  if (w <= 0 || r <= 0 || r > E1RM_MAX_REPS) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

interface Bests {
  weight: number;
  e1rm: number;
  reps: number; // body-weight sets only
}
const NO_BESTS: Bests = { weight: 0, e1rm: 0, reps: 0 };
const counts = (x: WorkoutSet) => x.completed && !x.is_warmup && x.reps !== null;

function bestsOf(sets: WorkoutSet[], base: Bests = NO_BESTS): Bests {
  const b = { ...base };
  for (const x of sets) {
    if (!counts(x)) continue;
    const w = x.weight ?? 0;
    b.weight = Math.max(b.weight, w);
    b.e1rm = Math.max(b.e1rm, e1rm(x));
    if (w <= 0) b.reps = Math.max(b.reps, x.reps ?? 0);
  }
  return b;
}

/** Which record (if any) a set of numbers beats. Needs some history: a first time is not a record. */
function beats(x: Pick<WorkoutSet, "weight" | "reps">, prev: Bests, also: Bests = NO_BESTS): PRKind | null {
  const w = x.weight ?? 0;
  if (w > 0) {
    if (prev.weight > 0 && w > prev.weight && w > also.weight) return "weight";
    const e = e1rm(x);
    if (prev.e1rm > 0 && e > prev.e1rm && e > also.e1rm) return "set";
    return null;
  }
  const r = x.reps ?? 0;
  if (prev.weight === 0 && prev.reps > 0 && r > prev.reps && r > also.reps) return "reps";
  return null;
}

export interface Session {
  workout: Workout;
  we: WorkoutExercise;
  sets: WorkoutSet[];
  top: WorkoutSet | null;
  volume: number;
  pr: boolean;
  prKind: PRKind | null;
  /** The set that made the record. */
  prSet: WorkoutSet | null;
}

/** All sessions of one exercise, newest first, with PR flags. */
export function exerciseSessions(s: State, exerciseId: string, idx = setsIndex(s)): Session[] {
  const list: Session[] = [];
  for (const we of Object.values(s.workout_exercises)) {
    if (we.exercise_id !== exerciseId) continue;
    const workout = s.workouts[we.workout_id];
    if (!workout) continue;
    const sets = idx.get(we.id) ?? [];
    const top = topSet(sets);
    if (!top && !sets.some((x) => x.completed && (x.duration_seconds ?? 0) > 0)) continue;
    list.push({ workout, we, sets, top, volume: volumeOf(sets, sidesOf(s, exerciseId)), pr: false, prKind: null, prSet: null });
  }
  list.sort((a, b) => (a.workout.started_at < b.workout.started_at ? -1 : 1));
  let prev: Bests | null = null;
  const rank: Record<PRKind, number> = { weight: 3, set: 2, reps: 1 };
  for (const sess of list) {
    if (prev) {
      for (const x of sess.sets) {
        if (!counts(x)) continue;
        const k = beats(x, prev);
        if (!k) continue;
        const cur = sess.prKind;
        // Keep the strongest kind; within a kind, the bigger set.
        if (!cur || rank[k] > rank[cur] || (k === cur && sess.prSet && (k === "set" ? e1rm(x) > e1rm(sess.prSet) : better(x, sess.prSet)))) {
          sess.prKind = k;
          sess.prSet = x;
        }
      }
      sess.pr = !!sess.prKind;
    }
    prev = bestsOf(sess.sets, prev ?? NO_BESTS);
  }
  return list.reverse();
}

/** What you did last time, ignoring the given workout. */
export function lastSession(s: State, exerciseId: string, excludeWorkoutId?: string): Session | null {
  return exerciseSessions(s, exerciseId).find((x) => x.workout.id !== excludeWorkoutId) ?? null;
}

/** Records from every workout before a given one (for live PR detection). */
function bestsBefore(s: State, exerciseId: string, beforeIso: string, excludeWorkoutId: string): Bests | null {
  let b: Bests | null = null;
  for (const sess of exerciseSessions(s, exerciseId)) {
    if (sess.workout.id === excludeWorkoutId || sess.workout.started_at >= beforeIso) continue;
    b = bestsOf(sess.sets, b ?? NO_BESTS);
  }
  return b;
}

export interface MonthStats {
  workouts: number;
  seconds: number;
  volume: number;
  days: number[]; // volume per day of month
  label: string;
}

export function monthStats(s: State, ref = new Date()): MonthStats {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = new Array(daysInMonth).fill(0);
  const idx = setsIndex(s);
  const weByWorkout = new Map<string, WorkoutExercise[]>();
  for (const we of Object.values(s.workout_exercises)) {
    const a = weByWorkout.get(we.workout_id);
    if (a) a.push(we);
    else weByWorkout.set(we.workout_id, [we]);
  }
  let workouts = 0;
  let seconds = 0;
  let volume = 0;
  for (const w of Object.values(s.workouts)) {
    if (!w.completed_at) continue;
    const d = new Date(w.started_at);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    workouts++;
    seconds += w.duration_seconds ?? 0;
    let v = 0;
    for (const we of weByWorkout.get(w.id) ?? []) v += volumeOf(idx.get(we.id) ?? [], sidesOf(s, we.exercise_id));
    volume += v;
    days[d.getDate() - 1] += v || 1;
  }
  return {
    workouts,
    seconds,
    volume,
    days,
    label: ref.toLocaleDateString(locale(), { month: "short" }),
  };
}

export interface ExerciseSummary {
  exercise: Exercise;
  sessions: Session[];
  last: Session;
  best: WorkoutSet;
  firstInRange: Session;
  change: number | null; // % change of top weight (or reps) over the range
}

export const RANGES = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365, All: Infinity } as const;
export type RangeKey = keyof typeof RANGES;

export function inRange(sessions: Session[], range: RangeKey) {
  const days = RANGES[range];
  if (days === Infinity) return sessions;
  const cutoff = Date.now() - days * 86400000;
  return sessions.filter((x) => new Date(x.workout.started_at).getTime() >= cutoff);
}

/** Top weight when the exercise is loaded, reps when it's body weight. */
export function metricOf(sessions: Session[]) {
  const loaded = sessions.some((x) => (x.top?.weight ?? 0) > 0);
  return {
    loaded,
    value: (x: Session) => (loaded ? x.top?.weight ?? 0 : x.top?.reps ?? 0),
  };
}

export function changePct(sessions: Session[]): number | null {
  if (sessions.length < 2) return null;
  const { value } = metricOf(sessions);
  const first = value(sessions[sessions.length - 1]);
  const last = value(sessions[0]);
  if (!first) return null;
  return Math.round(((last - first) / first) * 100);
}

export function exerciseSummaries(s: State, range: RangeKey = "3M"): ExerciseSummary[] {
  const idx = setsIndex(s);
  const out: ExerciseSummary[] = [];
  for (const ex of Object.values(s.exercises)) {
    const sessions = exerciseSessions(s, ex.id, idx).filter((x) => x.top); // cardio has its own view
    if (!sessions.length) continue;
    const ranged = inRange(sessions, range);
    const best = sessions.reduce<WorkoutSet | null>(
      (b, x) => (x.top && (!b || better(x.top, b)) ? x.top : b),
      null,
    )!;
    out.push({
      exercise: ex,
      sessions,
      last: sessions[0],
      best,
      firstInRange: ranged[ranged.length - 1] ?? sessions[0],
      change: changePct(ranged),
    });
  }
  return out.sort((a, b) => (a.last.workout.started_at < b.last.workout.started_at ? 1 : -1));
}

export interface PREvent {
  exercise: Exercise;
  session: Session;
  kind: PRKind;
  set: WorkoutSet;
  /** The best before it, in the same terms as the record. */
  previous: number;
}

/** Most recent personal records across all exercises. */
export function recentPRs(s: State, limit = 5): PREvent[] {
  const idx = setsIndex(s);
  const out: PREvent[] = [];
  for (const ex of Object.values(s.exercises)) {
    const sessions = exerciseSessions(s, ex.id, idx);
    sessions.forEach((sess, i) => {
      if (!sess.prKind || !sess.prSet) return;
      const b = sessions.slice(i + 1).reduce((acc, x) => bestsOf(x.sets, acc), NO_BESTS);
      const previous = sess.prKind === "weight" ? b.weight : sess.prKind === "set" ? b.e1rm : b.reps;
      out.push({ exercise: ex, session: sess, kind: sess.prKind, set: sess.prSet, previous });
    });
  }
  return out
    .sort((a, b) => (a.session.workout.started_at < b.session.workout.started_at ? 1 : -1))
    .slice(0, limit);
}

/** The record a set makes: it beats every earlier workout and every other set in its own. */
export function prKindOf(s: State, x: WorkoutSet): PRKind | null {
  if (!counts(x)) return null;
  const we = s.workout_exercises[x.workout_exercise_id];
  const w = we && s.workouts[we.workout_id];
  if (!we || !w) return null;
  const prev = bestsBefore(s, we.exercise_id, w.started_at, w.id);
  if (!prev) return null;
  const others = bestsOf(setsOf(s, we.id).filter((y) => y.id !== x.id));
  return beats(x, prev, others);
}

export const isPRSet = (s: State, x: WorkoutSet) => !!prKindOf(s, x);

/** The record an exercise made in a workout, if any (the strongest kind). */
export function workoutPR(s: State, weId: string): PRKind | null {
  const we = s.workout_exercises[weId];
  const w = we && s.workouts[we.workout_id];
  if (!we || !w) return null;
  const prev = bestsBefore(s, we.exercise_id, w.started_at, w.id);
  if (!prev) return null;
  const kinds = setsOf(s, weId)
    .filter(counts)
    .map((x) => beats(x, prev));
  return kinds.includes("weight") ? "weight" : kinds.includes("set") ? "set" : kinds.includes("reps") ? "reps" : null;
}

/* ───────────── workout time ─────────────
 * The clock starts when the first set is ticked (not when the workout is opened)
 * and stays put after that, even if that set is unticked. */

/** When the clock started (ms), or null while nothing has been ticked yet. */
export function clockStartAt(s: State, workoutId: string): number | null {
  const w = s.workouts[workoutId];
  if (w?.clock_started_at) return Date.parse(w.clock_started_at);
  // Workouts begun before the clock was stored: fall back to the first ticked set.
  let first: number | null = null;
  for (const we of workoutExercises(s, workoutId))
    for (const x of setsOf(s, we.id)) {
      if (!x.completed || !x.completed_at) continue;
      const t = Date.parse(x.completed_at);
      if (first === null || t < first) first = t;
    }
  return first;
}

/** Live clock in seconds, or null before the first set. */
export const liveSeconds = (start: number | null, now: number) => (start === null ? null : Math.max(0, (now - start) / 1000));

/* ───────────── time per exercise ─────────────
 * Estimated from when sets were ticked: an exercise runs from the end of the one before it
 * (or the clock start) to its own last ticked set. A long gap inside it is reported apart,
 * since it usually means a break that wasn't the exercise itself. */
const LONG_GAP = 5 * 60 * 1000;

/** "seconds:longestGapSeconds" for one exercise of a workout, or "" when nothing was ticked. */
export function exerciseTimeKey(s: State, weId: string): string {
  const we = s.workout_exercises[weId];
  if (!we) return "";
  const times = new Map<string, number[]>();
  for (const w of workoutExercises(s, we.workout_id)) {
    const ts = setsOf(s, w.id)
      .filter((x) => x.completed && x.completed_at)
      .map((x) => Date.parse(x.completed_at!))
      .sort((a, b) => a - b);
    if (ts.length) times.set(w.id, ts);
  }
  const mine = times.get(weId);
  if (!mine) return "";
  // The exercise done just before this one (by time) marks where this one began.
  let prevEnd = clockStartAt(s, we.workout_id) ?? mine[0];
  for (const [id, ts] of times) if (id !== weId && ts[ts.length - 1] <= mine[0] && ts[ts.length - 1] > prevEnd) prevEnd = ts[ts.length - 1];
  const points = [Math.min(prevEnd, mine[0]), ...mine];
  let gap = 0;
  for (let i = 1; i < points.length; i++) gap = Math.max(gap, points[i] - points[i - 1]);
  const total = mine[mine.length - 1] - points[0];
  return `${Math.round(total / 1000)}:${gap > LONG_GAP ? Math.round(gap / 1000) : 0}`;
}
