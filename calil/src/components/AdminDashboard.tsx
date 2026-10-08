"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon } from "./icons";
import { Logo } from "./ui";
import { AdminInsights, type Insights } from "./AdminInsights";

interface Day {
  day: string;
  signups: number;
  workouts: number;
  active: number;
  dictate: number;
  import: number;
  failed: number;
}
interface UserRow {
  email: string;
  joined: string;
  provider: string;
  last_sign_in: string | null;
  confirmed: boolean;
  workouts: number;
  last_workout: string | null;
  consent: string | null;
  ai_30d: number;
}
interface Stats {
  generated_at: string;
  users: {
    total: number;
    confirmed: number;
    new_7d: number;
    new_30d: number;
    google: number;
    consented: number;
  };
  active: {
    d1: number;
    d7: number;
    d30: number;
    eligible_week2: number;
    retained_week2: number;
  };
  totals: {
    workouts: number;
    sets: number;
    plans: number;
    custom_exercises: number;
  };
  daily: Day[];
  ai_30d: {
    dictate: number;
    import: number;
    failed: number;
    hit_limit_users: number;
  };
  storage: { db_bytes: number };
  user_list: UserRow[];
  insights?: Insights | null;
  funnel?: { signed_up: number; consented: number; first_set: number; dictated: number; finished: number; returning: number } | null;
}

// Measured per-call costs (USD) for the current models; see README.
const COST = { dictate: 0.0005, import: 0.03 };
const USD_ILS = 3.7;
const FREE_DB_BYTES = 500 * 1024 * 1024;

const n = (v: number) => v.toLocaleString("en-US");
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1 / 24) return "just now";
  if (d < 1) return `${Math.round(d * 24)}h ago`;
  if (d < 30) return `${Math.round(d)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
};

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-[20px] border border-line bg-card p-4 shadow-card">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p
        className={`tnum mt-1 text-[26px] font-semibold tracking-[-0.02em] ${tone === "warn" ? "text-danger" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="tnum mt-0.5 text-[13px] text-ink-3">{sub}</p>}
    </div>
  );
}

/** 30 slim bars with the total on top; bars in accent, failures stacked in red. */
function Bars({
  title,
  days,
  value,
  failed,
}: {
  title: string;
  days: Day[];
  value: (d: Day) => number;
  failed?: (d: Day) => number;
}) {
  const max = Math.max(1, ...days.map((d) => value(d) + (failed?.(d) ?? 0)));
  const total = days.reduce((s, d) => s + value(d), 0);
  return (
    <div className="rounded-[20px] border border-line bg-card p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="tnum text-[13px] text-ink-3">{n(total)} in 30 days</p>
      </div>
      <div
        className="flex h-[72px] items-end gap-[3px]"
        role="img"
        aria-label={`${title}: ${total} in the last 30 days`}
      >
        {days.map((d) => {
          const v = value(d);
          const f = failed?.(d) ?? 0;
          return (
            <div
              key={d.day}
              className="flex flex-1 flex-col justify-end"
              title={`${d.day}: ${v}${f ? ` (+${f} failed)` : ""}`}
            >
              {f > 0 && (
                <span
                  className="rounded-t-[3px] bg-danger"
                  style={{ height: `${(f / max) * 72}px` }}
                />
              )}
              <span
                className={`${f ? "" : "rounded-t-[3px]"} rounded-b-[3px] ${v ? "bg-accent" : "bg-fill"}`}
                style={{
                  height: v ? `${Math.max(3, (v / max) * 72)}px` : "3px",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-ink-3">
        <span>{days[0]?.day.slice(5)}</span>
        <span>today</span>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [state, setState] = useState<"loading" | "denied" | "ready" | "error">(
    "loading",
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [withMe, setWithMe] = useState(true);

  const load = useCallback(async (me = true) => {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return setState("denied");
    try {
      const r = await fetch(`/api/admin/stats${me ? "" : "?me=0"}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      if (r.status === 404 || r.status === 401) return setState("denied");
      if (!r.ok) return setState("error");
      setStats(await r.json());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void supabase()
      .auth.getSession()
      .then(() => {
        if (alive) void load();
      });
    return () => {
      alive = false;
    };
  }, [load]);

  const users = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (stats?.user_list ?? []).filter(
      (u) => !term || u.email.toLowerCase().includes(term),
    );
  }, [stats, q]);

  if (state === "denied")
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[20px] font-semibold">Page not found</p>
        <Link href="/" className="text-[15px] text-accent">
          Back to Calil
        </Link>
      </main>
    );
  if (state !== "ready" || !stats)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        {state === "error" ? (
          <button
            type="button"
            onClick={() => void load()}
            className="text-[15px] text-accent"
          >
            Couldn’t load. Try again
          </button>
        ) : (
          <Logo height={34} className="animate-pulse" />
        )}
      </main>
    );

  const s = stats;
  const cost =
    (s.ai_30d.dictate * COST.dictate + s.ai_30d.import * COST.import) * USD_ILS;
  const calls = s.ai_30d.dictate + s.ai_30d.import;
  const failRate = calls
    ? Math.round((s.ai_30d.failed / (calls + s.ai_30d.failed)) * 100)
    : 0;
  const retention = s.active.eligible_week2
    ? Math.round((s.active.retained_week2 / s.active.eligible_week2) * 100)
    : null;
  const dbPct = Math.round((s.storage.db_bytes / FREE_DB_BYTES) * 100);

  return (
    <main
      className="mx-auto w-full max-w-[1120px] px-4 sm:px-6"
      style={{ paddingTop: "calc(var(--sat) + 20px)", paddingBottom: 64 }}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo height={30} />
          <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold tracking-wide text-white uppercase">
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="press flex items-center gap-2 rounded-full bg-fill px-3.5 py-2 text-[14px]"
        >
          <Icon name="undo" size={16} /> Updated {ago(s.generated_at)}
        </button>
      </header>

      <h2 className="mt-8 mb-3 text-[15px] font-semibold text-ink-2">Users</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Users"
          value={n(s.users.total)}
          sub={`+${s.users.new_7d} this week · +${s.users.new_30d} in 30d`}
        />
        <Tile
          label="Active this week"
          value={n(s.active.d7)}
          sub={`${s.active.d1} today · ${s.active.d30} in 30 days`}
        />
        <Tile
          label="Came back in week 2"
          value={retention === null ? "—" : `${retention}%`}
          sub={
            s.active.eligible_week2
              ? `${s.active.retained_week2} of ${s.active.eligible_week2} users`
              : "Needs users older than 14 days"
          }
        />
        <Tile
          label="Signed in with Google"
          value={n(s.users.google)}
          sub={`${s.users.confirmed} confirmed · ${s.users.consented} accepted terms`}
        />
      </div>

      <h2 className="mt-8 mb-3 text-[15px] font-semibold text-ink-2">Usage</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Workouts logged"
          value={n(s.totals.workouts)}
          sub={`${n(s.totals.sets)} sets`}
        />
        <Tile
          label="Plans"
          value={n(s.totals.plans)}
          sub={`${n(s.totals.custom_exercises)} custom exercises`}
        />
        <Tile
          label="AI calls (30d)"
          value={n(calls)}
          sub={`${n(s.ai_30d.dictate)} dictation · ${n(s.ai_30d.import)} import`}
        />
        <Tile
          label="AI cost (30d, est.)"
          value={`₪${cost.toFixed(2)}`}
          sub={`Failure rate ${failRate}%`}
          tone={failRate > 10 ? "warn" : undefined}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Bars
          title="Active users per day"
          days={s.daily}
          value={(d) => d.active}
        />
        <Bars
          title="Workouts per day"
          days={s.daily}
          value={(d) => d.workouts}
        />
        <Bars
          title="Sign-ups per day"
          days={s.daily}
          value={(d) => d.signups}
        />
        <Bars
          title="AI calls per day"
          days={s.daily}
          value={(d) => d.dictate + d.import}
          failed={(d) => d.failed}
        />
      </div>

      {s.funnel && <Funnel f={s.funnel} />}

      <AdminInsights
        data={s.insights ?? null}
        withMe={withMe}
        onWithMe={(v) => {
          setWithMe(v);
          void load(v);
        }}
      />

      <h2 className="mt-8 mb-3 text-[15px] font-semibold text-ink-2">Health</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Database"
          value={`${(s.storage.db_bytes / 1048576).toFixed(1)} MB`}
          sub={`${dbPct}% of the 500 MB free tier`}
          tone={dbPct > 80 ? "warn" : undefined}
        />
        <Tile
          label="Users vs free tier"
          value={`${n(s.active.d30)} / 50,000`}
          sub="Monthly active users (Supabase)"
        />
        <Tile
          label="Hit the AI limit"
          value={n(s.ai_30d.hit_limit_users)}
          sub="Users in the last 30 days"
          tone={s.ai_30d.hit_limit_users ? "warn" : undefined}
        />
        <Tile
          label="Failed AI calls (30d)"
          value={n(s.ai_30d.failed)}
          sub="Dictation and import"
          tone={failRate > 10 ? "warn" : undefined}
        />
      </div>

      <div className="mt-8 mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink-2">
          People ({users.length})
        </h2>
        <label className="flex h-10 w-full max-w-[260px] items-center gap-2 rounded-[12px] bg-fill px-3 text-ink-2">
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email"
            aria-label="Search users"
            className="min-w-0 flex-1 bg-transparent text-[15px]! text-ink outline-none"
          />
        </label>
      </div>
      <div className="overflow-x-auto rounded-[20px] border border-line bg-card shadow-card">
        <table className="w-full min-w-[760px] text-left text-[14px]">
          <thead className="text-[12px] tracking-wide text-ink-3 uppercase">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-3 py-3 font-medium">Via</th>
              <th className="px-3 py-3 font-medium">Last seen</th>
              <th className="px-3 py-3 text-right font-medium">Workouts</th>
              <th className="px-3 py-3 font-medium">Last workout</th>
              <th className="px-3 py-3 text-right font-medium">AI 30d</th>
              <th className="px-4 py-3 font-medium">Terms</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {users.map((u) => (
              <tr key={u.email} className="border-b border-line last:border-0">
                <td className="max-w-[260px] truncate px-4 py-3">
                  {u.email}
                  {!u.confirmed && (
                    <span className="ml-2 rounded-full bg-fill px-2 py-0.5 text-[11px] text-ink-2">
                      unconfirmed
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-2">{ago(u.joined)}</td>
                <td className="px-3 py-3 text-ink-2 capitalize">
                  {u.provider}
                </td>
                <td className="px-3 py-3 text-ink-2">{ago(u.last_sign_in)}</td>
                <td className="px-3 py-3 text-right">{u.workouts}</td>
                <td className="px-3 py-3 text-ink-2">{ago(u.last_workout)}</td>
                <td className="px-3 py-3 text-right">{u.ai_30d}</td>
                <td className="px-4 py-3">
                  {u.consent ? (
                    <Icon name="check" size={16} className="text-accent" />
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[13px] text-ink-3">
        Aggregates and account metadata only. Workout contents stay private.
        Every visit to this page is logged.
      </p>
    </main>
  );
}

/** How far new people get, step by step (test accounts excluded). */
function Funnel({ f }: { f: NonNullable<Stats["funnel"]> }) {
  const steps: [string, number][] = [
    ["Signed up", f.signed_up],
    ["Accepted terms", f.consented],
    ["Logged a first set", f.first_set],
    ["Used dictation", f.dictated],
    ["Finished a workout", f.finished],
    ["Came back (3+ workouts)", f.returning],
  ];
  const top = Math.max(1, f.signed_up);
  return (
    <section>
      <h2 className="mt-8 mb-3 text-[15px] font-semibold text-ink-2">Getting started (activation funnel)</h2>
      <div className="space-y-2 rounded-[20px] border border-line bg-card p-4 shadow-card">
        {steps.map(([label, n]) => (
          <div key={label} className="flex items-center gap-3 text-[14px]">
            <span className="w-48 shrink-0 text-ink-2">{label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-fill">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / top) * 100}%` }} />
            </span>
            <span className="tnum w-20 shrink-0 text-end">
              {n} <span className="text-ink-3">({Math.round((n / top) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
