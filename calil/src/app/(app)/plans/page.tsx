"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { createTemplate, deleteTemplate, reorderTemplates, templateFromStarter } from "@/lib/actions";
import { STARTER_PLANS } from "@/lib/starters";
import { useStore } from "@/lib/store";
import { exName, useLang, useT } from "@/lib/i18n";
import { addDays, plannedOn, sameDay, weekdayName, workoutsOn } from "@/lib/schedule";
import { byPosition, sortedTemplates } from "@/lib/stats";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { Icon } from "@/components/icons";
import { useStartWorkout } from "@/components/StartOptions";
import { SortableList } from "@/components/SortableList";
import { SwipeRow } from "@/components/SwipeRow";
import { BrandBar, Card, Empty, Screen, Sheet, Skeleton, TipOnce, Title } from "@/components/ui";
import { locale } from "@/lib/i18n";
import { useToday } from "@/lib/hooks";

export default function PlansPage() {
  return (
    <Suspense>
      <Plans />
    </Suspense>
  );
}

function Plans() {
  const t = useT();
  const loaded = useStore((s) => s.loaded);

  return (
    <Screen>
      <BrandBar />
      <Title eyebrow={t("Plans")}>{t("Your plans, ready to go.")}</Title>
      {!loaded ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <Upcoming />
          <PlanList />
        </>
      )}
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
  const lang = useLang();
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
      <div className="flex items-center justify-between px-1">
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
        <>
        <TipOnce id="plans-gestures" className="mb-2">
          {t("Tip: swipe a plan one way to start it, the other way to delete. Hold and drag to reorder.")}
        </TipOnce>
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
                  <p className="text-[15px] text-ink-2">
                    {count === 1 ? t("1 exercise") : t("{n} exercises", { n: count })}
                    {plan.weekdays?.length ? (
                      <span className="text-accent-ink"> · {plan.weekdays.map((d) => weekdayName(d, "short", locale(lang))).join(", ")}</span>
                    ) : null}
                  </p>
                  {names && <p className="truncate text-[14px] text-ink-3">{names}</p>}
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink-2">
                  <Icon name="chevronRight" size={18} />
                </span>
              </Link>
            </SwipeRow>
          )}
        />
        </>
      )}

      <h2 className="px-1 pt-4 text-[21px] font-semibold tracking-[-0.01em]">{t("Starter plans")}</h2>
      <ul className="space-y-2">
        {STARTER_PLANS.map((p) => {
          const added = ownNames.has(p.name.toLowerCase());
          return (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => router.push(`/plan?id=${templateFromStarter(p)}&added=1`)}
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

/** The next 7 days: plans pinned to them. */
function Upcoming() {
  const t = useT();
  const lang = useLang();
  const start = useStartWorkout();
  const today = useToday();
  const upcoming = useStore((s) => {
    const out: { date: Date; plans: { id: string; name: string }[]; done: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const plans = plannedOn(s, d).map((p) => ({ id: p.id, name: p.name }));
      // Today: leave out what's already done or under way.
      const started = i === 0 ? new Set(workoutsOn(s, d).map((w) => w.template_id)) : new Set<string | null>();
      const left = plans.filter((p) => !started.has(p.id));
      const done = workoutsOn(s, d).some((w) => w.completed_at);
      if (left.length) out.push({ date: d, plans: left, done });
    }
    return out;
  });
  const anyDays = useStore((s) => Object.values(s.workout_templates).some((p) => p.weekdays?.length));
  const hasPlans = useStore((s) => Object.keys(s.workout_templates).length > 0);

  return (
    <div className="mb-6">
      <section>
        <h2 className="px-1 pb-2 text-[15px] font-medium text-ink-2">{t("Coming up")}</h2>
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map((u) => (
              <li key={u.date.getTime()}>
                {u.plans.map((p) => (
                  <Link
                    key={p.id}
                    href={`/plan?id=${p.id}`}
                    className="press mb-2 flex items-center gap-3 rounded-[20px] border border-dashed border-ink-3/40 p-4"
                  >
                    <span className="flex w-12 shrink-0 flex-col items-center leading-tight">
                      <span className="text-[13px] text-ink-3">{u.date.toLocaleDateString(locale(lang), { weekday: "short" })}</span>
                      <span className="tnum text-[20px] font-semibold">{u.date.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold" dir="auto">
                        {p.name}
                      </span>
                      <span className="block text-[14px] text-ink-2">{sameDay(u.date, today) ? t("Today") : t("Planned")}</span>
                    </span>
                    {sameDay(u.date, today) ? (
                      <button
                        type="button"
                        aria-label={t("Start {name}", { name: p.name })}
                        onClick={(e) => {
                          e.preventDefault();
                          start.fromTemplate(p.id);
                        }}
                        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                      >
                        <Icon name="arrowRight" size={20} />
                      </button>
                    ) : (
                      <Icon name="chevronRight" size={18} className="text-ink-3" />
                    )}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-4">
            <p className="text-[15px] text-ink-2">
              {anyDays ? t("Nothing planned for the next 7 days.") : hasPlans ? t("Plans can have fixed days, and then they show up here.") : t("Make a plan and give it days, and your week shows up here.")}{" "}
              <Link href="/plans" className="text-accent">
                {hasPlans ? t("Set days") : t("Plans")}
              </Link>
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
