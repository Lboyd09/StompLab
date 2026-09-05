import { createFileRoute } from "@tanstack/react-router";
import { getSql, pingDatabase } from "@/lib/db";

/**
 * Once-a-day ping so a free Supabase project does not pause after 7 idle days.
 * Touches real tables (user + rig_cache), not only `select 1`, and retries
 * once so a cold project can wake. Preview deploys never hit production Postgres.
 */
function authorized(request: Request) {
  const cron = request.headers.get("x-vercel-cron");
  if (cron) return true;
  const secret = (process.env.CRON_SECRET ?? process.env.KEEPALIVE_SECRET ?? "").trim();
  if (!secret) return process.env.VERCEL_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pingOnce() {
  const ping = await pingDatabase();
  if (!ping.ok) {
    return { ...ping, users: 0, cache: 0 };
  }
  const sql = await getSql();
  const users = await sql.query<{ n: number }>(`select count(*)::int as n from "user"`);
  const cache = await sql.query<{ n: number }>(`select count(*)::int as n from rig_cache`);
  return {
    ...ping,
    users: Number(users[0]?.n ?? 0),
    cache: Number(cache[0]?.n ?? 0),
  };
}

async function ping() {
  if (process.env.VERCEL_ENV === "preview") {
    return Response.json({ ok: true, skipped: "preview" });
  }
  let last: Awaited<ReturnType<typeof pingOnce>> | null = null;
  let lastErr = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      last = await pingOnce();
      if (last.ok) {
        return Response.json({
          ok: true,
          users: last.users,
          cache: last.cache,
          source: last.source,
          mode: last.mode,
          host: last.host,
          ms: last.pingMs,
          attempt,
          at: new Date().toISOString(),
        });
      }
      lastErr = last.error;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    if (attempt < 2) await sleep(1500);
  }
  return Response.json(
    {
      ok: false,
      error: lastErr || last?.error || "keepalive failed",
      ms: last?.pingMs ?? 0,
      at: new Date().toISOString(),
    },
    { status: 503 },
  );
}

export const Route = createFileRoute("/api/keepalive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("unauthorized", { status: 401 });
        try {
          return await ping();
        } catch (err) {
          const message = err instanceof Error ? err.message : "keepalive failed";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
