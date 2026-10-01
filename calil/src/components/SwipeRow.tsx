"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import { Button, Sheet } from "./ui";
import { track } from "@/lib/track";

const ACTION_W = 88; // width of a revealed action button
const OPEN_EVENT = "calil:swipe-open";

/**
 * iOS-style swipe-to-delete. Swipe left to reveal a red Delete that follows the
 * finger; release partway and it stays open (tap to delete), or swipe all the
 * way to delete right away. With `confirm`, a sheet asks first.
 * Optional `primary`: the same from the other side (swipe right), in blue, e.g. Start.
 * Vertical scrolling stays native; taps on the row's content still work.
 */
export function SwipeRow({
  children,
  onDelete,
  confirm,
  primary,
  radius = 22,
  className = "",
}: {
  children: ReactNode;
  onDelete: () => void;
  confirm?: { title: string; message: string; action?: string };
  /** Leading action revealed by swiping the other way (no confirmation). */
  primary?: { label: string; icon: IconName; onAction: () => void };
  radius?: number;
  className?: string;
}) {
  const id = useId();
  const row = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null; pid: number } | null>(null);
  const moved = useRef(false);
  const [x, setX] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [asking, setAsking] = useState(false);
  const [rowW, setRowW] = useState(360); // measured when a drag starts
  // x is kept in "logical" units (negative = revealing Delete); flipped on screen when the
  // row itself is right-to-left (measured, since some rows stay LTR inside a Hebrew page).
  const [sign, setSign] = useState(1);
  const signRef = useRef(1); // read by the move handlers before the re-render lands
  const t = useT();

  // Only one row open at a time; any other row opening closes this one.
  useEffect(() => {
    const close = (e: Event) => {
      if ((e as CustomEvent).detail !== id) {
        setAnimate(true);
        setX(0);
      }
    };
    window.addEventListener(OPEN_EVENT, close);
    return () => window.removeEventListener(OPEN_EVENT, close);
  }, [id]);

  const width = () => row.current?.offsetWidth ?? 360;

  const settle = (to: number) => {
    setAnimate(true);
    setX(to);
  };

  const commit = () => {
    if (confirm) {
      settle(-ACTION_W);
      setAsking(true);
      return;
    }
    haptic(15);
    track("swipe_delete");
    setAnimate(true);
    setX(-width());
    setTimeout(onDelete, 200);
  };

  const runPrimary = () => {
    if (!primary) return;
    haptic(15);
    track("swipe_start");
    settle(0);
    primary.onAction();
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, base: x, axis: null, pid: e.pointerId };
    setRowW(width());
    if (row.current) {
      signRef.current = getComputedStyle(row.current).direction === "rtl" ? -1 : 1;
      setSign(signRef.current);
    }
    moved.current = false;
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    const dx = (e.clientX - d.x) * signRef.current;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        row.current?.setPointerCapture(e.pointerId);
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
      }
    }
    if (d.axis !== "x") return;
    moved.current = true;
    let next = d.base + dx;
    if (next > 0 && !primary) next = next * 0.2; // nothing on that side: resist
    setAnimate(false);
    setX(next);
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== "x") return;
    const dx = (e.clientX - d.x) * signRef.current;
    const end = d.base + dx;
    if (end < -width() * 0.55) commit();
    else if (end < -ACTION_W / 2) {
      settle(-ACTION_W);
      haptic(8);
    } else if (primary && end > width() * 0.55) runPrimary();
    else if (primary && end > ACTION_W / 2) {
      settle(ACTION_W);
      haptic(8);
    } else settle(0);
  };

  const full = -x > rowW * 0.55; // past the point of no return: the button grows
  const fullPrimary = x > rowW * 0.55;
  const open = x !== 0;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ borderRadius: radius }}>
      {/* the leading action (other side), e.g. Start */}
      {primary && (
        <div
          className="absolute inset-y-0 start-0 flex"
          style={{ width: Math.max(ACTION_W, x), opacity: x > 4 ? 1 : 0 }}
          aria-hidden={!open}
        >
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={runPrimary}
            className="flex h-full items-center justify-center bg-accent text-white"
            style={{
              width: fullPrimary ? "100%" : Math.max(ACTION_W, x),
              transition: animate ? "width 220ms var(--ease-out)" : "none",
              borderRadius: radius,
            }}
          >
            <span className="flex flex-col items-center gap-0.5 text-[13px] font-semibold">
              <Icon name={primary.icon} size={20} />
              {primary.label}
            </span>
          </button>
        </div>
      )}

      {/* the revealed action */}
      <div
        className="absolute inset-y-0 end-0 flex justify-end"
        style={{ width: Math.max(ACTION_W, -x), opacity: x < -4 ? 1 : 0 }}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={commit}
          className="flex h-full items-center justify-center bg-danger text-white"
          style={{
            width: full ? "100%" : Math.max(ACTION_W, -x),
            transition: animate ? "width 220ms var(--ease-out)" : "none",
            borderRadius: radius,
          }}
        >
          <span className="flex flex-col items-center gap-0.5 text-[13px] font-semibold">
            <Icon name="trash" size={20} />
            {t("Delete")}
          </span>
        </button>
      </div>

      {/* the row itself */}
      <div
        ref={row}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDragStart={(e) => e.preventDefault()} // links are draggable; that would cancel the swipe
        onClickCapture={(e) => {
          // A swipe isn't a tap; and tapping an open row just closes it.
          if (moved.current) {
            // The click that ends a swipe: swallow it, keep the row where the swipe left it.
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          } else if (open && !asking) {
            // Tapping an open row closes it instead of opening the item.
            e.preventDefault();
            e.stopPropagation();
            settle(0);
          }
        }}
        className="relative"
        style={{
          touchAction: "pan-y",
          WebkitTouchCallout: "none",
          transform: `translate3d(${x * sign}px,0,0)`,
          transition: animate ? "transform 260ms var(--ease-out)" : "none",
        }}
      >
        {children}
      </div>

      {confirm && (
        <Sheet
          open={asking}
          onClose={() => {
            setAsking(false);
            settle(0);
          }}
          title={confirm.title}
        >
          <div className="pb-3">
            <p className="mb-4 px-1 text-[16px] text-ink-2">{confirm.message}</p>
            <Button
              variant="danger"
              className="w-full bg-danger! text-white!"
              onClick={() => {
                setAsking(false);
                haptic(20);
                track("swipe_delete");
                setAnimate(true);
                setX(-width());
                setTimeout(onDelete, 200);
              }}
            >
              {confirm.action ?? t("Delete")}
            </Button>
            <Button
              variant="ghost"
              className="mt-1 w-full"
              onClick={() => {
                setAsking(false);
                settle(0);
              }}
            >
              {t("Cancel")}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
