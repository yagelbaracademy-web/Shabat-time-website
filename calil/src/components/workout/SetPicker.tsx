"use client";

import { useEffect, useRef, useState } from "react";
import { updateSet } from "@/lib/actions";
import { fmtNum, haptic, parseNum } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { Equipment } from "@/lib/types";
import { Button, Sheet } from "../ui";

const ROW = 44; // height of one value on the wheel
const VISIBLE = 5; // values in view; the middle one is chosen

/** Weight steps that match the equipment: plates for a bar, whole kilos for dumbbells. */
function weightValues(equipment: Equipment | null, unit: "kg" | "lb", current: number | null) {
  const lb = unit === "lb";
  const [step, max] =
    equipment === "dumbbell" || equipment === "kettlebell"
      ? lb ? [2.5, 200] : [1, 80]
      : equipment === "bodyweight"
        ? lb ? [5, 200] : [2.5, 100]
        : lb ? [5, 700] : [2.5, 300];
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  // A number typed by hand stays reachable even if it's between steps.
  if (current !== null && current > 0 && !out.includes(current)) {
    out.push(current);
    out.sort((a, b) => a - b);
  }
  return out;
}

const REPS = Array.from({ length: 51 }, (_, i) => i);

/**
 * A scroll wheel, like the iPhone's time picker: flick to the number, the middle row
 * is the value. Snaps to each row with a light tick.
 */
function Wheel({
  values,
  value,
  onChange,
  format,
  label,
}: {
  values: number[];
  value: number | null;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const index = Math.max(0, value === null ? 0 : values.findIndex((v) => v >= value - 1e-9));
  const last = useRef(index);
  const scrolledAt = useRef(0);
  const first = useRef(true);

  // Follow the value when it changes from outside (typed, or the sheet opening),
  // but never fight a finger that is spinning the wheel.
  useEffect(() => {
    const el = ref.current;
    if (!el || performance.now() - scrolledAt.current < 250) return;
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTo({ top: index * ROW, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
    last.current = index;
  }, [index]);

  return (
    <div className="relative" data-no-sheet-drag>
      {/* The chosen row: a soft band in the middle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 rounded-[12px] bg-accent-soft"
        style={{ top: ROW * Math.floor(VISIBLE / 2), height: ROW }}
      />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={(e) => {
          scrolledAt.current = performance.now();
          const i = Math.min(values.length - 1, Math.max(0, Math.round(e.currentTarget.scrollTop / ROW)));
          if (i !== last.current) {
            last.current = i;
            haptic(4);
            onChange(values[i]);
          }
        }}
        onKeyDown={(e) => {
          const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
          if (!d) return;
          e.preventDefault();
          onChange(values[Math.min(values.length - 1, Math.max(0, index + d))]);
        }}
        className="no-scrollbar relative snap-y snap-mandatory overflow-y-scroll overscroll-contain"
        style={{
          height: ROW * VISIBLE,
          paddingBlock: ROW * Math.floor(VISIBLE / 2),
          // Fade the rows away from the middle, like a drum.
          maskImage: "linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)",
        }}
      >
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={i === index}
            tabIndex={-1}
            onClick={() => onChange(v)}
            className={`tnum flex w-full snap-center items-center justify-center text-[22px] ${i === index ? "font-semibold text-ink" : "text-ink-2"}`}
            style={{ height: ROW }}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One column: the number you can type, and the wheel under it. */
function Column({
  title,
  value,
  onChange,
  values,
  format,
  decimal,
}: {
  title: string;
  value: number | null;
  onChange: (v: number | null) => void;
  values: number[];
  format: (v: number) => string;
  decimal?: boolean;
}) {
  const [text, setText] = useState<string | null>(null); // while typing
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-center text-[13px] text-ink-3">{title}</p>
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        aria-label={title}
        value={text ?? (value === null ? "" : format(value))}
        placeholder="–"
        onFocus={(e) => {
          setText(value === null || value === 0 ? "" : fmtNum(value));
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.,]/g, "");
          setText(v);
          const n = parseNum(v);
          if (v === "") onChange(null);
          else if (n !== null) onChange(decimal ? n : Math.round(n));
        }}
        onBlur={() => setText(null)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="tnum mb-2 h-12 w-full rounded-[14px] bg-card text-center text-[22px] font-semibold outline-none focus:shadow-[0_0_0_2px_var(--accent)]"
      />
      <Wheel values={values} value={value} onChange={onChange} format={format} label={title} />
    </div>
  );
}

/**
 * Tap a set's number: pick weight and reps on wheels (or type them in the boxes above).
 * Bodyweight is a weight of 0, shown as "BW".
 */
export function SetPicker({
  setId,
  hint,
  equipment,
  perSide,
  onClose,
}: {
  setId: string | null;
  hint: { weight: number | null; reps: number | null } | null;
  equipment: Equipment | null;
  perSide: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const set = useStore((s) => (setId ? s.sets[setId] : undefined), [setId]);
  const unit = useStore((s) => s.profile?.weight_unit ?? "kg");
  const [draft, setDraft] = useState<{ id: string; weight: number | null; reps: number | null } | null>(null);
  // A new set opened: start from what it holds, or what it was showing faintly.
  if (set && draft?.id !== set.id)
    setDraft({
      id: set.id,
      weight: set.weight ?? hint?.weight ?? (equipment === "bodyweight" ? 0 : null),
      reps: set.reps ?? hint?.reps ?? null,
    });
  if (!set && draft) setDraft(null);

  const bw = t("BW");
  const fmtW = (v: number) => (v === 0 ? bw : fmtNum(v));
  const save = () => {
    if (set && draft) updateSet(set.id, { weight: draft.weight, reps: draft.reps });
    haptic(10);
    onClose();
  };

  return (
    <Sheet
      open={!!set}
      onClose={save}
      title={set ? (set.is_warmup ? t("Warm-up set") : t("Set {n}", { n: set.set_number })) : ""}
    >
      {set && draft && (
        <div className="pb-3">
          {/* Same order as the table: weight, then reps. */}
          <div className="flex gap-3" dir="ltr">
            <Column
              title={perSide ? t("Per side ({unit})", { unit: t(unit) }) : t("Weight ({unit})", { unit: t(unit) })}
              value={draft.weight}
              decimal
              values={weightValues(equipment, unit, draft.weight)}
              format={fmtW}
              onChange={(v) => setDraft({ ...draft, weight: v })}
            />
            <Column
              title={t("Reps")}
              value={draft.reps}
              values={REPS}
              format={(v) => String(v)}
              onChange={(v) => setDraft({ ...draft, reps: v })}
            />
          </div>
          <button
            type="button"
            aria-pressed={draft.weight === 0}
            onClick={() => {
              setDraft({ ...draft, weight: draft.weight === 0 ? null : 0 });
              haptic(8);
            }}
            className={`press mt-3 h-11 w-full rounded-[14px] border text-[15px] font-medium ${
              draft.weight === 0 ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-card text-ink-2"
            }`}
          >
            {t("Bodyweight")}
          </button>
          <Button className="mt-3 w-full" onClick={save}>
            {t("Save")}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
