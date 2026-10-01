import { getUser, json, markFailed, takeQuota } from "../../server/auth.js";

// POST /api/import  (Cloudflare Pages Function)
// Reads a training program or a logged workout (pasted text, spreadsheet text, or a photo)
// and returns structured workouts for the import preview. Nothing is saved here.
// Body: { text?: string, image?: base64, mime?: string, library: [{ name, aliases }] }
// Auth: the user's Supabase access token.

// flash-lite was tested and drops sets on real notes (0/8 complete); flash with minimal thinking was 8/8 in ~5s.
const MODELS = [
  { model: "gemini-3.5-flash", thinking: { thinkingLevel: "minimal" } },
  { model: "gemini-3.5-flash", thinking: { thinkingLevel: "low" } },
  { model: "gemini-2.5-flash", thinking: null },
];
const TIMEOUT_MS = 40000;
const MAX_TEXT = 60000;
const MAX_IMAGE_B64 = 8 * 1024 * 1024;

const RULES = `You read gym training material and turn it into structured workouts for a workout-logging app.
Input may be Hebrew, English or mixed: a coach's program (often a spreadsheet dump, rows as "a | b | c"), a photo of one, or the user's own notes of a workout they already did.

Decide "kind":
- "plan": a program to follow (targets: sets, rep ranges, rest, RPE, instructions). Usually several workouts (e.g. "Upper #1", "Lower #1"), sometimes several blocks (sheets).
- "log": a workout already performed (actual weights and reps, checkmarks like "- [x]", past tense).

For every workout: name (keep the source's name, e.g. "Upper #1"; for a log without a name invent a short one from the muscles, e.g. "Back & Biceps"), block (sheet / block title or ""), date ("YYYY-MM-DD" only if written, else "").

For every exercise, in order:
- original_name: exactly as written in the source.
- library_name: the exact name from the user's library if it is the same movement (match across languages, slang and the user's aliases), else "".
- suggested_name: when library_name is "", the standard English gym name of that movement, Title Case, specific but short (e.g. "Iso-Lateral Row" for "חתירה מכונה צהובה", "Bent-Over Barbell Row" for "בנט אובר מוט מהרצפה"). When library_name is set, repeat it.
- muscle_group: one of Chest, Back, Shoulders, Biceps, Triceps, Legs, Glutes, Calves, Core, Full body.
- equipment: barbell, dumbbell, cable, machine, bodyweight, kettlebell or other.
- is_warmup: true for warm-up / mobility / activation items (often under a "חימום"/"warm-up" heading).
- target_sets, rep_min, rep_max: integers or null. "8-10" → 8 and 10; "12" → 12 and 12. Reps in seconds/breaths/"by effort" → null (put the text in note).
- rest_seconds: rest in seconds (lower bound of a range), or null.
- note: short and useful only: tempo/execution cues, RPE ("RPE 9-10"), set type (TOP SET / BACK OFF / AMRAP / drop set), setup, "each side". Keep the source language. null when there is nothing meaningful. Never repeat sets/reps/rest in the note.
- performed (logs only, else []): one item per set actually done. weight as a plain decimal string ("28.75"), "" if none. When a set line has reps but no weight, it uses the previous set's weight: write that weight explicitly. "כל צד"/"per side" goes in the set note. reps integer. note: anything else written on that set line (e.g. "דרופ גוף 5 חז", "הגילתי שהאגודל..."), else "".
  For logs, target_sets = number of performed sets, rep_min/rep_max = min/max performed reps.

Hebrew abbreviations: קג/ק"ג = kg, חז = reps, סט = set, יד יד = one arm at a time.
Skip cardio/aerobic instructions that are not exercises with sets (mention nothing for them).
If the input is not a program or a performed workout (e.g. an exercise catalogue with video links, body-weight or measurement tracking, a blank weekly log grid), return kind "plan" with an empty workouts array. Do not invent workouts.`;

const ex = {
  type: "object",
  properties: {
    original_name: { type: "string" },
    library_name: { type: "string" },
    suggested_name: { type: "string" },
    muscle_group: { type: "string" },
    equipment: { type: "string", enum: ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell", "other"] },
    is_warmup: { type: "boolean" },
    target_sets: { type: "integer", nullable: true },
    rep_min: { type: "integer", nullable: true },
    rep_max: { type: "integer", nullable: true },
    rest_seconds: { type: "integer", nullable: true },
    note: { type: "string", nullable: true },
    performed: {
      type: "array",
      items: {
        type: "object",
        properties: { weight: { type: "string" }, reps: { type: "integer", nullable: true }, note: { type: "string" } },
      },
    },
  },
  required: ["original_name", "library_name", "suggested_name", "is_warmup", "performed"],
};
const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["plan", "log"] },
    workouts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          block: { type: "string" },
          date: { type: "string" },
          exercises: { type: "array", items: ex },
        },
        required: ["name", "exercises"],
      },
    },
  },
  required: ["kind", "workouts"],
};

const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const str = (v, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function clean(out) {
  const workouts = (Array.isArray(out?.workouts) ? out.workouts : []).slice(0, 20).map((w) => ({
    name: str(w.name, 80) ?? "Workout",
    block: str(w.block, 80) ?? "",
    date: /^\d{4}-\d{2}-\d{2}$/.test(w.date ?? "") ? w.date : "",
    exercises: (Array.isArray(w.exercises) ? w.exercises : []).slice(0, 40).map((e) => {
      let repMin = int(e.rep_min, 0, 200);
      let repMax = int(e.rep_max, 0, 200);
      if (repMin !== null && repMax !== null && repMin > repMax) [repMin, repMax] = [repMax, repMin];
      return {
        original_name: str(e.original_name, 120) ?? "",
        library_name: str(e.library_name, 120) ?? "",
        suggested_name: str(e.suggested_name, 80) ?? str(e.original_name, 80) ?? "Exercise",
        muscle_group: str(e.muscle_group, 30),
        equipment: e.equipment ?? null,
        is_warmup: !!e.is_warmup,
        target_sets: int(e.target_sets, 1, 20),
        rep_min: repMin,
        rep_max: repMax ?? repMin,
        rest_seconds: int(e.rest_seconds, 0, 900),
        note: str(e.note, 400),
        performed: (Array.isArray(e.performed) ? e.performed : []).slice(0, 20).map((p) => {
          const w = parseFloat(String(p.weight ?? "").replace(",", "."));
          return {
            weight: Number.isFinite(w) && w >= 0 && w < 10000 ? Math.round(w * 100) / 100 : null,
            reps: int(p.reps, 0, 999),
            note: str(p.note, 300),
          };
        }),
      };
    }),
  }));
  return { kind: out?.kind === "log" ? "log" : "plan", workouts: workouts.filter((w) => w.exercises.length) };
}

async function callModel({ model, thinking }, parts, env) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
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
          maxOutputTokens: 32000,
          ...(thinking ? { thinkingConfig: thinking } : {}),
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    });
    if (!r.ok) throw new Error(`${model} ${r.status}`);
    const d = await r.json();
    const text = (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return clean(JSON.parse(text));
  } finally {
    clearTimeout(t);
  }
}

/** Catches half-finished answers (an exercise with no sets, a log with no reps) so we retry instead. */
function looksComplete(out) {
  if (!out.workouts.length) return false;
  const exs = out.workouts.flatMap((w) => w.exercises);
  if (out.kind === "log") return exs.every((e) => e.performed.length > 0 && e.performed.some((p) => p.reps !== null));
  return exs.some((e) => e.target_sets !== null || e.rep_min !== null);
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
  const { text, image, mime, library } = body ?? {};
  if (!text && !image) return json({ error: "nothing to import" }, 400);
  if (text && text.length > MAX_TEXT) return json({ error: "too long" }, 413);
  if (image && image.length > MAX_IMAGE_B64) return json({ error: "image too large" }, 413);

  const lib = (Array.isArray(library) ? library : [])
    .slice(0, 500)
    .map((e) => (e?.aliases?.length ? `${e.name} (user also calls it: ${e.aliases.join(", ")})` : e?.name))
    .filter(Boolean);
  const intro = `User's exercise library (use exact names for library_name, without the parenthetical):\n${lib.join("\n")}\n\n`;
  const parts = image
    ? [{ text: intro + "Input (photo):" }, { inline_data: { mime_type: mime || "image/jpeg", data: image } }]
    : [{ text: `${intro}Input:\n${text}` }];

  if (!(await takeQuota(user, "import", env))) return json({ error: "limit", message: "You've reached today's import limit. Try again tomorrow." }, 429);

  let lastError = "";
  let best = null;
  for (const m of MODELS) {
    try {
      const out = await callModel(m, parts, env);
      if (!out.workouts.length || looksComplete(out)) return json(out); // empty = "not a program", a real answer
      if (!best || out.workouts.length > best.workouts.length) best = out;
      lastError = `${m.model}: incomplete result`;
    } catch (e) {
      lastError = String(e?.message ?? e);
    }
  }
  // Nothing looked complete: an empty result means "not a program"; anything else is shown for review.
  if (best) return json(best);
  await markFailed(user, "import", env);
  return json({ error: "could not read that", detail: lastError }, 502);
}
