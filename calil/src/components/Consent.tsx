"use client";

import { useEffect, useState } from "react";
import { LEGAL_VERSION } from "@/content/legal";
import { signOut } from "@/lib/auth";
import { clearPendingConsent, pendingConsent } from "@/lib/consent";
import { nowIso } from "@/lib/format";
import { saveProfile, useStore } from "@/lib/store";
import { getAddress, useLang, useT } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import { Button, Logo } from "./ui";

/** The one consent line: unticked by default, links open the documents in a new tab. */
export function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const lang = useLang();
  useT(); // re-render when the form of address changes
  const address = getAddress();
  return (
    <label className="flex cursor-pointer items-start gap-3 px-1 text-[15px] leading-snug text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          checked ? "bg-accent text-white" : "border-2 border-ink-3/50 bg-card"
        }`}
      >
        {checked && <Icon name="check" size={14} stroke={3} />}
      </span>
      {lang === "he" ? (
        <span>
          {address === "m" ? "אני בן 18 ומעלה ומסכים" : address === "f" ? "אני בת 18 ומעלה ומסכימה" : "אני בן/בת 18 ומעלה ומסכים/ה"}{" "}
          <a href="/terms" target="_blank" rel="noopener" className="text-accent underline-offset-2 hover:underline">
            לתנאי השימוש
          </a>{" "}
          <a href="/privacy" target="_blank" rel="noopener" className="text-accent underline-offset-2 hover:underline">
            ולמדיניות הפרטיות
          </a>
          , כולל האופן שבו ההערות שלי נשמרות.
        </span>
      ) : (
        <span>
          I’m 18 or older and I agree to the{" "}
          <a href="/terms?lang=en" target="_blank" rel="noopener" className="text-accent underline-offset-2 hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy?lang=en" target="_blank" rel="noopener" className="text-accent underline-offset-2 hover:underline">
            Privacy Policy
          </a>
          , including how my workout notes are handled.
        </span>
      )}
    </label>
  );
}

const POINTS: { icon: IconName; text: string }[] = [
  { icon: "user", text: "Your workouts are private to you. Stored in the EU, never sold, never used for ads." },
  { icon: "mic", text: "Dictation and import are processed by Google’s AI only when you use them, and not used for training." },
  { icon: "bolt", text: "Calil is a notebook, not medical advice. Train safely and check with a professional when in doubt." },
];

/**
 * Shown once after sign-in when this account hasn't accepted the current
 * documents (Google sign-ups, older accounts, or after the documents change).
 * Consent ticked on the sign-up form is saved silently instead.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const profile = useStore((s) => s.profile);
  const [checked, setChecked] = useState(false);
  const t = useT();
  const needs = !!profile && profile.terms_version !== LEGAL_VERSION;

  // Consent ticked on the sign-up form: record it now that there's a profile.
  useEffect(() => {
    if (!needs) return;
    const pending = pendingConsent();
    if (!pending) return;
    saveProfile({ terms_version: pending.version, terms_accepted_at: pending.at });
    clearPendingConsent();
  }, [needs]);

  if (!needs || pendingConsent()) return <>{children}</>;

  const updated = !!profile?.terms_version;
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6"
      style={{ paddingTop: "calc(var(--sat) + 10vh)", paddingBottom: "calc(var(--sab) + 24px)" }}
    >
      <Logo height={40} />
      <h1 className="mt-8 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em]">
        {updated ? t("We’ve updated our terms.") : t("Before you start.")}
      </h1>
      <ul className="mt-6 space-y-4">
        {POINTS.map((p) => (
          <li key={p.icon} className="flex items-start gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name={p.icon} size={18} />
            </span>
            <p className="pt-1.5 text-[16px] leading-snug text-ink-2">{t(p.text)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <ConsentCheckbox checked={checked} onChange={setChecked} />
      </div>
      <Button
        className="mt-6 w-full"
        disabled={!checked}
        onClick={() => saveProfile({ terms_version: LEGAL_VERSION, terms_accepted_at: nowIso() })}
      >
        {t("Continue")}
      </Button>
      <button type="button" onClick={() => void signOut()} className="mt-3 h-11 text-[15px] text-ink-3">
        {t("Not now, sign out")}
      </button>
    </main>
  );
}
