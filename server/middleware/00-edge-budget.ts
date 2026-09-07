/**
 * Runs before SSR. Unknown and scanner paths get a cached 404 — never a Lab
 * render. Do not wrap successful HTML (that SWR cache-control doubled origin
 * hits). Real pages still SSR exactly once per navigation.
 */
import { isDocumentPath } from "../../scripts/grok-pwa-shared.mjs";
import { isAbuseUserAgent, isCheap404Path, SCANNER_CACHE } from "../../src/lib/edge-budget";

interface EdgeEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": SCANNER_CACHE,
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export default async function edgeBudgetMiddleware(
  event: EdgeEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();

  const path = event.url.pathname;
  if (isCheap404Path(path)) return notFound();

  const ua = event.req.headers.get("user-agent");
  if (isDocumentPath(path) && isAbuseUserAgent(ua)) return notFound();

  return next();
}
