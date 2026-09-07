/**
 * Cheap request-budget helpers: drop scanner / unknown paths before SSR so
 * they never render the Lab, and fingerprint payloads so sync effects do not loop.
 */

const APP_DOCUMENTS = new Set([
  "/",
  "/catalog",
  "/create",
  "/gear",
  "/history",
  "/equivalents",
  "/guide",
  "/login",
  "/upgrade",
  "/account",
  "/admin",
  "/settings",
]);

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

const ABUSE_UA =
  /(?:curl|wget|python-requests|python-urllib|go-http-client|libwww|scrapy|httpx|nuclei|sqlmap|nikto|masscan|zgrab|censys|shodan|bytespider|petalbot|semrush|ahrefs|dotbot|gptbot|ccbot|claudebot|amazonbot|aiohttp|okhttp|java\/|php\/|scanner|fuzz|exploit|masscan)/i;

const FRIENDLY_UA =
  /Googlebot|bingbot|DuckDuckBot|Applebot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|WhatsApp|Telegram/i;

/** Scanner 404s can live on the CDN all day. No SWR — that doubled origin hits. */
export const SCANNER_CACHE = "public, max-age=86400, s-maxage=86400";

export function normalizePath(pathname: string): string {
  const raw = String(pathname ?? "").split("?")[0] || "/";
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    path = raw;
  }
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

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

export function isAppDocumentPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (APP_DOCUMENTS.has(path)) return true;
  if (path.startsWith("/preset/")) return true;
  return false;
}

/** True = return a cached 404 and never run React SSR. */
export function isCheap404Path(pathname: string): boolean {
  if (isScannerPath(pathname)) return true;
  const path = normalizePath(pathname);
  if (path.startsWith("/api/")) return false;
  if (path.startsWith("/__grok/")) return false;
  if (path.startsWith("/auth/")) return false;
  if (/\.[a-zA-Z0-9]{1,8}$/.test(path)) return false;
  if (isAppDocumentPath(path)) return false;
  return true;
}

export function isAbuseUserAgent(ua: string | null | undefined): boolean {
  const s = String(ua ?? "");
  if (!s) return false;
  if (FRIENDLY_UA.test(s)) return false;
  return ABUSE_UA.test(s);
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
