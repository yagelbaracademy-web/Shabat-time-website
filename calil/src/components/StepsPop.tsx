"use client";

import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useOnboarding } from "@/lib/onboarding";
import { completedWorkouts } from "@/lib/stats";
import { useStore } from "@/lib/store";
import { Confetti } from "./Confetti";
import { Icon } from "./icons";

/**
 * When a first step gets done (anywhere in the app), the checklist rises from the
 * bottom for a moment, ticks that step, and slides away.
 */
export function StepsPop() {
  const t = useT();
  const ob = useOnboarding();
  const loaded = useStore((s) => s.loaded);
  const firstSet = useStore((s) => Object.values(s.sets).some((x) => x.completed));
  const finished = useStore((s) => completedWorkouts(s).length);
  const done = [true, firstSet, !!ob.dictated, finished > 0];
  const key = done.map(Number).join("");
  const relevant = !ob.hideSteps && !ob.stepsDone && finished < 10;

  const prev = useRef<string | null>(null);
  const [shown, setShown] = useState<{ fresh: number; all: boolean } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const before = prev.current;
    prev.current = key;
    if (before === null || !relevant) return; // first look: nothing just happened
    const fresh = key.split("").findIndex((c, i) => c === "1" && before[i] === "0");
    if (fresh < 0) return;
    const show = setTimeout(() => {
      setShown({ fresh, all: !key.includes("0") });
      setVisible(true);
      haptic(18);
    }, 500); // let the action that did it land first
    const hide = setTimeout(() => setVisible(false), 3800);
    const clear = setTimeout(() => setShown(null), 4300);
    return () => [show, hide, clear].forEach(clearTimeout);
  }, [key, loaded, relevant]);

  if (!shown) return null;
  const labels = [t("Create your account"), t("Log your first set"), t("Say a set out loud"), t("Finish a workout")];
  const count = done.filter(Boolean).length;

  return (
    <div
      className="fixed inset-x-0 z-[58] mx-auto max-w-[560px] px-4"
      style={{
        bottom: "calc(var(--tabbar-h) + var(--sab) + 12px + var(--dock, 0px))",
        transform: visible ? "translateY(0)" : "translateY(calc(100% + 120px))",
        opacity: visible ? 1 : 0,
        transition: "transform 520ms var(--ease-drawer), opacity 300ms",
      }}
    >
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-live="polite"
        className="relative block w-full rounded-[22px] border border-line bg-card p-4 text-start shadow-float"
      >
        {shown.all && visible && <Confetti />}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[16px] font-semibold">{shown.all ? t("All first steps done!") : t("First steps")}</p>
          <p className="tnum text-[14px] text-ink-2">{t("{done} of {total} done", { done: count, total: labels.length })}</p>
        </div>
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-fill" dir="ltr">
          <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${((visible ? count : count - 1) / labels.length) * 100}%` }} />
        </div>
        <ul className="space-y-1.5">
          {labels.map((label, i) => {
            const isFresh = i === shown.fresh;
            const on = done[i] && (!isFresh || visible);
            return (
              <li key={label} className="flex items-center gap-2.5">
                <span
                  key={String(on)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? `bg-accent text-white ${isFresh ? "pop" : ""}` : "border-2 border-ink-3/40"}`}
                  style={isFresh ? { animationDelay: "250ms" } : undefined}
                >
                  {on && <Icon name="check" size={12} stroke={3} />}
                </span>
                <span className={`text-[15px] ${isFresh ? "font-semibold text-ink" : done[i] ? "text-ink-3 line-through" : "text-ink-2"}`}>{label}</span>
              </li>
            );
          })}
        </ul>
      </button>
    </div>
  );
}
