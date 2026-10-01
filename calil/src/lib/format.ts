import { getLang, locale, tr } from "./i18n";

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return String(Math.round(n * 100) / 100);
}

/** 1:05:09 → "01:05:09"; under an hour → "32:18" */
export function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** "25:00 · 4.2 km" for a cardio set. */
export function fmtCardio(x: { duration_seconds?: number | null; distance?: number | null }, distUnit: string) {
  const parts: string[] = [];
  if (x.duration_seconds) parts.push(fmtClock(x.duration_seconds));
  if (x.distance) parts.push(`${fmtNum(x.distance)} ${distUnit}`);
  return parts.join(" · ");
}

export function fmtDuration(totalSeconds: number) {
  const m = Math.round(totalSeconds / 60);
  const he = getLang() === "he";
  if (m < 60) return he ? `${m} דק׳` : `${m}m`;
  return he ? `${Math.floor(m / 60)} ש׳ ${m % 60} דק׳` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtVolume(v: number) {
  return Math.round(v).toLocaleString("en-US");
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString(locale(), opts);
}

export function fmtDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return tr("Today");
  if (d.toDateString() === y.toDateString()) return tr("Yesterday");
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(locale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return tr("Late night,");
  if (h < 12) return tr("Good morning,");
  if (h < 18) return tr("Good afternoon,");
  return tr("Good evening,");
}

/** Parses "82,5" and "82.5" alike; empty → null. */
export function parseNum(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
