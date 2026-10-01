import type { Equipment } from "@/lib/types";

/** Small equipment glyphs on a soft tile, echoing the mockups' exercise thumbnails. */
function Glyph({ kind }: { kind: Equipment | "cardio" | null }) {
  switch (kind) {
    case "cardio":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z" />
          <path d="M5.5 12.5h3.2l1.6-2.6 2.4 4.6 1.6-2h4" strokeWidth="1.7" />
        </g>
      );
    case "barbell":
      return (
        <g fill="currentColor">
          <rect x="2" y="11" width="20" height="2" rx="1" />
          <rect x="5" y="6.5" width="2.6" height="11" rx="1.2" />
          <rect x="16.4" y="6.5" width="2.6" height="11" rx="1.2" />
          <rect x="2.6" y="8.5" width="2" height="7" rx="1" />
          <rect x="19.4" y="8.5" width="2" height="7" rx="1" />
        </g>
      );
    case "dumbbell":
      return (
        <g fill="currentColor">
          <rect x="7" y="11" width="10" height="2" rx="1" />
          <rect x="3" y="7" width="5" height="10" rx="2.4" />
          <rect x="16" y="7" width="5" height="10" rx="2.4" />
        </g>
      );
    case "cable":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 3v9" />
          <path d="M3.5 15.5c3-2.2 5.8-3.3 8.5-3.3s5.5 1.1 8.5 3.3" strokeWidth="2.2" />
          <circle cx="12" cy="12.2" r="1.3" fill="currentColor" stroke="none" />
        </g>
      );
    case "machine":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16.5l9-5.5 7 1.5" strokeWidth="2.6" />
          <path d="M8 14v5M16 12.5V19M6 19h4M14 19h4" />
        </g>
      );
    case "bodyweight":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 5h16" strokeWidth="2.4" />
          <path d="M6.5 5v14M17.5 5v14" />
        </g>
      );
    case "kettlebell":
      return (
        <g fill="currentColor">
          <path d="M8.5 9.2V8a3.5 3.5 0 0 1 7 0v1.2" fill="none" stroke="currentColor" strokeWidth="2" />
          <ellipse cx="12" cy="15" rx="6" ry="5.5" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <circle cx="12" cy="12" r="6.5" />
          <path d="M12 8.5V12l2.2 1.6" />
        </g>
      );
  }
}

export function ExerciseIcon({ kind, size = 48, tone = "fill" }: { kind: Equipment | "cardio" | null; size?: number; tone?: "fill" | "accent" | "card" }) {
  const bg = tone === "accent" ? "bg-card text-accent" : tone === "card" ? "bg-card text-ink" : "bg-fill text-ink";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[14px] ${bg}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24">
        <Glyph kind={kind} />
      </svg>
    </span>
  );
}
