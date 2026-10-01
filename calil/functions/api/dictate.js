import { getUser, json, markFailed, takeQuota } from "../../server/auth.js";

// POST /api/dictate  (Cloudflare Pages Function)
// Turns a spoken (audio) or typed sentence into structured workout operations.
// Body: { audio?: base64, mime?: string, text?: string, context: { library: string[], workout: [...], unit } }
// Auth: the user's Supabase access token.
// Returns: { transcript, operations: [{ exercise, is_new_exercise, muscle_group, mode, sets, note }] }
//
// Only this file knows about the model; swap `callModel` to change provider.

const MAX_AUDIO_B64 = 4 * 1024 * 1024;
// Short sentences: the fast model. Pasted lists: flash with minimal thinking, which
// was tested to keep every set of a long list (flash-lite drops sets on long input).
const SHORT = [
  { model: "gemini-3.5-flash-lite", thinking: null, timeout: 9000 },
  { model: "gemini-2.5-flash", thinking: null, timeout: 9000 },
];
const LONG = [
  { model: "gemini-3.5-flash", thinking: { thinkingLevel: "minimal" }, timeout: 30000 },
  { model: "gemini-2.5-flash", thinking: null, timeout: 30000 },
];
const MAX_TEXT = 4000;
const isList = (text) => text.length > 160 || (text.match(/\n/g) ?? []).length >= 3;

/** A positive number from the model's string, or null. */
const num = (v, max) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
};

const RULES = `You turn a short spoken or typed gym log into operations for a workout-logging app.
The user may speak Hebrew or English, often mixed.
Modes:
- "log": the user reports set(s) they just performed ("bench 80 kilos 8 reps", "third set 82.5 by 8", "עשיתי 100 קילו 6 חזרות"). Each item in sets is one performed set.
- "plan": the user asks to add/open/prepare an exercise or sets to do ("add incline dumbbell, 4 sets of 8 at 38", "תפתח תרגיל ..."). Expand "N sets of R" into N items.
- "note": only a remark (pain, form, feeling) without numbers.
A remark said together with numbers goes into "note" of that same operation. Never put commands or set numbers in note.
Text introduced as a note ("note:", "הערה:") is mode "note" even if it contains numbers, e.g. "הערה: המושב בגובה 4" (setup detail, not reps). Keep notes in the user's language.
Match exercise names to the library even when said in Hebrew, transliterated or in another word order
("דמבלס אינקליין" = "Incline Dumbbell Press", "לחיצת חזה" = "Bench Press", "פולי עליון" = "Lat Pulldown").
Use the exact library spelling. Set is_new_exercise=true only when no library exercise is the same movement; then give a clean English Title Case name and a muscle group.
If no exercise is mentioned, use "" for exercise (the focused one).
A LIST of several exercises (typically pasted from notes or a coach's message) is the workout the user is ABOUT TO DO now:
use mode "plan" for every exercise, even if lines have checkmarks like "- [x]" or are written in past tense. One item per set,
with that set's weight and reps as the planned values; when a set line only has reps, it uses the previous set's weight, so
write that weight explicitly. Remarks about a specific set or exercise go in that exercise's note.
Only a short report of what was just performed ("bench 80 kilos 8 reps") is "log".
Cardio (running, treadmill, walking, bike, elliptical, rowing, stairs, jump rope; "ריצה", "הליכון", "אופניים") is logged with minutes and distance (km, or miles if said) instead of weight and reps; one item per bout, weight empty, reps null. "20 דקות" = minutes "20", "חצי שעה" = "30", "3 ק״מ" = distance "3". Use the library's cardio names (Treadmill, Running, Stationary Bike…).
Warm-up sets ("warm-up", "סט חימום", "חימום", "empty bar"/"מוט ריק" before working sets) get warmup=true; an empty Olympic bar is 20 kg.
set_number only when the user says which set. weight is a plain decimal string like "82.5" (no units), or "" when not said.`;

const SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          exercise: { type: "string" },
          is_new_exercise: { type: "boolean" },
          muscle_group: { type: "string", nullable: true },
          mode: { type: "string", enum: ["log", "plan", "note"] },
          sets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                set_number: { type: "integer", nullable: true },
                weight: { type: "string" },
                reps: { type: "integer", nullable: true },
                warmup: { type: "boolean" },
                minutes: { type: "string" },
                distance: { type: "string" },
              },
            },
          },
          note: { type: "string", nullable: true },
        },
        required: ["exercise", "is_new_exercise", "mode", "sets"],
      },
    },
  },
  required: ["transcript", "operations"],
};

function clean(out) {
  const ops = Array.isArray(out?.operations) ? out.operations : [];
  return {
    transcript: String(out?.transcript ?? "").trim(),
    operations: ops.slice(0, 30).map((o) => ({
      exercise: String(o.exercise ?? "").trim(),
      is_new_exercise: !!o.is_new_exercise,
      muscle_group: o.muscle_group ?? null,
      mode: ["log", "plan", "note"].includes(o.mode) ? o.mode : "log",
      sets: (Array.isArray(o.sets) ? o.sets : []).slice(0, 20).map((s) => {
        const w = parseFloat(String(s.weight ?? "").replace(",", "."));
        const reps = Number.isInteger(s.reps) && s.reps >= 0 && s.reps < 1000 ? s.reps : null;
        return {
          set_number: Number.isInteger(s.set_number) && s.set_number > 0 && s.set_number < 50 ? s.set_number : null,
          weight: Number.isFinite(w) && w >= 0 && w < 10000 ? Math.round(w * 100) / 100 : null,
          reps,
          warmup: s.warmup === true,
          minutes: num(s.minutes, 1440),
          distance: num(s.distance, 1000),
        };
      }),
      note: o.note ? String(o.note).trim().slice(0, 500) || null : null,
    })),
  };
}

async function callModel({ model, thinking, timeout }, parts, env) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: RULES }] },
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8000,
          ...(thinking ? { thinkingConfig: thinking } : {}),
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    });
    if (!r.ok) throw new Error(`${model} ${r.status}`);
    const d = await r.json();
    const text = (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return clean(JSON.parse(text)); // throws on truncated / malformed output → next model
  } finally {
    clearTimeout(t);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const { audio, mime, text, context } = body ?? {};
  if (!audio && !text) return json({ error: "nothing to parse" }, 400);
  if (audio && audio.length > MAX_AUDIO_B64) return json({ error: "recording too long" }, 413);

  const ctx =
    `Library: ${JSON.stringify((context?.library ?? []).slice(0, 400))}\n` +
    `User's own names (said → library name): ${JSON.stringify(context?.aliases ?? {}).slice(0, 3000)}\n` +
    `Weight unit: ${context?.unit === "lb" ? "lb" : "kg"}\n` +
    `Current workout: ${JSON.stringify(context?.workout ?? []).slice(0, 6000)}\n` +
    `Put the exact words of the input in "transcript" (numbers as digits), then produce operations.`;
  const parts = audio
    ? [{ text: ctx + "\nInput (audio):" }, { inline_data: { mime_type: String(mime || "audio/mp4").split(";")[0], data: audio } }]
    : [{ text: `${ctx}\nInput (typed): ${String(text).slice(0, MAX_TEXT)}` }];

  if (!(await takeQuota(user, "dictate", env))) return json({ error: "limit", message: "You've reached today's dictation limit. Typing in the table still works." }, 429);

  let lastError = "";
  const models = text && isList(String(text)) ? LONG : SHORT;
  for (const m of models) {
    try {
      return json(await callModel(m, parts, env));
    } catch (e) {
      lastError = String(e?.message ?? e);
    }
  }
  await markFailed(user, "dictate", env);
  return json({ error: "could not understand", detail: lastError }, 502);
}
