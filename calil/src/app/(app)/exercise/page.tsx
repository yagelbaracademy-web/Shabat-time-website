"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { fmtCardio, fmtDay, fmtNum } from "@/lib/format";
import { useStore } from "@/lib/store";
import { exName, useT } from "@/lib/i18n";
import { exerciseSessions, isCardio, PR_LABEL, type RangeKey, type Session } from "@/lib/stats";
import { EditExerciseSheet } from "@/components/ChangeExercise";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { Icon } from "@/components/icons";
import { ProgressBlock } from "@/components/ProgressChart";
import { BackLink, Card, Empty, Screen, Skeleton } from "@/components/ui";

export default function ExercisePage() {
  return (
    <Suspense>
      <ExerciseView />
    </Suspense>
  );
}

function ExerciseView() {
  const id = useSearchParams().get("id") ?? "";
  const loaded = useStore((s) => s.loaded);
  const exercise = useStore((s) => s.exercises[id], [id]);
  const sessions = useStore((s) => exerciseSessions(s, id), [id]);
  const unit = useStore((s) => s.profile?.weight_unit ?? "kg");
  const t = useT();
  const [range, setRange] = useState<RangeKey>("All");
  const [renaming, setRenaming] = useState(false);

  if (!loaded) return <Screen><Skeleton className="mt-16 h-80" /></Screen>;
  if (!exercise)
    return (
      <Screen>
        <BackLink href="/progress" label="Progress" />
        <Empty icon="search" title={t("Exercise not found")} />
      </Screen>
    );

  const last = sessions[0];
  const best = sessions.reduce<(typeof sessions)[number] | null>(
    (b, x) => (x.top && (!b?.top || (x.top.weight ?? 0) > (b.top.weight ?? 0) || ((x.top.weight ?? 0) === (b.top.weight ?? 0) && (x.top.reps ?? 0) > (b.top.reps ?? 0))) ? x : b),
    null,
  );
  const w = (v: number | null) => (v ? `${fmtNum(v)} ${t(unit)}` : t("BW"));
  // Cardio: a session is its total time and distance; "best" is the longest.
  const cardio = isCardio(exercise);
  const distUnit = t(unit === "lb" ? "mi" : "km");
  const total = (x: Session) => {
    const done = x.sets.filter((y) => y.completed);
    return {
      duration_seconds: done.reduce((a, y) => a + (y.duration_seconds ?? 0), 0),
      distance: done.reduce((a, y) => a + (y.distance ?? 0), 0),
    };
  };
  const longest = cardio ? sessions.reduce<Session | null>((b, x) => (!b || total(x).duration_seconds > total(b).duration_seconds ? x : b), null) : null;

  return (
    <Screen>
      <div className="pt-2">
        <BackLink href="/progress" label="Progress" />
      </div>
      <header className="mt-4 mb-5 flex items-center gap-4">
        <ExerciseIcon kind={cardio ? "cardio" : exercise.equipment} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]" dir="auto">
            {exName(exercise)}
          </h1>
          <p className="text-[16px] text-ink-2">
            {t(exercise.muscle_group ?? "Custom")} · {sessions.length === 1 ? t("1 session") : t("{n} sessions", { n: sessions.length })}
          </p>
        </div>
        <button type="button" onClick={() => setRenaming(true)} className="press shrink-0 rounded-full bg-fill px-3.5 py-2 text-[15px] font-medium">
          {t("Edit")}
        </button>
      </header>
      <EditExerciseSheet exerciseId={exercise.id} open={renaming} onClose={() => setRenaming(false)} where="exercise" />

      {!last ? (
        <Card>
          <Empty icon="clock" title={t("No history yet")}>
            {t("Log it once and you’ll always know what you did last time.")}
          </Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="p-4">
              <p className="text-[14px] text-ink-2">{t("Last time")}</p>
              <p className="tnum mt-0.5 text-[22px] font-semibold tracking-[-0.01em]">
                {cardio ? fmtCardio(total(last), distUnit) : `${w(last.top?.weight ?? null)} × ${last.top?.reps}`}
              </p>
              <p className="text-[13px] text-ink-3">{fmtDay(last.workout.started_at)}</p>
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-[14px] text-ink-2">
                <Icon name="trophy" size={15} className="text-gold" /> {cardio ? t("Longest") : t("Best")}
              </p>
              <p className="tnum mt-0.5 text-[22px] font-semibold tracking-[-0.01em]">
                {cardio ? longest && fmtCardio(total(longest), distUnit) : `${w(best?.top?.weight ?? null)} × ${best?.top?.reps}`}
              </p>
              <p className="text-[13px] text-ink-3">{cardio ? longest && fmtDay(longest.workout.started_at) : best && fmtDay(best.workout.started_at)}</p>
            </Card>
          </div>

          {!cardio && (
            <Card className="p-4">
              <ProgressBlock sessions={sessions} range={range} onRange={setRange} unit={unit} />
            </Card>
          )}

          <h2 className="px-1 pt-3 text-[19px] font-semibold">{t("History")}</h2>
          <ul className="space-y-2.5">
            {sessions.map((sess) => (
              <li key={sess.we.id}>
                <Card className="p-4">
                  <Link href={`/workout?id=${sess.workout.id}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold">{fmtDay(sess.workout.started_at)}</p>
                      <p className="truncate text-[14px] text-ink-2">{sess.workout.name}</p>
                    </div>
                    {sess.prKind && (
                      <span className="flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[13px] font-semibold text-gold">
                        <Icon name="trophy" size={14} /> {t(PR_LABEL[sess.prKind])}
                      </span>
                    )}
                  </Link>
                  <ol className="mt-3 space-y-1">
                    {sess.sets
                      .filter((x) => x.completed)
                      .map((x) => (
                        <li key={x.id} className="text-[15px]">
                          <div className="tnum flex items-center gap-3">
                            <span className="w-5 text-ink-3">{x.set_number}</span>
                            <span className={x.id === sess.top?.id ? "font-semibold" : ""}>
                              {cardio ? fmtCardio(x, distUnit) : `${w(x.weight)} × ${x.reps}`}
                            </span>
                          </div>
                          {x.note && (
                            <p className="mt-0.5 ms-8 flex items-start gap-1.5 text-[14px] text-ink-2">
                              <Icon name="note" size={14} className="mt-[3px] shrink-0 text-ink-3" />
                              {x.note}
                            </p>
                          )}
                        </li>
                      ))}
                  </ol>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Screen>
  );
}
