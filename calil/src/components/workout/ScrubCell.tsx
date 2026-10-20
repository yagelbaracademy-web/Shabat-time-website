"use client";

import { useEffect, useRef, useState } from "react";
import { fmtNum, haptic, parseNum } from "@/lib/format";

const PX = 36; // finger travel per step, and the gap between the faint neighbours
const SLOP = 7; // less than this is a tap (keyboard), more sideways is a swipe

/**
 * A set's weight or reps. Tap to type; swipe sideways to step it up or down, with the
 * next values showing faintly while the finger is down (bigger values sit to the right,
 * like a ruler). One light tick per step. Screen readers get an adjustable control.
 */
export function ScrubCell({
  value,
  hint,
  step,
  min = 0,
  max,
  decimal,
  format,
  label,
  done,
  peek,
  hintLabel,
  onCommit,
}: {
  value: number | null;
  /** What an empty cell shows faintly (and where a swipe starts from). */
  hint: number | null;
  /** Faint text instead of the hint number, e.g. a rep range "8–12". */
  hintLabel?: string | null;
  step: number;
  min?: number;
  max: number;
  decimal?: boolean;
  format: (v: number) => string;
  label: string;
  done: boolean;
  /** Nudge once to show that it slides. */
  peek?: boolean;
  onCommit: (v: number | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const press = useRef<{ x: number; y: number; pid: number; base: number; axis: "x" | "y" | null } | null>(null);
  const [scrub, setScrub] = useState<{ base: number; dx: number } | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const swallowClick = useRef(false);

  const clamp = (v: number) => Math.min(max, Math.max(min, decimal ? v : Math.round(v)));
  const roundStep = (v: number) => Math.round(v * 100) / 100;
  const stepsOf = (dx: number) => Math.round(-dx / PX); // swipe left = up
  const live = scrub ? roundStep(clamp(scrub.base + stepsOf(scrub.dx) * step)) : null;
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (live !== null && live !== lastTick.current) {
      if (lastTick.current !== null) haptic(5);
      lastTick.current = live;
    }
  }, [live]);

  const shown = live ?? value;
  const text = shown === null ? null : format(shown);

  const onPointerDown = (e: React.PointerEvent) => {
    if (typing !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    press.current = { x: e.clientX, y: e.clientY, pid: e.pointerId, base: value ?? hint ?? 0, axis: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || p.pid !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.axis) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      p.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (p.axis === "x") {
        e.currentTarget.setPointerCapture(e.pointerId);
        lastTick.current = null;
      } else {
        press.current = null; // a vertical move is the page scrolling
        return;
      }
    }
    setScrub({ base: p.base, dx });
  };
  const onPointerUp = () => {
    const p = press.current;
    press.current = null;
    if (!p || p.axis !== "x" || !scrub) return;
    swallowClick.current = true; // the click that follows a swipe isn't a tap
    const next = roundStep(clamp(scrub.base + stepsOf(scrub.dx) * step));
    setScrub(null);
    if (next !== value) onCommit(next);
  };

  // Tap: type it. Focus right in the tap so the phone opens its keyboard.
  const onClick = () => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    setTyping(value === null ? "" : fmtNum(value));
    input.current?.focus();
  };

  const nudge = (d: number) => {
    const next = roundStep(clamp((value ?? hint ?? 0) + d * step));
    haptic(5);
    onCommit(next);
  };

  return (
    <div
      data-no-swipe
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value ?? undefined}
      aria-valuetext={text ?? (hint !== null ? format(hint) : "–")}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={typing === null ? 0 : -1}
      onKeyDown={(e) => {
        if (typing !== null) return;
        const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
        if (d) {
          e.preventDefault();
          nudge(d);
        } else if (e.key === "Enter") onClick();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        press.current = null;
        setScrub(null);
      }}
      onClick={onClick}
      className={`relative h-12 w-full min-w-0 cursor-ew-resize touch-pan-y overflow-hidden rounded-[12px] outline-none select-none focus-visible:shadow-[0_0_0_2px_var(--accent)] ${
        scrub ? "bg-card shadow-[0_0_0_1.5px_var(--accent)]" : ""
      }`}
    >
      {/* The typed value lives in a real input, focused straight from the tap. */}
      <input
        ref={input}
        inputMode={decimal ? "decimal" : "numeric"}
        enterKeyHint="done"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden={typing === null}
        value={typing ?? ""}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.,-]/g, "");
          setTyping(v);
          const n = parseNum(v.replace("-", ""));
          if (v === "") onCommit(null);
          else if (n !== null) onCommit(clamp(v.startsWith("-") ? -n : n));
        }}
        onFocus={(e) => {
          if (typing === null) setTyping(value === null ? "" : fmtNum(value));
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select());
        }}
        onBlur={() => setTyping(null)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder={hintLabel ?? (hint !== null ? format(hint) : "–")}
        className={`tnum absolute inset-0 h-full w-full bg-card text-center text-[19px] outline-none placeholder:text-ink-3/70 ${
          typing === null ? "pointer-events-none opacity-0" : "shadow-[0_0_0_2px_var(--accent)]"
        } rounded-[12px]`}
      />

      {typing === null &&
        (scrub ? (
          // While swiping: the value in the middle, its neighbours faint on both sides.
          <span aria-hidden className="pointer-events-none absolute inset-0" dir="ltr">
            {[-2, -1, 0, 1, 2].map((k) => {
              const v = roundStep((live ?? 0) + k * step);
              if (v < min || v > max) return null;
              const frac = -scrub.dx / PX - stepsOf(scrub.dx); // -0.5..0.5 between steps
              const x = (k - frac) * PX; // moves 1:1 with the finger
              return (
                <span
                  key={k}
                  className={`tnum absolute top-1/2 left-1/2 whitespace-nowrap ${k === 0 ? "text-[19px] font-semibold text-ink" : "text-[15px] text-ink-3"}`}
                  style={{ transform: `translate(calc(-50% + ${x}px), -50%)`, opacity: k === 0 ? 1 : Math.max(0, 0.75 - Math.abs(k) * 0.25) }}
                >
                  {format(v)}
                </span>
              );
            })}
          </span>
        ) : (
          <span
            aria-hidden
            className={`tnum pointer-events-none absolute inset-0 flex items-center justify-center truncate ${peek ? "scrub-peek" : ""} ${
              text === null ? "text-[19px] text-ink-3/70" : `${text.length > 5 ? "text-[15px]" : "text-[19px]"} text-ink ${done ? "font-semibold" : ""}`
            }`}
          >
            {text ?? hintLabel ?? (hint !== null ? format(hint) : "–")}
          </span>
        ))}
    </div>
  );
}
