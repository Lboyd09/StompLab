const ALLOWED = ["/", "/upgrade", "/create", "/history", "/admin", "/catalog", "/gear", "/settings"] as const;
export type NextPath = (typeof ALLOWED)[number];

export function parseNext(s?: string): NextPath {
  if (s && (ALLOWED as readonly string[]).includes(s)) return s as NextPath;
  return "/";
}
