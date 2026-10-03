// Calil watchdog: every 5 minutes, checks that the app's backend answers.
// If the database is down on two checks in a row, restarts the Supabase project
// (at most once per 30 minutes) and emails the owner. Emails again when it's back.
// The regular check also keeps the free Supabase project from pausing for inactivity.

const PROJECT = "csndsvkaiwyztrjykfwq";
const SB = `https://${PROJECT}.supabase.co`;

async function backendUp(env) {
  try {
    const r = await fetch(`${SB}/rest/v1/exercises?select=id&limit=1`, {
      headers: { apikey: env.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(15000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function email(env, subject, text) {
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Calil watchdog", email: "calil@yagelbar.com" },
      to: [{ email: env.ALERT_EMAIL }],
      subject,
      textContent: text,
    }),
  }).catch(() => {});
}

async function check(env) {
  const state = JSON.parse((await env.STATE.get("state")) ?? "{}");
  let up = await backendUp(env);
  if (!up) {
    await new Promise((r) => setTimeout(r, 20000)); // a blip isn't an outage
    up = await backendUp(env);
  }
  const now = Date.now();

  if (up) {
    if (state.down) {
      await email(env, "Calil is back up", `The app answers again (down since ${new Date(state.down).toISOString()}).`);
    }
    await env.STATE.put("state", JSON.stringify({ lastOk: now }));
    return "up";
  }

  const next = { ...state, down: state.down ?? now };
  const canRestart = !state.restartedAt || now - state.restartedAt > 30 * 60 * 1000;
  if (canRestart) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/restart`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.SUPABASE_PAT}` },
    }).catch(() => null);
    next.restartedAt = now;
    await email(
      env,
      "Calil is down: restarting the database",
      `The app's backend did not answer on two checks 20 seconds apart. ` +
        `The watchdog asked Supabase to restart the project (${r ? r.status : "request failed"}). ` +
        `You'll get another email when it's back. If it isn't back within 30 minutes, check https://status.supabase.com and the Supabase dashboard.`,
    );
  }
  await env.STATE.put("state", JSON.stringify(next));
  return canRestart ? "down, restarted" : "down, waiting";
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(check(env));
  },
  // Manual check: GET with ?key=<WATCHDOG_KEY>
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.WATCHDOG_KEY || url.searchParams.get("key") !== env.WATCHDOG_KEY) return new Response("not found", { status: 404 });
    if (url.searchParams.get("test") === "email") {
      await email(env, "Calil watchdog is on", "This is a test. You'll get an email like this only if the app goes down and when it comes back.");
      return new Response("sent");
    }
    return new Response(await check(env));
  },
};
