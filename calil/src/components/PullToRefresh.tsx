"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { flush, refresh } from "@/lib/store";
import { haptic } from "@/lib/format";
import { Icon } from "./icons";

const TRIGGER = 72; // px of (resisted) pull needed to refresh
const MAX = 120;

/**
 * Pull down from the top of any screen to refresh, for the home-screen app
 * where there's no browser reload button. Saves anything still queued, then
 * reloads (fresh data and the newest version). Offline it only retries a sync.
 */
export function PullToRefresh() {
  const t = useT();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const active = useRef(false);
  const pullRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const canStart = (e: TouchEvent) =>
      window.scrollY <= 0 &&
      !busyRef.current &&
      document.body.style.overflow !== "hidden" && // a sheet is open
      e.touches.length === 1 &&
      !(e.target as HTMLElement).closest("input, textarea, [data-no-pull]");

    const onStart = (e: TouchEvent) => {
      if (!canStart(e)) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      active.current = false;
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (!active.current) {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
          start.current = null; // a scroll or a sideways swipe, not a pull
          return;
        }
        active.current = true;
        setDragging(true);
      }
      e.preventDefault();
      const d = Math.min(MAX, dy * 0.5);
      if (pullRef.current < TRIGGER && d >= TRIGGER) haptic(10);
      pullRef.current = d;
      setPull(d);
    };
    const onEnd = async () => {
      if (!start.current) return;
      start.current = null;
      const go = active.current && pullRef.current >= TRIGGER;
      active.current = false;
      setDragging(false);
      if (!go) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setPull(TRIGGER);
      const minSpin = new Promise((r) => setTimeout(r, 650));
      // Push anything still queued first, so a reload can never lose a set.
      await Promise.all([flush().catch(() => {}), minSpin]);
      if (navigator.onLine) {
        // Like the browser's reload button: fresh data and the latest version of the app.
        window.location.reload();
        return;
      }
      await refresh().catch(() => {}); // offline: keep the page, just try a sync
      busyRef.current = false;
      setBusy(false);
      pullRef.current = 0;
      setPull(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const visible = pull > 0 || busy;
  const progress = Math.min(1, pull / TRIGGER);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[55] flex justify-center"
      style={{
        top: "calc(var(--sat) + 6px)",
        transform: `translateY(${visible ? pull - 34 : -60}px)`,
        transition: dragging ? "none" : "transform 300ms var(--ease-out)",
        opacity: visible ? Math.max(0.35, progress) : 0,
      }}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-accent shadow-float">
        {busy ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" role="status" aria-label={t("Refreshing…")} />
        ) : (
          <Icon name="down" size={19} stroke={2.2} style={{ transform: `rotate(${progress >= 1 ? 180 : 0}deg)`, transition: "transform 200ms" }} />
        )}
      </span>
    </div>
  );
}
