"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDay, fmtDuration, fmtNum, fmtVolume } from "@/lib/format";
import { useStore } from "@/lib/store";
import { exName, useT } from "@/lib/i18n";
import { e1rm, exerciseSummaries, metricOf, monthStats, PR_LABEL, recentPRs, type RangeKey } from "@/lib/stats";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { Icon } from "@/components/icons";
import { MonthBars, Sparkline } from "@/components/charts";
import { ProgressBlock } from "@/components/ProgressChart";
import { BrandBar, Card, CardHeader, Empty, Screen, Skeleton, Stat, Title } from "@/components/ui";

export default function ProgressPage() {
  const loaded = useStore((s) => s.loaded);
  const unit = useStore((s) => s.profile?.weight_unit ?? "kg");
  const t = useT();
  const [range, setRange] = useState<RangeKey>("3M");
  const summaries = useStore((s) => exerciseSummaries(s, range), [range]);
  const pr = useStore((s) => recentPRs(s, 1)[0] ?? null);
  const month = useStore((s) => monthStats(s));

  // Feature the exercise you train most often; let the user switch.
  const ranked = useMemo(() => [...summaries].sort((a, b) => b.sessions.length - a.sessions.length), [summaries]);
  const [featured, setFeatured] = useState<string | null>(null);
  const f = summaries.find((x) => x.exercise.id === featured) ?? ranked[0];

  if (!loaded)
    return (
      <Screen>
        <BrandBar />
        <Skeleton className="mt-24 h-80" />
      </Screen>
    );

  const up = f && f.change !== null && f.change > 0;

  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={t("Progress")}>{!f ? t("Your story starts here.") : up ? t("You’re getting stronger.") : t("Keep showing up.")}</Title>

      {!f ? (
        <Card>
          <Empty icon="chart" title={t("No progress yet")} action={{ label: t("Start a workout"), href: "/" }}>
            {t("Finish a workout and each exercise gets its own simple graph.")}
          </Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {ranked.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
              {ranked.slice(0, 8).map((x) => (
                <button
                  key={x.exercise.id}
                  type="button"
                  onClick={() => setFeatured(x.exercise.id)}
                  className={`press h-10 shrink-0 rounded-full px-4 text-[15px] font-medium ${
                    x.exercise.id === f.exercise.id ? "bg-ink text-white" : "bg-fill text-ink"
                  }`}
                >
                  {exName(x.exercise)}
                </button>
              ))}
            </div>
          )}

          <Card className="p-4">
            <Link href={`/exercise?id=${f.exercise.id}`} className="mb-2 flex items-center gap-3.5">
              <ExerciseIcon kind={f.exercise.equipment} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[21px] font-semibold tracking-[-0.01em]">{exName(f.exercise)}</p>
                <p className="tnum text-[15px] text-ink-2">
                  {t("Best")} {fmtNum(f.best.weight) ? `${fmtNum(f.best.weight)} ${t(unit)} × ${f.best.reps}` : t("{n} reps", { n: f.best.reps ?? 0 })}
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink-2">
                <Icon name="chevronRight" size={18} />
              </span>
            </Link>
            <ProgressBlock sessions={f.sessions} range={range} onRange={setRange} unit={unit} />
          </Card>

          {pr && (
            <Link href={`/exercise?id=${pr.exercise.id}`} className="block">
              <Card className="press flex items-center gap-4 p-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-accent-soft text-accent">
                  <Icon name="trophy" size={30} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium tracking-wide text-ink-2 uppercase">
                    {t(PR_LABEL[pr.kind])} · {fmtDay(pr.session.workout.started_at)}
                  </p>
                  <p className="tnum text-[22px] font-semibold tracking-[-0.01em]">
                    {pr.set.weight ? `${fmtNum(pr.set.weight)} ${t(unit)} × ${pr.set.reps}` : t("{n} reps", { n: pr.set.reps ?? 0 })}
                  </p>
                  <p className="truncate text-[15px] text-ink-2">
                    {exName(pr.exercise)}
                    {pr.kind === "weight"
                      ? ` · ${t("+{n} {unit} on your best", { n: fmtNum((pr.set.weight ?? 0) - pr.previous), unit: t(unit) })}`
                      : pr.kind === "set"
                        ? ` · ${t("est. max {n} {unit}", { n: fmtNum(Math.round(e1rm(pr.set))), unit: t(unit) })}`
                        : ` · ${t("+{n} reps on your best", { n: (pr.set.reps ?? 0) - pr.previous })}`}
                  </p>
                </div>
              </Card>
            </Link>
          )}

          <Card className="p-5">
            <CardHeader title={t("This month")} />
            <div className="mt-3 mb-5 grid grid-cols-3 gap-3">
              <Stat value={month.workouts} label={t("Workouts")} />
              <Stat value={fmtDuration(month.seconds)} label={t("Total time")} />
              <Stat value={fmtVolume(month.volume)} label={t("Volume ({unit})", { unit: t(unit) })} />
            </div>
            <MonthBars days={month.days} label={month.label} />
          </Card>

          <Card className="p-2">
            <h2 className="px-3 pt-3 pb-1 text-[19px] font-semibold">{t("All exercises")}</h2>
            <ul>
              {summaries.map((x) => {
                const { value } = metricOf(x.sessions);
                return (
                  <li key={x.exercise.id}>
                    <Link href={`/exercise?id=${x.exercise.id}`} className="press flex min-h-[68px] items-center gap-3 rounded-[16px] px-3">
                      <ExerciseIcon kind={x.exercise.equipment} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px]">{exName(x.exercise)}</p>
                        <p className="tnum truncate text-[14px] text-ink-2">
                          {x.last.top?.weight ? `${fmtNum(x.last.top.weight)} ${t(unit)} × ${x.last.top.reps}` : t("{n} reps", { n: x.last.top?.reps ?? 0 })} ·{" "}
                          {fmtDay(x.last.workout.started_at)}
                        </p>
                      </div>
                      <Sparkline values={[...x.sessions].slice(0, 12).reverse().map(value)} />
                      {x.change !== null && x.change !== 0 && (
                        <span className={`tnum w-12 text-end text-[14px] font-semibold ${x.change > 0 ? "text-accent-ink" : "text-ink-3"}`}>
                          {x.change > 0 ? "+" : ""}
                          {x.change}%
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </Screen>
  );
}
