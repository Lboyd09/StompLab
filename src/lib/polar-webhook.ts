import { createHmac, timingSafeEqual } from "node:crypto";

function hmacB64(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

export function verifyPolarWebhook(rawBody: string, headers: Headers): boolean {
  const secret = (process.env.POLAR_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return false;
  const sigHeader = headers.get("webhook-signature") ?? headers.get("x-polar-signature") ?? "";
  const id = headers.get("webhook-id") ?? "";
  const ts = headers.get("webhook-timestamp") ?? "";
  const signed = `${id}.${ts}.${rawBody}`;
  const expected = hmacB64(secret, signed);
  const parts = sigHeader.split(/[,\s]+/).map((p) => p.replace(/^v1=/, "").replace(/^v1,/, ""));
  for (const part of parts) {
    if (!part) continue;
    try {
      const a = Buffer.from(part);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      /* continue */
    }
  }
  try {
    const fallback = hmacB64(secret, rawBody);
    const a = Buffer.from(sigHeader.replace(/^v1[,=]/, ""));
    const b = Buffer.from(fallback);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  } catch {
    /* ignore */
  }
  return false;
}
