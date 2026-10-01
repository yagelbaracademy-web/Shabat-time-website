/**
 * Turns a short spoken sentence into workout data. Rule-based, instant and
 * free; the WorkoutParser interface lets an LLM-backed parser replace it later.
 *
 *   "Bench press, 80 kilos, 8 reps"
 *   "Third set, 82.5 kilos, 8 reps, shoulder felt slightly uncomfortable"
 *   "לחיצת חזה 80 קילו 8 חזרות"
 */

export interface ParsedEntry {
  exerciseId: string | null;
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
  note: string | null;
}

export interface ParseContext {
  exercises: { id: string; name: string }[];
  /** exercise ids already in the workout get a boost when matching */
  inWorkout: Set<string>;
}

export interface WorkoutParser {
  parse(text: string, ctx: ParseContext): ParsedEntry | Promise<ParsedEntry>;
}

const EN_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
const HE_NUM: Record<string, number> = {
  אחת: 1, אחד: 1, שתיים: 2, שניים: 2, שתי: 2, שני: 2, שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4,
  חמש: 5, חמישה: 5, שש: 6, שישה: 6, שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10,
  שתים: 2, עשרים: 20, שלושים: 30, ארבעים: 40, חמישים: 50, שישים: 60, שבעים: 70, שמונים: 80, תשעים: 90, מאה: 100,
};
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6,
  ראשון: 1, שני: 2, שלישי: 3, רביעי: 4, חמישי: 5, שישי: 6, שביעי: 7, שמיני: 8,
};

/** Hebrew / slang names → built-in exercise names. */
const ALIASES: Record<string, string> = {
  "לחיצת חזה": "Bench Press",
  "לחיצת חזה בשיפוע": "Incline Bench Press",
  "לחיצת כתפיים": "Overhead Press",
  "סקוואט": "Squat",
  "סקווט": "Squat",
  "דדליפט": "Deadlift",
  "מתח": "Pull-up",
  "מתחים": "Pull-up",
  "מקבילים": "Dips",
  "שכיבות סמיכה": "Push-up",
  "פולי עליון": "Lat Pulldown",
  "חתירה": "Seated Cable Row",
  "כפיפת מרפקים": "Dumbbell Curl",
  "יד קדמית": "Dumbbell Curl",
  "יד אחורית": "Triceps Pushdown",
  "הרחקה לצדדים": "Lateral Raise",
  "לחיצת רגליים": "Leg Press",
  "פשיטת ברכיים": "Leg Extension",
  "כפיפת ברכיים": "Leg Curl",
  "פלאנק": "Plank",
  bench: "Bench Press",
  ohp: "Overhead Press",
  pulldown: "Lat Pulldown",
  "pull ups": "Pull-up",
  pullups: "Pull-up",
  "chin ups": "Chin-up",
  rdl: "Romanian Deadlift",
};

const WEIGHT_UNIT = String.raw`(?:kg|kgs|kilo|kilos|kilogram|kilograms|lb|lbs|pound|pounds|קילו|קילוגרם|ק"ג|קג)`;
const REPS_UNIT = String.raw`(?:reps?|repetitions?|times|חזרות|חזרה|פעמים)`;
const NUM = String.raw`(\d+(?:\.\d+)?)`;

function normalize(text: string) {
  let t = ` ${text.toLowerCase()} `
    .replace(/[“”]/g, '"')
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[-–]/g, " ");
  // compound english numbers: "eighty two" → 82
  t = t.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g,
    (_, a, b) => String(EN_NUM[a] + EN_NUM[b]),
  );
  t = t.replace(/\b[a-z]+\b/g, (w) => (w in EN_NUM ? String(EN_NUM[w]) : w));
  // hebrew: "שמונים ושתיים" → 82 ; single words → digits
  t = t.replace(
    /(עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים)\s+ו(\S+)/g,
    (m, a, b) => (b in HE_NUM ? String(HE_NUM[a] + HE_NUM[b]) : m),
  );
  t = t.replace(/(^|\s)([א-ת]+)(?=\s)/g, (m, sp, w) => (w in HE_NUM && !(w in ORDINALS) ? sp + HE_NUM[w] : m));
  // "and a half" / "וחצי" / "point five"
  t = t.replace(/(\d+)\s+(?:and a half|וחצי)/g, (_, n) => `${n}.5`);
  t = t.replace(/(\d+)\s+point\s+(\d)/g, "$1.$2");
  return t.replace(/\s+/g, " ");
}

const stem = (w: string) => w.replace(/(es|s)$/, "");
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9א-ת\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(stem);

function matchExercise(text: string, ctx: ParseContext): { id: string; span: string } | null {
  // aliases first (longest wins)
  const aliasHits = Object.keys(ALIASES)
    .filter((a) => new RegExp(`(^|\\s)${a}(?=\\s|$|[,.])`).test(text))
    .sort((a, b) => b.length - a.length);
  for (const a of aliasHits) {
    const ex = ctx.exercises.find((e) => e.name === ALIASES[a]);
    if (ex) return { id: ex.id, span: `${a} ${ex.name.toLowerCase()}` };
  }
  const words = new Set(tokens(text));
  let best: { id: string; name: string; score: number } | null = null;
  for (const e of ctx.exercises) {
    const nt = tokens(e.name);
    if (!nt.length) continue;
    const hit = nt.filter((w) => words.has(w)).length;
    if (hit === 0) continue;
    const ratio = hit / nt.length;
    if (ratio < 0.99 && !(ratio >= 0.5 && ctx.inWorkout.has(e.id))) continue;
    const score = ratio * 10 + hit + (ctx.inWorkout.has(e.id) ? 3 : 0);
    if (!best || score > best.score) best = { id: e.id, name: e.name, score };
  }
  return best ? { id: best.id, span: best.name.toLowerCase() } : null;
}

export const ruleParser: WorkoutParser = {
  parse(raw, ctx) {
    let t = normalize(raw);
    const out: ParsedEntry = { exerciseId: null, setNumber: null, weight: null, reps: null, note: null };
    const cut = (re: RegExp) => {
      t = t.replace(re, " , ");
    };

    const ex = matchExercise(t, ctx);
    if (ex) {
      out.exerciseId = ex.id;
      // remove every word of the matched name
      for (const w of ex.span.split(/\s+/)) cut(new RegExp(`(^|\\s)${w.replace(/[-]/g, "\\s?")}\\w*(?=\\s|$|[,.])`, "g"));
    }

    // set number
    let m = t.match(/(?:set|סט)\s*(?:number|מספר)?\s*(\d+)/);
    if (m) {
      out.setNumber = Number(m[1]);
      cut(new RegExp(m[0]));
    } else {
      const ords = Object.keys(ORDINALS).join("|");
      m = t.match(new RegExp(`(?:(${ords})\\s+set|סט\\s+(${ords}))`));
      if (m) {
        out.setNumber = ORDINALS[m[1] ?? m[2]];
        cut(new RegExp(m[0]));
      }
    }

    m = t.match(new RegExp(`${NUM}\\s*${WEIGHT_UNIT}`));
    if (m) {
      out.weight = Number(m[1]);
      cut(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    m = t.match(new RegExp(`(\\d+)\\s*${REPS_UNIT}`)) ?? t.match(new RegExp(`${REPS_UNIT}\\s*(\\d+)`));
    if (m) {
      out.reps = Number(m[1]);
      cut(new RegExp(m[0]));
    }
    // "80 x 8", "80 by 8", "80 for 8"
    if (out.weight === null && out.reps === null) {
      m = t.match(new RegExp(`${NUM}\\s*(?:x|×|by|for|על|כפול)\\s*(\\d+)`));
      if (m) {
        out.weight = Number(m[1]);
        out.reps = Number(m[2]);
        cut(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
    // leftover bare numbers
    const bare = [...t.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$|,)/g)].map((x) => Number(x[1]));
    if (bare.length) {
      if (out.weight === null && out.reps === null && bare.length >= 2) {
        out.weight = bare[0];
        out.reps = bare[1];
      } else if (out.reps === null && out.weight !== null) out.reps = bare[0];
      else if (out.weight === null && out.reps !== null) out.weight = bare[0];
      t = t.replace(/(?:^|\s)\d+(?:\.\d+)?(?=\s|$|,)/g, " ");
    }

    // what's left is the note
    const note = t
      .split(/[,.;]/)
      .map((x) => x.replace(/^\s*(and|with|then|but|also|note|ו|עם|הערה)\b/g, "").trim())
      .filter((x) => /[a-zא-ת]{2,}/.test(x) && !/^(and|the|a|at|of|on|ו)$/.test(x))
      .join(", ")
      .trim();
    if (note) out.note = note.charAt(0).toUpperCase() + note.slice(1);
    return out;
  },
};

export const workoutParser: WorkoutParser = ruleParser;

export function isEmpty(p: ParsedEntry) {
  return !p.exerciseId && p.setNumber === null && p.weight === null && p.reps === null && !p.note;
}
