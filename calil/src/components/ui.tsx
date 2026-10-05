"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

/* ───────────────────────────── brand ───────────────────────────── */

const LOGO_BODY = (
  <>
    <path d="M420.5 608.5A152.5 139.5 0 1 0 420.5 812.5L374.3 767.2A82.5 79.5 0 1 1 374.3 653.8ZM365.0 631.1a32.4 32.4 0 1 0 64.7 0a32.4 32.4 0 1 0 -64.7 0ZM365.0 789.9a32.4 32.4 0 1 0 64.7 0a32.4 32.4 0 1 0 -64.7 0Z" />
    <path
      fillRule="evenodd"
      d="M443 710.5a152.5 139.5 0 1 0 305 0a152.5 139.5 0 1 0 -305 0ZM513 710.5a82.5 79.5 0 1 0 165 0a82.5 79.5 0 1 0 -165 0Z"
    />
    <path d="M678 711h69v103.5a34.5 34.5 0 0 1-69 0Z" />
    <rect x="776" y="481" width="78" height="369" rx="39" />
    <rect x="892.5" y="589" width="80" height="261" rx="40" />
    <circle cx="932.5" cy="524.5" r="42.5" />
    <rect x="1011" y="481" width="80" height="369" rx="40" />
  </>
);

export function Logo({
  height = 34,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="160 476 936 380"
      height={height}
      width={(height * 936) / 380}
      fill="currentColor"
      role="img"
      aria-label="Calil"
      className={className}
    >
      {LOGO_BODY}
    </svg>
  );
}

export function Avatar({ size = 44 }: { size?: number }) {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const initial = (profile?.name || profile?.email || "")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <Link
      href="/settings"
      aria-label={t("Profile and settings")}
      className="press inline-flex items-center justify-center overflow-hidden rounded-full bg-fill text-ink-2"
      style={{ width: size, height: size }}
    >
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : initial ? (
        <span className="text-[17px] font-semibold text-ink-2">{initial}</span>
      ) : (
        <Icon name="user" size={22} />
      )}
    </Link>
  );
}

/** Top bar with the wordmark and avatar, as in the mockups. */
export function BrandBar() {
  const t = useT();
  const pending = useStore((s) => s.pending);
  const online = useStore((s) => s.online);
  return (
    <>
      <CompactBar />
      <div className="flex items-center justify-between pt-3">
        <Logo height={36} />
        <div className="flex items-center gap-3">
          {!online && pending > 0 && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-[13px] text-ink-2"
              role="status"
            >
              <Icon name="wifiOff" size={15} /> {t("Saved on device")}
            </span>
          )}
          <Avatar />
        </div>
      </div>
    </>
  );
}

/** Once the big logo scrolls away, a slim bar keeps the logo and your photo in reach. */
function CompactBar() {
  const t = useT();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 56);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      inert={!shown}
      className="fixed inset-x-0 top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl"
      style={{
        paddingTop: "var(--sat)",
        transform: shown ? "none" : "translateY(-100%)",
        opacity: shown ? 1 : 0,
        transition: "transform 240ms var(--ease-out), opacity 200ms",
        pointerEvents: shown ? "auto" : "none",
      }}
    >
      <div className="mx-auto flex h-12 w-full max-w-[560px] items-center justify-between px-4 sm:px-6">
        <button
          type="button"
         
          aria-label={t("Back to top")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Logo height={22} />
        </button>
        <Avatar size={32} />
      </div>
    </div>
  );
}

/* ───────────────────────────── layout ───────────────────────────── */

export function Screen({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto w-full max-w-[560px] px-4 sm:px-6 ${className}`}
      style={{
        paddingTop: "calc(var(--sat) + 8px)",
        paddingBottom: "calc(var(--tabbar-h) + var(--sab) + 32px + var(--dock, 0px))",
      }}
    >
      {children}
    </main>
  );
}

export function Title({
  eyebrow,
  children,
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="mt-7 mb-6">
      {eyebrow && <p className="text-[17px] text-ink-2">{eyebrow}</p>}
      <h1 className="mt-0.5 text-[32px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance">
        {children}
      </h1>
    </header>
  );
}

export function Card({
  children,
  className = "",
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  const C = as;
  return (
    <C
      className={`rounded-[24px] border border-line bg-card shadow-card ${className}`}
    >
      {children}
    </C>
  );
}

export function CardHeader({
  title,
  sub,
  href,
  action,
}: {
  title: ReactNode;
  sub?: ReactNode;
  href?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[15px] text-ink-2">{sub}</p>}
      </div>
      {action}
      {href && (
        <Link
          href={href}
          aria-label={typeof title === "string" ? title : undefined}
          className="press -me-1 flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink-2"
        >
          <Icon name="chevronRight" size={18} />
        </Link>
      )}
    </div>
  );
}

/** `label` is the English name of the screen; it's translated here. */
export function BackLink({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  const t = useT();
  return (
    <Link
      href={href}
      className="press -ms-2 inline-flex h-11 items-center gap-0.5 rounded-full pe-3 ps-1 text-[17px] text-accent"
    >
      <Icon name="chevronLeft" size={24} /> {t(label)}
    </Link>
  );
}

/* ───────────────────────────── controls ───────────────────────────── */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btn: Record<BtnVariant, string> = {
  primary: "bg-accent text-white active:bg-accent-press",
  secondary: "bg-fill text-ink",
  ghost: "text-accent",
  danger: "bg-fill text-danger",
};

export function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  ...rest
}: {
  variant?: BtnVariant;
  icon?: IconName;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`press inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] px-5 text-[17px] font-semibold disabled:opacity-40 ${btn[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  size = 44,
  iconSize = 20,
  ...rest
}: {
  icon: IconName;
  label: string;
  size?: number;
  iconSize?: number;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`press inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = "",
  size = "md",
}: {
  options: readonly T[] | { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <div
      role="tablist"
      className={`inline-flex rounded-[14px] bg-fill p-1 ${className}`}
    >
      {opts.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[10px] font-medium transition-[background-color,color,box-shadow] duration-200 ${
              size === "sm"
                ? "min-h-[34px] px-3 text-[14px]"
                : "min-h-[38px] px-4 text-[15px]"
            } ${active ? "bg-card text-accent-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-ink-2"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-accent" : "bg-fill-2"}`}
    >
      <span
        className="absolute top-[2px] start-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-transform duration-250 ease-[var(--ease-out)]"
        style={{
          transform: checked ? "translateX(calc(20px * var(--dir)))" : "none",
        }}
      />
    </button>
  );
}

/* ───────────────────────────── sheet ───────────────────────────── */

/** Bottom sheet: slides up, dismisses on backdrop tap or Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  if (open && !mounted) setMounted(true); // mount synchronously on open
  const shown = open && entered;
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Pull down to close, like iOS sheets: from the handle or title any time,
  // from the content only when it's scrolled to the top.
  useEffect(() => {
    const el = panel.current;
    if (!mounted || !el) return;
    let start: { y: number; t: number } | null = null;
    let active = false;
    let dy = 0;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest("input, textarea, select, [data-no-sheet-drag]")) return;
      const inBody = body.current?.contains(e.target as Node);
      if (inBody && (body.current?.scrollTop ?? 0) > 0) return;
      start = { y: e.touches[0].clientY, t: performance.now() };
      active = false;
      dy = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const d = e.touches[0].clientY - start.y;
      if (!active) {
        if (d < 6) {
          if (d < -6) start = null; // scrolling up: leave it to the content
          return;
        }
        active = true;
        setDragging(true);
      }
      e.preventDefault();
      dy = Math.max(0, d);
      setDragY(dy);
    };
    const onEnd = () => {
      if (!start) return;
      const v = dy / Math.max(1, performance.now() - start.t);
      start = null;
      if (!active) return;
      active = false;
      setDragging(false);
      if (dy > el.offsetHeight * 0.25 || (v > 0.6 && dy > 40)) closeRef.current();
      else setDragY(0);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [mounted]);

  useEffect(() => {
    if (open) {
      const r = requestAnimationFrame(() =>
        requestAnimationFrame(() => setEntered(true)),
      );
      return () => cancelAnimationFrame(r);
    }
    const t = setTimeout(() => {
      setMounted(false);
      setEntered(false);
      setDragY(0);
    }, 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        className="absolute inset-0 bg-black/25 transition-opacity duration-300"
        style={{ opacity: shown ? Math.max(0.2, 1 - dragY / 500) : 0, transition: dragging ? "none" : undefined }}
        onClick={onClose}
      />
      <div
        ref={panel}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-[560px] flex-col rounded-t-[28px] bg-bg shadow-float ${full ? "h-[92dvh]" : "max-h-[88dvh]"}`}
        style={{
          transform: shown ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging ? "none" : "transform 380ms var(--ease-drawer)",
          paddingBottom: "calc(var(--sab) + 12px)",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-[5px] w-9 rounded-full bg-fill-2" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pt-1 pb-3">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            <IconButton
              icon="close"
              label={t("Close")}
              onClick={onClose}
              className="bg-fill text-ink-2"
              size={36}
              iconSize={18}
            />
          </div>
        )}
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/** A tappable row used inside sheets (action lists). */
export function SheetAction({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: IconName;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press flex min-h-[56px] w-full items-center gap-3.5 rounded-[16px] bg-card px-4 text-start text-[17px] ${danger ? "text-danger" : "text-ink"}`}
    >
      <Icon name={icon} size={21} className={danger ? "" : "text-ink-2"} />
      {children}
    </button>
  );
}

/* ───────────────────────────── swipe to dismiss ───────────────────────────── */

/**
 * Wrap a floating card so it can be flicked away sideways or down, like iOS
 * notifications. Taps on buttons/inputs inside keep working: a drag only
 * starts after the finger moves a few pixels.
 */
export function Swipeable({
  onDismiss,
  children,
  className = "",
  style,
}: {
  onDismiss: () => void;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    active: boolean;
  } | null>(null);
  const [offset, setOffset] = useState<{
    x: number;
    y: number;
    out: boolean;
    animate: boolean;
  }>({ x: 0, y: 0, out: false, animate: false });

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input,textarea")) return;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      active: false,
    };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.hypot(dx, dy) < 8) return;
      d.active = true;
      el.current?.setPointerCapture(e.pointerId);
    }
    // Free sideways and down; resist upward like a rubber band.
    setOffset({ x: dx, y: dy > 0 ? dy : dy * 0.2, out: false, animate: false });
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const dt = Math.max(1, performance.now() - d.t);
    const w = el.current?.offsetWidth ?? 300;
    const fast = Math.abs(dx) / dt > 0.5 || dy / dt > 0.5;
    if (Math.abs(dx) > w * 0.3 || dy > 50 || fast) {
      const sideways = Math.abs(dx) >= dy;
      setOffset({
        x: sideways ? Math.sign(dx || 1) * (w + 40) : dx,
        y: sideways ? dy : 160,
        out: true,
        animate: true,
      });
      setTimeout(onDismiss, 200);
    } else {
      setOffset({ x: 0, y: 0, out: false, animate: true });
    }
  };

  const dist = Math.max(Math.abs(offset.x), Math.max(0, offset.y));
  return (
    <div
      ref={el}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={className}
      style={{
        ...style,
        touchAction: "none",
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        opacity: offset.out ? 0 : Math.max(0.35, 1 - dist / 320),
        transition: offset.animate
          ? "transform 220ms var(--ease-out), opacity 220ms var(--ease-out)"
          : "none",
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────── toast ───────────────────────────── */

interface ToastItem {
  id: number;
  title: string;
  sub?: string;
  icon?: IconName;
  tone?: "default" | "pr";
  action?: { label: string; run: () => void };
}
let toasts: ToastItem[] = [];
const toastListeners = new Set<() => void>();
let toastSeq = 0;

export function toast(t: Omit<ToastItem, "id">, ms = 3800) {
  const item = { ...t, id: ++toastSeq };
  toasts = [...toasts.slice(-1), item];
  toastListeners.forEach((l) => l());
  setTimeout(() => dismissToast(item.id), ms);
}
function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  toastListeners.forEach((l) => l());
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  const resting = useStore((s) => !!s.rest);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-[560px] flex-col items-center gap-2 px-4"
      style={{
        bottom: `calc(var(--tabbar-h) + var(--sab) + 16px + var(--dock, 0px) + ${resting ? 72 : 0}px)`,
      }}
      aria-live="polite"
    >
      {list.map((t) => (
        <Swipeable
          key={t.id}
          onDismiss={() => dismissToast(t.id)}
          className="rise pointer-events-auto flex w-full items-center gap-3 rounded-[18px] bg-ink px-4 py-3 text-white shadow-float"
        >
          {t.icon && (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.tone === "pr" ? "bg-[#f5b400] text-ink" : "bg-white/12"}`}
            >
              <Icon name={t.icon} size={19} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{t.title}</p>
            {t.sub && (
              <p className="truncate text-[14px] text-white/70">{t.sub}</p>
            )}
          </div>
          {t.action && (
            <button
              type="button"
              className="press shrink-0 rounded-full px-3 py-2 text-[15px] font-semibold text-[#7db4ff]"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </Swipeable>
      ))}
    </div>
  );
}

/* ───────────────────────────── misc ───────────────────────────── */

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <p className="tnum truncate text-[22px] font-semibold tracking-[-0.01em]">
        {value}
      </p>
      <p className="truncate text-[14px] text-ink-2">{label}</p>
    </div>
  );
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-ink-2">
        <Icon name={icon} size={26} />
      </span>
      <p className="text-[17px] font-semibold">{title}</p>
      {children && (
        <div className="mt-1 text-[15px] text-ink-2">{children}</div>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[24px] bg-fill ${className}`} />
  );
}
