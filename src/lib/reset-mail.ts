import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { emailHoldStatus } from "@/lib/closed-accounts";
import { MAIL_UNAVAILABLE } from "@/lib/mailer";
import { rateLimited, currentClientIp } from "@/lib/rate-limit";
import { getSql } from "@/lib/db";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";
import { publicOrigin } from "@/lib/site-origin";

export const requestResetMail = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ email: z.string().min(3).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) return { ok: false, error: "That email doesn't look right." };
    // Better Auth's own limiter does not cover this wrapper. 3 per 15 minutes
    // for an address, 10 for a network address.
    const ip = await currentClientIp();
    if (
      (await rateLimited(getSql, `reset:email:${email}`, 3, 15 * 60)) ||
      (await rateLimited(getSql, `reset:ip:${ip}`, 10, 15 * 60))
    ) {
      return { ok: false, error: "We just sent a reset email. Check your inbox, or try again in a few minutes." };
    }
    const hold = await emailHoldStatus(email);
    if (hold.blocked) return { ok: false, error: hold.message };
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
      console.error("[auth] reset mail failed", err instanceof Error ? err.message : err);
      return { ok: false, error: MAIL_UNAVAILABLE };
    }
  });
