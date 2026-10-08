import { useSyncExternalStore } from "react";

/**
 * What a person has already seen or done while getting started: one-time tips,
 * the microphone explainer, the first-steps card. Kept on this device; it only
 * decides which hints to show, so losing it just shows a hint again.
 */
export interface Onboarding {
  dictated?: boolean; // used dictation at least once
  micPrimed?: boolean; // saw our explanation before the system's microphone prompt
  hideSteps?: boolean; // closed the first-steps card
  seen?: Record<string, boolean>; // one-time tips by id
  sayHints?: number; // "next time, just say…" hints shown so far
  style?: "coach" | "starter" | "free"; // answer to "how do you train?"
}

const KEY = "calil:onboarding";
let state: Onboarding | null = null;
const subs = new Set<() => void>();

function read(): Onboarding {
  if (state) return state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Onboarding;
  } catch {
    state = {};
  }
  return state;
}

export function getOnboarding(): Onboarding {
  return typeof window === "undefined" ? {} : read();
}

export function setOnboarding(patch: Partial<Onboarding>) {
  state = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  subs.forEach((f) => f());
}

export function markSeen(id: string) {
  setOnboarding({ seen: { ...(read().seen ?? {}), [id]: true } });
}

const EMPTY: Onboarding = {};
export function useOnboarding(): Onboarding {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => read(),
    () => EMPTY,
  );
}
