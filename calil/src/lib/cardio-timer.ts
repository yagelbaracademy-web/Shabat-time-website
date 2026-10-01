import { useSyncExternalStore } from "react";

/**
 * The one running cardio stopwatch. Kept in localStorage as a start time, so it
 * keeps counting through a locked phone, a reload or switching tabs.
 */
export interface CardioRun {
  setId: string;
  startedAt: number; // ms
  base: number; // seconds already on the clock before this start
  goal: number | null; // seconds
  goalHit?: boolean;
}

const KEY = "calil:cardio";
export const GOAL_EVENT = "calil:cardio-goal";
let run: CardioRun | null = null;
let loaded = false;
const subs = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    run = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    run = null;
  }
  watch();
}

function save(next: CardioRun | null) {
  run = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {}
  watch();
  subs.forEach((f) => f());
}

export const elapsed = (r: CardioRun, now = Date.now()) => r.base + Math.max(0, Math.floor((now - r.startedAt) / 1000));

/** Buzzes once when the goal is reached, even if the card isn't on screen. */
function watch() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  if (!run?.goal || run.goalHit) return;
  ticker = setInterval(() => {
    if (!run?.goal || run.goalHit || elapsed(run) < run.goal) return;
    try {
      navigator.vibrate?.([250, 120, 250, 120, 400]);
    } catch {}
    window.dispatchEvent(new CustomEvent(GOAL_EVENT, { detail: run.setId }));
    save({ ...run, goalHit: true });
  }, 1000);
}

export function useCardioRun(): CardioRun | null {
  return useSyncExternalStore(
    (f) => {
      load();
      subs.add(f);
      return () => subs.delete(f);
    },
    () => {
      load();
      return run;
    },
    () => null,
  );
}

export function startCardio(setId: string, base: number, goal: number | null) {
  save({ setId, startedAt: Date.now(), base, goal, goalHit: goal !== null && base >= goal });
}

export function setCardioGoal(goal: number | null) {
  if (run) save({ ...run, goal, goalHit: goal !== null && elapsed(run) >= goal });
}

/** Stops the clock and returns the total seconds for that set. */
export function stopCardio(): { setId: string; seconds: number } | null {
  if (!run) return null;
  const out = { setId: run.setId, seconds: elapsed(run) };
  save(null);
  return out;
}
