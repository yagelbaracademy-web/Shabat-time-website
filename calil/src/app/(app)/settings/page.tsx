"use client";

import { useRef, useState } from "react";
import { deleteAccount, signOut } from "@/lib/auth";
import { getState, resetStore, saveProfile, useStore } from "@/lib/store";
import { setAddress, setExNames, setLang, useLang, useT, type Address, type ExNames } from "@/lib/i18n";
import { AvatarEditor, removeAvatar } from "@/components/AvatarEditor";
import { Icon } from "@/components/icons";
import { BackLink, Button, Card, Screen, Segmented, Sheet, Skeleton, Toggle, toast } from "@/components/ui";

const REST_OPTIONS = [60, 90, 120, 180];

export default function SettingsPage() {
  const profile = useStore((s) => s.profile);
  const pending = useStore((s) => s.pending);
  const [name, setName] = useState<string | null>(null);
  const t = useT();
  const lang = useLang();
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);

  if (!profile)
    return (
      <Screen>
        <Skeleton className="mt-16 h-72" />
      </Screen>
    );

  return (
    <Screen>
      <div className="pt-2">
        <BackLink href="/" label="Home" />
      </div>
      <h1 className="mt-4 mb-6 text-[32px] font-semibold tracking-[-0.02em]">{t("Settings")}</h1>

      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          aria-label={profile.avatar_url ? t("Change photo") : t("Add photo")}
          className="press relative flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-fill text-ink-3"
        >
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Icon name="user" size={36} />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-center text-[11px] font-medium text-white">{t("Edit")}</span>
        </button>
        <div className="min-w-0">
          <p className="truncate text-[20px] font-semibold" dir="auto">
            {profile.name || profile.email}
          </p>
          <div className="mt-1 flex gap-4 text-[15px]">
            <button type="button" onClick={() => photoInput.current?.click()} className="text-accent">
              {profile.avatar_url ? t("Change photo") : t("Add photo")}
            </button>
            {profile.avatar_url && (
              <button type="button" onClick={() => void removeAvatar()} className="text-ink-3">
                {t("Remove")}
              </button>
            )}
          </div>
        </div>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPhoto(f);
            e.target.value = "";
          }}
        />
      </div>
      <AvatarEditor file={photo} onClose={() => setPhoto(null)} />

      <div className="space-y-6">
        <Group title="Profile">
          <Row label="Language">
            <Segmented
              options={[
                { value: "en", label: "English" },
                { value: "he", label: "עברית" },
              ]}
              value={lang}
              onChange={(v) => {
                setLang(v as "en" | "he");
                saveProfile({ language: v as "en" | "he" });
              }}
              size="sm"
            />
          </Row>
          {lang === "he" && (
            <Row label="Form of address">
              <Segmented
                options={[
                  { value: "m", label: t("Masculine") },
                  { value: "f", label: t("Feminine") },
                  { value: "neutral", label: t("Doesn’t matter") },
                ]}
                value={profile.address ?? "neutral"}
                onChange={(v) => {
                  setAddress(v as Address);
                  saveProfile({ address: v as Address });
                }}
                size="sm"
              />
            </Row>
          )}
          {lang === "he" && (
            <Row label="Exercise names">
              <Segmented
                options={[
                  { value: "en", label: t("English") },
                  { value: "he", label: t("Hebrew") },
                ]}
                value={profile.exercise_names ?? "en"}
                onChange={(v) => {
                  setExNames(v as ExNames);
                  saveProfile({ exercise_names: v as ExNames });
                }}
                size="sm"
              />
            </Row>
          )}
          <Row label="Name">
            <input
              value={name ?? profile.name ?? ""}
              placeholder={t("Your name")}
              dir="auto"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== null && saveProfile({ name: name.trim() || null })}
              className="w-full min-w-0 bg-transparent text-end text-ink-2 outline-none placeholder:text-ink-3"
            />
          </Row>
          <Row label="Email">
            <span className="truncate text-ink-2">{profile.email}</span>
          </Row>
        </Group>

        <Group title="Workout">
          <Row label="Rest timer">
            <Toggle label={t("Rest timer")} checked={profile.rest_timer_enabled} onChange={(v) => saveProfile({ rest_timer_enabled: v })} />
          </Row>
          {profile.rest_timer_enabled && (
            <div className="px-4 py-3">
              <p className="mb-2 text-[15px] text-ink-2">{t("Default rest")}</p>
              <Segmented
                className="w-full"
                options={REST_OPTIONS.map((s) => ({ value: String(s), label: s < 120 ? t("{n}s", { n: s }) : t("{n}m", { n: s / 60 }) }))}
                value={String(profile.default_rest_seconds)}
                onChange={(v) => saveProfile({ default_rest_seconds: Number(v) })}
              />
            </div>
          )}
          <Row label="Weight unit">
            <Segmented
              options={[
                { value: "kg" as const, label: t("kg") },
                { value: "lb" as const, label: t("lb") },
              ]}
              value={profile.weight_unit}
              onChange={(v) => saveProfile({ weight_unit: v })}
              size="sm"
            />
          </Row>
        </Group>

        <Group title="Your data">
          <button type="button" onClick={downloadData} className="press flex min-h-[56px] w-full items-center gap-3 px-4 text-[17px]">
            <Icon name="down" size={20} className="text-ink-2" /> {t("Download my data")}
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="press flex min-h-[56px] w-full items-center gap-3 px-4 text-[17px] text-danger"
          >
            <Icon name="trash" size={20} /> {t("Delete account")}
          </button>
        </Group>

        <Group title="About">
          {[
            ["Terms of Use", `/terms${lang === "he" ? "" : "?lang=en"}`],
            ["Privacy Policy", `/privacy${lang === "he" ? "" : "?lang=en"}`],
            ["Accessibility", `/accessibility${lang === "he" ? "" : "?lang=en"}`],
            ["Photo credits", "/credits"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="press flex min-h-[52px] items-center justify-between px-4 text-[17px]">
              {t(label)}
              <Icon name="chevronRight" size={18} className="text-ink-3" />
            </a>
          ))}
        </Group>

        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (pending > 0 && !confirm(t("{n} change(s) haven’t synced yet and will be lost. Log out anyway?", { n: pending }))) return;
              void signOut();
            }}
            className="press flex min-h-[56px] w-full items-center gap-3 px-4 text-[17px] text-danger"
          >
            <Icon name="logout" size={20} /> {t("Log out")}
          </button>
        </Card>

        <p className="text-center text-[13px] text-ink-3">
          {pending > 0 ? t("{n} change(s) waiting to sync", { n: pending }) : t("Everything is saved")}
        </p>
      </div>
      <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} />
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <section>
      <h2 className="px-4 pb-2 text-[13px] font-medium tracking-wide text-ink-3 uppercase">{t(title)}</h2>
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 px-4">
      <span className="shrink-0 text-[17px]">{t(label)}</span>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  );
}

/** Everything the user has in Calil, as a JSON file (right of access / portability). */
function downloadData() {
  const s = getState();
  const own = <T extends { id: string }>(rows: Record<string, T>, keep: (r: T) => boolean = () => true) => Object.values(rows).filter(keep);
  const data = {
    exported_at: new Date().toISOString(),
    profile: s.profile,
    exercises: own(s.exercises, (e) => e.user_id !== null),
    exercise_aliases: own(s.exercise_aliases),
    workout_templates: own(s.workout_templates),
    template_exercises: own(s.template_exercises),
    workouts: own(s.workouts),
    workout_exercises: own(s.workout_exercises),
    sets: own(s.sets),
    built_in_exercises_used: own(s.exercises, (e) => e.user_id === null).map((e) => ({ id: e.id, name: e.name })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `calil-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const t = useT();
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toUpperCase() === "DELETE";
  return (
    <Sheet
      open={open}
      onClose={() => {
        setTyped("");
        onClose();
      }}
      title={t("Delete your account?")}
    >
      <div className="pb-3">
        <p className="mb-4 px-1 text-[16px] text-ink-2">
          {t("This permanently deletes your account and everything in it: workouts, plans, notes and progress. It can’t be undone. You can download your data first.")}
        </p>
        <label className="block px-1 pb-1.5 text-[14px] text-ink-2" htmlFor="confirm-delete">
          {t("Type DELETE to confirm")}
        </label>
        <input
          id="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          className="h-14 w-full rounded-[16px] bg-card px-4 text-[18px]! tracking-wide outline-none"
        />
        <Button
          variant="danger"
          className="mt-4 w-full bg-danger! text-white!"
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteAccount();
              resetStore();
            } catch (e) {
              toast({ title: (e as Error).message, icon: "trash" });
              setBusy(false);
            }
          }}
        >
          {busy ? t("Deleting…") : t("Delete my account")}
        </Button>
      </div>
    </Sheet>
  );
}
