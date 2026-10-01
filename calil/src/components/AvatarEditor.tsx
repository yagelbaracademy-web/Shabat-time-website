"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { getState, saveProfile } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Icon } from "./icons";
import { Button, Sheet, toast } from "./ui";
import { track } from "@/lib/track";

const OUT = 512; // exported avatar size (px)
const MAX_ZOOM = 4;
const BUCKET = "avatars";

/** Path inside our bucket for a public avatar URL, or null if the photo lives elsewhere (e.g. Google). */
function ownPath(url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  return url && url.includes(marker) ? url.split(marker)[1].split("?")[0] : null;
}

/**
 * Pick a photo, then position and zoom it inside a circle (drag, pinch, wheel
 * or the slider), Facebook-style. Saves a 512×512 JPEG to storage.
 */
export function AvatarEditor({ file, onClose }: { file: File | null; onClose: () => void }) {
  const t = useT();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Load the picked file.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    im.onerror = () => {
      toast({ title: t("Couldn’t open that photo."), icon: "user" });
      onClose();
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    const fit = () => setSize(Math.min(320, window.innerWidth - 56));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Image size at zoom 1 so it just covers the circle.
  const base = img ? size / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const dispW = img ? img.naturalWidth * base * zoom : size;
  const dispH = img ? img.naturalHeight * base * zoom : size;

  /** Keep the photo covering the whole circle. */
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    if (!img) return p;
    const w = img.naturalWidth * base * z;
    const h = img.naturalHeight * base * z;
    const mx = Math.max(0, (w - size) / 2);
    const my = Math.max(0, (h - size) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };

  const setZoomClamped = (z: number) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(nz);
    setPos((p) => clamp(p, nz));
  };

  const onDown = (e: React.PointerEvent) => {
    box.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomClamped(gesture.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.current.dist));
    } else if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + cur.x - prev.x, y: p.y + cur.y - prev.y }));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  const save = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUT;
      const ctx = canvas.getContext("2d")!;
      const k = OUT / size;
      const left = size / 2 + pos.x - dispW / 2;
      const top = size / 2 + pos.y - dispH / 2;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, left * k, top * k, dispW * k, dispH * k);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
      if (!blob) throw new Error();

      const uid = getState().userId!;
      const path = `${uid}/${Date.now()}.jpg`;
      const sb = supabase();
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const old = ownPath(getState().profile?.avatar_url);
      saveProfile({ avatar_url: url });
      track("avatar_upload");
      if (old) void sb.storage.from(BUCKET).remove([old]);
      toast({ title: t("Photo updated"), icon: "check" });
      onClose();
    } catch {
      toast({ title: t("Couldn’t save the photo. Try again."), icon: "user" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!file} onClose={onClose} title={t("Move and scale")}>
      <div className="flex flex-col items-center pb-3">
        <div
          ref={box}
          className="relative cursor-grab touch-none overflow-hidden rounded-[24px] bg-ink select-none active:cursor-grabbing"
          style={{ width: size, height: size }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => setZoomClamped(zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06))}
          role="img"
          aria-label={t("Photo preview. Drag to move, pinch to zoom.")}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
              style={{
                width: img.naturalWidth * base,
                height: img.naturalHeight * base,
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${zoom})`,
              }}
            />
          )}
          {/* circular window: everything outside is dimmed */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(11,11,12,0.55)] ring-2 ring-white/90" />
        </div>

        <label className="mt-5 flex w-full max-w-[320px] items-center gap-3 text-ink-3">
          <Icon name="user" size={16} />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomClamped(Number(e.target.value))}
            aria-label={t("Zoom")}
            className="h-11 flex-1 accent-[var(--accent)]"
          />
          <Icon name="user" size={24} />
        </label>

        <Button className="mt-4 w-full" disabled={!img || busy} onClick={() => void save()}>
          {busy ? t("Saving…") : t("Save photo")}
        </Button>
      </div>
    </Sheet>
  );
}

/** Removes the user's uploaded photo (keeps nothing behind in storage). */
export async function removeAvatar() {
  const old = ownPath(getState().profile?.avatar_url);
  saveProfile({ avatar_url: null });
  if (old) await supabase().storage.from(BUCKET).remove([old]);
}
