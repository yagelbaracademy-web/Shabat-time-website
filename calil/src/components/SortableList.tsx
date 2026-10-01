"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/lib/format";

const HOLD_MS = 380; // press and hold to pick a row up
const SLOP = 8; // moving more than this before the hold ends = scroll or swipe, not a drag

/**
 * Press-and-hold to reorder, no handles. A short tap still opens the row, a
 * sideways swipe still reaches SwipeRow's actions, and normal scrolling still
 * scrolls; only a still finger held for a moment lifts the row.
 */
export function SortableList<T extends { id: string }>({
  items,
  render,
  onReorder,
  gap = 8,
  className = "",
}: {
  items: T[];
  render: (item: T) => ReactNode;
  onReorder: (ids: string[]) => void;
  gap?: number;
  className?: string;
}) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  const press = useRef<{ id: string; x: number; y: number; pid: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const drag = useRef<{ id: string; from: number; startY: number; tops: number[]; heights: number[]; pid: number } | null>(null);
  const justDropped = useRef(false);
  const [state, setState] = useState<{ id: string; dy: number; over: number; from: number; height: number } | null>(null);

  // While a row is lifted, stop the page from scrolling under the finger.
  useEffect(() => {
    if (!state) return;
    const block = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", block, { passive: false });
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("touchmove", block);
      document.body.style.userSelect = "";
    };
  }, [state]);

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  const lift = (id: string, pid: number, y: number) => {
    const from = items.findIndex((i) => i.id === id);
    const els = items.map((i) => refs.current.get(i.id)!);
    if (from < 0 || els.some((e) => !e)) return;
    drag.current = {
      id,
      from,
      startY: y,
      tops: els.map((e) => e.getBoundingClientRect().top),
      heights: els.map((e) => e.offsetHeight),
      pid,
    };
    try {
      els[from].setPointerCapture(pid);
    } catch {}
    haptic(18);
    setState({ id, dy: 0, over: from, from, height: els[from].offsetHeight });
  };

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelPress();
    const { clientX: x, clientY: y, pointerId: pid } = e;
    press.current = { id, x, y, pid, timer: setTimeout(() => lift(id, pid, y), HOLD_MS) };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && !drag.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) cancelPress();
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    const dy = e.clientY - d.startY;
    // Where would the lifted row's center land?
    const center = d.tops[d.from] + d.heights[d.from] / 2 + dy;
    let over = 0;
    d.tops.forEach((top, i) => {
      if (i !== d.from && top + d.heights[i] / 2 < center) over++;
    });
    setState((s) => {
      if (s && s.over !== over) haptic(6);
      return s ? { ...s, dy, over } : s;
    });
  };

  const onPointerUp = () => {
    cancelPress();
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    justDropped.current = true; // swallow the click that follows the drop
    setTimeout(() => (justDropped.current = false), 50);
    setState((s) => {
      if (s && s.over !== s.from) {
        const ids = items.map((i) => i.id);
        const [moved] = ids.splice(s.from, 1);
        ids.splice(s.over, 0, moved);
        onReorder(ids);
      }
      return null;
    });
  };

  /** How far each non-lifted row moves to make room. */
  const shift = (i: number) => {
    if (!state || i === state.from) return 0;
    const space = state.height + gap;
    if (state.from < state.over && i > state.from && i <= state.over) return -space;
    if (state.over < state.from && i >= state.over && i < state.from) return space;
    return 0;
  };

  return (
    <ul className={className} style={{ display: "flex", flexDirection: "column", gap }}>
      {items.map((item, i) => {
        const lifted = state?.id === item.id;
        return (
          <li
            key={item.id}
            ref={(el) => {
              if (el) refs.current.set(item.id, el);
              else refs.current.delete(item.id);
            }}
            onPointerDown={onPointerDown(item.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClickCapture={(e) => {
              if (justDropped.current || lifted) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onContextMenu={(e) => e.preventDefault()} // a long press shouldn't open the browser menu
            className="relative"
            style={{
              transform: lifted ? `translate3d(0, ${state!.dy}px, 0) scale(1.03)` : `translate3d(0, ${shift(i)}px, 0)`,
              transition: lifted ? "box-shadow 200ms" : "transform 220ms var(--ease-out)",
              zIndex: lifted ? 20 : undefined,
              boxShadow: lifted ? "var(--shadow-float)" : undefined,
              borderRadius: 22,
            }}
          >
            {render(item)}
          </li>
        );
      })}
    </ul>
  );
}
