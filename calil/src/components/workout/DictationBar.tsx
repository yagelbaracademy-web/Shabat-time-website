"use client";

import { useEffect, useRef, useState } from "react";
import { applyInterpretation, dictate, interpret, type ApplyResult } from "@/lib/speech/apply";
import type { Interpretation } from "@/lib/speech/provider";
import { canRecord, startRecording, type Recording } from "@/lib/speech/provider";
import { haptic } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { PR_TITLE } from "@/lib/stats";
import { Icon } from "../icons";
import { Swipeable, toast } from "../ui";
import { track } from "@/lib/track";

type Mode = "idle" | "recording" | "transcribing" | "result";

/** What the bar can do, shown as gently rotating examples whenever the field is empty. */
const EXAMPLES = [
  "Bench press 80 kg 8 reps",
  "Third set 82.5 by 8, wide grip",
  "Note: seat on 4",
  "Add squat, 3 sets of 10",
  "Treadmill 20 minutes 3 km",
  "Paste a whole workout here",
];
/** Rotating example hint: soft fade, pauses while focused, static with reduced motion. */
function useRotatingHint(active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % EXAMPLES.length), 4000);
    return () => clearInterval(id);
  }, [active]);
  return EXAMPLES[i];
}

/**
 * Mic → speak → what was heard lands in the box, like a chat app. Fix a word if needed,
 * press Send, and the set is filled in. Typing the same sentence works the same way.
 */
export function DictationBar({ workoutId, focusWeId }: { workoutId: string; focusWeId: string | null }) {
  const resting = useStore((s) => !!s.rest);
  const t = useT();
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState("");
  // What the recording was understood as, kept until Send: unchanged text needs no second call.
  const [heard, setHeard] = useState<{ text: string; interp: Interpretation } | null>(null);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [micOk] = useState(() => canRecord());
  const [focused, setFocused] = useState(false);
  const learning = true; // examples stay: they're the only hint of everything the bar can do
  const example = useRotatingHint(learning && !focused && !draft && mode !== "recording" && mode !== "transcribing");
  const rec = useRef<Recording | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--dock", "76px");
    return () => {
      document.documentElement.style.removeProperty("--dock");
      rec.current?.cancel();
    };
  }, []);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setMode((m) => (m === "result" ? "idle" : m)), 7000);
  };

  const show = (r: ApplyResult) => {
    setResult(r);
    setMode("result");
    haptic(r.ok ? 14 : 30);
    if (r.pr) toast({ title: t(PR_TITLE[r.pr]), sub: r.summary.split("\n")[0], icon: "trophy", tone: "pr" }, 4500);
    scheduleHide();
  };

  const run = async (sentence: string) => {
    const t = sentence.trim();
    if (!t) {
      setMode("idle");
      return;
    }
    // Sending the recording as heard: apply what was already understood.
    if (heard && heard.text.trim() === t) {
      const interp = heard.interp;
      setHeard(null);
      track("dictate_voice_sent");
      show(applyInterpretation(interp, workoutId, focusWeId));
      return;
    }
    if (heard) track("dictate_voice_edited");
    setHeard(null);
    track(t.includes("\n") || t.length > 160 ? "paste_list" : "dictate_text");
    setMode("transcribing");
    show(await dictate({ text: t }, workoutId, focusWeId));
  };

  const finish = async () => {
    const r = rec.current;
    rec.current = null;
    if (!r) return setMode("idle");
    setMode("transcribing");
    const audio = await r.stop();
    if (!audio) return setMode("idle");
    track("dictate_voice");
    try {
      const interp = await interpret({ audio }, workoutId, focusWeId);
      const text = interp.transcript.trim();
      setMode("idle");
      if (!text) {
        toast({ title: t("Didn’t hear anything."), icon: "mic" });
        return;
      }
      // Into the box for a look; nothing is logged until Send.
      setHeard({ text, interp });
      setDraft(text);
      haptic(10);
    } catch (e) {
      console.error("[calil] dictation failed", e);
      track("dictate_failed");
      toast({ title: (e as Error).message, icon: "mic" });
      setMode("idle");
    }
  };

  const listen = async () => {
    if (!micOk) {
      toast({ title: t("Recording isn’t available here. Type the set instead."), icon: "mic" });
      return;
    }
    haptic(10);
    setResult(null);
    setMode("recording");
    setLevel(0);
    try {
      rec.current = await startRecording({
        onLevel: setLevel,
        onAutoStop: (reason) => {
          if (reason === "no-speech") {
            rec.current?.cancel();
            rec.current = null;
            setMode("idle");
            toast({ title: t("Didn’t hear anything."), icon: "mic" });
          } else void finish();
        },
      });
    } catch (e) {
      rec.current = null;
      setMode("idle");
      toast({ title: (e as Error).message, icon: "mic" }, 5000);
    }
  };

  const busy = mode === "recording" || mode === "transcribing";

  return (
    <div className="fixed inset-x-0 z-40 mx-auto max-w-[560px] px-4" style={{ bottom: "calc(var(--tabbar-h) + var(--sab) + 10px)" }}>
      {mode === "result" && result && (
        <Swipeable
          onDismiss={() => setMode("idle")}
          className="rise rounded-[24px] surface p-3 shadow-float"
          style={{ marginBottom: resting ? 84 : 8 }}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${result.ok ? "bg-accent text-white" : "bg-fill text-ink-2"}`}
            >
              <Icon name={result.ok ? "check" : "mic"} size={15} stroke={2.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`max-h-[30vh] overflow-y-auto text-[15px] whitespace-pre-line ${result.ok ? "font-semibold" : "text-ink-2"}`}>
                {result.summary}
              </p>
            </div>
            {result.undo && (
              <button
                type="button"
                onClick={() => {
                  result.undo?.();
                  setMode("idle");
                }}
                className="press shrink-0 rounded-full px-2.5 py-1.5 text-[15px] font-semibold text-accent"
              >
                {t("Undo")}
              </button>
            )}
          </div>
        </Swipeable>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const text = draft;
          setDraft("");
          void run(text);
        }}
        className="flex h-[60px] items-center gap-2 rounded-full border border-line bg-card pe-2 ps-2 shadow-float"
      >
        <button
          type="button"
          onClick={mode === "recording" ? () => void finish() : mode === "transcribing" ? undefined : () => void listen()}
          aria-label={mode === "recording" ? t("Stop recording") : t("Dictate a set")}
          className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            mode === "recording" ? "bg-accent text-white" : "bg-accent-soft text-accent"
          }`}
          style={mode === "recording" ? { boxShadow: `0 0 0 ${4 + level * 12}px rgba(28,116,234,0.18)` } : undefined}
        >
          {mode === "recording" ? (
            <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
          ) : mode === "transcribing" ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
          ) : (
            <Icon name="mic" size={21} stroke={2} />
          )}
        </button>

        {busy ? (
          <button
            type="button"
            onClick={mode === "recording" ? () => void finish() : undefined}
            className="min-w-0 flex-1 truncate text-start text-[16px] text-ink-2"
          >
            {mode === "recording" ? t("Listening… tap to stop") : t("Writing it down…")}
          </button>
        ) : (
          <span className="relative flex h-full min-w-0 flex-1 items-center">
            {/* Animated example sits over the empty field; the real placeholder takes over once focused. */}
            {learning && !draft && !focused && (
              <span
                key={example}
                aria-hidden
                className="hint-in pointer-events-none absolute inset-x-0 truncate text-start text-[16px] text-ink-3"
              >
                {t(example)}
              </span>
            )}
            <input
              value={draft}
              dir="auto"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setDraft(e.target.value);
                if (!e.target.value) setHeard(null);
              }}
              onPaste={(e) => {
                // A pasted list (notes, a coach's message) becomes the workout right away.
                // Read it from the clipboard because a one-line field would flatten the line breaks.
                const pasted = e.clipboardData.getData("text");
                if (pasted.includes("\n") || pasted.length > 160) {
                  e.preventDefault();
                  setDraft("");
                  void run(pasted);
                }
              }}
              placeholder={learning ? (focused ? t(example) : "") : t("Dictate or type a set…")}
              aria-label={t("Type a set, for example Bench press 80 kg 8 reps")}
              className="h-full w-full min-w-0 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
              enterKeyHint="send"
              autoComplete="off"
            />
          </span>
        )}

        {!busy && heard && draft && (
          <button
            type="button"
            aria-label={t("Clear")}
            onClick={() => {
              setDraft("");
              setHeard(null);
              track("dictate_voice_cleared");
            }}
            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3"
          >
            <Icon name="close" size={18} />
          </button>
        )}
        {!busy && draft.trim() && (
          <button
            type="submit"
            aria-label={t("Send")}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white"
          >
            <Icon name="send" size={19} />
          </button>
        )}
      </form>
    </div>
  );
}
