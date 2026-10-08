"use client";

import Link from "next/link";
import { deleteWorkout } from "@/lib/actions";
import { fmtDuration } from "@/lib/format";
import { useStore } from "@/lib/store";
import { exName, locale, useLang, useT } from "@/lib/i18n";
import { addDays, startOfWeek } from "@/lib/schedule";
import { completedWorkouts, setsOf, workoutExercises } from "@/lib/stats";
import { Icon } from "@/components/icons";
import { SwipeRow } from "@/components/SwipeRow";
import { BrandBar, Card, Empty, Screen, Skeleton, Title } from "@/components/ui";
import { useToday } from "@/lib/hooks";

/** Everything you've done, newest first, by week. */
export default function HistoryPage() {
  const t = useT();
  const loaded = useStore((s) => s.loaded);
  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={t("History")}>{t("Everything you’ve done.")}</Title>
      <Link
        href="/import?as=log"
        className="press mb-5 flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-fill text-[16px] font-medium text-ink-2"
      >
        <Icon name="plus" size={18} /> {t("Add a workout you did")}
      </Link>
      {loaded ? <WorkoutsByWeek /> : <Skeleton className="h-72" />}
    </Screen>
  );
}

function WorkoutsByWeek() {
  const t = useT();
  const lang = useLang();
  const today = useToday();
  const groups = useStore((s) => {
    const thisWeek = startOfWeek(today).getTime();
    const out: { key: number; title: string; items: { id: string; name: string; date: string; dur: number; exercises: string; sets: number }[] }[] = [];
    for (const w of completedWorkouts(s)) {
      const ws = startOfWeek(new Date(w.started_at)).getTime();
      const wes = workoutExercises(s, w.id);
      const item = {
        id: w.id,
        name: w.name,
        date: w.started_at,
        dur: w.duration_seconds ?? 0,
        exercises: wes
          .map((we) => exName(s.exercises[we.exercise_id]))
          .filter(Boolean)
          .join(", "),
        sets: wes.reduce((n, we) => n + setsOf(s, we.id).filter((x) => x.completed).length, 0),
      };
      const g = out[out.length - 1];
      if (g?.key === ws) g.items.push(item);
      else {
        const end = addDays(new Date(ws), 6);
        const title =
          ws === thisWeek
            ? t("This week")
            : ws === addDays(new Date(thisWeek), -7).getTime()
              ? t("Last week")
              : `${new Date(ws).toLocaleDateString(locale(lang), { day: "numeric", month: "short" })} – ${end.toLocaleDateString(locale(lang), { day: "numeric", month: "short" })}`;
        out.push({ key: ws, title, items: [item] });
      }
    }
    return out;
  });

  return (
    <div className="space-y-5">

      {groups.length === 0 ? (
        <Card>
          <Empty icon="clock" title={t("No workouts yet")} action={{ label: t("Start a workout"), href: "/" }}>
            {t("Finished workouts appear here, newest first.")}
          </Empty>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <h2 className="px-1 pb-2 text-[15px] font-medium text-ink-2">
              {g.title} · {g.items.length === 1 ? t("1 workout") : t("{n} workouts", { n: g.items.length })}
            </h2>
            <ul className="space-y-2">
              {g.items.map((w) => (
                <li key={w.id}>
                  <SwipeRow
                    radius={20}
                    onDelete={() => deleteWorkout(w.id)}
                    confirm={{
                      title: t("Delete “{name}”?", { name: w.name }),
                      message: t("It’s removed from your history, progress and records. This can’t be undone."),
                    }}
                  >
                    <Link href={`/workout?id=${w.id}`} className="press flex items-center gap-3 rounded-[20px] border border-line bg-card p-4">
                      <span className="flex w-12 shrink-0 flex-col items-center leading-tight">
                        <span className="text-[13px] text-ink-3">{new Date(w.date).toLocaleDateString(locale(lang), { weekday: "short" })}</span>
                        <span className="tnum text-[20px] font-semibold">{new Date(w.date).getDate()}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold" dir="auto">
                          {w.name}
                        </p>
                        <p className="truncate text-[14px] text-ink-2">{w.exercises || t("No exercises")}</p>
                        <p className="tnum text-[13px] text-ink-3">
                          {w.dur ? `${fmtDuration(w.dur)} · ` : ""}
                          {w.sets === 1 ? t("1 set") : t("{n} sets", { n: w.sets })}
                        </p>
                      </div>
                      <Icon name="chevronRight" size={18} className="text-ink-3" />
                    </Link>
                  </SwipeRow>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
