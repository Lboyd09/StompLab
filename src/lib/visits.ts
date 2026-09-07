import { randomBytes } from "node:crypto";

export const VISITOR_COOKIE = "sl_vid";

export function isVisitorId(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{16,64}$/.test(value));
}

export function mintVisitorId(): string {
  return randomBytes(16).toString("base64url");
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("=").trim());
  }
  return null;
}
