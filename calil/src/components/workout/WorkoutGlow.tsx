"use client";

import { useEffect, useRef } from "react";

/** iPhone screen corner radii (points), by screen size in portrait. */
const RADII: Record<string, number> = {
  "375x812": 41, // X, XS, 11 Pro, 12/13 mini
  "414x896": 41, // XR, XS Max, 11, 11 Pro Max
  "390x844": 47, // 12, 13, 14, 12/13 Pro
  "428x926": 53, // 12/13 Pro Max, 14 Plus
  "393x852": 55, // 14 Pro, 15, 15 Pro, 16
  "430x932": 55, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  "402x874": 62, // 16 Pro
  "440x956": 62, // 16 Pro Max
};

/** Workout mode: light flowing around the edge of the screen. */
export function WorkoutGlow() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      const w = Math.min(screen.width, screen.height);
      const h = Math.max(screen.width, screen.height);
      el.current?.style.setProperty("--glow-r", `${standalone ? (RADII[`${w}x${h}`] ?? 0) : 0}px`);
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={el} className="edge-glow" aria-hidden>
      <div className="soft">
        <i />
      </div>
      <div className="line">
        <i />
      </div>
    </div>
  );
}
