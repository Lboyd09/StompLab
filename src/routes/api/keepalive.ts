import { createFileRoute } from "@tanstack/react-router";
import { cronAuthorized } from "@/lib/cron-auth";
import { getSql, pingDatabase } from "@/lib/db";

/**
 * Once-a-day ping so a free Supabase project does not pause after 7 idle days.
 * Touches user + rig_cache with `limit 1` so it does not count whole tables
 * (that burned egress). Preview deploys never hit production Postgres.
 * Needs `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends it). The reply
 * is only ok true or false.
 */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pingOnce(): Promise<boolean> {
  const ping = await pingDatabase();
  if (!ping.ok) return false;
  const sql = await getSql();
  await sql.query(`select 1 from "user" limit 1`);
  await sql.query(`select 1 from rig_cache limit 1`);
  return true;
}

async function ping() {
  if (process.env.VERCEL_ENV === "preview") {
    return Response.json({ ok: true });
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      if (await pingOnce()) return Response.json({ ok: true });
    } catch (err) {
      console.error("[keepalive] ping failed", err instanceof Error ? err.message : err);
    }
    if (attempt < 2) await sleep(1500);
  }
  return Response.json({ ok: false }, { status: 503 });
}

export const Route = createFileRoute("/api/keepalive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
        try {
          return await ping();
        } catch (err) {
          console.error("[keepalive] failed", err instanceof Error ? err.message : err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
