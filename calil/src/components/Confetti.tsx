"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";


const COLORS = ["#1c74ea", "#6fb1ff", "#bfdcff", "#0d58c4", "#f2b84b", "#ffffff"];

/**
 * A short burst of confetti in Calil's colors, from where this sits, flying across the
 * whole screen (drawn in a full-screen layer, so it never widens the page). Plays once.
 */
export function Confetti({ count = 48 }: { count?: number }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (r) setAt({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const done = setTimeout(() => setAt(null), 1900);
    return () => clearTimeout(done);
  }, []);

  // Scattered but stable: a fixed pseudo-random spread per piece.
  const rand = (i: number, k: number) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const bits = Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + rand(i, 1) * 0.6;
    const dist = 120 + rand(i, 2) * 220;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 90,
      r: rand(i, 3) * 720 - 360,
      c: COLORS[i % COLORS.length],
      w: 6 + rand(i, 4) * 6,
      d: rand(i, 5) * 140,
    };
  });

  return (
    <span ref={anchor} aria-hidden className="absolute inset-0">
      {at &&
        createPortal(
          <span aria-hidden className="confetti pointer-events-none fixed inset-0 z-[60] overflow-hidden">
            <span className="absolute" style={{ left: at.x, top: at.y }}>
              {bits.map((b, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--x": `${b.x}px`,
                      "--y": `${b.y}px`,
                      "--r": `${b.r}deg`,
                      background: b.c,
                      width: b.w,
                      height: b.w * 0.45,
                      animationDelay: `${b.d}ms`,
                      boxShadow: b.c === "#ffffff" ? "0 0 0 1px rgba(12,12,14,0.08)" : undefined,
                    } as React.CSSProperties
                  }
                />
              ))}
            </span>
          </span>,
          document.body,
        )}
    </span>
  );
}
