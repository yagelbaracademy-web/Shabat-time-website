import type { State } from "./store";
import type { Workout, WorkoutTemplate } from "./types";
import { sortedTemplates } from "./stats";

/* Time helpers for the week strip and the week list. Weeks start on Sunday (Israel, US). */

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

/** Workouts started on that day (finished ones, plus the one in progress), oldest first. */
export function workoutsOn(s: State, d: Date): Workout[] {
  const k = dayKey(d);
  return Object.values(s.workouts)
    .filter((w) => dayKey(new Date(w.started_at)) === k)
    .sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
}

/** Plans pinned to that weekday. */
export function plannedOn(s: State, d: Date): WorkoutTemplate[] {
  return sortedTemplates(s).filter((t) => t.weekdays?.includes(d.getDay()));
}

/** Weekday names for 0 = Sunday … 6 = Saturday, in the current language. */
export function weekdayName(day: number, style: "short" | "long" | "narrow" = "short", loc = "en-US") {
  return new Date(2026, 9, 4 + day).toLocaleDateString(loc, { weekday: style }); // 4 Oct 2026 is a Sunday
}

/** The next day (from tomorrow, within a week) that has a plan pinned to it. */
export function nextPlannedDay(s: State, from: Date): { date: Date; plans: WorkoutTemplate[] } | null {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(from, i);
    const plans = plannedOn(s, d);
    if (plans.length) return { date: d, plans };
  }
  return null;
}
