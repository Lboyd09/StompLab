/**
 * Runs before SSR. Scanner probes get a cached 404 instead of a full Lab
 * render. Anonymous HTML is cacheable at the edge so repeat hits skip the
 * function. Does not change signed-in client data (session/plan still fetch).
 */
import { isDocumentPath } from "../../scripts/grok-pwa-shared.mjs";
import { isScannerPath, PUBLIC_HTML_CACHE, SCANNER_CACHE } from "../../src/lib/edge-budget";

interface EdgeEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function edgeBudgetMiddleware(
  event: EdgeEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  const path = event.url.pathname;

  if (method === "GET" && isScannerPath(path)) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": SCANNER_CACHE,
      },
    });
  }

  const result = await next();
  if (method !== "GET" || !(result instanceof Response)) return result;
  if (result.status !== 200) return result;
  if (result.headers.get("set-cookie")) return result;
  if (path.startsWith("/api/")) return result;

  const type = String(result.headers.get("content-type") ?? "");
  const isHtml = type.includes("text/html") && isDocumentPath(path);
  const isManifest = path === "/__grok/manifest.webmanifest" || path === "/__grok/manifest.json";
  if (!isHtml && !isManifest) return result;

  const headers = new Headers(result.headers);
  headers.set("cache-control", isManifest ? "public, max-age=3600" : PUBLIC_HTML_CACHE);
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}
