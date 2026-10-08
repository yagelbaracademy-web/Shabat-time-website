import { useSyncExternalStore } from "react";
import { getState, subscribe as subscribeStore } from "./store";

/**
 * What a person has already seen or done while getting started: one-time tips,
 * the microphone explainer, the first-steps card. Kept on this device; it only
 * decides which hints to show, so losing it just shows a hint again.
 */
export interface Onboarding {
  dictated?: boolean; // used dictation at least once
  micPrimed?: boolean; // saw our explanation before the system's microphone prompt
  hideSteps?: boolean; // closed the first-steps card
  stepsDone?: boolean; // saw (and closed) the "first steps done" celebration
  seen?: Record<string, boolean>; // one-time tips by id
  sayHints?: number; // "next time, just say…" hints shown so far
  style?: "coach" | "starter" | "free"; // answer to "how do you train?"
}

// Per account, and per profile creation, so a reset account gets the welcome again.
const keyNow = () => {
  const s = getState();
  return `calil:onboarding:${s.userId ?? "anon"}:${s.profile?.created_at ?? ""}`;
};
let state: Onboarding | null = null;
let stateKey = "";
const subs = new Set<() => void>();

function read(): Onboarding {
  const key = keyNow();
  if (state && key === stateKey) return state;
  stateKey = key;
  try {
    state = JSON.parse(localStorage.getItem(key) ?? "{}") as Onboarding;
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
    localStorage.setItem(stateKey || keyNow(), JSON.stringify(state));
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
      const off = subscribeStore(f); // the account (key) can change after sign-in
      return () => {
        subs.delete(f);
        off();
      };
    },
    () => read(),
    () => EMPTY,
  );
}
