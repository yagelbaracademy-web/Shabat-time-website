"use client";

import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/lib/hooks";
import { nextPlan } from "@/lib/actions";
import { fmtClock, fmtDay, fmtDuration, fmtNum, fmtVolume, greeting } from "@/lib/format";
import { useStore } from "@/lib/store";
import { exName, useT } from "@/lib/i18n";
import { completedWorkouts, monthStats, setsOf, topSet, workoutExercises } from "@/lib/stats";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { Icon } from "@/components/icons";
import { MonthBars } from "@/components/charts";
import { habitLabel, StartTiles, useStartWorkout } from "@/components/StartOptions";
import { BrandBar, Card, CardHeader, Screen, Skeleton, Stat, Title } from "@/components/ui";

const HEADLINES = ["Let’s move today.", "Ready for something Calil?", "One set at a time.", "Every set makes you stronger."];

export default function Home() {
  const loaded = useStore((s) => s.loaded);
  const name = useStore((s) => s.profile?.name?.split(" ")[0] ?? "");
  const [today] = useState(() => new Date());
  const t = useT();
  const hello = { g: greeting(today).replace(",", name ? `, ${name}` : ","), h: t(HEADLINES[today.getDate() % HEADLINES.length]) };

  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={hello.g}>{hello.h}</Title>
      {loaded ? (
        <div className="space-y-3">
          <PrimaryCTA />
          <StartTiles />
          <LastWorkout />
          <ThisMonth />
        </div>
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-[108px]" />
          <Skeleton className="h-[112px]" />
          <Skeleton className="h-60" />
        </div>
      )}
    </Screen>
  );
}

function PrimaryCTA() {
  const start = useStartWorkout();
  const next = useStore(() => nextPlan());
  const habit = habitLabel(next);
  const now = useNow(!!start.active);
  const t = useT();

  const a = start.active;
  const title = a ? t("Continue workout") : t("Start workout");
  const sub = a
    ? `${a.name} · ${fmtClock((now - new Date(a.started_at).getTime()) / 1000)}`
    : next
      ? `${habit ? `${habit}: ` : t("Next up: ")}${next.name}`
      : t("Track your next session");

  return (
    <button
      type="button"
      onClick={() => (a ? start.resume() : next ? start.suggested(next) : start.empty())}
      className="press flex w-full items-center gap-4 rounded-[26px] bg-accent-soft p-4 text-start"
    >
      <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] bg-card shadow-card">
        <ExerciseIcon kind="dumbbell" size={52} tone="accent" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[22px] font-semibold tracking-[-0.01em]">{title}</span>
        <span className="tnum block truncate text-[15px] text-ink-2">{sub}</span>
      </span>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_16px_-6px_rgba(28,116,234,0.6)]">
        <Icon name="arrowRight" size={24} stroke={2} />
      </span>
    </button>
  );
}

function LastWorkout() {
  const data = useStore((s) => {
    const w = completedWorkouts(s)[0];
    if (!w) return null;
    const rows = workoutExercises(s, w.id).map((we) => {
      const ex = s.exercises[we.exercise_id];
      const sets = setsOf(s, we.id).filter((x) => x.completed);
      const reps = sets.map((x) => x.reps ?? 0);
      return {
        id: we.id,
        name: ex ? exName(ex) : "",
        equipment: ex?.equipment ?? null,
        sets: sets.length,
        reps: reps.length ? (Math.min(...reps) === Math.max(...reps) ? `${reps[0]}` : `${Math.min(...reps)}–${Math.max(...reps)}`) : "",
        top: topSet(sets),
      };
    });
    return { w, rows };
  });
  const unit = useStore((s) => s.profile?.weight_unit ?? "kg");
  const t = useT();

  if (!data)
    return (
      <Card className="p-5">
        <CardHeader title={t("Last workout")} sub={t("Nothing logged yet")} />
        <p className="mt-3 text-[15px] text-ink-2">{t("Your first session will show up here, with every set ready to repeat.")}</p>
      </Card>
    );

  return (
    <Card className="p-5">
      <CardHeader title={t("Last workout")} sub={`${fmtDay(data.w.started_at)} · ${data.w.name}`} href={`/workout?id=${data.w.id}`} />
      <ul className="mt-4 space-y-3">
        {data.rows.slice(0, 4).map((r) => (
          <li key={r.id} className="flex items-center gap-3.5">
            <ExerciseIcon kind={r.equipment} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-medium" dir="auto">
                {r.name}
              </p>
              <p className="tnum text-[15px] text-ink-2">
                {r.sets === 1 ? t("1 set") : t("{n} sets", { n: r.sets })}
                {r.reps ? ` · ${t("{n} reps", { n: r.reps })}` : ""}
              </p>
            </div>
            {r.top?.weight ? <span className="tnum text-[16px] text-ink-2">{fmtNum(r.top.weight)} {t(unit)}</span> : null}
          </li>
        ))}
        {data.rows.length > 4 && <li className="ps-[66px] text-[15px] text-ink-3">{t("+{n} more", { n: data.rows.length - 4 })}</li>}
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
      {m.workouts === 0 && (
        <p className="mt-3 text-[14px] text-ink-3">
          {t("Finish a workout and it lands here.")}{" "}
          <Link href="/plans" className="text-accent">
            {t("Browse plans")}
          </Link>
        </p>
      )}
    </Card>
  );
}
