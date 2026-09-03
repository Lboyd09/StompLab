const ALLOWED = ["/", "/upgrade", "/create", "/history", "/admin", "/catalog", "/gear", "/settings", "/account"] as const;
export type NextPath = (typeof ALLOWED)[number];

export function parseNext(s?: string): NextPath {
  if (!s) return "/";
  const path = s.split("?")[0];
  if ((ALLOWED as readonly string[]).includes(path)) return path as NextPath;
  return "/";
}

export function parseCheckoutId(s?: string): string | undefined {
  const v = (s ?? "").trim();
  if (v.length < 4 || v.length > 120) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return undefined;
  return v;
}
