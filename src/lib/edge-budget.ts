/**
 * Cheap request-budget helpers: drop scanner probes before SSR, cache public
 * HTML at the edge, and fingerprint payloads so sync effects do not loop.
 */

const SCANNER_PREFIXES = [
  "/wp-",
  "/wordpress",
  "/xmlrpc",
  "/phpmyadmin",
  "/adminer",
  "/cgi-bin",
  "/vendor/phpunit",
  "/actuator",
  "/server-status",
  "/server-info",
  "/autodiscover",
  "/owa",
  "/exchange",
  "/hnap1",
  "/manager/html",
  "/solr",
  "/jenkins",
  "/telescope",
  "/_profiler",
  "/debug/default",
  "/containers/json",
  "/latest/meta-data",
  "/boaform",
  "/setup.cgi",
];

const SCANNER_EXT = /\.(php|asp|aspx|cgi|jsp|env|sql|bak|old|py|rb)$/i;

/** Public HTML — bots and guests hit CDN instead of the render function. */
export const PUBLIC_HTML_CACHE = "public, s-maxage=120, stale-while-revalidate=600";
/** Scanner 404s can live on the CDN all day. */
export const SCANNER_CACHE = "public, max-age=86400, s-maxage=86400";

export function isScannerPath(pathname: string): boolean {
  const raw = String(pathname ?? "");
  if (!raw || raw === "/") return false;
  const path = raw.toLowerCase();
  if (path.startsWith("/.well-known/")) return false;
  if (SCANNER_EXT.test(path)) return true;
  if (path.startsWith("/.") || path.includes("/.")) return true;
  for (const prefix of SCANNER_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix)) return true;
  }
  return false;
}

export function jsonFingerprint(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function shouldPushSync(lastFingerprint: string, next: unknown): boolean {
  const nextFp = jsonFingerprint(next);
  return Boolean(nextFp) && nextFp !== lastFingerprint;
}
