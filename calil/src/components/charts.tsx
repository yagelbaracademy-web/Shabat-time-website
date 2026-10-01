"use client";

import { useId, useMemo, useState } from "react";
import { fmtNum } from "@/lib/format";
import { locale } from "@/lib/i18n";

export interface Point {
  t: number; // epoch ms
  y: number;
  label: string; // tooltip text
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    min = Math.max(0, min - 10);
    max = max + 10;
  }
  const span = max - min;
  const raw = span / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = lo; ticks.length < count + 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
    if (v >= max) break;
  }
  return ticks;
}

/** Simple progress line with a soft area, tap-and-drag to read any point. */
export function LineChart({ points, unit }: { points: Point[]; unit: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const W = 340;
  const H = 190;
  const pad = { l: 34, r: 14, t: 34, b: 26 };

  const geo = useMemo(() => {
    const ys = points.map((p) => p.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const t0 = points[0]?.t ?? 0;
    const t1 = points[points.length - 1]?.t ?? 1;
    const x = (t: number) => (t1 === t0 ? pad.l + (W - pad.l - pad.r) / 2 : pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
    const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);
    const xy = points.map((p) => [x(p.t), y(p.y)] as const);
    const line = xy.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`).join("");
    const area = xy.length ? `${line}L${xy[xy.length - 1][0]} ${H - pad.b}L${xy[0][0]} ${H - pad.b}Z` : "";
    // up to 5 x labels, evenly spaced over the data
    const n = Math.min(5, points.length);
    const xl = Array.from({ length: n }, (_, i) => points[Math.round((i * (points.length - 1)) / Math.max(1, n - 1))]);
    return { ticks, y, xy, line, area, xl, x };
  }, [points, pad.b, pad.l, pad.r, pad.t]);

  if (!points.length) return null;
  const sel = active ?? points.length - 1;
  const [sx, sy] = geo.xy[sel];
  const tip = `${points[sel].label}`;
  const tipW = Math.max(52, tip.length * 7.4 + 18);
  const tipX = Math.min(W - tipW - 2, Math.max(2, sx - tipW / 2));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    geo.xy.forEach(([x], i) => {
      if (Math.abs(x - px) < Math.abs(geo.xy[best][0] - px)) best = i;
    });
    setActive(best);
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full touch-pan-y select-none"
      direction="ltr" // time runs left to right in both languages
      role="img"
      aria-label={`Progress chart, latest ${points[points.length - 1].label}`}
      onPointerDown={onMove}
      onPointerMove={(e) => e.buttons && onMove(e)}
      onPointerLeave={() => setActive(null)}
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <text x={0} y={12} fontSize="11" fill="var(--ink-3)">
        {unit}
      </text>
      {geo.ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--line)" />
          <text x={pad.l - 8} y={geo.y(t) + 4} fontSize="11" textAnchor="end" fill="var(--ink-3)" className="tnum">
            {fmtNum(t)}
          </text>
        </g>
      ))}
      <path d={geo.area} fill={`url(#${id}-a)`} />
      <path d={geo.line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {geo.xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={points.length > 24 ? 0 : 3.2} fill="var(--card)" stroke="var(--accent)" strokeWidth="2" />
      ))}
      <line x1={sx} x2={sx} y1={sy} y2={H - pad.b} stroke="var(--accent)" strokeOpacity="0.25" strokeDasharray="3 3" />
      <circle cx={sx} cy={sy} r="9" fill="var(--accent)" fillOpacity="0.15" />
      <circle cx={sx} cy={sy} r="5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
      <g transform={`translate(${tipX} ${Math.max(0, sy - 34)})`}>
        <rect width={tipW} height="24" rx="8" fill="var(--accent)" />
        <text x={tipW / 2} y="16.5" fontSize="12.5" fontWeight="600" textAnchor="middle" fill="#fff" className="tnum">
          {tip}
        </text>
      </g>
      {geo.xl.map((p, i) => (
        <text
          key={i}
          x={geo.x(p.t)}
          y={H - 6}
          fontSize="11"
          textAnchor={i === 0 ? "start" : i === geo.xl.length - 1 ? "end" : "middle"}
          fill="var(--ink-3)"
        >
          {new Date(p.t).toLocaleDateString(locale(), { month: "short", day: "numeric" })}
        </text>
      ))}
    </svg>
  );
}

/** One slim bar per day of the month; trained days in accent. */
export function MonthBars({ days, label }: { days: number[]; label: string }) {
  const max = Math.max(1, ...days);
  const today = new Date().getDate();
  return (
    <div>
      <div className="flex h-[52px] items-end gap-[3px]" aria-hidden dir="ltr">
        {days.map((v, i) => {
          const h = v ? 18 + (v / max) * 34 : 22;
          return (
            <span
              key={i}
              className="flex-1 rounded-full transition-[height] duration-500"
              style={{
                height: h,
                background: v ? "var(--accent)" : i + 1 > today ? "var(--fill)" : "var(--accent-soft)",
                opacity: v ? 0.55 + 0.45 * (v / max) : 1,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[13px] text-ink-3" dir="ltr">
        <span>{label} 1</span>
        <span>{label} 15</span>
        <span>
          {label} {days.length}
        </span>
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 72, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (width - 4) + 2,
    height - 3 - ((v - min) / (max - min || 1)) * (height - 6),
  ]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.6" fill="var(--accent)" />
    </svg>
  );
}
