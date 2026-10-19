import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { isAbuseUserAgent } from "@/lib/edge-budget";
import { isOwnerAccount } from "@/lib/plan";
import { clientIpFrom, rateLimited } from "@/lib/rate-limit";

/**
 * Download beacon for the admin funnel. Stores the kind and the signed-in user
 * id (empty when signed out). No email, no IP, no song.
 */
const KINDS = new Set(["download"]);

function noContent() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function record(request: Request) {
  if (isAbuseUserAgent(request.headers.get("user-agent"))) return noContent();
  let kind = "download";
  try {
    const body = (await request.text()).slice(0, 200);
    if (body) {
      const parsed = JSON.parse(body) as { kind?: unknown };
      if (typeof parsed.kind === "string") kind = parsed.kind;
    }
  } catch {
    /* empty or junk body: default kind */
  }
  if (!KINDS.has(kind)) return noContent();
  let userId = "";
  try {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    if (user && isOwnerAccount(user.email)) return noContent();
    userId = user?.id ?? "";
  } catch {
    /* signed out or auth off: anonymous */
  }
  const who = userId || `ip:${clientIpFrom(request.headers)}`;
  if (await rateLimited(getSql, `evt:${kind}:${who}`, 30, 3600)) return noContent();
  try {
    const sql = await getSql();
    await sql.query(`insert into download_events (user_id, kind) values ($1, $2)`, [userId, kind]);
  } catch {
    /* table may not exist yet */
  }
  return noContent();
}

export const Route = createFileRoute("/api/event")({
  server: {
    handlers: {
      POST: async ({ request }) => record(request),
      GET: async () => noContent(),
    },
  },
});
