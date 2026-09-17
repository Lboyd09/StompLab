import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { mailerConfigured, mailFrom, mailerLastError } from "@/lib/mailer";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";
import { publicOrigin } from "@/lib/site-origin";

export const resetMailStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: mailerConfigured(),
  from: mailerConfigured() ? mailFrom() : "",
  support: PUBLIC_SUPPORT_EMAIL,
  lastError: mailerLastError(),
}));

export const requestResetMail = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ email: z.string().min(3).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) return { ok: false, error: "That email doesn't look right." };
    if (!mailerConfigured()) {
      return {
        ok: false,
        error: `Reset mail isn't connected on this site yet. Email ${PUBLIC_SUPPORT_EMAIL} and we'll reset you.`,
      };
    }
    const origin = await publicOrigin();
    const redirectTo = `${origin.replace(/\/$/, "")}/reset-password`;
    try {
      const api = auth.api as {
        requestPasswordReset?: (opts: { body: { email: string; redirectTo: string } }) => Promise<unknown>;
        forgetPassword?: (opts: { body: { email: string; redirectTo: string } }) => Promise<unknown>;
      };
      if (typeof api.requestPasswordReset === "function") {
        await api.requestPasswordReset({ body: { email, redirectTo } });
      } else if (typeof api.forgetPassword === "function") {
        await api.forgetPassword({ body: { email, redirectTo } });
      } else {
        return { ok: false, error: `Could not start a reset. Email ${PUBLIC_SUPPORT_EMAIL}.` };
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/not on yet|mailer|resend|from-address|verified/i.test(msg)) {
        return { ok: false, error: msg };
      }
      return { ok: false, error: `Could not send the reset email. Email ${PUBLIC_SUPPORT_EMAIL} if it keeps failing.` };
    }
  });
