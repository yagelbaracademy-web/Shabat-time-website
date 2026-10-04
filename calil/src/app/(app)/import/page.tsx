"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { defaultChoice, readProgram, saveLogs, savePlans, type ImportResult, type ImportedExercise, type NameChoice } from "@/lib/import";
import { likelyProgramSheet, preloadSpreadsheetReader, readSpreadsheet, type SheetText } from "@/lib/import/sheet";
import { useNow } from "@/lib/hooks";
import { haptic } from "@/lib/format";
import { getState, useStore } from "@/lib/store";
import { exName, tr, useT } from "@/lib/i18n";
import { ExerciseIcon } from "@/components/ExerciseIcon";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Icon } from "@/components/icons";
import { BackLink, Button, Card, Screen, Segmented, Sheet, SheetAction, Toggle, toast } from "@/components/ui";

type Step = "input" | "reading" | "preview";

interface Draft {
  include: boolean;
  name: string;
  choices: NameChoice[];
}

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

export default function ImportPage() {
  return (
    <Suspense>
      <Importer />
    </Suspense>
  );
}

/** What the import becomes is the user's call, defaulted by where they came from (Plans or History). */
type Mode = "plan" | "log";

function Importer() {
  const t = useT();
  const router = useRouter();
  const from: Mode = useSearchParams().get("as") === "log" ? "log" : "plan";
  const [mode, setMode] = useState<Mode>(from);
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; image?: File; sheets?: SheetText[]; opening?: boolean } | null>(null);
  const [sheet, setSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [includeWarmup, setIncludeWarmup] = useState(false);
  const [date, setDate] = useState(today);
  const [alsoPlan, setAlsoPlan] = useState(true);
  const [startedAt, setStartedAt] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Start fetching the spreadsheet reader now, so picking a file feels instant.
  useEffect(() => {
    void preloadSpreadsheetReader().catch(() => {});
  }, []);

  const pickFile = async (f: File) => {
    setError(null);
    if (f.type.startsWith("image/")) {
      setFile({ name: f.name, image: f });
      return;
    }
    // Show the file right away; reading it happens behind a spinner.
    setFile({ name: f.name, opening: true });
    try {
      if (/\.(xlsx|xlsm|xls|ods)$/i.test(f.name)) {
        const sheets = await readSpreadsheet(f);
        if (!sheets.length) throw new Error();
        setFile({ name: f.name, sheets });
        setSheet(likelyProgramSheet(sheets));
      } else {
        setText(await f.text());
        setFile(null);
      }
    } catch {
      setFile(null);
      setError(t("Couldn’t open that file. Try an .xlsx, .csv or a screenshot."));
    }
  };

  const read = async () => {
    setError(null);
    setStep("reading");
    setStartedAt(Date.now());
    abort.current = new AbortController();
    try {
      const input = file?.image
        ? { image: file.image }
        : { text: file?.sheets ? `## Sheet: ${file.sheets[sheet].name}\n${file.sheets[sheet].text}` : text };
      const r = await readProgram(input, abort.current.signal);
      setResult(r);
      setDrafts(r.workouts.map((w) => ({ include: true, name: w.name, choices: w.exercises.map(defaultChoice) })));
      setIncludeWarmup(false);
      if (r.workouts[0]?.date) setDate(r.workouts[0].date);
      // Only switch to "a workout I did" when the source has no performed numbers at all.
      if (from === "log" && !hasPerformed(r)) setMode("plan");
      else setMode(from);
      setStep("preview");
      haptic(12);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      setStep("input");
    }
  };

  const save = () => {
    if (!result) return;
    const chosen = result.workouts
      .map((workout, i) => ({ workout, name: drafts[i].name.trim() || workout.name, choices: drafts[i].choices, include: drafts[i].include }))
      .filter((x) => x.include);
    if (!chosen.length) return;
    if (mode === "plan") {
      const ids = savePlans({ workouts: chosen, includeWarmup });
      toast({ title: ids.length === 1 ? t("Plan saved") : t("{n} plans saved", { n: ids.length }), icon: "check" });
      router.replace(ids.length === 1 ? `/plan?id=${ids[0]}` : "/plans");
    } else {
      const ids = saveLogs({ workouts: chosen, includeWarmup, date, alsoPlan });
      toast({ title: t("Saved to history"), sub: alsoPlan ? t("Also added to your plans") : undefined, icon: "check" });
      router.replace(`/workout?id=${ids[0]}`);
    }
    haptic(20);
  };

  return (
    <Screen className={step === "preview" ? "pb-[calc(var(--tabbar-h)+var(--sab)+110px)]!" : ""}>
      <div className="pt-2">
        {from === "log" ? <BackLink href="/history" label="History" /> : <BackLink href="/plans" label="Plans" />}
      </div>

      {step === "input" && (
        <>
          <h1 className="mt-4 text-[32px] leading-tight font-semibold tracking-[-0.02em]">{t("Import")}</h1>
          <p className="mt-1 mb-5 text-[17px] text-ink-2">
            {from === "log" ? t("A workout you did, from your notes or a screenshot.") : t("A program from your coach, or one you wrote down.")}
          </p>

          <Card className="p-4">
            {file ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                    {file.opening ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
                    ) : (
                      <Icon name={file.image ? "copy" : "list"} size={21} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{file.name}</span>
                    {file.opening && <span className="block text-[14px] text-ink-2">Opening…</span>}
                  </span>
                  <button type="button" aria-label={t("Remove file")} onClick={() => setFile(null)} className="press flex h-10 w-10 items-center justify-center rounded-full text-ink-3">
                    <Icon name="close" size={18} />
                  </button>
                </div>
                {file.sheets && file.sheets.length > 1 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[14px] text-ink-2">{t("Which sheet?")}</p>
                    <div className="space-y-1.5">
                      {file.sheets.map((s, i) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => setSheet(i)}
                          className={`press flex min-h-[48px] w-full items-center gap-3 rounded-[14px] px-3.5 text-start text-[16px] ${i === sheet ? "bg-accent-soft text-accent-ink" : "bg-fill"}`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${i === sheet ? "bg-accent text-white" : "border-2 border-ink-3/50"}`}>
                            {i === sheet && <Icon name="check" size={12} stroke={3} />}
                          </span>
                          <span className="min-w-0 flex-1 truncate" dir="auto">
                            {s.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                dir="auto"
                rows={9}
                placeholder={t("Paste here, for example:\n\nPull-up\n25kg 7 reps\n20kg 8 reps\n\nBench press 3×8–10, rest 2 min")}
                className="w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-ink-3"
              />
            )}
          </Card>

          {!file && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="press mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-fill text-[16px] font-medium"
            >
              <Icon name="plus" size={19} /> {t("Choose a file")}
              <span className="text-ink-3">· {t("Excel, CSV or a screenshot")}</span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickFile(f);
              e.target.value = "";
            }}
          />

          {error && (
            <p role="alert" className="mt-3 px-1 text-[15px] text-danger">
              {error}
            </p>
          )}

          <Button className="mt-5 w-full" disabled={file ? !!file.opening : !text.trim()} onClick={() => void read()}>
            {t("Read it")}
          </Button>
        </>
      )}

      {step === "reading" && (
        <Reading since={startedAt} big={!!file?.sheets || text.length > 2000} onCancel={() => abort.current?.abort()} />
      )}

      {step === "preview" && result && (
        <Preview
          result={result}
          mode={mode}
          setMode={setMode}
          drafts={drafts}
          setDrafts={setDrafts}
          includeWarmup={includeWarmup}
          setIncludeWarmup={setIncludeWarmup}
          date={date}
          setDate={setDate}
          alsoPlan={alsoPlan}
          setAlsoPlan={setAlsoPlan}
          onBack={() => setStep("input")}
          onSave={save}
        />
      )}
    </Screen>
  );
}

/* ───────────────────────────── reading ───────────────────────────── */

function Reading({ since, big, onCancel }: { since: number; big: boolean; onCancel: () => void }) {
  const now = useNow(true, 500);
  const secs = Math.max(0, Math.floor((now - since) / 1000));
  const t = useT();
  const msg = t(secs < 4 ? "Reading…" : secs < 10 ? "Finding the exercises…" : secs < 18 ? "Matching them to your library…" : "Almost there…");
  return (
    <div className="flex flex-col items-center px-6 pt-28 text-center">
      <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent" />
      <p className="mt-6 text-[20px] font-semibold">{msg}</p>
      <p className="tnum mt-1 text-[15px] text-ink-2">{big ? t("A full program takes 10–20 seconds") : t("A few seconds")}</p>
      <Button variant="ghost" className="mt-6" onClick={onCancel}>
        {t("Cancel")}
      </Button>
    </div>
  );
}

/* ───────────────────────────── preview ───────────────────────────── */

function Preview({
  result,
  mode,
  setMode,
  drafts,
  setDrafts,
  includeWarmup,
  setIncludeWarmup,
  date,
  setDate,
  alsoPlan,
  setAlsoPlan,
  onBack,
  onSave,
}: {
  result: ImportResult;
  mode: Mode;
  setMode: (m: Mode) => void;
  drafts: Draft[];
  setDrafts: (d: Draft[]) => void;
  includeWarmup: boolean;
  setIncludeWarmup: (v: boolean) => void;
  date: string;
  setDate: (v: string) => void;
  alsoPlan: boolean;
  setAlsoPlan: (v: boolean) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState<{ w: number; e: number } | null>(null);
  const isLog = mode === "log";
  const canLog = hasPerformed(result);
  const warmups = result.workouts.reduce((n, w) => n + w.exercises.filter((e) => e.is_warmup).length, 0);
  const selected = drafts.filter((d) => d.include).length;
  const block = result.workouts[0]?.block;

  const update = (w: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, i) => (i === w ? { ...d, ...patch } : d)));
  const setChoice = (w: number, e: number, c: NameChoice) =>
    update(w, { choices: drafts[w].choices.map((x, i) => (i === e ? c : x)) });

  return (
    <>
      {canLog && (
        <Segmented
          className="mt-4 w-full"
          options={[
            { value: "plan", label: t("A plan for next time") },
            { value: "log", label: t("A workout I did") },
          ]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
      )}
      <h1 className="mt-4 text-[30px] leading-tight font-semibold tracking-[-0.02em]">
        {isLog ? t("A workout you did") : result.workouts.length === 1 ? t("1 workout found") : t("{n} workouts found", { n: result.workouts.length })}
      </h1>
      <p className="mt-1 mb-5 text-[16px] text-ink-2" dir="auto">
        {isLog ? t("It goes into your history, so it counts for progress and records.") : block ? block : t("Check it, then save.")}
      </p>

      <Card className="mb-4 divide-y divide-line overflow-hidden">
        {isLog && (
          <label className="flex min-h-[56px] items-center justify-between gap-4 px-4">
            <span className="text-[17px]">{t("Date")}</span>
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-end text-[17px]! text-accent-ink outline-none"
            />
          </label>
        )}
        {isLog && (
          <div className="flex min-h-[56px] items-center justify-between gap-4 px-4">
            <span className="text-[17px]">{t("Also save as a plan")}</span>
            <Toggle label={t("Also save as a plan")} checked={alsoPlan} onChange={setAlsoPlan} />
          </div>
        )}
        {warmups > 0 && (
          <div className="flex min-h-[56px] items-center justify-between gap-4 px-4">
            <span className="text-[17px]">
              {t("Include warm-up")} <span className="text-ink-3">({warmups})</span>
            </span>
            <Toggle label={t("Include warm-up")} checked={includeWarmup} onChange={setIncludeWarmup} />
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {result.workouts.map((w, wi) => {
          const d = drafts[wi];
          const shown = w.exercises.map((e, ei) => ({ e, ei })).filter(({ e }) => includeWarmup || !e.is_warmup);
          return (
            <Card key={wi} className={`p-4 transition-opacity ${d.include ? "" : "opacity-50"}`}>
              <div className="mb-2 flex items-center gap-3">
                {result.workouts.length > 1 && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={d.include}
                    aria-label={t("Import {name}", { name: d.name })}
                    onClick={() => update(wi, { include: !d.include })}
                    className="press flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-full ${d.include ? "bg-accent text-white" : "border-2 border-ink-3/50"}`}>
                      {d.include && <Icon name="check" size={15} stroke={2.8} />}
                    </span>
                  </button>
                )}
                <input
                  value={d.name}
                  dir="auto"
                  onChange={(e) => update(wi, { name: e.target.value })}
                  aria-label={t("Workout name")}
                  className="min-w-0 flex-1 bg-transparent text-[20px]! font-semibold tracking-[-0.01em] outline-none"
                />
                <span className="shrink-0 text-[14px] text-ink-3">{t("{n} ex.", { n: shown.length })}</span>
              </div>
              {d.include && (
                <ul className="divide-y divide-line">
                  {shown.map(({ e, ei }) => (
                    <ExerciseRow key={ei} e={e} choice={d.choices[ei]} isLog={isLog} onEdit={() => setEditing({ w: wi, e: ei })} />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <div
        className="fixed inset-x-0 z-40 mx-auto flex max-w-[560px] gap-2 px-4"
        style={{ bottom: "calc(var(--tabbar-h) + var(--sab) + 12px)" }}
      >
        <Button variant="secondary" className="shadow-float" onClick={onBack}>
          {t("Back")}
        </Button>
        <Button className="flex-1 shadow-float" disabled={!selected} onClick={onSave}>
          {isLog ? t("Save workout") : selected === 1 ? t("Save plan") : t("Save {n} plans", { n: selected })}
        </Button>
      </div>

      <NameSheet
        target={editing ? result.workouts[editing.w].exercises[editing.e] : null}
        choice={editing ? drafts[editing.w].choices[editing.e] : null}
        onClose={() => setEditing(null)}
        onChoose={(c) => {
          if (editing) setChoice(editing.w, editing.e, c);
          setEditing(null);
        }}
      />
    </>
  );
}

/** True when the source has numbers that were actually performed (so "a workout I did" makes sense). */
function hasPerformed(r: ImportResult) {
  return r.workouts.some((w) => w.exercises.some((e) => e.performed.some((p) => p.reps !== null || p.weight !== null)));
}

function summary(e: ImportedExercise, isLog: boolean) {
  if (isLog && e.performed.length) {
    return e.performed.map((p) => (p.weight !== null ? `${p.weight}×${p.reps ?? "–"}` : `${p.reps ?? "–"}`)).join(" · ");
  }
  const start = startWeight(e);
  const reps = e.rep_min !== null ? (e.rep_max && e.rep_max !== e.rep_min ? `${e.rep_min}–${e.rep_max}` : `${e.rep_min}`) : null;
  const parts = [`${tr("{n} sets", { n: e.target_sets ?? "–" })}${reps ? ` × ${reps}` : ""}`];
  if (e.rest_seconds)
    parts.push(
      tr("{time} rest", {
        time: e.rest_seconds < 120 ? tr("{n}s", { n: e.rest_seconds }) : `${Math.floor(e.rest_seconds / 60)}:${String(e.rest_seconds % 60).padStart(2, "0")}`,
      }),
    );
  if (start !== null) parts.push(tr("starts at {n} {unit}", { n: start, unit: tr(getState().profile?.weight_unit ?? "kg") }));
  return parts.join(" · ");
}

/** A plan's starting weight from the source: the heaviest weight written for it. */
function startWeight(e: ImportedExercise) {
  const ws = e.performed.map((p) => p.weight).filter((w): w is number => w !== null && w > 0);
  return ws.length ? Math.max(...ws) : null;
}

function ExerciseRow({ e, choice, isLog, onEdit }: { e: ImportedExercise; choice: NameChoice; isLog: boolean; onEdit: () => void }) {
  const t = useT();
  const existing = useStore((s) => (choice.kind === "existing" ? s.exercises[choice.exerciseId] : null), [choice]);
  const name = existing ? exName(existing) : choice.kind === "new" ? choice.name : e.suggested_name;
  const isNew = choice.kind === "new";
  const renamed = name.toLowerCase() !== e.original_name.toLowerCase();
  return (
    <li>
      <button type="button" onClick={onEdit} className="flex w-full items-start gap-3 py-3 text-start">
        <ExerciseIcon kind={existing?.equipment ?? e.equipment} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[16px] font-medium" dir="auto">
              {name}
            </span>
            {isNew && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent-ink">{t("New")}</span>}
            {e.is_warmup && <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-[12px] text-ink-2">{t("Warm-up")}</span>}
          </span>
          {renamed && (
            <span className="block truncate text-[13px] text-ink-3" dir="auto">
              {t("You wrote:")} {e.original_name}
            </span>
          )}
          <span className="tnum block text-[14px] text-ink-2" dir="auto">
            {summary(e, isLog)}
          </span>
          {e.note && (
            <span className="mt-0.5 line-clamp-1 block text-[13px] text-ink-3" dir="auto">
              {e.note}
            </span>
          )}
        </span>
        <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-ink-3" />
      </button>
    </li>
  );
}

/** Choose what an imported exercise is called / which exercise it is. */
function NameSheet({
  target,
  choice,
  onClose,
  onChoose,
}: {
  target: ImportedExercise | null;
  choice: NameChoice | null;
  onClose: () => void;
  onChoose: (c: NameChoice) => void;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const existing = useStore((s) => (choice?.kind === "existing" ? s.exercises[choice.exerciseId] : null), [choice]);
  const options = useMemo(() => {
    if (!target) return [];
    const list: { label: string; sub: string; c: NameChoice }[] = [];
    const std = target.suggested_name;
    const mine = target.original_name;
    if (existing) list.push({ label: exName(existing), sub: tr("From your library"), c: { kind: "existing", exerciseId: existing.id } });
    if (std && std.toLowerCase() !== existing?.name.toLowerCase())
      list.push({ label: std, sub: tr("Standard name, remembers what you wrote"), c: { kind: "new", name: std, alias: mine !== std ? mine : null } });
    if (mine && mine.toLowerCase() !== std.toLowerCase())
      list.push({ label: mine, sub: tr("Keep your own name"), c: { kind: "new", name: mine, alias: null } });
    return list;
  }, [target, existing]);

  const same = (a: NameChoice | null, b: NameChoice) =>
    !!a && a.kind === b.kind && (a.kind === "existing" ? a.exerciseId === (b as { exerciseId: string }).exerciseId : a.name === (b as { name: string }).name);

  return (
    <>
      <Sheet open={!!target && !picking} onClose={onClose} title={t("Which exercise is this?")}>
        {target && (
          <div className="space-y-2 pb-3">
            <p className="px-1 pb-1 text-[15px] text-ink-2" dir="auto">
              {t("You wrote")} “{target.original_name}”
            </p>
            {options.map((o) => (
              <button
                key={o.label + o.c.kind}
                type="button"
                onClick={() => onChoose(o.c)}
                className={`press flex min-h-[60px] w-full items-center gap-3 rounded-[16px] px-4 text-start ${same(choice, o.c) ? "bg-accent-soft" : "bg-card"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-medium" dir="auto">
                    {o.label}
                  </span>
                  <span className="block text-[14px] text-ink-2">{o.sub}</span>
                </span>
                {same(choice, o.c) && <Icon name="check" size={20} className="text-accent" />}
              </button>
            ))}
            <SheetAction icon="search" onClick={() => setPicking(true)}>
              {t("Pick another exercise…")}
            </SheetAction>
          </div>
        )}
      </Sheet>
      <ExercisePicker
        open={picking}
        title={t("Pick exercise")}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          setPicking(false);
          onChoose({ kind: "existing", exerciseId: id });
        }}
      />
    </>
  );
}
