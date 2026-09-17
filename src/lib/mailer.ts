import { PUBLIC_SUPPORT_EMAIL } from "./plan";
import { RESET_TOKEN_MINUTES } from "./password-policy";
import { publicOrigin } from "./site-origin";

function envFirst(...keys: string[]): string {
  for (const k of keys) {
    const v = (process.env[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

export function mailerConfigured(): boolean {
  return Boolean(envFirst("RESEND_API_KEY"));
}

let lastMailError = "";

export function mailerLastError(): string {
  return lastMailError;
}

export function mailFrom(): string {
  const from = envFirst("MAIL_FROM", "EMAIL_FROM");
  if (from) return from;
  return "Stomp Lab <onboarding@resend.dev>";
}

function fromLooksUnverified(from: string): boolean {
  const lower = from.toLowerCase();
  return lower.includes("@gmail.com") || lower.includes("@icloud.com") || lower.includes("@yahoo.");
}

async function absoluteResetUrl(url: string): Promise<string> {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = (await publicOrigin()).replace(/\/$/, "");
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/reset-password`;
}

export async function sendPasswordResetEmail(opts: { to: string; url: string }): Promise<void> {
  const to = opts.to.trim().toLowerCase();
  if (!to.includes("@")) throw new Error("That email doesn't look right.");
  if (!mailerConfigured()) {
    lastMailError = "RESEND_API_KEY is missing";
    throw new Error(
      `Password reset mail is not on yet. Email ${PUBLIC_SUPPORT_EMAIL} and we will reset you.`,
    );
  }

  const link = await absoluteResetUrl(opts.url);
  const subject = "Reset your Stomp Lab password";
  const text = [
    "Reset your Stomp Lab password with this link:",
    link,
    "",
    `This link expires in ${RESET_TOKEN_MINUTES} minutes. If you didn't ask for it, ignore this email — your password stays the same.`,
  ].join("\n");
  const html = `<p>Reset your Stomp Lab password:</p>
<p><a href="${link.replace(/"/g, "")}">Choose a new password</a></p>
<p>This link expires in ${RESET_TOKEN_MINUTES} minutes. If you didn't ask for it, ignore this email — your password stays the same.</p>`;

  const resend = envFirst("RESEND_API_KEY");
  const froms = [mailFrom(), "Stomp Lab <onboarding@resend.dev>"].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  if (fromLooksUnverified(froms[0] ?? "")) {
    froms.reverse();
  }

  let last = "Could not send the reset email. Try again in a minute.";
  for (const from of froms) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (res.ok) {
      lastMailError = "";
      return;
    }
    const body = await res.json().catch(() => ({}));
    const msg =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: string }).message ?? "")
        : "";
    if (/domain|verified|from/i.test(msg)) {
      last = "Reset mail's from-address isn't verified on Resend. Set MAIL_FROM to an address on stomplab.app.";
      continue;
    }
    last = msg || last;
  }
  lastMailError = last;
  throw new Error(last);
}
