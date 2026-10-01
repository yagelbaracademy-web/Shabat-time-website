"use client";

import { useState } from "react";
import { addMachine, MACHINE_SEP, switchMachine } from "@/lib/actions";
import { haptic } from "@/lib/format";
import { useStore } from "@/lib/store";
import { exName, useT } from "@/lib/i18n";
import type { Exercise } from "@/lib/types";
import { Button, Sheet, SheetAction } from "../ui";
import { track } from "@/lib/track";

/**
 * "Same exercise, different machine." Lists the machines already used for this
 * exercise and adds a new one under a name the user picks ("Machine 2", "the heavy one").
 */
export function MachineSheet({ open, onClose, weId, exercise }: { open: boolean; onClose: () => void; weId: string; exercise: Exercise }) {
  const t = useT();
  // Names are matched on what's stored (English for built-ins), so switching language keeps the family together.
  const cut = exercise.name.indexOf(MACHINE_SEP);
  const baseStored = cut > 0 ? exercise.name.slice(0, cut) : exercise.name;
  const family = useStore(
    (s) => {
      const all = Object.values(s.exercises);
      const base = all.find((e) => e.name === baseStored && !e.user_id) ?? all.find((e) => e.name === baseStored);
      const variants = all.filter((e) => e.user_id && e.name.startsWith(baseStored + MACHINE_SEP));
      variants.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      return base ? [base, ...variants] : variants;
    },
    [baseStored],
  );
  const base = family.find((e) => e.name === baseStored);
  const baseId = base?.id ?? exercise.id;
  const baseName = base ? exName(base) : baseStored;
  const [label, setLabel] = useState("");
  const close = () => {
    setLabel("");
    onClose();
  };

  const pick = (id: string) => {
    if (id !== exercise.id) track("machine_switch");
    switchMachine(weId, id);
    haptic(10);
    close();
  };
  const add = () => {
    if (!label.trim()) return;
    addMachine(weId, baseId, baseStored, label);
    haptic(12);
    close();
  };

  return (
    <Sheet open={open} onClose={close} title={t("Different machine")}>
      <div className="pb-3">
        <p className="mb-3 px-1 text-[15px] text-ink-2">{t("Each machine keeps its own weights and history.")}</p>
        {family.length > 1 && (
          <div className="mb-4 space-y-2">
            {family.map((e) => {
              const suffix = e.name.includes(MACHINE_SEP) ? e.name.slice(e.name.indexOf(MACHINE_SEP) + MACHINE_SEP.length) : t("Original");
              return (
                <SheetAction key={e.id} icon={e.id === exercise.id ? "check" : "swap"} onClick={() => pick(e.id)}>
                  <span dir="auto">{suffix}</span>
                </SheetAction>
              );
            })}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="flex min-h-[56px] items-center gap-1 rounded-[16px] bg-card px-4 text-[17px]">
            <span className="shrink-0 text-ink-2" dir="auto">
              {baseName}
              {MACHINE_SEP}
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("e.g. Machine 2")}
              maxLength={40}
              dir="auto"
              enterKeyHint="done"
              aria-label={t("Machine name")}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3"
            />
          </label>
          <Button type="submit" className="mt-3 w-full" disabled={!label.trim()}>
            {t("Add machine")}
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
