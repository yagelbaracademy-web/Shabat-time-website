import { supabase } from "../supabase";
import { tr } from "../i18n";

/**
 * Dictation = record a short clip on the device, then send it to the server,
 * which transcribes it and turns it into structured operations in one step.
 * Recording is plain MediaRecorder (same on iPhone, Android and desktop); the
 * model sits behind `Interpreter`, so it can change without touching the UI.
 */

export interface DictationSet {
  set_number: number | null;
  weight: number | null;
  reps: number | null;
  warmup?: boolean;
  /** Cardio bout: minutes and distance instead of weight × reps. */
  minutes?: number | null;
  distance?: number | null;
}

/** One thing the user asked for, e.g. "log 80×8 on bench" or "add incline, 4×8 @ 38". */
export interface DictationOp {
  exercise: string; // library name, a new name, or "" for the focused exercise
  is_new_exercise: boolean;
  muscle_group: string | null;
  mode: "log" | "plan" | "note";
  sets: DictationSet[];
  note: string | null;
}

export interface Interpretation {
  transcript: string;
  operations: DictationOp[];
}

export interface DictationContext {
  library: string[];
  /** "what the user says" → library name */
  aliases: Record<string, string>;
  unit: "kg" | "lb";
  workout: { exercise: string; focused: boolean; sets: { n: number; weight: number | null; reps: number | null; done: boolean }[] }[];
}

export interface Interpreter {
  interpret(input: { audio: Blob } | { text: string }, context: DictationContext): Promise<Interpretation>;
}

async function toBase64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Speech + understanding in one round trip to /api/dictate (Gemini today). */
export const serverInterpreter: Interpreter = {
  async interpret(input, context) {
    const { data } = await supabase().auth.getSession();
    const body =
      "audio" in input
        ? { audio: await toBase64(input.audio), mime: input.audio.type || "audio/mp4", context }
        : { text: input.text, context };
    const ctl = new AbortController();
    // Pasted lists go through a slower, more careful model on the server.
    const timer = setTimeout(() => ctl.abort(), "text" in input && input.text.length > 160 ? 45000 : 20000);
    try {
      const r = await fetch("/api/dictate", {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify(body),
      });
      if (r.status === 401) throw new Error(tr("Please sign in again."));
      if (r.status === 429) throw new Error(tr("You’ve reached today’s dictation limit. Typing in the table still works."));
      if (!r.ok) throw new Error(tr("Couldn’t understand that. Try again."));
      return (await r.json()) as Interpretation;
    } finally {
      clearTimeout(timer);
    }
  },
};

export const interpreter: Interpreter = serverInterpreter;

/* ───────────────────────────── recording ───────────────────────────── */

export interface Recording {
  /** Stop and get the audio (null if nothing was recorded). */
  stop(): Promise<Blob | null>;
  /** Stop and throw the audio away. */
  cancel(): void;
}

export interface RecordOptions {
  /** Called when the recorder decides on its own that you're done talking. */
  onAutoStop: (reason: "silence" | "no-speech" | "max") => void;
  /** 0..1 input level, for a little live meter. */
  onLevel?: (level: number) => void;
  maxMs?: number;
}

export function canRecord() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function pickMime() {
  for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

const MIC_ERRORS: Record<string, string> = {
  NotAllowedError: "Microphone access is blocked. Allow it in Settings › Safari › Microphone.",
  NotFoundError: "No microphone found.",
  NotReadableError: "The microphone is busy in another app.",
};

/**
 * Starts recording. Stops by itself after ~1.2s of silence once you've spoken,
 * after 6s if you never speak, or at `maxMs`.
 */
export async function startRecording({ onAutoStop, onLevel, maxMs = 15000 }: RecordOptions): Promise<Recording> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    throw new Error(tr(MIC_ERRORS[(e as DOMException).name] ?? "Couldn’t start the microphone."));
  }

  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  // Silence detection on the same stream.
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const started = performance.now();
  let spoke = false;
  let lastLoud = started;
  // Learn the room's noise floor in the first moments, so a loud gym doesn't count as speech.
  let floor = 0;
  let floorSamples = 0;
  let stopped = false;
  let raf = 0;

  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    onLevel?.(Math.min(1, rms * 8));
    const now = performance.now();
    if (now - started < 300) {
      floor = (floor * floorSamples + rms) / ++floorSamples;
    } else if (rms > Math.max(0.02, floor * 2.5)) {
      spoke = true;
      lastLoud = now;
    }
    const reason =
      spoke && now - lastLoud > 1200 ? "silence" : !spoke && now - started > 6000 ? "no-speech" : now - started > maxMs ? "max" : null;
    if (reason) {
      onAutoStop(reason);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  rec.start(250);
  raf = requestAnimationFrame(tick);

  const release = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  return {
    stop: () =>
      new Promise((resolve) => {
        if (stopped) return resolve(null);
        rec.onstop = () => {
          release();
          resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || mime || "audio/mp4" }) : null);
        };
        try {
          rec.stop();
        } catch {
          release();
          resolve(null);
        }
      }),
    cancel: () => {
      try {
        rec.stop();
      } catch {}
      release();
    },
  };
}
