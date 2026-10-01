"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { changeExercise, createExercise, dropIfUnused, exerciseUsage, renameExercise } from "@/lib/actions";
import { getState, useStore } from "@/lib/store";
import { aliasesOf } from "@/lib/stats";
import { exName, getLang, useT } from "@/lib/i18n";
import { ExerciseIcon } from "./ExerciseIcon";
import { Icon } from "./icons";
import { Button, Sheet, toast } from "./ui";

type Target = { table: "workout_exercises" | "template_exercises"; id: string };

/**
 * One place to fix an exercise: type what it really is.
 * - pick a match from the library → the row points at that exercise
 * - or keep what you typed → renames your own exercise, or creates one in place of a built-in
 * When the old exercise also appears elsewhere, ask once whether to fix it everywhere.
 */
export function EditExerciseSheet({
  open,
  onClose,
  exerciseId,
  target,
  where,
}: {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  /** The plan/workout row being edited. Without it (exercise page) changes always apply everywhere. */
  target?: Target;
  where: "plan" | "workout" | "exercise";
}) {
  const t = useT();
  const current = useStore((s) => s.exercises[exerciseId], [exerciseId]);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ newId: string; newName: string; extra: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Start from the current name each time the sheet opens (set during render, not in an effect).
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (open && seededFor !== exerciseId) {
    setSeededFor(exerciseId);
    setQ(exName(current));
  } else if (!open && seededFor) setSeededFor(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.select(), 380);
    return () => clearTimeout(t);
  }, [open, exerciseId]);

  const results = useStore(
    (s) => {
      const term = q.trim().toLowerCase();
      const words = term.split(/\s+/).filter(Boolean);
      const list = Object.values(s.exercises).filter((e) => e.id !== exerciseId);
      if (!words.length) return list.sort((a, b) => exName(a).localeCompare(exName(b), getLang() === "he" ? "he" : "en")).slice(0, 30);
      return list
        .map((e) => ({ e, hay: `${e.name} ${exName(e)} ${e.muscle_group ?? ""} ${aliasesOf(s, e.id).join(" ")}`.toLowerCase() }))
        .filter(({ hay }) => words.every((w) => hay.includes(w)))
        .sort((a, b) => Number(!a.e.name.toLowerCase().startsWith(term)) - Number(!b.e.name.toLowerCase().startsWith(term)))
        .map(({ e }) => e)
        .slice(0, 30);
    },
    [q, exerciseId],
  );

  const typed = q.trim();
  const exact = useMemo(
    () => results.find((e) => [e.name, exName(e)].some((n) => n.toLowerCase() === typed.toLowerCase())) ?? null,
    [results, typed],
  );
  const own = !!current?.user_id;
  const canUseTyped =
    !!typed && !!current && ![current.name, exName(current)].some((n) => n.toLowerCase() === typed.toLowerCase()) && !exact;

  const close = () => {
    // A just-created exercise the user backed out of shouldn't linger in the library.
    if (confirm) dropIfUnused(confirm.newId);
    setConfirm(null);
    onClose();
  };

  const finish = (newId: string, everywhere: boolean) => {
    if (target) changeExercise(target, newId, everywhere);
    else {
      // Exercise page: there is no single row, so move every use over.
      const anyWe = Object.values(getState().workout_exercises).find((we) => we.exercise_id === exerciseId);
      const anyTe = Object.values(getState().template_exercises).find((te) => te.exercise_id === exerciseId);
      const row = anyWe
        ? { table: "workout_exercises" as const, id: anyWe.id }
        : anyTe
          ? { table: "template_exercises" as const, id: anyTe.id }
          : null;
      if (row) changeExercise(row, newId, true);
    }
    toast({ title: everywhere || !target ? t("Changed everywhere") : t("Exercise changed"), icon: "check" });
    setConfirm(null);
    onClose();
  };

  /** Point at another exercise, asking "everywhere?" when the old one is used elsewhere. */
  const switchTo = (newId: string) => {
    const u = exerciseUsage(exerciseId);
    const others =
      where === "plan"
        ? { workouts: u.workouts, plans: Math.max(0, u.plans - 1) }
        : where === "workout"
          ? { workouts: Math.max(0, u.workouts - 1), plans: u.plans }
          : u;
    const extra = [
      others.workouts ? (others.workouts === 1 ? t("1 workout in your history") : t("{n} workouts in your history", { n: others.workouts })) : "",
      others.plans
        ? where === "exercise"
          ? others.plans === 1 ? t("1 plan") : t("{n} plans", { n: others.plans })
          : others.plans === 1 ? t("1 other plan") : t("{n} other plans", { n: others.plans })
        : "",
    ]
      .filter(Boolean)
      .join(t(" and "));
    if (extra) setConfirm({ newId, newName: exName(getState().exercises[newId]), extra });
    else finish(newId, false);
  };

  const applyTyped = () => {
    if (!current || !canUseTyped) return;
    if (own) {
      renameExercise(exerciseId, typed); // the user's own exercise: just rename it, everywhere
      toast({ title: t("Renamed"), icon: "check" });
      close();
      return;
    }
    // A shared built-in can't be renamed: make the user's own exercise with this name instead.
    switchTo(createExercise(typed, current.muscle_group, current.equipment));
  };

  if (!current) return null;

  const useTypedButton = canUseTyped ? (
    <button
      type="button"
      onClick={applyTyped}
      className="press mb-3 flex min-h-[60px] w-full items-center gap-3 rounded-[18px] bg-card px-3 text-start shadow-card"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
        <Icon name={own ? "edit" : "plus"} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px]" dir="auto">
          {t("Use “{name}”", { name: typed })}
        </span>
        <span className="block text-[14px] text-ink-2">{own ? t("Rename this exercise everywhere") : t("As your own exercise")}</span>
      </span>
    </button>
  ) : null;

  return (
    <Sheet open={open} onClose={close} title={confirm ? t("Change it everywhere?") : t("Edit exercise")} full={!confirm}>
      {confirm ? (
        <div className="pb-3">
          <p className="mb-4 px-1 text-[16px] text-ink-2">
            {t("“{name}” also appears in {where}.", { name: exName(current), where: confirm.extra })}
            {where === "exercise"
              ? ` ${t("All of them will become {name}.", { name: confirm.newName })}`
              : ` ${t("If it was the wrong exercise, fix it everywhere so your history and progress stay together.")}`}
          </p>
          <Button className="w-full" onClick={() => finish(confirm.newId, true)}>
            {t("Change everywhere to {name}", { name: confirm.newName })}
          </Button>
          {where !== "exercise" && (
            <Button variant="secondary" className="mt-2 w-full" onClick={() => finish(confirm.newId, false)}>
              {where === "plan" ? t("Only in this plan") : t("Only in this workout")}
            </Button>
          )}
          <Button
            variant="ghost"
            className="mt-1 w-full"
            onClick={() => {
              dropIfUnused(confirm.newId);
              setConfirm(null);
            }}
          >
            {t("Back")}
          </Button>
        </div>
      ) : (
        <div className="pb-6">
          <div className="sticky top-0 z-10 bg-bg pb-3">
            <label className="flex h-12 items-center gap-2 rounded-[14px] bg-fill px-3.5 text-ink-2">
              <Icon name="search" size={19} />
              <input
                ref={input}
                value={q}
                dir="auto"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (exact) switchTo(exact.id);
                  else if (canUseTyped) applyTyped();
                }}
                placeholder={t("What is this exercise?")}
                aria-label={t("Exercise name")}
                className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
                autoCorrect="off"
                enterKeyHint="done"
              />
              {q && (
                <button type="button" aria-label={t("Clear")} onClick={() => setQ("")} className="text-ink-3">
                  <Icon name="close" size={18} />
                </button>
              )}
            </label>
            <p className="mt-2 px-1 text-[14px] text-ink-3">{t("Pick the right one below, or type a name and use it.")}</p>
          </div>

          {!results.length && useTypedButton}
          <ul>
            {results.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => switchTo(e.id)}
                  className="press flex min-h-[60px] w-full items-center gap-3 rounded-[16px] px-2 text-start"
                >
                  <ExerciseIcon kind={e.equipment} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px]" dir="auto">
                      {exName(e)}
                    </span>
                    <span className="block truncate text-[14px] text-ink-2">
                      {t(e.muscle_group ?? "Custom")}
                      {e.user_id ? ` · ${t("Yours")}` : ""}
                    </span>
                  </span>
                  <Icon name="swap" size={18} className="text-accent" />
                </button>
              </li>
            ))}
          </ul>
          {results.length > 0 && useTypedButton && <div className="mt-3">{useTypedButton}</div>}
        </div>
      )}
    </Sheet>
  );
}
