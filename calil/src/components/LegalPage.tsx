"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LEGAL_UPDATED, type Doc, type Lang } from "@/content/legal";
import { Icon } from "./icons";
import { Segmented } from "./ui";

const OTHERS = [
  { href: "/terms", he: "תנאי שימוש", en: "Terms" },
  { href: "/privacy", he: "פרטיות", en: "Privacy" },
  { href: "/accessibility", he: "נגישות", en: "Accessibility" },
];

/** A calm, readable legal document with a Hebrew / English switch. Public: no sign-in needed. */
export function LegalPage({ doc, path }: { doc: Record<Lang, Doc>; path: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [picked, setLang] = useState<Lang | null>(null);
  const lang: Lang = picked ?? (params.get("lang") === "en" ? "en" : "he");
  const d = doc[lang];
  const he = lang === "he";

  return (
    <main
      lang={lang}
      dir={he ? "rtl" : "ltr"}
      className="mx-auto w-full max-w-[640px] px-5"
      style={{ paddingTop: "calc(var(--sat) + 20px)", paddingBottom: "calc(var(--sab) + 48px)" }}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            // Came from inside the app: go back there. Opened directly: go home.
            if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
            else router.push("/");
          }}
          className="press -ms-2 inline-flex h-11 items-center gap-0.5 rounded-full ps-1 pe-3 text-[17px] text-accent"
        >
          <Icon name={he ? "chevronRight" : "chevronLeft"} size={24} />
          {he ? "חזרה" : "Back"}
        </button>
        <Segmented
          size="sm"
          options={[
            { value: "he", label: "עברית" },
            { value: "en", label: "English" },
          ]}
          value={lang}
          onChange={(v) => setLang(v as Lang)}
        />
      </div>

      <h1 className="mt-6 text-[32px] leading-tight font-semibold tracking-[-0.02em]">{d.title}</h1>
      <p className="mt-1 text-[14px] text-ink-3">
        {he ? "עודכן לאחרונה: " : "Last updated: "}
        {LEGAL_UPDATED[lang]}
      </p>
      <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{d.intro}</p>

      <div className="mt-8 space-y-8">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{s.h}</h2>
            <div className="mt-2 space-y-3">
              {s.p.map((t, i) => (
                <p key={i} className="text-[16px] leading-relaxed text-ink-2">
                  {t}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <nav aria-label={he ? "מסמכים נוספים" : "Other documents"} className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-[15px]">
        {OTHERS.filter((o) => o.href !== path).map((o) => (
          <Link key={o.href} href={`${o.href}${lang === "en" ? "?lang=en" : ""}`} className="text-accent">
            {o[lang]}
          </Link>
        ))}
        <Link href="/" className="text-ink-3">
          {he ? "חזרה לאפליקציה" : "Back to the app"}
        </Link>
      </nav>
    </main>
  );
}
