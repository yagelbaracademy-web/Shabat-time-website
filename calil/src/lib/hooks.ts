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
