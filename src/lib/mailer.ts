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

const RESEND_KEYS = [
  "RESEND_API_KEY",
  "RESEND_KEY",
  "RESEND_TOKEN",
  "RESEND_SECRET",
  "RESEND_API_TOKEN",
] as const;

export function mailerConfigured(): boolean {
  return Boolean(envFirst(...RESEND_KEYS));
}

let lastMailError = "";

/** What a player sees when mail fails. The detail stays in the server log. */
export const MAIL_UNAVAILABLE = `We couldn't send that email right now. Try again in a minute, or email ${PUBLIC_SUPPORT_EMAIL}.`;

export function mailerLastError(): string {
  return lastMailError;
}

export function mailFrom(): string {
  const from = envFirst("MAIL_FROM", "EMAIL_FROM", "RESEND_FROM", "RESEND_FROM_EMAIL");
  if (from) return from;
  return "Stomp Lab <onboarding@resend.dev>";
}

function fromLooksUnverified(from: string): boolean {
  const lower = from.toLowerCase();
  return lower.includes("@gmail.com") || lower.includes("@icloud.com") || lower.includes("@yahoo.");
}

async function absoluteUrl(url: string, fallbackPath: string): Promise<string> {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = (await publicOrigin()).replace(/\/$/, "");
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}${fallbackPath}`;
}

export async function sendLabEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const to = opts.to.trim().toLowerCase();
  if (!to.includes("@")) throw new Error("That email doesn't look right.");
  const resend = envFirst(...RESEND_KEYS);
  if (!resend) {
    lastMailError = "Mail is not connected";
    console.error("[mail] no send key configured");
    throw new Error(MAIL_UNAVAILABLE);
  }

  const froms = [mailFrom(), "Stomp Lab <onboarding@resend.dev>"].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  if (fromLooksUnverified(froms[0] ?? "")) {
    froms.reverse();
  }

  let last = "Could not send the email";
  for (const from of froms) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
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
      last = "Sender address is not verified";
      continue;
    }
    if (/api key|unauthorized|invalid/i.test(msg)) {
      last = "Mail key was rejected";
      continue;
    }
    last = msg.slice(0, 160) || last;
  }
  lastMailError = last;
  console.error("[mail] send failed:", last);
  throw new Error(MAIL_UNAVAILABLE);
}

export async function sendVerificationEmailMessage(opts: { to: string; url: string }): Promise<void> {
  const link = await absoluteUrl(opts.url, "/");
  const subject = "Confirm your Stomp Lab account";
  const text = [
    "Confirm your email so you can build custom presets:",
    link,
    "",
    "If you didn't make a Stomp Lab account, ignore this email.",
  ].join("\n");
  const html = `<p>Confirm your email so you can build custom presets:</p>
<p><a href="${link.replace(/"/g, "")}">Confirm my account</a></p>
<p>If you didn't make a Stomp Lab account, ignore this email.</p>`;
  await sendLabEmail({ to: opts.to, subject, text, html });
}

export async function sendPasswordResetEmail(opts: { to: string; url: string }): Promise<void> {
  const link = await absoluteUrl(opts.url, "/reset-password");
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
  await sendLabEmail({ to: opts.to, subject, text, html });
}
