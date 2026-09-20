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
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Not found — Stomp Lab</title>
<style>html,body{margin:0;min-height:100%;background:#0b0d12;color:#f3efe6;font-family:Archivo,system-ui,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:2rem;text-align:center}p.k{letter-spacing:.28em;font-size:11px;text-transform:uppercase;color:#5ce1e6}h1{font-size:clamp(1.8rem,5vw,2.6rem);letter-spacing:-.04em;font-weight:600}a{color:#3d7eff}</style></head>
<body><main><div><p class="k">Stomp Lab</p><h1>This page isn’t here.</h1><p><a href="/">Back to the Lab</a></p></div></main></body></html>`,
    {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": SCANNER_CACHE,
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
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
