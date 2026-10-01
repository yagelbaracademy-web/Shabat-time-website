"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { controlFrom, controlName, flush, log, scanSeen } from "@/lib/analytics";

/** Listens once for the whole app: screen views, taps on any control, and what was on screen. */
export function Analytics() {
  const path = usePathname();

  useEffect(() => {
    log(`view:${path.replace(/\/+$/, "") || "/"}`);
    const t = setTimeout(scanSeen, 1200);
    return () => clearTimeout(t);
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = controlFrom(e.target);
      if (!el) return;
      log(`tap:${controlName(el) ?? "(unnamed)"}`);
    };
    // Sheets and menus open without a route change: scan when something new shows up.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const mo = new MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        scanSeen();
      }, 900);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const onHide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      mo.disconnect();
      if (pending) clearTimeout(pending);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return null;
}
