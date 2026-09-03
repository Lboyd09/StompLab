/**
 * Public origin for Polar returns, auth trusted hosts, and docs.
 * Follows the request Host so a custom domain works without a rebuild.
 * Never invent an Amazon tag or Polar product id here.
 */

function env(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[key]?.trim();
  return v ? v : undefined;
}

export function hostFromRaw(raw?: string | null): string {
  const v = (raw ?? "").trim().split(",")[0].trim();
  if (!v) return "";
  try {
    const u = v.includes("://") ? new URL(v) : new URL(`https://${v}`);
    return u.hostname.toLowerCase();
  } catch {
    return v
      .replace(/^https?:\/\//i, "")
      .replace(/[:/].*$/, "")
      .toLowerCase();
  }
}

export function isLoopbackHost(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(host);
}

export function isPublicHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  if (!h || isLoopbackHost(h)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  if (h.endsWith(".grok-sandbox.com") || h.endsWith(".vercel.app")) return true;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(h);
}

const KNOWN_HOSTS = [
  "stomplab.vercel.app",
  "stomplab.com",
  "www.stomplab.com",
  "stomplab.app",
  "www.stomplab.app",
];

function withWwwAliases(hosts: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const raw of hosts) {
    const h = raw.trim().toLowerCase();
    if (!h) continue;
    out.add(h);
    if (h.startsWith("*.")) continue;
    if (h.startsWith("www.")) out.add(h.slice(4));
    else if (h.includes(".") && !h.endsWith(".vercel.app") && !h.endsWith(".grok-sandbox.com")) {
      out.add(`www.${h}`);
    }
  }
  return [...out];
}

export function configuredAuthHosts(): string[] {
  const hosts = new Set<string>(KNOWN_HOSTS);
  const add = (raw?: string | null) => {
    const h = hostFromRaw(raw);
    if (h) hosts.add(h);
  };
  add(env("BETTER_AUTH_URL"));
  add(env("APP_ORIGIN"));
  add(env("SITE_URL"));
  add(env("POLAR_SUCCESS_ORIGIN"));
  add(env("VERCEL_PROJECT_PRODUCTION_URL"));
  add(env("VERCEL_URL"));
  for (const part of (env("EXTRA_AUTH_HOSTS") ?? "").split(/[,\s]+/)) add(part);
  hosts.add("*.vercel.app");
  return withWwwAliases(hosts);
}

export function configuredAuthOrigins(): string[] {
  return configuredAuthHosts().flatMap((h) => {
    if (h.startsWith("*.")) return [`https://${h}`, `http://${h}`];
    return [`https://${h}`];
  });
}

const FALLBACK_ORIGIN = "https://stomplab.vercel.app";

export async function publicOrigin(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const host = hostFromRaw(req?.headers.get("x-forwarded-host") || req?.headers.get("host"));
    if (isPublicHostname(host)) return `https://${host}`;
  } catch {
    /* preview / no request */
  }
  const fromEnv = env("APP_ORIGIN") || env("SITE_URL") || env("POLAR_SUCCESS_ORIGIN") || env("BETTER_AUTH_URL");
  if (fromEnv?.startsWith("http")) return fromEnv.replace(/\/$/, "");
  const vercel = env("VERCEL_PROJECT_PRODUCTION_URL") || env("VERCEL_URL");
  if (vercel) return `https://${hostFromRaw(vercel)}`;
  return FALLBACK_ORIGIN;
}
