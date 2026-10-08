"use client";


const COLORS = ["#1c74ea", "#6fb1ff", "#bfdcff", "#0d58c4", "#f2b84b", "#ffffff"];

/** A short burst of confetti in Calil's colors. Plays once; nothing with reduced motion. */
export function Confetti({ count = 36 }: { count?: number }) {
  // Scattered but stable: a fixed pseudo-random spread per piece.
  const rand = (i: number, k: number) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const bits = Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + rand(i, 1) * 0.5;
    const dist = 90 + rand(i, 2) * 120;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 60,
      r: rand(i, 3) * 540 - 270,
      c: COLORS[i % COLORS.length],
      w: 6 + rand(i, 4) * 5,
      d: rand(i, 5) * 120,
    };
  });
  return (
    <span aria-hidden className="confetti pointer-events-none absolute inset-0 overflow-visible">
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
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
