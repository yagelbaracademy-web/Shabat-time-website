"use client";

import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/lib/hooks";
import { nextPlan, setPlanDays } from "@/lib/actions";
import { fmtClock, fmtDuration, fmtNum, fmtVolume, greeting } from "@/lib/format";
import { useStore } from "@/lib/store";
import { exName, locale, useT } from "@/lib/i18n";
import { addDays, plannedOn, sameDay, startOfWeek, workoutsOn } from "@/lib/schedule";
import { clockStartAt, liveSeconds, monthStats, setsOf, topSet, workoutExercises } from "@/lib/stats";
import { track } from "@/lib/track";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { Icon } from "@/components/icons";
import { MonthBars } from "@/components/charts";
import { habitLabel, PlanPickerSheet, useStartWorkout } from "@/components/StartOptions";
import { BrandBar, Card, CardHeader, Screen, Skeleton, Stat, Title, toast } from "@/components/ui";

const HEADLINES = ["Let’s move today.", "Ready for something Calil?", "One set at a time.", "Every set makes you stronger."];

/** "Today": where you are in the week, and the one thing to do next. */
export default function Home() {
  const loaded = useStore((s) => s.loaded);
  const name = useStore((s) => s.profile?.name?.split(" ")[0] ?? "");
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState(today);
  const t = useT();
  const hello = { g: greeting(today).replace(",", name ? `, ${name}` : ","), h: t(HEADLINES[today.getDate() % HEADLINES.length]) };

  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={hello.g}>{hello.h}</Title>
      {loaded ? (
        <div className="space-y-3">
          <WeekStrip today={today} selected={selected} onSelect={setSelected} />
          {sameDay(selected, today) ? <TodayCard /> : <DayCard day={selected} today={today} />}
          <ThisMonth />
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
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
          <div className="mt-1 flex">
            <button type="button" onClick={() => setPicking(true)} className="press flex h-11 flex-1 items-center justify-center gap-1.5 text-[15px] font-medium text-ink-2">
              <Icon name="list" size={17} /> {t("Another plan")}
            </button>
            <span className="my-2.5 w-px bg-line" aria-hidden />
            <button type="button" onClick={start.empty} className="press flex h-11 flex-1 items-center justify-center gap-1.5 text-[15px] font-medium text-ink-2">
              <Icon name="plus" size={17} /> {t("New workout")}
            </button>
          </div>
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
      <PlanPickerSheet open={picking} onClose={() => setPicking(false)} />
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
            <Link href="/plans?tab=plans" className="mt-1 inline-block text-[15px] text-accent">
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
        return { id: we.id, name: ex ? exName(ex) : "", equipment: ex?.equipment ?? null, sets: sets.length, top: topSet(sets) };
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
              <p className="tnum text-[15px] text-ink-2">{r.sets === 1 ? t("1 set") : t("{n} sets", { n: r.sets })}</p>
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
