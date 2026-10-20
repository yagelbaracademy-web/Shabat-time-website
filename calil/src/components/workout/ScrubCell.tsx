"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fmtNum, haptic, parseNum } from "@/lib/format";
import { tr } from "@/lib/i18n";

const PX = 36; // finger travel per step, and the gap between the faint neighbours
const SLOP = 7; // less than this is a tap, more sideways is a swipe
const IDLE_MS = 4000; // an active cell settles back after this long untouched
const ACTIVE_EVENT = "calil:cell-active"; // one active cell at a time

/**
 * A set's weight or reps.
 * Tap: the cell wakes up with − and + on its sides (hold to keep counting).
 * Tap the number again: type it. Swiping sideways steps it too, as a bonus.
 * No browser gestures to fight, so it behaves the same in every phone browser.
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
  /** What an empty cell shows faintly (and where a step starts from). */
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
  /** Nudge once to show that it can be changed in place. */
  peek?: boolean;
  onCommit: (v: number | null) => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const press = useRef<{ x: number; y: number; pid: number; base: number; axis: "x" | "y" | null } | null>(null);
  const [scrub, setScrub] = useState<{ base: number; dx: number } | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const swallowClick = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest value, for the hold-to-repeat loop (it outlives a render).
  const current = useRef(value ?? hint ?? 0);
  useEffect(() => {
    current.current = value ?? hint ?? 0;
  }, [value, hint]);

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

  /** Keeps the cell awake a little longer after each touch. */
  const wake = () => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setActive(false), IDLE_MS);
  };
  const activate = () => {
    setActive(true);
    wake();
    window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: id }));
  };

  // Another cell woke up, or a touch landed elsewhere: settle back.
  useEffect(() => {
    if (!active) return;
    const other = (e: Event) => (e as CustomEvent).detail !== id && setActive(false);
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setActive(false);
    window.addEventListener(ACTIVE_EVENT, other);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      window.removeEventListener(ACTIVE_EVENT, other);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [active, id]);
  useEffect(
    () => () => {
      if (idle.current) clearTimeout(idle.current);
      if (repeat.current) clearTimeout(repeat.current);
    },
    [],
  );

  const shown = live ?? value;
  const text = shown === null ? null : format(shown);

  const bump = (d: number, size = step) => {
    // A bigger step lands on its own grid (e.g. 42.5 → 45, not 45.5).
    const raw = current.current + d * size;
    const next = roundStep(clamp(size > step ? (d > 0 ? Math.floor(raw / size) : Math.ceil(raw / size)) * size : raw));
    if (next === current.current && value !== null) return false;
    current.current = next;
    haptic(6);
    onCommit(next);
    return true;
  };
  // Hold − or + to keep counting, faster after a moment.
  const startRepeat = (d: number) => {
    bump(d);
    wake();
    let delay = 380;
    let n = 0;
    const tick = () => {
      // Held a while: bigger jumps (×5, 2.5 kg for half-kilo steps), so far numbers come quickly.
      if (!bump(d, ++n > 8 ? step * 5 : step)) return;
      wake();
      delay = Math.max(70, delay * 0.82);
      repeat.current = setTimeout(tick, delay);
    };
    repeat.current = setTimeout(tick, delay);
  };
  const stopRepeat = () => {
    if (repeat.current) clearTimeout(repeat.current);
    repeat.current = null;
  };

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
      if (p.axis === "y") {
        press.current = null; // a vertical move is the page scrolling
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      lastTick.current = null;
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
    activate();
  };

  // First tap wakes the cell; a tap on its number while awake opens the keyboard.
  // Focus happens inside the tap itself, so the phone agrees to show the keyboard.
  const onClick = () => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    if (!active) {
      activate();
      return;
    }
    if (idle.current) clearTimeout(idle.current);
    setTyping(value === null ? "" : fmtNum(value));
    input.current?.focus();
  };

  const stepButton = (d: 1 | -1) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={d > 0 ? tr("More") : tr("Less")}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault(); // no focus, no text selection, no double-tap zoom
        startRepeat(d);
      }}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      onPointerCancel={stopRepeat}
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-accent-soft text-[20px] leading-none font-semibold text-accent active:bg-accent active:text-white ${
        d > 0 ? "right-1" : "left-1"
      }`}
    >
      {d > 0 ? "+" : "−"}
    </button>
  );

  return (
    <div
      ref={box}
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
          bump(d);
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
      // No blue tap flash, no text selection or callout from a press on a phone.
      style={{ WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
      className={`relative h-12 w-full min-w-0 touch-pan-y overflow-hidden rounded-[12px] outline-none transition-[background-color,box-shadow] duration-150 focus-visible:shadow-[0_0_0_2px_var(--accent)] ${
        scrub || active ? "bg-card shadow-[0_0_0_1.5px_rgba(28,116,234,0.45)]" : ""
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
        onBlur={() => {
          setTyping(null);
          setActive(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder={hintLabel ?? (hint !== null ? format(hint) : "–")}
        className={`tnum absolute inset-0 h-full w-full rounded-[12px] bg-card text-center text-[19px] outline-none placeholder:text-ink-3/70 ${
          typing === null ? "pointer-events-none opacity-0" : "shadow-[0_0_0_2px_var(--accent)]"
        }`}
      />

      {typing === null && active && !scrub && (
        <>
          {stepButton(-1)}
          {stepButton(1)}
        </>
      )}

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
            className={`tnum pointer-events-none absolute inset-y-0 flex items-center justify-center truncate ${active ? "inset-x-9" : "inset-x-0"} ${peek ? "scrub-peek" : ""} ${
              text === null ? "text-[19px] text-ink-3/70" : `${text.length > 4 || active ? "text-[16px]" : "text-[19px]"} text-ink ${done || active ? "font-semibold" : ""}`
            }`}
          >
            {text ?? hintLabel ?? (hint !== null ? format(hint) : "–")}
          </span>
        ))}
    </div>
  );
}
