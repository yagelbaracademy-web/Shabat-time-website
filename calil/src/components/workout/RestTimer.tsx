"use client";

import { useEffect, useRef, useState } from "react";
import { addRest, pauseRest, resumeRest, skipRest } from "@/lib/actions";
import { fmtClock, haptic } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Icon } from "../icons";

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18].forEach((d, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.4);
    });
    setTimeout(() => ctx.close(), 900);
  } catch {}
}

/** Compact floating rest timer. Never covers the workout; sits above the tab bar. */
export function RestPill() {
  const rest = useStore((s) => s.rest);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(null);
  const t = useT();

  useEffect(() => {
    if (!rest?.endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest?.endsAt]);

  const left = rest ? (rest.endsAt ? rest.endsAt - now : rest.pausedLeft ?? 0) : 0;
  const done = !!rest && left <= 0;

  useEffect(() => {
    if (!done || !rest?.endsAt || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    haptic(180);
    chime();
    const t = setTimeout(skipRest, 4000);
    return () => clearTimeout(t);
  }, [done, rest?.endsAt]);

  if (!rest) return null;
  const secs = Math.ceil(Math.max(0, left) / 1000);
  const frac = Math.max(0, Math.min(1, left / (rest.total * 1000)));
  const paused = rest.endsAt === null;
  const R = 17;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="rise fixed inset-x-0 z-40 mx-auto flex max-w-[560px] justify-center px-4"
      style={{ bottom: "calc(var(--tabbar-h) + var(--sab) + 12px + var(--dock, 0px))" }}
    >
      <div
        role="timer"
        aria-live="off"
        aria-label={t("Rest {time}", { time: fmtClock(secs) })}
        // Glass: frosted and see-through, like the tab bar, so it floats over the workout.
        className={`flex w-full items-center gap-3 rounded-[22px] border py-2 pe-2 ps-2.5 shadow-float backdrop-blur-2xl backdrop-saturate-150 ${
          done ? "border-transparent bg-accent text-white" : "border-white/80 bg-white/85 dark:border-white/10 dark:bg-card/80"
        }`}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={R} fill="none" stroke={done ? "rgba(255,255,255,.35)" : "rgba(28,116,234,.15)"} strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke={done ? "#fff" : "var(--accent)"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="tnum text-[22px] leading-none font-semibold tracking-[-0.01em]">{done ? t("Go") : fmtClock(secs)}</p>
          <p className={`mt-1 text-[13px] ${done ? "text-white/80" : "text-ink-2"}`}>{done ? t("Rest is over") : paused ? t("Paused") : t("Rest")}</p>
        </div>
        {!done && (
          <>
            <button
              type="button"
              onClick={() => addRest(30)}
              className="press tnum h-11 rounded-full bg-card px-3.5 text-[15px] font-semibold text-accent-ink"
            >
              {t("+30s")}
            </button>
            <button
              type="button"
              aria-label={paused ? t("Resume rest") : t("Pause rest")}
              onClick={paused ? resumeRest : pauseRest}
              className="press flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"
            >
              <Icon name={paused ? "play" : "pause"} size={18} stroke={2.4} />
            </button>
          </>
        )}
        <button
          type="button"
          aria-label={t("Skip rest")}
          onClick={skipRest}
          className={`press flex h-11 w-11 items-center justify-center rounded-full ${done ? "bg-white/20" : "bg-card text-ink-2"}`}
        >
          <Icon name={done ? "close" : "skip"} size={18} />
        </button>
      </div>
    </div>
  );
}
