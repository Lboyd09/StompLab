import { PUBLIC_SUPPORT_EMAIL } from "./plan";
import { RESET_TOKEN_MINUTES } from "./password-policy";

function envFirst(...keys: string[]): string {
  for (const k of keys) {
    const v = (process.env[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

export function mailerConfigured(): boolean {
  return Boolean(envFirst("RESEND_API_KEY", "SMTP_URL", "SMTP_PASS"));
}

export function mailFrom(): string {
  const from = envFirst("MAIL_FROM", "EMAIL_FROM");
  if (from) return from;
  return `Stomp Lab <${PUBLIC_SUPPORT_EMAIL}>`;
}

export async function sendPasswordResetEmail(opts: { to: string; url: string }): Promise<void> {
  const to = opts.to.trim().toLowerCase();
  if (!to.includes("@")) throw new Error("That email doesn't look right.");
  if (!mailerConfigured()) {
    throw new Error(
      `Password reset mail is not on yet. Email ${PUBLIC_SUPPORT_EMAIL} and we will reset you.`,
    );
  }

  const subject = "Reset your Stomp Lab password";
  const text = [
    "Reset your Stomp Lab password with this link:",
    opts.url,
    "",
    `This link expires in ${RESET_TOKEN_MINUTES} minutes. If you didn't ask for it, ignore this email — your password stays the same.`,
  ].join("\n");
  const html = `<p>Reset your Stomp Lab password:</p>
<p><a href="${opts.url.replace(/"/g, "")}">Choose a new password</a></p>
<p>This link expires in ${RESET_TOKEN_MINUTES} minutes. If you didn't ask for it, ignore this email — your password stays the same.</p>`;

  const resend = envFirst("RESEND_API_KEY");
  if (resend) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      throw new Error("Could not send the reset email. Try again in a minute.");
    }
    return;
  }

  throw new Error(
    `Password reset mail is not on yet. Email ${PUBLIC_SUPPORT_EMAIL} and we will reset you.`,
  );
}
