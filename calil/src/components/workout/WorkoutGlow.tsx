"use client";

import { useEffect } from "react";

/** Workout mode: soft, light orbs of Calil blue drifting slowly behind the content. */
export function WorkoutGlow() {
  // The page background sits on <body>; let the orbs show through it while this is on.
  useEffect(() => {
    document.documentElement.classList.add("workout-mode");
    return () => document.documentElement.classList.remove("workout-mode");
  }, []);
  return (
    <div className="workout-orbs" aria-hidden>
      <span className="o1" />
      <span className="o2" />
      <span className="o3" />
      <span className="o4" />
    </div>
  );
}
