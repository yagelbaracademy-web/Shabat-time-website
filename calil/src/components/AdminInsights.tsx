"use client";

import { useMemo, useState } from "react";

export interface InsightRow {
  event: string;
  uses: number;
  users: number;
  days: number;
  last: string;
  first: string;
  screens: string[] | null;
}
export interface Insights {
  people_30d: number;
  events_30d: number;
  rows: InsightRow[];
}

/** Outcomes recorded in code ("do:…"), in words. */
const OUTCOMES: Record<string, string> = {
  dictate_voice: "Dictated by voice",
  dictate_text: "Typed into the dictation bar",
  dictate_failed: "Dictation failed",
  dictate_voice_sent: "Sent a recording as heard",
  dictate_voice_edited: "Fixed a recording before sending",
  dictate_voice_cleared: "Cleared a recording",
  paste_list: "Pasted a workout list",
  import_file: "Imported a program",
  swipe_start: "Swiped a plan to start",
  swipe_delete: "Swiped to delete",
  reorder_plans: "Reordered plans",
  warmup_set: "Added a warm-up set",
  rest_custom: "Set a rest time per exercise",
  machine_add: "Added a machine",
  machine_switch: "Switched machine",
  avatar_upload: "Uploaded a profile photo",
  workout_finish: "Finished a workout",
  workout_discard: "Discarded a workout",
  pr: "Hit a personal record",
  cardio: "Used the cardio stopwatch",
};

const SCREENS: Record<string, string> = {
  "/": "Home",
  "/workout": "Workout",
  "/plans": "Plans",
  "/plan": "Plan editor",
  "/progress": "Progress",
  "/exercise": "Exercise history",
  "/settings": "Settings",
  "/import": "Import",
};

type Tag = { label: string; tone: "good" | "warn" | "muted" };

interface Control {
  name: string;
  taps: number;
  users: number;
  days: number;
  seen: number;
  last: string | null;
  screens: string[];
  tag: Tag | null;
}

const daysSince = (iso: string | null) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity;
const n = (v: number) => v.toLocaleString("en-US");
const ago = (iso: string | null) => {
  const d = daysSince(iso);
  if (d === Infinity) return "never";
  if (d < 1 / 24) return "just now";
  if (d < 1) return `${Math.round(d * 24)}h ago`;
  return `${Math.round(d)}d ago`;
};
const pretty = (name: string) =>
  name.startsWith("link ")
    ? `Go to ${SCREENS[name.slice(5)] ?? name.slice(5)}`
    : name.replace(/\{name\}/g, "<exercise>").replace(/\{[a-z]+\}/g, "…");

function tagOf(c: Omit<Control, "tag">): Tag | null {
  if (c.taps === 0 && c.seen >= 5)
    return { label: "Seen, never used", tone: "warn" };
  if (c.taps > 0 && daysSince(c.last) >= 14)
    return { label: "Stopped being used", tone: "warn" };
  if (c.taps > 0 && c.seen >= 10 && c.taps / c.seen < 0.05)
    return { label: "Rarely chosen", tone: "muted" };
  if (c.days >= 5) return { label: "Used regularly", tone: "good" };
  return null;
}

const TONE = {
  good: "bg-accent-soft text-accent-ink",
  warn: "bg-gold-soft text-gold",
  muted: "bg-fill text-ink-2",
};

export function AdminInsights({
  data,
  withMe,
  onWithMe,
}: {
  data: Insights | null;
  withMe: boolean;
  onWithMe: (v: boolean) => void;
}) {
  const [filter, setFilter] = useState<"all" | "unused" | "regular">("all");

  const { controls, outcomes, screens, unnamed } = useMemo(() => {
    const rows = data?.rows ?? [];
    const by = (prefix: string) =>
      rows
        .filter((r) => r.event.startsWith(prefix))
        .map((r) => ({ ...r, name: r.event.slice(prefix.length) }));
    const taps = new Map(by("tap:").map((r) => [r.name, r]));
    const seen = new Map(by("seen:").map((r) => [r.name, r]));
    const names = new Set([...taps.keys(), ...seen.keys()]);
    names.delete("(unnamed)");
    const controls: Control[] = [...names].map((name) => {
      const t = taps.get(name);
      const s = seen.get(name);
      const base = {
        name,
        taps: t?.uses ?? 0,
        users: t?.users ?? 0,
        days: t?.days ?? 0,
        seen: s?.uses ?? 0,
        last: t?.last ?? null,
        screens: [...new Set([...(t?.screens ?? []), ...(s?.screens ?? [])])],
      };
      return { ...base, tag: tagOf(base) };
    });
    controls.sort((a, b) => b.taps - a.taps || b.seen - a.seen);
    return {
      controls,
      outcomes: by("do:").sort((a, b) => b.uses - a.uses),
      screens: by("view:").sort((a, b) => b.uses - a.uses),
      unnamed: taps.get("(unnamed)")?.uses ?? 0,
    };
  }, [data]);

  const shown = controls.filter((c) =>
    filter === "unused"
      ? c.taps === 0
      : filter === "regular"
        ? c.tag?.label === "Used regularly"
        : true,
  );
  const neverUsed = controls.filter((c) => c.taps === 0 && c.seen >= 5);
  const stopped = controls.filter((c) => c.tag?.label === "Stopped being used");
  const top = controls.filter((c) => c.taps > 0).slice(0, 5);

  return (
    <section>
      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink-2">
          Usage insights (last 30 days)
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[14px] text-ink-2">
          <input
            type="checkbox"
            checked={withMe}
            onChange={(e) => onWithMe(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Include my own use
        </label>
      </div>

      {!data || !data.rows.length ? (
        <p className="rounded-[20px] border border-line bg-card px-4 py-5 text-[14px] text-ink-3 shadow-card">
          Nothing recorded yet. Use the app a little and come back.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-[20px] border border-line bg-card p-4 shadow-card">
            <p className="text-[13px] text-ink-2">
              {n(data.people_30d)} {data.people_30d === 1 ? "person" : "people"}{" "}
              · {n(data.events_30d)} events
            </p>
            <ul className="mt-2 space-y-1.5 text-[15px]">
              {top.length > 0 && (
                <li>
                  <span className="font-semibold">Most used:</span>{" "}
                  {top
                    .map((c) => `${pretty(c.name)} (${n(c.taps)})`)
                    .join(", ")}
                </li>
              )}
              {neverUsed.length > 0 && (
                <li>
                  <span className="font-semibold">
                    On screen but never tapped ({neverUsed.length}):
                  </span>{" "}
                  {neverUsed
                    .slice(0, 8)
                    .map((c) => pretty(c.name))
                    .join(", ")}
                  {neverUsed.length > 8 ? "…" : ""}
                </li>
              )}
              {stopped.length > 0 && (
                <li>
                  <span className="font-semibold">Stopped being used:</span>{" "}
                  {stopped.map((c) => pretty(c.name)).join(", ")}
                </li>
              )}
              <li className="text-[13px] text-ink-3">
                Rare isn&apos;t always bad: delete account, export or import are
                used once by design. Small numbers are a direction, not a
                verdict.
                {unnamed
                  ? ` ${n(unnamed)} taps were on controls without a stable name.`
                  : ""}
              </li>
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[20px] border border-line bg-card p-4 shadow-card">
              <p className="mb-2 text-[13px] font-medium tracking-wide text-ink-3 uppercase">
                What happened
              </p>
              <ul className="tnum space-y-1 text-[14px]">
                {outcomes.length === 0 && <li className="text-ink-3">—</li>}
                {outcomes.map((o) => (
                  <li key={o.name} className="flex justify-between gap-3">
                    <span>{OUTCOMES[o.name] ?? o.name}</span>
                    <span className="text-ink-2">
                      {n(o.uses)} · {ago(o.last)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[20px] border border-line bg-card p-4 shadow-card">
              <p className="mb-2 text-[13px] font-medium tracking-wide text-ink-3 uppercase">
                Screens opened
              </p>
              <ul className="tnum space-y-1 text-[14px]">
                {screens.map((o) => (
                  <li key={o.name} className="flex justify-between gap-3">
                    <span>{SCREENS[o.name] ?? o.name}</span>
                    <span className="text-ink-2">
                      {n(o.uses)} · {o.days}d
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[20px] border border-line bg-card shadow-card">
            <div className="flex gap-2 border-b border-line px-4 py-3 text-[13px]">
              {(["all", "unused", "regular"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  data-track={`admin filter ${f}`}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 ${filter === f ? "bg-ink text-bg" : "bg-fill text-ink-2"}`}
                >
                  {f === "all"
                    ? `All buttons (${controls.length})`
                    : f === "unused"
                      ? "Never tapped"
                      : "Used regularly"}
                </button>
              ))}
            </div>
            <table className="w-full min-w-[680px] text-left text-[14px]">
              <thead className="text-[12px] tracking-wide text-ink-3 uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Button</th>
                  <th className="px-3 py-3 text-right font-medium">Taps</th>
                  <th className="px-3 py-3 text-right font-medium">
                    On screen
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Days used
                  </th>
                  <th className="px-3 py-3 font-medium">Last tap</th>
                  <th className="px-4 py-3 font-medium">Signal</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {shown.map((c) => (
                  <tr
                    key={c.name}
                    className="border-b border-line last:border-0"
                  >
                    <td className="max-w-[300px] px-4 py-2.5">
                      <span className="block truncate">{pretty(c.name)}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {c.screens.map((x) => SCREENS[x] ?? x).join(" · ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {n(c.taps)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-2">
                      {n(c.seen)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-2">
                      {c.days}
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{ago(c.last)}</td>
                    <td className="px-4 py-2.5">
                      {c.tag && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${TONE[c.tag.tone]}`}
                        >
                          {c.tag.label}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
