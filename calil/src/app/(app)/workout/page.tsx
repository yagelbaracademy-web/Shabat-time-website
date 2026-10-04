"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "@/lib/hooks";
import { exName, useLang, useT } from "@/lib/i18n";
import { funMatch } from "@/lib/fun-weights";
import { addExercise, deleteWorkout, finishWorkout, nextPlan, renameWorkout, setWorkoutNote, templateFromWorkout } from "@/lib/actions";
import { fmtClock, fmtDay, fmtDuration, fmtNum, fmtVolume, haptic } from "@/lib/format";
import { getState, useStore } from "@/lib/store";
import { activeWorkout, completedWorkouts, PR_LABEL, setsOf, volumeOf, workoutExercises, workoutPR } from "@/lib/stats";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Icon } from "@/components/icons";
import { habitLabel, StartTiles, useStartWorkout } from "@/components/StartOptions";
import { BrandBar, Button, Screen, Sheet, SheetAction, Skeleton, Title, toast } from "@/components/ui";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { DictationBar } from "@/components/workout/DictationBar";
import { track } from "@/lib/track";

export default function WorkoutPage() {
  return (
    <Suspense>
      <WorkoutRoute />
    </Suspense>
  );
}

function WorkoutRoute() {
  const params = useSearchParams();
  const id = params.get("id");
  const loaded = useStore((s) => s.loaded);
  const exists = useStore((s) => (id ? !!s.workouts[id] : false), [id]);
  const active = useStore(activeWorkout);
  const router = useRouter();

  useEffect(() => {
    if (!id && active) router.replace(`/workout?id=${active.id}`);
  }, [id, active, router]);

  if (!loaded)
    return (
      <Screen>
        <BrandBar />
        <Skeleton className="mt-10 h-40" />
      </Screen>
    );
  if (id && exists) return <WorkoutView id={id} />;
  if (!id && active) return null;
  return <NoWorkout missing={!!id} />;
}

/* ───────────────────────────── nothing running ───────────────────────────── */

function NoWorkout({ missing }: { missing: boolean }) {
  const start = useStartWorkout();
  const next = useStore(() => nextPlan());
  const t = useT();
  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={missing ? t("That workout was deleted.") : t("Workout")}>{t("Ready when you are.")}</Title>
      <button
        type="button"
        onClick={() => (next ? start.suggested(next) : start.empty())}
        className="press mb-3 flex w-full items-center gap-4 rounded-[26px] bg-accent-soft p-4 text-start"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-card text-accent shadow-card">
          <Icon name="bolt" size={28} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[21px] font-semibold tracking-[-0.01em]">{next ? next.name : t("Start workout")}</span>
          <span className="block text-[15px] text-ink-2">
            {next ? (habitLabel(next) ?? t("Next in your plans")) : t("Empty session, add as you go")}
          </span>
        </span>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="arrowRight" size={24} />
        </span>
      </button>
      <StartTiles />
    </Screen>
  );
}

/* ───────────────────────────── the workout ───────────────────────────── */

function WorkoutView({ id }: { id: string }) {
  const router = useRouter();
  const workout = useStore((s) => s.workouts[id], [id]);
  const weIds = useStore(
    (s) =>
      workoutExercises(s, id)
        .map((we) => we.id)
        .join(","),
    [id],
  );
  const list = useMemo(() => (weIds ? weIds.split(",") : []), [weIds]);
  const live = !workout?.completed_at;
  const now = useNow(live);
  const t = useT();

  const [chosen, setExpanded] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [finish, setFinish] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const cards = useRef<Record<string, HTMLDivElement | null>>({});

  // Until the user picks one, expand the first exercise that still has work left.
  const fallback = useStore((s) => list.find((we) => setsOf(s, we).some((x) => !x.completed)) ?? list[list.length - 1] ?? null, [list]);
  const expanded = chosen && list.includes(chosen) ? chosen : fallback;

  // Opening a workout in progress lands on the exercise you're on, not at the top.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !live || !expanded) return;
    landed.current = true;
    if (list.indexOf(expanded) <= 0) return;
    const t = setTimeout(() => cards.current[expanded]?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(t);
  }, [expanded, list, live]);

  const advance = useCallback(
    (fromId: string) => {
      const s = getState();
      const i = list.indexOf(fromId);
      const next = [...list.slice(i + 1), ...list.slice(0, i)].find((we) => setsOf(s, we).some((x) => !x.completed));
      if (!next) return;
      setTimeout(() => {
        setExpanded(next);
        requestAnimationFrame(() => cards.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }, 450);
    },
    [list],
  );

  if (!workout) return null;
  const elapsed = live ? (now - new Date(workout.started_at).getTime()) / 1000 : (workout.duration_seconds ?? 0);

  return (
    <Screen className={live ? "pb-[calc(var(--tabbar-h)+var(--sab)+120px)]!" : ""}>
      <BrandBar />
      <header className="mt-6 mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] text-ink-2">{live ? t("Workout") : fmtDay(workout.started_at)}</p>
          {editingName ? (
            <input
              autoFocus
              defaultValue={workout.name}
              onBlur={(e) => {
                renameWorkout(id, e.target.value);
                setEditingName(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="w-full bg-transparent text-[32px]! leading-tight font-semibold tracking-[-0.02em] outline-none"
              aria-label={t("Workout name")}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="block max-w-full truncate text-start text-[32px] leading-tight font-semibold tracking-[-0.02em]"
            >
              {workout.name}
            </button>
          )}
          {(live || elapsed > 0) && (
            <p className="tnum mt-1 flex items-center gap-1.5 text-[17px] text-ink-2">
              <Icon name="clock" size={19} />
              {live ? fmtClock(elapsed) : fmtDuration(elapsed)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("Workout options")}
            onClick={() => setMenu(true)}
            className="press flex h-11 w-11 items-center justify-center rounded-full text-ink-2"
          >
            <Icon name="moreH" size={22} />
          </button>
          {live && (
            <button
              type="button"
              onClick={() => setFinish(true)}
              className="press h-11 rounded-full bg-fill px-5 text-[16px] font-semibold"
            >
              {t("Finish")}
            </button>
          )}
        </div>
      </header>

      <div className="space-y-3">
        {list.map((weId, i) => (
          <div key={weId} ref={(el) => void (cards.current[weId] = el)} className="scroll-mt-4">
            <ExerciseCard
              weId={weId}
              index={i}
              count={list.length}
              expanded={expanded === weId}
              onExpand={() => setExpanded(weId)}
              onExerciseDone={() => advance(weId)}
            />
          </div>
        ))}
      </div>

      {list.length === 0 && (
        <p className="px-1 pb-3 text-[16px] text-ink-2">{t("Add your first exercise. We’ll remember your numbers for next time.")}</p>
      )}

      <button
        type="button"
        onClick={() => setPicker(true)}
        className="press mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-ink-3/40 text-[17px] font-medium text-ink"
      >
        <Icon name="plus" size={20} /> {t("Add exercise")}
      </button>

      <NoteField id={id} />

      {live && <DictationBar workoutId={id} focusWeId={expanded} />}

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(exId) => {
          const weId = addExercise(id, exId);
          setExpanded(weId);
          haptic();
          setTimeout(() => cards.current[weId]?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
        }}
      />

      <FinishSheet id={id} open={finish} onClose={() => setFinish(false)} onDone={() => router.push("/")} />

      <Sheet open={menu} onClose={() => setMenu(false)} title={workout.name}>
        <div className="space-y-2 pb-3">
          <SheetAction
            icon="edit"
            onClick={() => {
              setMenu(false);
              setEditingName(true);
            }}
          >
            {t("Rename")}
          </SheetAction>
          <SheetAction
            icon="list"
            onClick={() => {
              const tid = templateFromWorkout(id);
              setMenu(false);
              if (tid)
                toast({
                  title: t("Saved as a plan"),
                  icon: "check",
                  action: { label: t("Open"), run: () => router.push(`/plan?id=${tid}`) },
                });
            }}
          >
            {t("Save as plan")}
          </SheetAction>
          <SheetAction
            icon="trash"
            danger
            onClick={() => {
              if (!confirm(live ? t("Discard this workout?") : t("Delete this workout from your history?"))) return;
              deleteWorkout(id);
              setMenu(false);
              router.replace(live ? "/" : "/plans?tab=history");
            }}
          >
            {live ? t("Discard workout") : t("Delete workout")}
          </SheetAction>
        </div>
      </Sheet>
    </Screen>
  );
}

function NoteField({ id }: { id: string }) {
  const note = useStore((s) => s.workouts[id]?.overall_note ?? "", [id]);
  const [open, setOpen] = useState(!!note);
  const [text, setText] = useState(note);
  const t = useT();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="press mt-2 flex h-12 items-center gap-2 px-1 text-[15px] text-ink-3">
        <Icon name="note" size={18} /> {t("Add workout note")}
      </button>
    );
  return (
    <label className="mt-3 block rounded-[20px] bg-fill p-4">
      <span className="mb-1 flex items-center gap-2 text-[14px] text-ink-2">
        <Icon name="note" size={16} /> {t("Workout note")}
      </span>
      <textarea
        value={text}
        rows={2}
        autoFocus={!note}
        onChange={(e) => {
          setText(e.target.value);
          setWorkoutNote(id, e.target.value);
        }}
        placeholder={t("How did it feel?")}
        dir="auto"
        className="w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-ink-3"
      />
    </label>
  );
}

/* ───────────────────────────── finish ───────────────────────────── */

/** "That's about 3 dairy cows": the day's volume as something you could picture. */
function VolumeFun({ id, volume, unit }: { id: string; volume: number; unit: string }) {
  const lang = useLang();
  const t = useT();
  const match = funMatch(unit === "lb" ? volume * 0.4536 : volume, id);
  if (!match) return null;
  const { thing, count } = match;
  const [one, many] = thing[lang === "he" ? "he" : "en"];
  const what = count === 1 ? one : `${count} ${many}`;
  return (
    <div className="mb-4 flex items-center gap-4 rounded-[20px] bg-card p-4">
      <span aria-hidden className="flex min-h-14 min-w-14 flex-wrap items-center justify-center rounded-[16px] bg-accent-soft px-2 text-[26px] leading-tight">
        {Array.from({ length: count }, (_, i) => (
          <span key={i}>{thing.emoji}</span>
        ))}
      </span>
      <p className="min-w-0 text-[16px] leading-snug">
        <span className="text-ink-2">{t("You lifted {n} {unit} today.", { n: fmtVolume(volume), unit: t(unit) })}</span>{" "}
        <span className="font-semibold">{t("That’s about {what}.", { what })}</span>
      </p>
    </div>
  );
}

function FinishSheet({ id, open, onClose, onDone }: { id: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const now = useNow(open);
  const t = useT();
  const summary = useStore(
    (s) => {
      const w = s.workouts[id];
      const wes = workoutExercises(s, id);
      const all = wes.flatMap((we) => setsOf(s, we.id));
      const done = all.filter((x) => x.completed);
      const open = all.filter((x) => !x.completed);
      const prs = wes.flatMap((we) => {
        const kind = workoutPR(s, we.id);
        return kind ? [{ name: exName(s.exercises[we.exercise_id]), kind }] : [];
      });
      return {
        w,
        done: done.length,
        open: open.length,
        openWithData: open.filter((x) => x.reps !== null).length,
        volume: volumeOf(done),
        prs,
        count: completedWorkouts(s).length + 1,
        unit: s.profile?.weight_unit ?? "kg",
      };
    },
    [id],
  );
  if (!summary.w) return null;
  const minutes = (now - new Date(summary.w.started_at).getTime()) / 1000;

  const end = (mode: "discard" | "complete") => {
    finishWorkout(id, mode);
    track("workout_finish");
    haptic(30);
    onClose();
    const n = summary.done + (mode === "complete" ? summary.openWithData : 0);
    toast({ title: t("Workout saved"), sub: `${fmtDuration(minutes)} · ${n === 1 ? t("1 set") : t("{n} sets", { n })}`, icon: "check" });
    onDone();
  };

  /** Stop without saving anything to history. */
  const discard = () => {
    deleteWorkout(id);
    track("workout_discard");
    haptic(20);
    onClose();
    toast({ title: t("Workout discarded"), icon: "trash" });
    onDone();
  };
  const nothingDone = summary.done === 0;

  return (
    <Sheet open={open} onClose={onClose} title={nothingDone ? t("Nothing to save yet") : t("Finish workout?")}>
      {nothingDone ? (
        <div className="pb-3">
          <p className="mb-5 px-1 text-[16px] text-ink-2">{t("No set was marked done, so this workout won’t go into your history.")}</p>
          <Button variant="danger" className="w-full" onClick={discard}>
            {t("Discard workout")}
          </Button>
          <Button variant="ghost" className="mt-1 w-full" onClick={onClose}>
            {t("Keep training")}
          </Button>
        </div>
      ) : (
        <div className="pb-3">
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-[20px] bg-card p-4">
            <div>
              <p className="tnum text-[22px] font-semibold">{fmtDuration(minutes)}</p>
              <p className="text-[14px] text-ink-2">{t("Time")}</p>
            </div>
            <div>
              <p className="tnum text-[22px] font-semibold">{summary.done}</p>
              <p className="text-[14px] text-ink-2">{t("Sets done")}</p>
            </div>
            <div>
              <p className="tnum text-[22px] font-semibold">{fmtVolume(summary.volume)}</p>
              <p className="text-[14px] text-ink-2">{t("Volume")}</p>
            </div>
          </div>
          {summary.prs.length > 0 && (
            <p className="mb-4 flex items-center gap-2 rounded-[16px] bg-gold-soft px-4 py-3 text-[15px] text-ink">
              <Icon name="trophy" size={19} className="text-gold" />
              <span>
                {t("New PR:")} {summary.prs.map((p) => `${p.name} (${t(PR_LABEL[p.kind])})`).join(", ")}
              </span>
            </p>
          )}
          <VolumeFun id={id} volume={summary.volume} unit={summary.unit} />
          {summary.open > 0 ? (
            <div className="space-y-2">
              <p className="px-1 pb-1 text-[15px] text-ink-2">
                {summary.open === 1 ? t("1 set isn’t marked done.") : t("{n} sets aren’t marked done.", { n: summary.open })}
              </p>
              <Button className="w-full" onClick={() => end("discard")}>
                {t("Finish, keep done sets only")}
              </Button>
              {summary.openWithData > 0 && (
                <Button variant="secondary" className="w-full" onClick={() => end("complete")}>
                  {summary.openWithData === 1
                    ? t("Mark the filled-in set as done and finish")
                    : t("Mark {n} as done and finish", { n: fmtNum(summary.openWithData) })}
                </Button>
              )}
            </div>
          ) : (
            <Button className="w-full" onClick={() => end("discard")}>
              {t("Finish workout")}
            </Button>
          )}
          <Button variant="ghost" className="mt-1 w-full" onClick={onClose}>
            {t("Keep training")}
          </Button>
          {/* Keeps the destructive action apart from the safe ones. */}
          <hr className="mx-1 mt-2 mb-1 border-line" />
          <button
            type="button"
            onClick={() => confirm(t("Discard this workout?")) && discard()}
            className="mt-1 h-11 w-full text-[15px] text-danger"
          >
            {t("Discard without saving")}
          </button>
        </div>
      )}
    </Sheet>
  );
}
