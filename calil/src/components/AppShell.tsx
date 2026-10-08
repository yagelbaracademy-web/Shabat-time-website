"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { initStore, refresh, resetStore, saveProfile, useStore } from "@/lib/store";
import { activeWorkout, clockStartAt, liveSeconds } from "@/lib/stats";
import { fmtClock } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { getLang, setAddress, setExNames, setLang, useT } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import { ConsentGate } from "./Consent";
import { PullToRefresh } from "./PullToRefresh";
import { Analytics } from "./Analytics";
import { StepsPop } from "./StepsPop";
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

  // Back on screen after a while (or a new day): pull fresh data quietly.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 10 * 60_000 && navigator.onLine) void refresh().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

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
      <Suspense>
        <ActiveBar />
        <TabBar />
      </Suspense>
      <Toaster />
      <StepsPop />
    </ConsentGate>
  );
}

// Each tab looks one way in time: now, ahead, back, and the trend.
// A workout in progress isn't a tab: it's a mode you return to from the bar above.
const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Today", icon: "home", match: (p) => p === "/" },
  { href: "/plans", label: "Plans", icon: "list", match: (p) => p.startsWith("/plan") || p.startsWith("/import") },
  { href: "/history", label: "History", icon: "calendar", match: (p) => p.startsWith("/history") || p.startsWith("/workout") },
  { href: "/progress", label: "Progress", icon: "chart", match: (p) => p.startsWith("/progress") || p.startsWith("/exercise") },
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

/** The workout in progress, one tap away from any other screen. */
function ActiveBar() {
  const path = usePathname() ?? "/";
  const id = useSearchParams().get("id");
  const active = useStore(activeWorkout);
  const now = useNow(!!active);
  const tt = useT();
  const onIt = path.startsWith("/workout") && (!id || id === active?.id);
  const first = useStore((s) => (active ? clockStartAt(s, active.id) : null), [active?.id]);
  const secs = liveSeconds(first, now);
  const visible = !!active && !onIt;

  // Lifts the rest timer and page padding above this bar while it shows.
  useEffect(() => {
    if (!visible) return;
    document.documentElement.style.setProperty("--dock", "64px");
    return () => {
      document.documentElement.style.removeProperty("--dock");
    };
  }, [visible]);

  if (!visible || !active) return null;
  return (
    <div className="fixed inset-x-0 z-40 mx-auto max-w-[560px] px-4" style={{ bottom: "calc(var(--tabbar-h) + var(--sab) + 8px)" }}>
      <Link
        href={`/workout?id=${active.id}`}
        className="press rise flex h-[52px] items-center gap-3 rounded-full bg-ink ps-4 pe-2 text-bg shadow-float"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" dir="auto">
          {active.name}
        </span>
        {secs !== null && <span className="tnum text-[15px] text-bg/70">{fmtClock(secs)}</span>}
        <span className="flex h-9 items-center gap-1 rounded-full bg-bg/15 px-3 text-[14px] font-semibold">
          {tt("Back to workout")}
        </span>
      </Link>
    </div>
  );
}

function TabBar() {
  const path = usePathname() ?? "/";
  const viewing = useSearchParams().get("id");
  const active = useStore(activeWorkout);
  const tt = useT();

  return (
    <nav
      aria-label={tt("Main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: "var(--sab)" }}
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-[560px] items-stretch px-2">
        {TABS.map((t) => {
          // A live workout is its own mode: no tab lights up under it.
          const onLive = !!active && path.startsWith("/workout") && (!viewing || viewing === active.id);
          const on = !onLive && t.match(path);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`press flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-accent" : "text-ink-3"}`}
              >
                <span className="relative">
                  <Icon name={t.icon} size={24} stroke={on ? 2.1 : 1.8} />
                </span>
                <span>{tt(t.label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
