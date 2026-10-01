"use client";

import { useSyncExternalStore } from "react";
import { HE, HE_F, HE_M } from "./i18n-he";
import { EXERCISE_NAMES_HE } from "./exercise-names-he";

/**
 * Two languages, English as the source. Strings are written in English in the
 * code and wrapped in t(); the Hebrew dictionary maps them, falling back to
 * English for anything missing. Hebrew also switches the document to RTL.
 */
export type Lang = "en" | "he";
/** Hebrew form of address. "neutral" uses the plural/neutral wording. */
export type Address = "neutral" | "m" | "f";
const KEY = "calil:lang";
const ADDRESS_KEY = "calil:address";
const EXNAMES_KEY = "calil:exnames";
export type ExNames = "en" | "he";

function initial(): Lang {
  try {
    return localStorage.getItem(KEY) === "he" ? "he" : "en";
  } catch {
    return "en";
  }
}

let lang: Lang = typeof window === "undefined" ? "en" : initial();
let address: Address = (() => {
  if (typeof window === "undefined") return "neutral";
  try {
    const a = localStorage.getItem(ADDRESS_KEY);
    return a === "m" || a === "f" ? a : "neutral";
  } catch {
    return "neutral";
  }
})();
const listeners = new Set<() => void>();

function applyToDocument(l: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = l;
  document.documentElement.dir = l === "he" ? "rtl" : "ltr";
}
if (typeof window !== "undefined") applyToDocument(lang);

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {}
  applyToDocument(l);
  listeners.forEach((f) => f());
}

let exNames: ExNames = (() => {
  if (typeof window === "undefined") return "en";
  try {
    return localStorage.getItem(EXNAMES_KEY) === "he" ? "he" : "en";
  } catch {
    return "en";
  }
})();

export function getExNames(): ExNames {
  return exNames;
}

export function setExNames(v: ExNames) {
  if (v === exNames) return;
  exNames = v;
  try {
    localStorage.setItem(EXNAMES_KEY, v);
  } catch {}
  listeners.forEach((f) => f());
}

/**
 * The name to show for an exercise. Built-ins can be shown in Hebrew (a display
 * preference); the stored name, search, dictation and import stay in English.
 */
export function exName(ex: { name: string; user_id: string | null } | null | undefined): string {
  if (!ex) return "";
  if (lang !== "he" || exNames !== "he") return ex.name;
  if (ex.user_id === null) return EXERCISE_NAMES_HE[ex.name] ?? ex.name;
  // A machine variant of a built-in ("Lat Pulldown · heavy one"): translate the base.
  const cut = ex.name.indexOf(" · ");
  const base = cut > 0 ? EXERCISE_NAMES_HE[ex.name.slice(0, cut)] : undefined;
  return base ? base + ex.name.slice(cut) : ex.name;
}

export function getAddress(): Address {
  return address;
}

export function setAddress(a: Address) {
  if (a === address) return;
  address = a;
  try {
    localStorage.setItem(ADDRESS_KEY, a);
  } catch {}
  listeners.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => lang, () => "en");
}

/** Re-renders on language or form-of-address changes. */
function usePrefsKey() {
  return useSyncExternalStore(subscribe, () => `${lang}:${address}:${exNames}`, () => "en:neutral:en");
}

type Vars = Record<string, string | number>;

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Translate outside React (actions, formatting). */
export function tr(s: string, vars?: Vars, l: Lang = lang, a: Address = address): string {
  if (l !== "he") return fill(s, vars);
  const gendered = a === "m" ? HE_M[s] : a === "f" ? HE_F[s] : undefined;
  return fill(gendered ?? HE[s] ?? s, vars);
}

/** Translate in components; re-renders when the language changes. */
export function useT() {
  const [l, a] = usePrefsKey().split(":") as [Lang, Address, ExNames];
  return (s: string, vars?: Vars) => tr(s, vars, l, a);
}

export const locale = (l: Lang = lang) => (l === "he" ? "he-IL" : "en-US");
