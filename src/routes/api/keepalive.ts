import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Once-a-day ping so a free Supabase project does not pause after 7 idle days.
 * Vercel Hobby only allows a daily cron — that is enough (pause is 7 days, not hours).
 * Preview deploys never hit production Postgres.
 */
function authorized(request: Request) {
  const cron = request.headers.get("x-vercel-cron");
  if (cron) return true;
  const secret = (process.env.CRON_SECRET ?? process.env.KEEPALIVE_SECRET ?? "").trim();
  if (!secret) return process.env.VERCEL_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function ping() {
  if (process.env.VERCEL_ENV === "preview") {
    return Response.json({ ok: true, skipped: "preview" });
  }
  const sql = await getSql();
  const rows = await sql<{ ok: number }>`select 1::int as ok`;
  return Response.json({
    ok: rows[0]?.ok === 1,
    at: new Date().toISOString(),
  });
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
