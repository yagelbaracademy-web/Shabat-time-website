# Calil

> Logging your workout should never interrupt your workout.

A minimalist workout notebook, built as an installable PWA.
Live at **https://calil.yagelbar.com**

## Stack

- Next.js 16 (App Router, `output: "export"`, fully static), React 19, TypeScript, Tailwind CSS 4
- Supabase Auth + Postgres, called straight from the browser and protected by row-level security
- One runtime dependency besides React/Next: `@supabase/supabase-js`

Because the app is static, it can be hosted on any CDN (Cloudflare Pages today, Vercel works as-is).
The database stays separate in Supabase.

## How it works

| Piece | Where |
|---|---|
| Local-first store + offline outbox | `src/lib/store.ts` |
| Domain actions (sets, workouts, plans, rest timer) | `src/lib/actions.ts` |
| Progress, PRs, month stats (pure functions) | `src/lib/stats.ts` |
| Speech-to-text provider (swappable) | `src/lib/speech/provider.ts` |
| Sentence → set parser (swappable) | `src/lib/speech/parser.ts` |
| Applying a dictated sentence to the workout | `src/lib/speech/apply.ts` |
| Auth helpers (Google, email, reset) | `src/lib/auth.ts` |
| Schema, RLS, seed | `supabase/schema.sql`, `supabase/seed.sql` |

**Data flow.** All of a user's rows are loaded into memory and cached in `localStorage`, so every
screen renders instantly and every edit is optimistic. Each change is recorded in a persistent
outbox (table + row id) and upserted to Supabase in the background. Row ids are generated on the
client, so replays are idempotent. If the connection drops mid-workout, the queue waits and
flushes when the device is back online; nothing is ever saved with a button.

**Dictation.** The MVP uses the browser's free Web Speech API and a rule-based parser (English and
Hebrew). Both sit behind interfaces (`SpeechProvider`, `WorkoutParser`), so a hosted STT model or an
LLM parser can replace them without touching the UI. Where speech isn't supported, the same bar
accepts typed sentences.

## Develop

```bash
cp .env.example .env.local   # fill in the Supabase URL + anon key
npm install
npm run dev
```

## Database

Run `supabase/schema.sql` then `supabase/seed.sql` on a fresh Supabase project.

Auth settings to set in Supabase:
- Site URL: `https://calil.yagelbar.com`
- Redirect URLs: `http://localhost:3000/**`, `https://calil.yagelbar.com/**`

### Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (Web).
2. Authorized redirect URI: `https://csndsvkaiwyztrjykfwq.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google: paste the client ID and secret, enable.

### Apple sign-in (later)

Enable Apple in Supabase, then add `"apple"` to `OAUTH_PROVIDERS` in `src/lib/auth.ts`.

## Deploy

```bash
npm run deploy   # next build + wrangler pages deploy out (Cloudflare Pages project "calil")
```

Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment.
On Vercel: import the repo, set the two `NEXT_PUBLIC_SUPABASE_*` variables, deploy.

## Ready for later (not in the UI)

The schema and store are shaped so these can be added without migrations of existing data:
Apple Health / Health Connect import (workouts carry their own timestamps and duration),
body-weight and recovery tables keyed by `user_id`, AI questions or summaries over
`stats.ts` output, and Apple Sign-In.
