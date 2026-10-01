"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The client exchanges the ?code= from the email link for a recovery session.
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data } = sb.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY" || s) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6" style={{ paddingTop: "calc(var(--sat) + 12vh)" }}>
      <Logo height={44} />
      <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.02em]">{t("Choose a new password")}</h1>
      {ready === false ? (
        <p className="mt-4 text-[17px] text-ink-2">
          {t("This link has expired or was already used.")}{" "}
          <Link href="/login" className="text-accent">
            {t("Request a new one")}
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-3">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("New password (8+ characters)")}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-[54px] w-full rounded-[16px] border border-line bg-card px-4 shadow-card outline-none placeholder:text-ink-3"
          />
          {error && <p className="px-1 text-[15px] text-danger">{error}</p>}
          <button type="submit" disabled={busy || !ready} className="press min-h-[54px] w-full rounded-[16px] bg-ink text-[17px] font-semibold text-white disabled:opacity-50">
            {busy ? t("Saving…") : t("Save password")}
          </button>
        </form>
      )}
    </main>
  );
}
