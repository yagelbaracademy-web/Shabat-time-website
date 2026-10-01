"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OAUTH_PROVIDERS, sendPasswordReset, signInWithEmail, signInWithProvider, signUpWithEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ConsentCheckbox } from "@/components/Consent";
import { Logo } from "@/components/ui";
import { rememberConsent } from "@/lib/consent";
import { setLang, tr, useLang, useT } from "@/lib/i18n";

type Mode = "signin" | "signup" | "reset";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const friendly = (m: string) =>
  /invalid login/i.test(m)
    ? tr("That email and password don’t match.")
    : /provider is not enabled|unsupported provider/i.test(m)
      ? tr("Google sign-in isn’t switched on yet. Use email for now.")
      : /already registered/i.test(m)
        ? tr("You already have an account. Sign in instead.")
        : m;

export default function LoginPage() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace("/"));
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
        router.replace("/");
      } else if (mode === "signup") {
        rememberConsent();
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) setInfo(t("Check your inbox to confirm your email, then sign in."));
        else router.replace("/");
      } else {
        await sendPasswordReset(email);
        setInfo(t("If that email has an account, a reset link is on its way."));
      }
    } catch (err) {
      setError(friendly((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (p: (typeof OAUTH_PROVIDERS)[number]) => {
    setError(null);
    try {
      await signInWithProvider(p);
    } catch (err) {
      setError(friendly((err as Error).message));
    }
  };

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6"
      style={{ paddingTop: "calc(var(--sat) + 12vh)", paddingBottom: "calc(var(--sab) + 24px)" }}
    >
      <div className="rise">
        <div className="flex items-start justify-between">
          <Logo height={52} />
          <button
            type="button"
            onClick={() => setLang(lang === "he" ? "en" : "he")}
            className="press rounded-full bg-fill px-3 py-1.5 text-[14px] font-medium text-ink-2"
          >
            {lang === "he" ? "English" : "עברית"}
          </button>
        </div>
        <p className="mt-6 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance">
          {t("Logging your workout should never interrupt your workout.")}
        </p>
        <p className="mt-3 text-[17px] text-ink-2">{t("A calm, fast notebook for every set you lift.")}</p>
      </div>

      <div className="rise mt-10 space-y-3" style={{ animationDelay: "60ms" }}>
        {mode !== "reset" &&
          OAUTH_PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => oauth(p)}
              className="press flex min-h-[54px] w-full items-center justify-center gap-3 rounded-[16px] border border-line bg-card text-[17px] font-semibold shadow-card"
            >
              <GoogleMark /> {t("Continue with Google")}
            </button>
          ))}

        {mode !== "reset" && (
          <div className="flex items-center gap-3 py-1 text-[14px] text-ink-3">
            <span className="h-px flex-1 bg-line" /> {t("or")} <span className="h-px flex-1 bg-line" />
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="overflow-hidden rounded-[16px] border border-line bg-card shadow-card">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder={t("Email")}
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[54px] w-full bg-transparent px-4 outline-none placeholder:text-ink-3"
            />
            {mode !== "reset" && (
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? t("Password (8+ characters)") : t("Password")}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[54px] w-full border-t border-line bg-transparent px-4 outline-none placeholder:text-ink-3"
              />
            )}
          </div>

          {mode === "signup" && <ConsentCheckbox checked={agreed} onChange={setAgreed} />}

          {error && <p role="alert" className="px-1 text-[15px] text-danger">{error}</p>}
          {info && <p role="status" className="px-1 text-[15px] text-accent-ink">{info}</p>}

          <button
            type="submit"
            disabled={busy || (mode === "signup" && !agreed)}
            className="press min-h-[54px] w-full rounded-[16px] bg-ink text-[17px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? t("One moment…") : mode === "signin" ? t("Sign in") : mode === "signup" ? t("Create account") : t("Send reset link")}
          </button>
        </form>

        <div className="flex items-center justify-between px-1 pt-1 text-[15px]">
          {mode === "signin" ? (
            <>
              <button type="button" className="text-accent" onClick={() => setMode("signup")}>
                {t("Create account")}
              </button>
              <button type="button" className="text-ink-2" onClick={() => setMode("reset")}>
                {t("Forgot password?")}
              </button>
            </>
          ) : (
            <button type="button" className="text-accent" onClick={() => setMode("signin")}>
              {t("I have an account")}
            </button>
          )}
        </div>
      </div>
      <nav aria-label="Legal" className="mt-auto flex justify-center gap-5 pt-10 text-[13px] text-ink-3">
        <a href={`/terms${lang === "he" ? "" : "?lang=en"}`}>{t("Terms")}</a>
        <a href={`/privacy${lang === "he" ? "" : "?lang=en"}`}>{t("Privacy")}</a>
        <a href={`/accessibility${lang === "he" ? "" : "?lang=en"}`}>{t("Accessibility")}</a>
      </nav>
    </main>
  );
}
