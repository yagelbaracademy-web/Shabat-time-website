"use client";

import { useEffect, useState } from "react";

/** Current time, ticking every `ms` while `live` is true. */
export function useNow(live = true, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [live, ms]);
  return now;
}

/**
 * Today's date that follows the clock: the home-screen app can stay open for days,
 * so re-check when it comes back to the screen and at midnight.
 */
export function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const key = (d: Date) => d.toDateString();
    let current = key(today);
    const check = () => {
      const now = new Date();
      if (key(now) !== current) {
        current = key(now);
        setToday(now);
      }
    };
    const next = new Date();
    next.setHours(24, 0, 1, 0);
    const midnight = setTimeout(check, next.getTime() - Date.now());
    const minute = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(midnight);
      clearInterval(minute);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [today]);
  return today;
}
