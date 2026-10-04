import type { Metadata } from "next";
import credits from "@/content/photo-credits.json";

export const metadata: Metadata = { title: "Photo credits · Calil" };

const LICENSES: Record<string, string> = {
  by: "CC BY",
  "by-sa": "CC BY-SA",
};

/** Credits for the photos in the post-workout comparison (Creative Commons). */
export default function Page() {
  return (
    <main className="mx-auto max-w-[640px] px-5 py-10" dir="ltr">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Photo credits</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        The photos shown after a workout (“that’s about a dairy cow”) are used under Creative Commons licenses. Each is cropped to a square
        and resized; cropped versions of CC BY-SA photos are shared under the same license.
      </p>
      <ul className="mt-6 space-y-3 text-[15px]">
        {credits.map((c) => (
          <li key={c.key} className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, tiny local photo */}
            <img src={`/fun/${c.key}.webp`} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-[10px] object-cover" />
            <span className="min-w-0">
              <a href={c.url ?? "#"} target="_blank" rel="noopener" className="text-accent">
                {c.title || "Untitled"}
              </a>{" "}
              by {c.creator || "unknown"} · {LICENSES[c.license] ?? c.license} {c.version}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
