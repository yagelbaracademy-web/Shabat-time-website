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
import { Button, Sheet, toast } from "../ui";

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
  const [goal, setGoal] = useState<number | null>(
    goalMinutes ? goalMinutes * 60 : null,
  );

  const [editing, setEditing] = useState(false);
  const secs = running ? elapsed(running, now) : (set.duration_seconds ?? 0);
  const activeGoal = running ? running.goal : goal;
  // A goal of your own shows up next to the quick ones, selected.
  const custom = [
    goalMinutes,
    activeGoal ? Math.round(activeGoal / 60) : null,
  ].filter((m): m is number => !!m && !GOALS.includes(m));
  const goalChoices = [...new Set([...GOALS, ...custom])].sort((a, b) => a - b);

  const start = () => {
    if (busy) stopAndSave(); // only one clock at a time: finish the other round first
    startCardio(set.id, set.duration_seconds ?? 0, goal);
    haptic(15);
  };
  const stop = () => {
    stopAndSave();
    haptic(20);
  };

  const timeSheet = (
    <TimeSheet
      open={editing}
      onClose={() => setEditing(false)}
      goal={activeGoal}
      done={set.duration_seconds ?? null}
      canLog={!running}
      onGoal={(g) => {
        setGoal(g);
        if (running) setCardioGoal(g);
      }}
      onLog={(m) => {
        setCardio(set.id, { duration_seconds: Math.round(m * 60) });
        if (m > 0) completeSet(set.id);
      }}
    />
  );

  // A finished round (or a past workout): one quiet line; tap it to edit.
  if ((set.completed || !live) && !running)
    return (
      <div className="flex min-h-[56px] items-center gap-3 bg-fill px-4">
        {n !== null && (
          <span className="tnum w-5 text-center text-[15px] text-ink-3">
            {n}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="tnum min-w-0 flex-1 text-start text-[18px] font-semibold"
          dir="auto"
        >
          {fmtClock(secs)}
          {set.distance ? (
            <span className="font-normal text-ink-2">
              {" "}
              · {fmtNum(set.distance)} {distUnit}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={
            set.completed ? t("Done. Tap to undo") : t("Mark as done")
          }
          onClick={() => toggleSet(set.id)}
          className={`press flex h-10 w-10 items-center justify-center rounded-full ${set.completed ? "bg-accent text-white" : "border-2 border-ink-3/50 text-transparent"}`}
        >
          <Icon name="check" size={19} stroke={2.6} />
        </button>
        {timeSheet}
      </div>
    );

  // The round you're on: a big ring in the middle, one button under it.
  return (
    <div className="bg-fill px-4 pt-5 pb-4">
      {n !== null && (
        <p className="tnum mb-1 text-center text-[13px] text-ink-3">
          {t("Round {n}", { n })}
        </p>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={t("Time {time}, tap to set a goal or type it", {
          time: fmtClock(secs),
        })}
        className="press relative mx-auto flex h-[200px] w-[200px] items-center justify-center"
        dir="ltr"
      >
        <Ring
          size={200}
          progress={activeGoal ? Math.min(1, secs / activeGoal) : null}
          spinning={!!running && !activeGoal}
        />
        <span className="relative flex flex-col items-center">
          <span className="tnum text-[46px] leading-none font-semibold tracking-[-0.03em]">
            {fmtClock(secs)}
          </span>
          <span className="tnum mt-1.5 text-[14px] text-ink-3">
            {activeGoal
              ? secs >= activeGoal
                ? t("Goal reached")
                : t("{n} min left", { n: Math.ceil((activeGoal - secs) / 60) })
              : t("tap to edit")}
          </span>
        </span>
      </button>

      <div className="mt-4 flex justify-center">
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="press flex h-14 items-center gap-2 rounded-full bg-ink px-9 text-[18px] font-semibold text-bg shadow-float"
          >
            <Icon name="pause" size={20} /> {t("Stop")}
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="press flex h-14 items-center gap-2 rounded-full bg-accent px-9 text-[18px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(28,116,234,0.7)]"
          >
            <Icon name="play" size={20} /> {secs > 0 ? t("Resume") : t("Start")}
          </button>
        )}
      </div>

      <p className="mt-5 mb-2 text-start text-[13px] text-ink-3">
        {t("Goal (min)")}
      </p>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${goalChoices.length}, minmax(0, 1fr))`,
        }}
      >
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
              className={`press tnum h-11 rounded-[14px] border text-[16px] font-medium ${
                on
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line bg-card text-ink-2"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      <label className="mt-3 flex h-12 items-center gap-3 rounded-[14px] border border-line bg-card px-4">
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
        <span className="h-5 w-px bg-line" aria-hidden />
        <span className="text-[14px] text-ink-3">{distUnit}</span>
      </label>
      {timeSheet}
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

/** Fills toward the goal; without a goal it slowly spins while the clock runs. */
function Ring({
  progress,
  spinning,
  size = 104,
}: {
  progress: number | null;
  spinning: boolean;
  size?: number;
}) {
  const W = size >= 160 ? 10 : 7;
  const R = size / 2 - W / 2 - 1;
  const C = 2 * Math.PI * R;
  const c = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`absolute inset-0 -rotate-90 ${spinning ? "animate-[spin_3s_linear_infinite]" : ""}`}
      aria-hidden
    >
      <circle
        cx={c}
        cy={c}
        r={R}
        fill="none"
        stroke="var(--line)"
        strokeWidth={W}
      />
      {(progress !== null || spinning) && (
        <circle
          cx={c}
          cy={c}
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={W}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={
            progress !== null ? C * (1 - Math.max(0.005, progress)) : C * 0.75
          }
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      )}
    </svg>
  );
}

/** Tap the time: set your own goal, or type the time you did. */
function TimeSheet({
  open,
  onClose,
  goal,
  done,
  canLog,
  onGoal,
  onLog,
}: {
  open: boolean;
  onClose: () => void;
  goal: number | null;
  done: number | null;
  canLog: boolean;
  onGoal: (seconds: number | null) => void;
  onLog: (minutes: number) => void;
}) {
  const t = useT();
  const [g, setG] = useState("");
  const [d, setD] = useState("");
  const field =
    "tnum h-14 w-full rounded-[14px] bg-card px-4 text-[22px] font-semibold outline-none";
  return (
    <Sheet open={open} onClose={onClose} title={t("Time")}>
      <form
        className="space-y-4 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          const gm = parseNum(g);
          if (g.trim() !== "")
            onGoal(gm && gm > 0 ? Math.round(gm * 60) : null);
          const dm = parseNum(d);
          if (canLog && dm !== null) onLog(dm);
          setG("");
          setD("");
          haptic(10);
          onClose();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block px-1 text-[15px] text-ink-2">
            {t("Your goal (minutes)")}
          </span>
          <input
            inputMode="decimal"
            className={field}
            placeholder={goal ? fmtNum(goal / 60) : t("e.g. 25")}
            value={g}
            onChange={(e) => setG(e.target.value)}
          />
        </label>
        {canLog && (
          <label className="block">
            <span className="mb-1.5 block px-1 text-[15px] text-ink-2">
              {t("Or type the time you did (minutes)")}
            </span>
            <input
              inputMode="decimal"
              className={field}
              placeholder={
                done ? fmtNum(Math.round((done / 60) * 10) / 10) : t("e.g. 30")
              }
              value={d}
              onChange={(e) => setD(e.target.value)}
            />
          </label>
        )}
        <Button type="submit" className="w-full">
          {t("Save")}
        </Button>
      </form>
    </Sheet>
  );
}
