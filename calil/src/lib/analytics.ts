import { HE, HE_F, HE_M } from "./i18n-he";
import { supabase } from "./supabase";

/**
 * Product analytics, first-party only (our own Supabase). Records which buttons
 * people see and tap, which screens they open, and a few outcomes ("do:…").
 * Names are always the English UI key ("Add set", "{name} options"), whatever the
 * language, and never include workout content, exercise names or typed text.
 * The server stores a salted hash instead of the user id.
 */

interface Ev {
  event: string;
  screen: string | null;
  at: string;
}

let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seen = new Set<string>(); // "screen|key", once per session

const screenNow = () => (typeof location === "undefined" ? null : location.pathname.replace(/\/+$/, "") || "/");

export function log(event: string, screen: string | null = screenNow()) {
  queue.push({ event: event.slice(0, 80), screen: screen?.slice(0, 40) ?? null, at: new Date().toISOString() });
  if (queue.length > 500) queue = queue.slice(-500);
  if (!timer) timer = setTimeout(flush, 8000);
}

export async function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const batch = queue.splice(0, 200);
  try {
    const { error } = await supabase().rpc("track_batch", { events: batch });
    if (error) throw error;
  } catch {
    queue = [...batch, ...queue].slice(-500); // try again later
  }
  if (queue.length) timer = setTimeout(flush, 8000);
}

/* ───────────── stable names: shown text → English key ───────────── */

let exact: Map<string, string> | null = null;
let patterns: { re: RegExp; key: string }[] = [];

function buildIndex() {
  exact = new Map();
  patterns = [];
  const add = (shown: string, key: string) => {
    const s = norm(shown);
    if (!s) return;
    if (shown.includes("{")) {
      const src = s.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[a-z]+\}/gi, "(.+)");
      patterns.push({ re: new RegExp(`^${src}$`), key });
    } else if (!exact!.has(s)) exact!.set(s, key);
  };
  for (const dict of [HE, HE_M, HE_F]) for (const [en, he] of Object.entries(dict)) add(he, en);
  for (const en of Object.keys(HE)) add(en, en);
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function keyOf(text: string | null | undefined): string | null {
  const s = norm(text ?? "");
  if (!s || s.length > 80) return null;
  if (!exact) buildIndex();
  const hit = exact!.get(s);
  if (hit) return hit;
  for (const p of patterns) if (p.re.test(s)) return p.key;
  return null;
}

/** The stable name of a control, or null when it can't be named without its content. */
export function controlName(el: Element): string | null {
  const own = el.getAttribute("data-track");
  if (own) return own;
  if (el instanceof HTMLAnchorElement) {
    try {
      const u = new URL(el.href, location.href);
      if (u.origin === location.origin) return `link ${u.pathname.replace(/\/+$/, "") || "/"}`;
    } catch {}
    return "link external";
  }
  const candidates = [el.getAttribute("aria-label"), (el as HTMLElement).innerText];
  // Also each text piece on its own, so "Move up (already first)" still finds "Move up".
  for (const n of Array.from(el.querySelectorAll("span, p"))) candidates.push((n as HTMLElement).innerText);
  for (const c of candidates) {
    const k = keyOf(c);
    if (k) return k;
  }
  return null;
}

const CONTROLS = "button, a[href], [role=button], [role=tab], [role=switch], input[type=checkbox]";

export function controlFrom(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(CONTROLS) : null;
}

/** Records the controls currently on screen as "seen" (once per screen per session). */
export function scanSeen() {
  const screen = screenNow();
  for (const el of Array.from(document.querySelectorAll(CONTROLS))) {
    if (!(el as HTMLElement).offsetParent && getComputedStyle(el).position !== "fixed") continue;
    if (el.closest("[inert], [aria-hidden=true]")) continue;
    const name = controlName(el);
    if (!name) continue;
    const id = `${screen}|${name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    log(`seen:${name}`, screen);
  }
}
