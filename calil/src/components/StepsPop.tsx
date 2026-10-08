"use client";

import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { setOnboarding, useOnboarding } from "@/lib/onboarding";
import { createPortal } from "react-dom";
import type { IconName } from "./icons";
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

  // ?celebrate replays the celebration (to see it again after it was closed)
  const [replay, setReplay] = useState(() => typeof window !== "undefined" && new URLSearchParams(location.search).has("celebrate"));
  const allDone = !key.includes("0");
  if (loaded && replay)
    return (
      <Celebration
        onClose={() => {
          setReplay(false);
          history.replaceState(null, "", location.pathname);
        }}
      />
    );
  if (loaded && allDone && relevant) return <Celebration />;
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

/**
 * Every first step done: a full screen that plays in beats. The bar fills fast, the
 * checks land one by one, then 👏 pops in with confetti and the words rise.
 */
function Celebration({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const name = useStore((s) => s.profile?.name?.split(" ")[0] ?? "");
  const [filled, setFilled] = useState(false);
  const [burst, setBurst] = useState(false);
  const steps: { icon: IconName; label: string }[] = [
    { icon: "user", label: t("Create your account") },
    { icon: "check", label: t("Log your first set") },
    { icon: "mic", label: t("Say a set out loud") },
    { icon: "trophy", label: t("Finish a workout") },
  ];
  useEffect(() => {
    const fill = requestAnimationFrame(() => requestAnimationFrame(() => setFilled(true)));
    const pop = setTimeout(() => {
      setBurst(true);
      haptic(30);
    }, 1050);
    // a tap on each clap (in step with .cel-claps)
    const claps = [1610, 1975, 2340].map((ms) => setTimeout(() => haptic(22), ms));
    return () => {
      cancelAnimationFrame(fill);
      clearTimeout(pop);
      claps.forEach(clearTimeout);
    };
  }, []);
  const close = () => {
    haptic(12);
    setOnboarding({ stepsDone: true });
    onClose?.();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("All first steps done!")} className="cel-bg fixed inset-0 z-[70] overflow-y-auto">
      <div
        className="mx-auto flex min-h-full max-w-[460px] flex-col px-6 text-center"
        style={{ paddingTop: "calc(var(--sat) + 9vh)", paddingBottom: "calc(var(--sab) + 24px)" }}
      >
        <div className="relative mx-auto flex h-[132px] w-[132px] items-center justify-center">
          {burst && <Confetti count={56} />}
          {burst && (
            <span className="cel-clap select-none text-[104px] leading-none" aria-hidden>
              <span className="cel-claps inline-block">👏</span>
            </span>
          )}
        </div>

        <h1 className="cel-rise mt-6 text-[32px] leading-tight font-semibold tracking-[-0.02em]" style={{ animationDelay: "1250ms" }}>
          {name ? (
            <>
              {t("Nicely done")}, <span dir="auto">{name}</span>
              <span className="text-accent">.</span>
            </>
          ) : (
            <>
              {t("Nicely done")}
              <span className="text-accent">!</span>
            </>
          )}
        </h1>
        <p className="cel-rise mx-auto mt-2 max-w-[320px] text-[17px] leading-snug text-ink-2" style={{ animationDelay: "1380ms" }}>
          {t("You’ve completed your first steps. From here it’s all Calil.")}
        </p>

        <div className="cel-rise mt-8 rounded-[24px] border border-white/80 bg-white/80 p-5 text-start shadow-[0_10px_30px_-12px_rgba(28,116,234,0.25)]" style={{ animationDelay: "60ms" }}>
          <p className="text-[17px] font-semibold">{t("{n} steps done", { n: steps.length })}</p>
          <div className="mt-3 mb-4 h-2 overflow-hidden rounded-full bg-accent-soft" dir="ltr">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: filled ? "100%" : "0%", transition: "width 850ms cubic-bezier(0.3, 0.7, 0.2, 1) 150ms" }}
            />
          </div>
          <ul className="space-y-3">
            {steps.map((x, i) => (
              <li key={x.label} className="flex items-center gap-3">
                <span
                  className="cel-check flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                  style={{ animationDelay: `${300 + i * 170}ms` }}
                >
                  <Icon name="check" size={15} stroke={3} />
                </span>
                <span className="flex-1 text-[16px]">{x.label}</span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon name={x.icon} size={18} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1" />
        <button
          type="button"
          onClick={close}
          className="cel-rise press mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-[18px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(28,116,234,0.75)]"
          style={{ animationDelay: "1550ms" }}
        >
          {t("Let’s keep going")} ✨
        </button>
      </div>
    </div>,
    document.body,
  );
}
