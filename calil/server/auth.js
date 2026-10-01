// Shared by the Pages Functions (bundled in by wrangler; not a route itself).

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The signed-in Supabase user behind the request's bearer token, or null. */
export async function getUser(request, env) {
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!r.ok) return null;
  const user = await r.json();
  return { id: user.id, email: user.email, auth };
}

/** Daily AI allowance per user, so no single account can run up the bill. */
export const LIMITS = { dictate: 300, import: 20 };

/** Counts one call; false when the user is over today's limit. Fails open if the counter is unreachable. */
export async function takeQuota(user, kind, env) {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ai_take`, {
      method: "POST",
      headers: { Authorization: user.auth, apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_limit: LIMITS[kind] }),
    });
    if (!r.ok) return true;
    return (await r.json()) === true;
  } catch {
    return true;
  }
}

/** Counts a failed AI call (for the admin dashboard). Never throws. */
export async function markFailed(user, kind, env) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ai_fail`, {
      method: "POST",
      headers: { Authorization: user.auth, apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind }),
    });
  } catch {}
}

/** Admins are listed by email in the ADMIN_EMAILS secret (comma separated). */
export function isAdmin(user, env) {
  const list = String(env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!user?.email && list.includes(user.email.toLowerCase());
}

/** Calls Supabase with the service role. Server only. */
export function service(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
