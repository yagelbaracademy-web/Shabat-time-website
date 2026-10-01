"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createTemplate, deleteTemplate, deleteWorkout, nextPlan, reorderTemplates, templateFromStarter } from "@/lib/actions";
import { fmtDay, fmtDuration } from "@/lib/format";
import { STARTER_PLANS } from "@/lib/starters";
import { useStore } from "@/lib/store";
import { exName, useT } from "@/lib/i18n";
import { byPosition, completedWorkouts, setsOf, sortedTemplates, workoutExercises } from "@/lib/stats";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { Icon } from "@/components/icons";
import { habitLabel, useStartWorkout } from "@/components/StartOptions";
import { SortableList } from "@/components/SortableList";
import { SwipeRow } from "@/components/SwipeRow";
import { BrandBar, Card, Empty, Screen, Segmented, Sheet, Skeleton, Title } from "@/components/ui";
import { locale } from "@/lib/i18n";

export default function PlansPage() {
  return (
    <Suspense>
      <Plans />
    </Suspense>
  );
}

function Plans() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "history" ? "history" : "plans";
  const loaded = useStore((s) => s.loaded);

  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={tab === "plans" ? t("Plans") : t("History")}>
        {tab === "plans" ? t("Find your next workout.") : t("Everything you’ve done.")}
      </Title>
      <Segmented
        className="mb-4 w-full"
        options={[
          { value: "plans", label: t("Plans") },
          { value: "history", label: t("History") },
        ]}
        value={tab}
        onChange={(v) => router.replace(v === "history" ? "/plans?tab=history" : "/plans")}
      />
      {!loaded ? <Skeleton className="h-72" /> : tab === "plans" ? <PlanList /> : <History />}
    </Screen>
  );
}

function NewOption({ icon, title, sub, onClick }: { icon: "edit" | "copy"; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex min-h-[72px] w-full items-center gap-4 rounded-[18px] bg-card px-4 text-start"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-accent-soft text-accent">
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="block text-[14px] text-ink-2">{sub}</span>
      </span>
      <Icon name="chevronRight" size={18} className="text-ink-3" />
    </button>
  );
}

function PlanList() {
  const t = useT();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const start = useStartWorkout();
  const next = useStore(() => nextPlan());
  const last = useStore((s) => completedWorkouts(s)[0] ?? null);
  const templates = useStore((s) =>
    sortedTemplates(s).map((t) => {
      const tes = Object.values(s.template_exercises)
        .filter((te) => te.template_id === t.id)
        .sort(byPosition);
      return {
        t,
        count: tes.length,
        names: tes
          .map((te) => exName(s.exercises[te.exercise_id]))
          .filter(Boolean)
          .slice(0, 3)
          .join(", "),
        equipment: s.exercises[tes[0]?.exercise_id]?.equipment ?? null,
      };
    }),
  );
  const ownNames = new Set(templates.map((x) => x.t.name.toLowerCase()));

  return (
    <div className="space-y-3">
      {next && (
        <div className="flex items-center gap-4 rounded-[26px] bg-accent-soft p-4">
          <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] bg-card shadow-card">
            <ExerciseIcon kind="dumbbell" size={52} tone="accent" />
          </span>
          <Link href={next.kind === "plan" ? `/plan?id=${next.template.id}` : `/workout?id=${next.workout.id}`} className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium tracking-wide text-accent-ink uppercase">
              {habitLabel(next) ?? t("Up next")}
            </span>
            <span className="block truncate text-[21px] font-semibold tracking-[-0.01em]">{next.name}</span>
            <span className="block text-[15px] text-ink-2">
              {next.kind === "plan"
                ? (() => {
                    const n = templates.find((x) => x.t.id === next.template.id)?.count ?? 0;
                    return n === 1 ? t("1 exercise") : t("{n} exercises", { n });
                  })()
                : t("Repeat it")}
            </span>
          </Link>
          <button
            type="button"
            aria-label={t("Start {name}", { name: next.name })}
            onClick={() => start.suggested(next)}
            className="press flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-white"
          >
            <Icon name="arrowRight" size={24} />
          </button>
        </div>
      )}

      {last && (
        <button
          type="button"
          onClick={() => start.duplicate(last.id)}
          className="press flex w-full items-center gap-4 rounded-[22px] bg-fill p-4 text-start"
        >
          <Icon name="copy" size={24} className="mx-2 text-ink-2" />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">{t("Duplicate last workout")}</span>
            <span className="block truncate text-[15px] text-ink-2">
              {last.name} · {fmtDay(last.started_at)}
            </span>
          </span>
          <Icon name="chevronRight" size={18} className="text-ink-3" />
        </button>
      )}

      <div className="flex items-center justify-between px-1 pt-3">
        <h2 className="text-[21px] font-semibold tracking-[-0.01em]">{t("Your plans")}</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="press flex h-10 items-center gap-1 rounded-full bg-fill px-3.5 text-[15px] font-medium"
        >
          <Icon name="plus" size={17} /> {t("New")}
        </button>
      </div>
      <Sheet open={creating} onClose={() => setCreating(false)} title={t("New plan")}>
        <div className="space-y-2 pb-3">
          <NewOption
            icon="edit"
            title={t("Build it yourself")}
            sub={t("Pick exercises, sets and reps")}
            onClick={() => router.push(`/plan?id=${createTemplate("")}&new=1`)}
          />
          <NewOption
            icon="copy"
            title={t("Import a program")}
            sub={t("Paste text, or choose an Excel file or screenshot")}
            onClick={() => router.push("/import")}
          />
        </div>
      </Sheet>
      {templates.length === 0 ? (
        <Card>
          <Empty icon="list" title={t("No plans yet")}>
            {t("Plans are optional. Make one, add a starter below, or")}{" "}
            <Link href="/import" className="text-accent">
              {t("import your coach’s program")}
            </Link>
            .
          </Empty>
        </Card>
      ) : (
        <SortableList
          items={templates.map((x) => ({ ...x, id: x.t.id }))}
          onReorder={reorderTemplates}
          render={({ t: plan, count, names, equipment }) => (
            <SwipeRow
              primary={{
                label: start.active ? t("Continue") : t("Start"),
                icon: "play",
                onAction: () => start.fromTemplate(plan.id),
              }}
              onDelete={() => deleteTemplate(plan.id)}
              confirm={{
                title: t("Delete “{name}”?", { name: plan.name }),
                message: t("The plan is removed. Workouts you already did stay in your history."),
              }}
            >
              <Link
                href={`/plan?id=${plan.id}`}
                className="press flex items-center gap-3.5 rounded-[22px] border border-line bg-card p-3.5"
              >
                <ExerciseIcon kind={equipment} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[18px] font-semibold" dir="auto">
                    {plan.name}
                  </p>
                  <p className="text-[15px] text-ink-2">{count === 1 ? t("1 exercise") : t("{n} exercises", { n: count })}</p>
                  {names && <p className="truncate text-[14px] text-ink-3">{names}</p>}
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink-2">
                  <Icon name="chevronRight" size={18} />
                </span>
              </Link>
            </SwipeRow>
          )}
        />
      )}

      <h2 className="px-1 pt-4 text-[21px] font-semibold tracking-[-0.01em]">{t("Starter plans")}</h2>
      <ul className="space-y-2">
        {STARTER_PLANS.map((p) => {
          const added = ownNames.has(p.name.toLowerCase());
          return (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => router.push(`/plan?id=${templateFromStarter(p)}`)}
                className="press flex w-full items-center gap-3.5 rounded-[22px] border border-line bg-card p-3.5 text-start shadow-card"
              >
                <ExerciseIcon kind={p.icon} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="text-[18px] font-semibold">{p.name}</p>
                  <p className="text-[15px] text-ink-2">
                    {t("{n} exercises", { n: p.exercises.length })} · {t("~{n} min", { n: p.minutes })}
                  </p>
                  <p className="truncate text-[14px] text-ink-3">{t(p.focus)}</p>
                </div>
                <span className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-fill px-3 text-[14px] font-medium text-accent-ink">
                  <Icon name="plus" size={15} /> {added ? t("Add again") : t("Add")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function History() {
  const t = useT();
  const groups = useStore((s) => {
    const out: { month: string; items: { id: string; name: string; date: string; dur: number; exercises: string; sets: number }[] }[] = [];
    for (const w of completedWorkouts(s)) {
      const month = new Date(w.started_at).toLocaleDateString(locale(), { month: "long", year: "numeric" });
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
      if (g?.month === month) g.items.push(item);
      else out.push({ month, items: [item] });
    }
    return out;
  });

  if (!groups.length)
    return (
      <Card>
        <Empty icon="clock" title={t("No workouts yet")}>
          {t("Finished workouts appear here, newest first.")}
        </Empty>
      </Card>
    );

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.month}>
          <h2 className="px-1 pb-2 text-[15px] font-medium text-ink-2">{g.month}</h2>
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
                  <Link
                    href={`/workout?id=${w.id}`}
                    className="press flex items-center gap-3 rounded-[20px] border border-line bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2">
                        <span className="truncate text-[17px] font-semibold" dir="auto">
                          {w.name}
                        </span>
                        <span className="shrink-0 text-[14px] text-ink-3">{fmtDay(w.date)}</span>
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
      ))}
    </div>
  );
}
