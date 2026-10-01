"use client";

import { useMemo } from "react";
import { fmtDate, fmtNum } from "@/lib/format";
import { inRange, metricOf, type RangeKey, type Session } from "@/lib/stats";
import { LineChart } from "./charts";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { Segmented } from "./ui";

export const RANGE_KEYS: RangeKey[] = ["1M", "3M", "6M", "1Y", "All"];

/** Chart + Then / Now / change for one exercise. */
export function ProgressBlock({
  sessions,
  range,
  onRange,
  unit,
}: {
  sessions: Session[];
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  unit: string;
}) {
  const t = useT();
  const ranged = useMemo(() => inRange(sessions, range), [sessions, range]);
  const shown = ranged.length ? ranged : sessions.slice(0, 1);
  const { loaded, value } = metricOf(sessions);
  const pts = useMemo(
    () =>
      [...shown].reverse().map((x) => ({
        t: new Date(x.workout.started_at).getTime(),
        y: value(x),
        label: loaded ? `${fmtNum(x.top?.weight)} ${t(unit)}` : t("{n} reps", { n: x.top?.reps ?? 0 }),
      })),
    [shown, value, loaded, unit, t],
  );
  const first = shown[shown.length - 1];
  const last = shown[0];
  const change = first && last && value(first) ? Math.round(((value(last) - value(first)) / value(first)) * 100) : null;
  const fmt = (x: Session) => (loaded ? `${fmtNum(x.top?.weight)} ${t(unit)}` : t("{n} reps", { n: x.top?.reps ?? 0 }));
  const sub = (x: Session) => (loaded ? `× ${x.top?.reps} · ${fmtDate(x.workout.started_at)}` : fmtDate(x.workout.started_at));

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Segmented options={RANGE_KEYS.map((k) => ({ value: k, label: t(k) }))} value={range} onChange={onRange} size="sm" />
      </div>
      {pts.length > 1 ? (
        <LineChart points={pts} unit={loaded ? t("Weight ({unit})", { unit: t(unit) }) : t("Reps")} />
      ) : (
        <p className="py-8 text-center text-[15px] text-ink-3">{t("Log this exercise twice to see a trend.")}</p>
      )}
      {first && last && first !== last && (
        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-stretch gap-0 rounded-[18px] bg-fill p-1.5">
          <div className="px-3 py-2">
            <p className="text-[14px] text-ink-2">{t("Then")}</p>
            <p className="tnum text-[22px] font-semibold tracking-[-0.01em]">{fmt(first)}</p>
            <p className="tnum text-[13px] text-ink-3">{sub(first)}</p>
          </div>
          <div className="border-s border-line px-3 py-2">
            <p className="text-[14px] text-ink-2">{t("Now")}</p>
            <p className="tnum text-[22px] font-semibold tracking-[-0.01em]">{fmt(last)}</p>
            <p className="tnum text-[13px] text-ink-3">{sub(last)}</p>
          </div>
          {change !== null && (
            <div className={`flex min-w-[96px] flex-col items-center justify-center rounded-[14px] px-3 ${change >= 0 ? "bg-accent-soft" : "bg-card"}`}>
              <p className={`tnum flex items-center gap-1 text-[21px] font-semibold ${change >= 0 ? "text-accent-ink" : "text-ink-2"}`}>
                {change >= 0 && <Icon name="trendUp" size={19} stroke={2.2} />}
                {change > 0 ? "+" : ""}
                {change}%
              </p>
              <p className="text-[13px] text-ink-2">{change >= 0 ? t("Increase") : t("Change")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
