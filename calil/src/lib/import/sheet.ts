/**
 * Spreadsheet → plain text the importer model can read.
 *
 * Coaches' sheets are free-form (merged cells, section titles, warm-ups), so
 * instead of guessing columns we keep every non-empty row as "a | b | c" and
 * let the model understand it. One quirk is fixed here: Excel silently turns
 * rep ranges like "8-10" into dates (8 October); those are turned back.
 */

export interface SheetText {
  name: string;
  text: string;
  rows: number;
}

function cellText(v: unknown): string {
  if (v instanceof Date) {
    // "8-10" typed in Excel becomes 8 Oct → day-month is the original range.
    return `${v.getDate()}-${v.getMonth() + 1}`;
  }
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The sheet most likely to hold the current program: named like one, not a tracker or a link list. */
export function likelyProgramSheet(sheets: SheetText[]) {
  const i = sheets.findIndex(
    (s) => /תוכנית|תכנית|בלוק|program|plan|block|week|שבוע/i.test(s.name) && !/מעקב|קישור|track|link|log/i.test(s.name),
  );
  return i >= 0 ? i : 0;
}

// Loaded only on the import screen, and warmed up as soon as that screen opens.
let lib: Promise<typeof import("xlsx")> | null = null;
export function preloadSpreadsheetReader() {
  lib ??= import("xlsx");
  return lib;
}

export async function readSpreadsheet(file: File): Promise<SheetText[]> {
  const XLSX = await preloadSpreadsheetReader();
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true, dense: true });
  const out: SheetText[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "" });
    const lines: string[] = [];
    let last = "";
    for (const r of rows) {
      const cells = r.map(cellText).filter(Boolean);
      if (!cells.length) continue;
      const line = cells.join(" | ");
      if (line === last) continue; // repeated header rows
      lines.push(line);
      last = line;
    }
    if (lines.length) out.push({ name, text: lines.join("\n"), rows: lines.length });
  }
  return out;
}
