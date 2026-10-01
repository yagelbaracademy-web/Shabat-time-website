"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createExercise } from "@/lib/actions";
import { MUSCLE_GROUPS } from "@/lib/starters";
import { useStore } from "@/lib/store";
import { exName, getLang, useT } from "@/lib/i18n";
import { aliasesOf, isCardio } from "@/lib/stats";
import type { Equipment, Exercise } from "@/lib/types";
import { ExerciseIcon } from "./ExerciseIcon";
import { Icon } from "./icons";
import { Button, Sheet } from "./ui";
import { EXERCISE_NAMES_HE } from "@/lib/exercise-names-he";

const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell", "other"];

/** Search-first exercise picker. Recently used exercises float to the top. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title,
  exclude = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  title?: string;
  exclude?: string[];
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equip, setEquip] = useState<Equipment | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const names = useStore((s) => {
    const m = new Map<string, string[]>();
    for (const e of Object.values(s.exercises)) {
      const a = aliasesOf(s, e.id);
      if (a.length) m.set(e.id, a);
    }
    return m;
  });
  const { recent, all } = useStore((s) => {
    const lastUsed = new Map<string, string>();
    for (const we of Object.values(s.workout_exercises)) {
      const w = s.workouts[we.workout_id];
      if (!w) continue;
      const prev = lastUsed.get(we.exercise_id);
      if (!prev || prev < w.started_at) lastUsed.set(we.exercise_id, w.started_at);
    }
    const list = Object.values(s.exercises);
    return {
      all: list.sort((a, b) => exName(a).localeCompare(exName(b), getLang() === "he" ? "he" : "en")),
      recent: list
        .filter((e) => lastUsed.has(e.id))
        .sort((a, b) => (lastUsed.get(a.id)! < lastUsed.get(b.id)! ? 1 : -1))
        .slice(0, 6),
    };
  });

  useEffect(() => {
    if (!open) return;
    // Focus after the sheet animates in, so iOS doesn't jump.
    const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 380);
    return () => clearTimeout(t);
  }, [open]);

  const close = () => {
    onClose();
    setTimeout(() => {
      setQ("");
      setCreating(false);
      setMuscle(null);
      setEquip(null);
    }, 350);
  };

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const skip = new Set(exclude);
    if (!term) return null;
    const words = term.split(/\s+/);
    return all
      .filter((e) => !skip.has(e.id))
      .filter((e) => {
        const hay = `${e.name} ${exName(e)} ${EXERCISE_NAMES_HE[e.name] ?? ""} ${e.muscle_group ?? ""} ${(names.get(e.id) ?? []).join(" ")}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(term)) - Number(!b.name.toLowerCase().startsWith(term)));
  }, [q, all, exclude, names]);

  const exact = all.some((e) => [e.name, exName(e), EXERCISE_NAMES_HE[e.name] ?? ""].some((n) => n.toLowerCase() === q.trim().toLowerCase()));

  const pick = (id: string) => {
    onPick(id);
    close();
  };

  const create = () => {
    if (!q.trim()) return;
    pick(createExercise(q, muscle, equip));
  };

  const row = (e: Exercise) => (
    <li key={e.id}>
      <button
        type="button"
        onClick={() => pick(e.id)}
        className="press flex min-h-[60px] w-full items-center gap-3 rounded-[16px] px-2 text-start"
      >
        <ExerciseIcon kind={isCardio(e) ? "cardio" : e.equipment} size={42} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px]">{exName(e)}</span>
          <span className="block truncate text-[14px] text-ink-2">
            {names.get(e.id)?.length ? `“${names.get(e.id)![0]}” · ` : ""}
            {t(e.muscle_group ?? "Custom")}
            {e.user_id ? ` · ${t("Yours")}` : ""}
          </span>
        </span>
        <Icon name="plus" size={20} className="text-accent" />
      </button>
    </li>
  );

  return (
    <Sheet open={open} onClose={close} title={title ?? t("Add exercise")} full>
      <div className="sticky top-0 z-10 bg-bg pb-3">
        <label className="flex h-12 items-center gap-2 rounded-[14px] bg-fill px-3.5 text-ink-2">
          <Icon name="search" size={19} />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCreating(false);
            }}
            placeholder={t("Search or create")}
            className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
            enterKeyHint="search"
            autoCorrect="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results?.[0]) pick(results[0].id);
            }}
          />
          {q && (
            <button type="button" aria-label={t("Clear")} onClick={() => setQ("")} className="text-ink-3">
              <Icon name="close" size={18} />
            </button>
          )}
        </label>
      </div>

      {q.trim() && !exact && (
        <div className="mb-3 rounded-[18px] bg-card p-3 shadow-card">
          {!creating ? (
            <button type="button" onClick={() => setCreating(true)} className="press flex min-h-[48px] w-full items-center gap-3 text-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                <Icon name="plus" size={20} />
              </span>
              <span className="text-[17px]">
                {t("Create")} <span className="font-semibold">“{q.trim()}”</span>
              </span>
            </button>
          ) : (
            <div className="space-y-3 p-1">
              <p className="text-[17px] font-semibold">{q.trim()}</p>
              <Chips label={t("Muscle")} options={MUSCLE_GROUPS} value={muscle} onChange={setMuscle} />
              <Chips label={t("Equipment")} options={EQUIPMENT} value={equip} onChange={(v) => setEquip(v as Equipment)} />
              <Button className="w-full" onClick={create}>
                {t("Create and add")}
              </Button>
            </div>
          )}
        </div>
      )}

      {results ? (
        <ul className="pb-6">{results.map(row)}</ul>
      ) : (
        <div className="pb-6">
          {recent.length > 0 && (
            <>
              <p className="px-2 pt-1 pb-1 text-[13px] font-medium tracking-wide text-ink-3 uppercase">{t("Recent")}</p>
              <ul className="mb-3">{recent.filter((e) => !exclude.includes(e.id)).map(row)}</ul>
            </>
          )}
          <p className="px-2 pt-1 pb-1 text-[13px] font-medium tracking-wide text-ink-3 uppercase">{t("All exercises")}</p>
          <ul>{all.filter((e) => !exclude.includes(e.id)).map(row)}</ul>
        </div>
      )}
    </Sheet>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T | null; onChange: (v: T | null) => void }) {
  const t = useT();
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-ink-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(value === o ? null : o)}
            className={`press h-9 rounded-full px-3 text-[14px] capitalize ${value === o ? "bg-accent text-white" : "bg-fill text-ink"}`}
          >
            {t(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
