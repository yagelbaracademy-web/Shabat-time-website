"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { initStore, resetStore, saveProfile, useStore } from "@/lib/store";
import { activeWorkout } from "@/lib/stats";
import { fmtClock } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { getLang, setAddress, setExNames, setLang, useT } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import { ConsentGate } from "./Consent";
import { PullToRefresh } from "./PullToRefresh";
import { Analytics } from "./Analytics";
import { Logo, Toaster } from "./ui";
import { RestPill } from "./workout/RestTimer";

/** Client-side auth gate + data bootstrap for every signed-in screen. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    const sb = supabase();
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user;
      if (!u) {
        setStatus("out");
        router.replace("/login");
        return;
      }
      setStatus("in");
      void initStore(u.id, u.email ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        resetStore();
        router.replace("/login");
      } else if (session?.user && event === "SIGNED_IN") {
        setStatus("in");
        void initStore(session.user.id, session.user.email ?? null);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (status !== "in") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Logo height={40} className="animate-pulse text-ink/80" />
      </div>
    );
  }

  return (
    <ConsentGate>
      {children}
      <LanguageSync />
      <AddressSync />
      <PullToRefresh />
      <Analytics />
      <RestPill />
      <Toaster />
      <TabBar />
    </ConsentGate>
  );
}

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
  { href: "/workout", label: "Workout", icon: "bolt", match: (p) => p.startsWith("/workout") },
  { href: "/progress", label: "Progress", icon: "chart", match: (p) => p.startsWith("/progress") || p.startsWith("/exercise") },
  { href: "/plans", label: "Plans", icon: "list", match: (p) => p.startsWith("/plan") || p.startsWith("/history") },
];

/** Follows the language saved on the account, e.g. chosen on another device. */
function LanguageSync() {
  const saved = useStore((s) => s.profile?.language);
  useEffect(() => {
    if (saved !== "he" && saved !== "en") return;
    // A Hebrew choice made before signing in (login screen) beats the account's default English.
    if (saved === "en" && getLang() === "he") saveProfile({ language: "he" });
    else setLang(saved);
  }, [saved]);
  return null;
}

function AddressSync() {
  const saved = useStore((s) => s.profile?.address);
  const names = useStore((s) => s.profile?.exercise_names);
  useEffect(() => {
    if (saved === "m" || saved === "f" || saved === "neutral") setAddress(saved);
  }, [saved]);
  useEffect(() => {
    if (names === "en" || names === "he") setExNames(names);
  }, [names]);
  return null;
}

function TabBar() {
  const path = usePathname() ?? "/";
  const active = useStore(activeWorkout);
  const tt = useT();
  const now = useNow(!!active);

  return (
    <nav
      aria-label={tt("Main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: "var(--sab)" }}
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-[560px] items-stretch px-2">
        {TABS.map((t) => {
          const on = t.match(path);
          const live = t.href === "/workout" && active;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={live ? `/workout?id=${active.id}` : t.href}
                aria-current={on ? "page" : undefined}
                className={`press flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-accent" : "text-ink-3"}`}
              >
                <span className="relative">
                  <Icon name={t.icon} size={24} stroke={on ? 2.1 : 1.8} />
                  {live && <span className="absolute -top-0.5 -end-1 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" />}
                </span>
                <span className="tnum">
                  {live ? fmtClock((now - new Date(active.started_at).getTime()) / 1000) : tt(t.label)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
