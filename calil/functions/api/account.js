// DELETE /api/account — permanently deletes the signed-in user's account.
// Every table references auth.users with ON DELETE CASCADE, so all their data goes with it.
// Profile photos in Storage are removed explicitly.
import { getUser, json } from "../../server/auth.js";

export async function onRequestDelete({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  // Photos live in Storage, which doesn't cascade with the user: remove them first.
  const list = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/avatars`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: user.id, limit: 1000 }),
  }).then((x) => (x.ok ? x.json() : [])).catch(() => []);
  const paths = (Array.isArray(list) ? list : []).map((f) => `${user.id}/${f.name}`);
  if (paths.length) {
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/avatars`, {
      method: "DELETE",
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
    }).catch(() => {});
  }

  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "DELETE",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!r.ok) return json({ error: "could not delete" }, 502);
  return json({ ok: true });
}
