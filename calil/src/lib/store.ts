"use client";

import { useMemo, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { getLang } from "./i18n";
import type { CollectionName, Profile, TableName, Tables } from "./types";

/* ────────────────────────────────────────────────────────────────────────────
 * Local-first store.
 *
 * All of the user's data lives in memory (and in localStorage) so every screen
 * renders instantly and every edit is optimistic. Mutations are recorded in a
 * persistent outbox and pushed to Supabase in the background; if the network
 * drops mid-workout nothing is lost, the queue simply waits.
 * ──────────────────────────────────────────────────────────────────────────── */

type Collections = { [K in CollectionName]: Record<string, Tables[K]> };

export interface RestTimer {
  /** epoch ms when the timer hits zero; null while paused */
  endsAt: number | null;
  /** ms left, only set while paused */
  pausedLeft: number | null;
  total: number; // seconds
}

export interface State extends Collections {
  userId: string | null;
  profile: Profile | null;
  loaded: boolean;
  pending: number;
  online: boolean;
  rest: RestTimer | null;
}

const empty = (): Collections => ({
  exercises: {},
  exercise_aliases: {},
  workout_templates: {},
  template_exercises: {},
  workouts: {},
  workout_exercises: {},
  sets: {},
});

const COLLECTIONS: CollectionName[] = [
  "exercises",
  "exercise_aliases",
  "workout_templates",
  "template_exercises",
  "workouts",
  "workout_exercises",
  "sets",
];

let state: State = {
  ...empty(),
  userId: null,
  profile: null,
  loaded: false,
  pending: 0,
  online: true,
  rest: null,
};

const listeners = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  schedulePersist();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot = state;

/** Subscribe to the store; the selector result is memoised per state version. */
export function useStore<T>(selector: (s: State) => T, deps: unknown[] = []): T {
  const s = useSyncExternalStore(subscribe, getState, () => serverSnapshot);
  // Deliberately dynamic deps: the selector is re-run only when state or deps change.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  return useMemo(() => selector(s), [s, ...deps]);
}

/* ───────────────────────────── row helpers ───────────────────────────── */

export function putRows<K extends CollectionName>(table: K, rows: Tables[K][]) {
  if (!rows.length) return;
  setState((s) => {
    const col = { ...s[table] } as Record<string, Tables[K]>;
    for (const r of rows) col[(r as { id: string }).id] = r;
    return { [table]: col } as Partial<State>;
  });
  rows.forEach((r) => enqueue(table, (r as { id: string }).id, "upsert"));
}

export function patchRow<K extends CollectionName>(table: K, id: string, patch: Partial<Tables[K]>) {
  const current = state[table][id];
  if (!current) return;
  putRows(table, [{ ...current, ...patch } as Tables[K]]);
}

/** Deletes rows locally. Children are removed by the caller; the DB cascades. */
export function removeRows(table: CollectionName, ids: string[], { sync = true } = {}) {
  if (!ids.length) return;
  setState((s) => {
    const col = { ...s[table] } as Record<string, unknown>;
    ids.forEach((id) => delete col[id]);
    return { [table]: col } as Partial<State>;
  });
  if (sync) ids.forEach((id) => enqueue(table, id, "delete"));
}

export function saveProfile(patch: Partial<Profile>) {
  if (!state.profile) return;
  setState({ profile: { ...state.profile, ...patch } });
  enqueue("profiles", state.profile.id, "upsert");
}

/* ───────────────────────────── persistence ───────────────────────────── */

const dataKey = (uid: string) => `calil:data:v1:${uid}`;
const queueKey = (uid: string) => `calil:queue:v1:${uid}`;
const restKey = "calil:rest";

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (typeof window === "undefined" || !state.userId) return;
  if (persistTimer) return;
  persistTimer = setTimeout(persistNow, 400);
}

function persistNow() {
  persistTimer = null;
  const uid = state.userId;
  if (!uid) return;
  try {
    const data: Record<string, unknown> = { profile: state.profile };
    COLLECTIONS.forEach((c) => (data[c] = state[c]));
    localStorage.setItem(dataKey(uid), JSON.stringify(data));
    localStorage.setItem(queueKey(uid), JSON.stringify(queue));
    if (state.rest) localStorage.setItem(restKey, JSON.stringify(state.rest));
    else localStorage.removeItem(restKey);
  } catch {
    // Storage full or unavailable: the in-memory store and server still work.
  }
}

/* ───────────────────────────── sync outbox ───────────────────────────── */

type Op = { t: TableName; id: string; op: "upsert" | "delete"; tries?: number };
let queue: Op[] = [];
let inflight: Op[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function enqueue(t: TableName, id: string, op: Op["op"]) {
  if (op === "upsert") {
    // The row is read at send time, so one queued upsert per row is enough,
    // unless that upsert is already on the wire.
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (q.t === t && q.id === id) {
        if (q.op === "upsert" && !inflight.includes(q)) return;
        break;
      }
    }
  }
  queue.push({ t, id, op });
  setState({ pending: queue.length });
  scheduleFlush(350);
}

function scheduleFlush(ms: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), ms);
}

function rowFor(t: TableName, id: string): unknown {
  if (t === "profiles") return state.profile?.id === id ? state.profile : undefined;
  return state[t][id];
}

function isNetworkError(e: { message?: string; code?: string } | null) {
  if (!e) return false;
  return !e.code || /fetch|network|load failed/i.test(e.message ?? "");
}

export async function flush(): Promise<boolean> {
  if (flushing || !state.userId) return queue.length === 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  flushing = true;
  try {
    while (queue.length) {
      // Group the longest prefix with the same table + op into one request.
      const head = queue[0];
      let n = 1;
      while (n < queue.length && n < 200 && queue[n].t === head.t && queue[n].op === head.op) n++;
      inflight = queue.slice(0, n);
      const ids = [...new Set(inflight.map((o) => o.id))];

      let error: { message?: string; code?: string } | null = null;
      if (head.op === "upsert") {
        const rows = ids.map((id) => rowFor(head.t, id)).filter(Boolean);
        if (rows.length) ({ error } = await supabase().from(head.t).upsert(rows));
      } else {
        ({ error } = await supabase().from(head.t).delete().in("id", ids));
      }

      if (error) {
        if (isNetworkError(error)) {
          setState({ online: false });
          scheduleFlush(5000);
          return false;
        }
        head.tries = (head.tries ?? 0) + 1;
        console.warn("[calil] sync error", head.t, error);
        if (head.tries < 5) {
          scheduleFlush(2000 * head.tries);
          return false;
        }
        // Give up on a batch the server keeps rejecting, so it can't block the queue.
      }
      queue = queue.filter((o) => !inflight.includes(o));
      inflight = [];
      setState({ pending: queue.length, online: true });
    }
    return true;
  } catch {
    setState({ online: false });
    scheduleFlush(5000);
    return false;
  } finally {
    inflight = [];
    flushing = false;
    persistNow();
  }
}

/* ───────────────────────────── loading ───────────────────────────── */

async function fetchAll<K extends TableName>(table: K): Promise<Tables[K][] | null> {
  const out: Tables[K][] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase().from(table).select("*").range(from, from + page - 1);
    if (error) return null;
    out.push(...((data ?? []) as Tables[K][]));
    if (!data || data.length < page) return out;
  }
}

function toMap<T extends { id: string }>(rows: T[]) {
  const m: Record<string, T> = {};
  for (const r of rows) m[r.id] = r;
  return m;
}

let bound = false;

/** Called once the auth session is known. Renders from cache, then refreshes. */
export async function initStore(userId: string, email: string | null) {
  if (state.userId === userId && state.loaded) return;
  queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(queueKey(userId)) ?? "[]");
  } catch {}
  let cached: Partial<State> = {};
  try {
    const raw = localStorage.getItem(dataKey(userId));
    if (raw) cached = { ...JSON.parse(raw), loaded: true };
  } catch {}
  let rest: RestTimer | null = null;
  try {
    rest = JSON.parse(localStorage.getItem(restKey) ?? "null");
  } catch {}

  state = { ...state, ...empty(), profile: null, ...cached, userId, pending: queue.length, rest };
  listeners.forEach((l) => l());

  if (!bound) {
    bound = true;
    window.addEventListener("online", () => {
      setState({ online: true });
      void flush();
    });
    window.addEventListener("offline", () => setState({ online: false }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        persistNow();
        void flush();
      } else void refresh();
    });
  }

  await refresh(email);
}

let refreshing = false;
export async function refresh(email: string | null = null) {
  const uid = state.userId;
  if (!uid || refreshing) return;
  refreshing = true;
  try {
    const flushed = await flush();
    if (!flushed) {
      setState({ loaded: true });
      return;
    }
    const [profiles, ...cols] = await Promise.all([
      fetchAll("profiles"),
      ...COLLECTIONS.map((c) => fetchAll(c)),
    ]);
    if (!profiles || cols.some((c) => c === null)) {
      setState({ loaded: true, online: navigator.onLine });
      return;
    }
    // A local edit made while we were fetching wins; try again later.
    if (queue.length) {
      setState({ loaded: true });
      return;
    }
    const next: Partial<State> = { loaded: true, online: true };
    COLLECTIONS.forEach((c, i) => {
      (next as Record<string, unknown>)[c] = toMap(cols[i] as { id: string }[]);
    });
    let profile = (profiles as Profile[]).find((p) => p.id === uid) ?? null;
    setState(next);
    if (!profile) {
      profile = {
        id: uid,
        name: null,
        email,
        avatar_url: null,
        weight_unit: "kg",
        rest_timer_enabled: true,
        default_rest_seconds: 90,
        dictation_lang: "en-US",
        language: getLang(),
        address: "neutral",
        exercise_names: "en",
        rest_by_exercise: {},
        terms_version: null,
        terms_accepted_at: null,
        created_at: new Date().toISOString(),
      };
      setState({ profile });
      enqueue("profiles", uid, "upsert");
    } else setState({ profile });
  } finally {
    refreshing = false;
  }
}

export function resetStore() {
  if (state.userId) {
    try {
      localStorage.removeItem(dataKey(state.userId));
      localStorage.removeItem(queueKey(state.userId));
      localStorage.removeItem(restKey);
    } catch {}
  }
  queue = [];
  state = { ...state, ...empty(), userId: null, profile: null, loaded: false, pending: 0, rest: null };
  listeners.forEach((l) => l());
}
