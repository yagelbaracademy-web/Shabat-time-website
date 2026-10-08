"use client";

import Link from "next/link";
import { useState } from "react";
import { useNow, useToday } from "@/lib/hooks";
import { nextPlan, setPlanDays } from "@/lib/actions";
import { fmtCardio, fmtClock, fmtDuration, fmtNum, fmtVolume, greeting } from "@/lib/format";
import { useStore } from "@/lib/store";
import { exName, locale, useT } from "@/lib/i18n";
import { addDays, nextPlannedDay, plannedOn, sameDay, startOfWeek, workoutsOn } from "@/lib/schedule";
import { clockStartAt, completedWorkouts, isCardio, liveSeconds, monthStats, setsOf, topSet, workoutExercises } from "@/lib/stats";
import { track } from "@/lib/track";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { Icon } from "@/components/icons";
import { MonthBars } from "@/components/charts";
import { habitLabel, NewWorkoutSheet, useStartWorkout } from "@/components/StartOptions";
import { BrandBar, Card, CardHeader, Screen, Skeleton, Stat, Title, toast } from "@/components/ui";
import { useRouter } from "next/navigation";
import { setOnboarding, useOnboarding } from "@/lib/onboarding";
import type { IconName } from "@/components/icons";

const HEADLINES = ["Let’s move today.", "Ready for something Calil?", "One set at a time.", "Every set makes you stronger."];

/** "Today": where you are in the week, and the one thing to do next. */
export default function Home() {
  const loaded = useStore((s) => s.loaded);
  const name = useStore((s) => s.profile?.name?.split(" ")[0] ?? "");
  const today = useToday();
  const [picked, setSelected] = useState<Date | null>(null);
  // Until a day is picked, the strip follows today (which moves at midnight).
  const selected = picked ?? today;
  const t = useT();
  const fresh = useStore((s) => Object.keys(s.workout_templates).length === 0 && Object.keys(s.workouts).length === 0);
  const asking = fresh;
  const hasHistory = useStore((s) => completedWorkouts(s).length > 0);
  const hello = { g: greeting(today).replace(",", name ? `, ${name}` : ","), h: t(HEADLINES[today.getDate() % HEADLINES.length]) };

  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={hello.g}>{hello.h}</Title>
      {loaded ? (
        <div className="space-y-3">
          <HowYouTrain />
          <WeekStrip today={today} selected={selected} onSelect={setSelected} />
          {/* While "How do you train?" is up, it is the way to start; no second start card. */}
          {sameDay(selected, today) ? !asking && <TodayCard /> : <DayCard day={selected} today={today} />}
          <FirstSteps />
          {hasHistory && <ThisMonth />}
        </div>
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[140px]" />
          <Skeleton className="h-60" />
        </div>
      )}
    </Screen>
  );
}

/* ───────────────────────────── week strip ───────────────────────────── */

function WeekStrip({ today, selected, onSelect }: { today: Date; selected: Date; onSelect: (d: Date) => void }) {
  const t = useT();
  const [shown, setWeekStart] = useState<Date | null>(null);
  const weekStart = shown ?? startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const marks = useStore(
    (s) =>
      days
        .map((d) => {
          const done = workoutsOn(s, d).length > 0;
          const planned = plannedOn(s, d).length > 0;
          return done ? "d" : planned ? "p" : "-";
        })
        .join(""),
    [weekStart.getTime()],
  );
  const thisWeek = sameDay(weekStart, startOfWeek(today));
  const range = `${days[0].toLocaleDateString(locale(), { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(locale(), { day: "numeric", month: "short" })}`;
  const doneCount = [...marks].filter((m) => m === "d").length;

  const go = (n: number) => {
    const next = addDays(weekStart, n * 7);
    setWeekStart(next);
    onSelect(sameDay(next, startOfWeek(today)) ? today : next);
  };

  return (
    <Card className="p-3 pt-2.5">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-[14px] text-ink-2">
          <span className="font-semibold text-ink">{thisWeek ? t("This week") : range}</span>
          {doneCount > 0 ? ` · ${doneCount === 1 ? t("1 workout") : t("{n} workouts", { n: doneCount })}` : ""}
        </p>
        <div className="flex">
          <button type="button" aria-label={t("Previous week")} onClick={() => go(-1)} className="press flex h-9 w-9 items-center justify-center rounded-full text-ink-2">
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" aria-label={t("Next week")} onClick={() => go(1)} className="press flex h-9 w-9 items-center justify-center rounded-full text-ink-2">
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          const isSel = sameDay(d, selected);
          const m = marks[i];
          return (
            <li key={d.getTime()}>
              <button
                type="button"
                onClick={() => onSelect(d)}
                aria-pressed={isSel}
                aria-label={`${d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}${m === "d" ? `, ${t("worked out")}` : m === "p" ? `, ${t("planned")}` : ""}`}
                className={`press flex h-[64px] w-full flex-col items-center justify-center gap-0.5 rounded-[14px] ${
                  isSel ? "bg-ink text-bg" : isToday ? "bg-accent-soft text-accent-ink" : "text-ink"
                }`}
              >
                <span className={`text-[12px] ${isSel ? "text-bg/70" : "text-ink-3"}`}>{d.toLocaleDateString(locale(), { weekday: "narrow" })}</span>
                <span className="tnum text-[17px] font-semibold">{d.getDate()}</span>
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    m === "d" ? (isSel ? "bg-bg" : "bg-accent") : m === "p" ? `border ${isSel ? "border-bg/70" : "border-ink-3"}` : ""
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ───────────────────────────── today ───────────────────────────── */

function TodayCard() {
  const start = useStartWorkout();
  const next = useStore(() => nextPlan());
  const doneToday = useStore((s) => workoutsOn(s, new Date()).filter((w) => w.completed_at));
  const now = useNow(!!start.active);
  const first = useStore((s) => (start.active ? clockStartAt(s, start.active.id) : null), [start.active?.id]);
  const secs = liveSeconds(first, now);
  const [picking, setPicking] = useState(false);
  const t = useT();
  const a = start.active;
  // Nothing for today, but plans with fixed days: say so, and when the next one is.
  const upcoming = useStore((s) => {
    const n = nextPlannedDay(s, new Date());
    return n ? `${n.plans.map((p) => p.name).join(" · ")}|${n.date.toLocaleDateString(locale(), { weekday: "long" })}` : "";
  });

  // A weekly habit that isn't pinned yet: offer to pin it, once, quietly.
  const habitTemplate = next && next.kind === "plan" && next.habitDay !== null && !next.template.weekdays?.length ? next.template : null;
  const dayName = new Date().toLocaleDateString(locale(), { weekday: "long" });

  const title = a ? t("Continue workout") : next ? next.name : t("Start workout");
  const sub = a
    ? `${a.name}${secs !== null ? ` · ${fmtClock(secs)}` : ""}`
    : next
      ? next.kind === "plan" && next.scheduled
        ? t("Planned for today")
        : (habitLabel(next) ?? t("Next in your plans"))
      : t("Empty session, add as you go");

  if (!a && !next && upcoming && doneToday.length === 0) {
    const [names, day] = upcoming.split("|");
    return (
      <>
        <Card className="p-5">
          <p className="text-[21px] font-semibold tracking-[-0.01em]">{t("No workout planned today")}</p>
          <p className="mt-0.5 text-[15px] text-ink-2" dir="auto">
            {t("Next: {names}, {day}", { names, day })}
          </p>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="press mt-3 flex h-11 items-center gap-1.5 rounded-full bg-fill px-4 text-[15px] font-medium text-ink"
          >
            <Icon name="plus" size={17} /> {t("Train anyway")}
          </button>
        </Card>
        <NewWorkoutSheet open={picking} onClose={() => setPicking(false)} />
      </>
    );
  }

  return (
    <>
      {doneToday.length > 0 && !a && (
        <div className="space-y-3">
          {doneToday.map((w) => (
            <WorkoutSummary key={w.id} id={w.id} label={t("Done today")} />
          ))}
        </div>
      )}
      <Card className="p-3">
        <button
          type="button"
          onClick={() => (a ? start.resume() : next ? start.suggested(next) : start.empty())}
          className="press flex w-full items-center gap-4 rounded-[20px] bg-accent-soft p-3.5 text-start"
        >
          <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[18px] bg-card shadow-card">
            <ExerciseIcon kind="dumbbell" size={46} tone="accent" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[21px] font-semibold tracking-[-0.01em]" dir="auto">
              {doneToday.length > 0 && !a ? t("Another workout?") : title}
            </span>
            <span className="tnum block truncate text-[15px] text-ink-2" dir="auto">
              {doneToday.length > 0 && !a && next ? next.name : sub}
            </span>
          </span>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <Icon name="arrowRight" size={22} stroke={2} />
          </span>
        </button>
        {!a && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="press mt-1 flex h-11 w-full items-center justify-center gap-1.5 text-[15px] font-medium text-ink-2"
          >
            <Icon name="plus" size={17} /> {t("New workout")}
          </button>
        )}
        {habitTemplate && !a && (
          <button
            type="button"
            onClick={() => {
              setPlanDays(habitTemplate.id, [...(habitTemplate.weekdays ?? []), new Date().getDay()]);
              track("habit_pin");
              toast({ title: t("Pinned to every {day}", { day: dayName }), icon: "calendar" });
            }}
            className="press mt-1 flex w-full items-center gap-2 rounded-[14px] px-2 py-2 text-start text-[14px] text-accent"
          >
            <Icon name="calendar" size={16} />
            {t("Pin {name} to every {day}?", { name: habitTemplate.name, day: dayName })}
          </button>
        )}
      </Card>
      <NewWorkoutSheet open={picking} onClose={() => setPicking(false)} />
    </>
  );
}

/* ───────────────────────────── any other day ───────────────────────────── */

function DayCard({ day, today }: { day: Date; today: Date }) {
  const t = useT();
  const done = useStore((s) => workoutsOn(s, day).filter((w) => w.completed_at), [day.getTime()]);
  const planned = useStore((s) => plannedOn(s, day), [day.getTime()]);
  const future = day > today;
  const label = day.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });

  if (done.length)
    return (
      <div className="space-y-3">
        {done.map((w) => (
          <WorkoutSummary key={w.id} id={w.id} label={label} />
        ))}
      </div>
    );

  return (
    <Card className="p-5">
      <p className="text-[14px] text-ink-2">{label}</p>
      {planned.length ? (
        <>
          <p className="mt-1 text-[19px] font-semibold" dir="auto">
            {planned.map((p) => p.name).join(" · ")}
          </p>
          <p className="text-[15px] text-ink-2">{future ? t("Planned") : t("Was planned, not logged")}</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-[19px] font-semibold">{future ? t("Nothing planned") : t("Rest day")}</p>
          {future && (
            <Link href="/plans" className="mt-1 inline-block text-[15px] text-accent">
              {t("Give your plans fixed days")}
            </Link>
          )}
        </>
      )}
    </Card>
  );
}

/** One workout at a glance: what was done, with the top set per exercise. */
function WorkoutSummary({ id, label }: { id: string; label: string }) {
  const data = useStore(
    (s) => {
      const w = s.workouts[id];
      if (!w) return null;
      const rows = workoutExercises(s, w.id).map((we) => {
        const ex = s.exercises[we.exercise_id];
        const sets = setsOf(s, we.id).filter((x) => x.completed);
        const cardio = isCardio(ex);
        const secs = sets.reduce((a, x) => a + (x.duration_seconds ?? 0), 0);
        const dist = sets.reduce((a, x) => a + (x.distance ?? 0), 0);
        return { id: we.id, name: ex ? exName(ex) : "", equipment: cardio ? ("cardio" as const) : (ex?.equipment ?? null), sets: sets.length, top: topSet(sets), cardio, secs, dist };
      });
      return { w, rows };
    },
    [id],
  );
  const unit = useStore((s) => s.profile?.weight_unit ?? "kg");
  const t = useT();
  if (!data) return null;
  const { w, rows } = data;

  return (
    <Card className="p-5">
      <CardHeader title={w.name} sub={`${label}${w.duration_seconds ? ` · ${fmtDuration(w.duration_seconds)}` : ""}`} href={`/workout?id=${w.id}`} />
      <ul className="mt-4 space-y-3">
        {rows.slice(0, 4).map((r) => (
          <li key={r.id} className="flex items-center gap-3.5">
            <ExerciseIcon kind={r.equipment} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-medium" dir="auto">
                {r.name}
              </p>
              <p className="tnum text-[15px] text-ink-2">
                {r.cardio
                  ? fmtCardio({ duration_seconds: r.secs, distance: r.dist }, t(unit === "lb" ? "mi" : "km")) || t("Cardio")
                  : r.sets === 1
                    ? t("1 set")
                    : t("{n} sets", { n: r.sets })}
              </p>
            </div>
            {r.top?.weight ? (
              <span className="tnum text-[16px] text-ink-2">
                {fmtNum(r.top.weight)} {t(unit)} × {r.top.reps}
              </span>
            ) : null}
          </li>
        ))}
        {rows.length > 4 && <li className="ps-[58px] text-[15px] text-ink-3">{t("+{n} more", { n: rows.length - 4 })}</li>}
      </ul>
    </Card>
  );
}

function ThisMonth() {
  const m = useStore((s) => monthStats(s));
  const unit = useStore((s) => s.profile?.weight_unit ?? "kg");
  const t = useT();
  return (
    <Card className="p-5">
      <CardHeader title={t("This month")} href="/progress" />
      <div className="mt-3 mb-5 grid grid-cols-3 gap-3">
        <Stat value={m.workouts} label={t("Workouts")} />
        <Stat value={fmtDuration(m.seconds)} label={t("Total time")} />
        <Stat value={fmtVolume(m.volume)} label={t("Volume ({unit})", { unit: t(unit) })} />
      </div>
      <MonthBars days={m.days} label={m.label} />
    </Card>
  );
}

/* ───────────────────────────── getting started ───────────────────────────── */

/** One question for a brand-new account, so the first screen points at the right first step. */
function HowYouTrain() {
  const t = useT();
  const router = useRouter();
  const start = useStartWorkout();
  const ob = useOnboarding();
  const fresh = useStore((s) => Object.keys(s.workout_templates).length === 0 && Object.keys(s.workouts).length === 0);
  // Stays until the account has a plan or a workout, so a choice can be changed after coming back.
  if (!fresh) return null;
  const pick = (style: "coach" | "starter" | "free", go: () => void) => {
    setOnboarding({ style });
    track(`start_${style}` as "start_coach");
    go();
  };
  const options: { icon: IconName; title: string; sub: string; go: () => void; style: "coach" | "starter" | "free" }[] = [
    { icon: "copy", title: t("I have a program from a coach"), sub: t("Paste it or upload a screenshot"), style: "coach", go: () => router.push("/import") },
    { icon: "list", title: t("I'd like a ready plan"), sub: t("Pick one and start in a tap"), style: "starter", go: () => router.push("/plans") },
    { icon: "bolt", title: t("I just train"), sub: t("Start empty and add as you go"), style: "free", go: start.empty },
  ];
  return (
    <Card className="p-5">
      <p className="text-[19px] font-semibold">{t("How do you train?")}</p>
      <p className="mt-0.5 mb-3 text-[15px] text-ink-2">{t("So we start you in the right place.")}</p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.style}
            type="button"
            onClick={() => pick(o.style, o.go)}
            aria-pressed={ob.style === o.style}
            className={`press flex min-h-[64px] w-full items-center gap-3.5 rounded-[16px] px-3.5 text-start ${
              ob.style === o.style ? "bg-accent-soft ring-1 ring-accent/30" : "bg-fill"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-card text-accent">
              <Icon name={o.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">{o.title}</span>
              <span className="block text-[14px] text-ink-2">{o.sub}</span>
            </span>
            <Icon name="chevronRight" size={18} className="text-ink-3" />
          </button>
        ))}
      </div>
    </Card>
  );
}

/** First steps, ticked from what you actually did; gone once done (or closed). */
function FirstSteps() {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const start = useStartWorkout();
  const ob = useOnboarding();
  const firstSet = useStore((s) => Object.values(s.sets).some((x) => x.completed));
  const finished = useStore((s) => completedWorkouts(s).length);
  const steps = [
    { done: true, label: t("Create your account") },
    { done: firstSet, label: t("Log your first set"), go: () => (start.active ? start.resume() : setPicking(true)) },
    {
      done: !!ob.dictated,
      label: t("Say a set out loud"),
      go: () => {
        // The workout screen points at the microphone once it opens.
        try {
          sessionStorage.setItem("calil:coach-mic", "1");
        } catch {}
        if (start.active) start.resume();
        else setPicking(true);
      },
    },
    { done: finished > 0, label: t("Finish a workout"), go: () => (start.active ? start.resume() : setPicking(true)) },
  ];
  const left = steps.filter((x) => !x.done).length;
  if (ob.hideSteps || left === 0 || finished >= 3) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[19px] font-semibold">{t("First steps")}</p>
          <p className="tnum text-[14px] text-ink-2">{t("{done} of {total} done", { done: steps.length - left, total: steps.length })}</p>
        </div>
        <button type="button" onClick={() => setOnboarding({ hideSteps: true })} className="press -me-1 rounded-full px-2 py-1 text-[14px] text-ink-3">
          {t("Hide")}
        </button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-fill" dir="ltr">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${((steps.length - left) / steps.length) * 100}%` }} />
      </div>
      <ul className="space-y-1">
        {steps.map((x) => (
          <li key={x.label}>
            <button
              type="button"
              disabled={x.done}
              onClick={x.go}
              className="press flex min-h-[48px] w-full items-center gap-3 rounded-[12px] px-1 text-start disabled:opacity-100"
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${x.done ? "bg-accent text-white" : "border-2 border-ink-3/40"}`}>
                {x.done && <Icon name="check" size={14} stroke={3} />}
              </span>
              <span className={`flex-1 text-[16px] ${x.done ? "text-ink-3 line-through" : "font-medium"}`}>{x.label}</span>
              {!x.done && <Icon name="chevronRight" size={18} className="text-ink-3" />}
            </button>
          </li>
        ))}
      </ul>
      <NewWorkoutSheet open={picking} onClose={() => setPicking(false)} />
    </Card>
  );
}
