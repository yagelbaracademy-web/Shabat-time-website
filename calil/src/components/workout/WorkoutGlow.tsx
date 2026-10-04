"use client";

import { useEffect } from "react";

/** Workout mode: vivid blue light drifting slowly in the corners, behind everything. */
export function WorkoutGlow() {
  // The page background sits on <body>; let the light show through it while this is on.
  useEffect(() => {
    document.documentElement.classList.add("workout-mode");
    return () => document.documentElement.classList.remove("workout-mode");
  }, []);
  return (
    <div className="workout-aura" aria-hidden>
      <span className="a1" />
      <span className="a2" />
      <span className="a3" />
      <span className="a4" />
    </div>
  );
}
