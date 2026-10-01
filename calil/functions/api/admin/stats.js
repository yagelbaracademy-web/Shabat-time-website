// GET /api/admin/stats — dashboard numbers for admins only.
// Anyone else gets a plain 404, so the endpoint doesn't reveal that it exists.
import { getUser, isAdmin, json, service } from "../../../server/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !isAdmin(user, env)) return json({ error: "not found" }, 404);

  // Log privileged access (who and when).
  await service(env, "/rest/v1/admin_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ admin_id: user.id, action: "view_stats" }),
  }).catch(() => {});

  const [r, u] = await Promise.all([
    service(env, "/rest/v1/rpc/admin_stats", { method: "POST", body: "{}" }),
    service(env, "/rest/v1/rpc/admin_insights", { method: "POST", body: JSON.stringify({ with_me: new URL(request.url).searchParams.get("me") !== "0" }) }).catch(() => null),
  ]);
  if (!r.ok) return json({ error: "stats unavailable" }, 502);
  const stats = await r.json();
  stats.insights = u && u.ok ? await u.json() : null;
  return new Response(JSON.stringify(stats), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
