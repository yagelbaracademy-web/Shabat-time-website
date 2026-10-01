"use client";

import { useEffect, useState } from "react";
import {
  addSet,
  completeSet,
  deleteSet,
  restoreSet,
  setCardio,
  toggleSet,
} from "@/lib/actions";
import {
  elapsed,
  GOAL_EVENT,
  setCardioGoal,
  startCardio,
  stopCardio,
  useCardioRun,
} from "@/lib/cardio-timer";
import { fmtClock, fmtNum, haptic, parseNum } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { track } from "@/lib/track";
import type { WorkoutSet } from "@/lib/types";
import { SwipeRow } from "../SwipeRow";
import { Icon } from "../icons";
import { toast } from "../ui";

const GOALS = [10, 20, 30, 45]; // minutes

/**
 * Cardio in one move: press Start, press Stop. The time is saved and the round is done.
 * Typing the time instead works too, a goal buzzes when reached, distance is optional.
 */
export function CardioRows({
  weId,
  sets,
  distUnit,
  live,
  goalMinutes = null,
}: {
  weId: string;
  sets: WorkoutSet[];
  distUnit: string;
  live: boolean;
  /** The plan's time goal, preselected. */
  goalMinutes?: number | null;
}) {
  const t = useT();
  const run = useCardioRun();

  // The goal buzz arrives from the timer even when this card isn't open; say it here too.
  useEffect(() => {
    const onGoal = (e: Event) => {
      if (!sets.some((x) => x.id === (e as CustomEvent).detail)) return;
      haptic(60);
      toast(
        {
          title: t("Goal reached"),
          sub: t("Keep going or press Stop."),
          icon: "trophy",
          tone: "pr",
        },
        6000,
      );
    };
    window.addEventListener(GOAL_EVENT, onGoal);
    return () => window.removeEventListener(GOAL_EVENT, onGoal);
  }, [sets, t]);

  return (
    <div>
      <ul className="space-y-2">
        {sets.map((x, i) => (
          <li key={x.id}>
            <SwipeRow
              radius={18}
              onDelete={() => {
                if (run?.setId === x.id) stopCardio();
                const removed = deleteSet(x.id);
                if (removed)
                  toast({
                    title: t("Deleted"),
                    icon: "trash",
                    action: {
                      label: t("Undo"),
                      run: () => restoreSet(removed),
                    },
                  });
              }}
            >
              <CardioRound
                set={x}
                n={sets.length > 1 ? i + 1 : null}
                running={run?.setId === x.id ? run : null}
                busy={!!run && run.setId !== x.id}
                distUnit={distUnit}
                live={live}
                goalMinutes={goalMinutes}
              />
            </SwipeRow>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          addSet(weId);
          haptic();
        }}
        className="press mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-fill text-[16px] font-medium text-ink"
      >
        <Icon name="plus" size={19} /> {t("Add another round")}
      </button>
    </div>
  );
}

function CardioRound({
  set,
  n,
  running,
  busy,
  distUnit,
  live,
  goalMinutes,
}: {
  set: WorkoutSet;
  n: number | null;
  running: ReturnType<typeof useCardioRun>;
  busy: boolean;
  distUnit: string;
  live: boolean;
  goalMinutes: number | null;
}) {
  const t = useT();
  const now = useNow(!!running);
  const [goal, setGoal] = useState<number | null>(goalMinutes ? goalMinutes * 60 : null);
  const goalChoices = goalMinutes && !GOALS.includes(goalMinutes) ? [...GOALS, goalMinutes].sort((a, b) => a - b) : GOALS;
  const [editing, setEditing] = useState(false);
  const secs = running ? elapsed(running, now) : (set.duration_seconds ?? 0);
  const activeGoal = running ? running.goal : goal;

  const start = () => {
    if (busy) stopAndSave(); // only one clock at a time: finish the other round first
    startCardio(set.id, set.duration_seconds ?? 0, goal);
    haptic(15);
  };
  const stop = () => {
    stopAndSave();
    haptic(20);
  };
  const commitMinutes = (text: string) => {
    setEditing(false);
    const m = parseNum(text);
    if (m === null) return;
    setCardio(set.id, { duration_seconds: Math.round(m * 60) });
    if (m > 0) completeSet(set.id);
  };

  return (
    <div
      className={`bg-fill p-3 ${set.completed && !running ? "opacity-90" : ""}`}
    >
      <div className="flex items-center gap-3">
        {n !== null && (
          <span className="tnum w-5 text-center text-[15px] text-ink-3">
            {n}
          </span>
        )}
        {editing ? (
          <label className="flex items-baseline gap-2">
            <input
              autoFocus
              inputMode="decimal"
              defaultValue={
                secs ? fmtNum(Math.round((secs / 60) * 10) / 10) : ""
              }
              onBlur={(e) => commitMinutes(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              aria-label={t("Minutes")}
              className="tnum w-24 rounded-[10px] bg-card px-2 text-[30px] font-semibold outline-none"
            />
            <span className="text-[15px] text-ink-2">{t("min")}</span>
          </label>
        ) : (
          <button
            type="button"
            disabled={!!running}
            onClick={() => setEditing(true)}
            aria-label={t("Time {time}, tap to type it", {
              time: fmtClock(secs),
            })}
            className="tnum text-[34px] leading-none font-semibold tracking-[-0.02em]"
            dir="ltr"
          >
            {fmtClock(secs)}
          </button>
        )}
        {running && activeGoal ? (
          <span className="tnum text-[15px] text-ink-3" dir="ltr">
            / {fmtClock(activeGoal)}
          </span>
        ) : null}
        <span className="flex-1" />
        {running ? (
            <button
              type="button"
              onClick={stop}
              className="press flex h-12 items-center gap-1.5 rounded-full bg-ink px-5 text-[16px] font-semibold text-bg"
            >
              <Icon name="pause" size={18} /> {t("Stop")}
            </button>
          ) : set.completed || !live ? (
            // Done toggle; in a past workout this is the only control (no stopwatch).
            <button
              type="button"
              aria-label={set.completed ? t("Done. Tap to undo") : t("Mark as done")}
              onClick={() => toggleSet(set.id)}
              className={`press flex h-11 w-11 items-center justify-center rounded-full ${
                set.completed ? "bg-accent text-white" : "border-2 border-ink-3/50 text-transparent"
              }`}
            >
              <Icon name="check" size={20} stroke={2.6} />
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className="press flex h-12 items-center gap-1.5 rounded-full bg-accent px-5 text-[16px] font-semibold text-white"
            >
              <Icon name="play" size={18} />{" "}
              {secs > 0 ? t("Resume") : t("Start")}
            </button>
          )}
      </div>

      {running && activeGoal ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-1000"
            style={{ width: `${Math.min(100, (secs / activeGoal) * 100)}%` }}
          />
        </div>
      ) : null}

      {live && !set.completed && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="pe-1 text-[13px] whitespace-nowrap text-ink-3">{t("Goal (min)")}</span>
          {goalChoices.map((m) => {
            const on = activeGoal === m * 60;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                aria-label={t("{n} min", { n: m })}
                onClick={() => {
                  const next = on ? null : m * 60;
                  setGoal(next);
                  if (running) setCardioGoal(next);
                  haptic(6);
                }}
                className={`press tnum h-8 min-w-11 rounded-full px-3 text-[14px] font-medium whitespace-nowrap ${on ? "bg-accent text-white" : "bg-card text-ink-2"}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      <label className="mt-2.5 flex h-10 items-center gap-2 rounded-[12px] bg-card px-3">
        <input
          inputMode="decimal"
          defaultValue={set.distance ? fmtNum(set.distance) : ""}
          key={set.distance ?? "none"}
          onBlur={(e) => {
            const d = parseNum(e.target.value);
            if (d !== (set.distance ?? null))
              setCardio(set.id, { distance: d });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder={t("Distance (optional)")}
          aria-label={t("Distance")}
          className="tnum min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
        <span className="text-[14px] text-ink-3">{distUnit}</span>
      </label>
    </div>
  );
}

/** Saves the running clock onto its set and marks it done. */
function stopAndSave() {
  const r = stopCardio();
  if (!r) return;
  setCardio(r.setId, { duration_seconds: r.seconds });
  if (r.seconds > 0) completeSet(r.setId);
  track("cardio");
}
