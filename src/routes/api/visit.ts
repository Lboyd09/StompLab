import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { isAbuseUserAgent } from "@/lib/edge-budget";
import { isVisitorId, mintVisitorId, readCookie, VISITOR_COOKIE } from "@/lib/visits";

function noContent(setCookie?: string) {
  const headers = new Headers({
    "cache-control": "no-store",
  });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(null, { status: 204, headers });
}

async function record(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (isAbuseUserAgent(ua)) return noContent();
  const existing = readCookie(request.headers.get("cookie"), VISITOR_COOKIE);
  const id = isVisitorId(existing) ? existing : mintVisitorId();
  const secure = (request.headers.get("x-forwarded-proto") ?? "https").includes("https");
  const cookie = `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
  try {
    const sql = await getSql();
    await sql.query(
      `insert into site_visits (day, visitor_key, hits)
       values (current_date, $1, 1)
       on conflict (day, visitor_key) do update set hits = site_visits.hits + 1`,
      [id],
    );
  } catch {
    /* table may not exist yet */
  }
  return noContent(isVisitorId(existing) ? undefined : cookie);
}

export const Route = createFileRoute("/api/visit")({
  server: {
    handlers: {
      POST: async ({ request }) => record(request),
      GET: async () => noContent(),
    },
  },
});
