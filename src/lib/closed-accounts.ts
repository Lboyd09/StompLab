import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { sendLabEmail } from "@/lib/mailer";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";
import { canonicalEmail } from "@/lib/referral-code";
import { publicOrigin } from "@/lib/site-origin";

export const DELETE_HOLD_DAYS = 14;
export const DELETE_CONFIRM_HOURS = 24;

export async function ensureClosedAccountsSchema(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql.query(`
    create table if not exists closed_accounts (
      email_canonical text primary key,
      requested_at timestamptz not null default now(),
      confirmed_at timestamptz,
      recreate_after timestamptz not null,
      confirm_token text unique,
      status text not null default 'pending_email',
      user_id text
    )
  `).catch(() => undefined);
  await sql.query(`alter table closed_accounts add column if not exists user_id text`).catch(() => undefined);
  await sql.query(`alter table entitlements add column if not exists current_period_end timestamptz`).catch(() => undefined);
  await sql.query(`create index if not exists closed_accounts_token_idx on closed_accounts (confirm_token)`).catch(() => undefined);
}

export async function wipeUser(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const tables = [
    `delete from referral_redemptions where referred_user_id = $1 or referrer_user_id = $1`,
    `delete from referrals where user_id = $1`,
    `delete from entitlements where user_id = $1`,
    `delete from purchases where user_id = $1`,
    `delete from build_events where user_id = $1`,
    `delete from research_failures where user_id = $1`,
    `delete from user_gear where user_id = $1`,
    `delete from user_presets where user_id = $1`,
    `delete from feedback where user_id = $1`,
    `delete from affiliate_clicks where user_id = $1`,
    `delete from profiles where user_id = $1`,
    `delete from "session" where "userId" = $1`,
    `delete from "account" where "userId" = $1`,
    `delete from "user" where id = $1`,
  ];
  for (const q of tables) {
    try {
      await sql.query(q, [userId]);
    } catch {
      /* table or column missing on a stale host */
    }
  }
}

async function disableLogin(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  for (const q of [`delete from "session" where "userId" = $1`, `delete from "account" where "userId" = $1`]) {
    try {
      await sql.query(q, [userId]);
    } catch {
      /* ignore */
    }
  }
}

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type EmailHold = {
  blocked: boolean;
  status: string;
  recreateAfter: string | null;
  message: string;
};

function holdMessage(recreateAfter: Date): string {
  const when = recreateAfter.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `This email is on a 14-day hold after a delete. You can create a new account after ${when}.`;
}

export async function purgeExpiredClosedAccounts(): Promise<void> {
  try {
    const sql = await getSql();
    await ensureClosedAccountsSchema(sql);
    const due = await sql<{ email_canonical: string; user_id: string | null }>`
      select email_canonical, user_id from closed_accounts
      where recreate_after <= now() and status in ('held', 'pending_email')
    `;
    for (const row of due) {
      if (row.user_id) await wipeUser(sql, row.user_id);
      await sql`delete from closed_accounts where email_canonical = ${row.email_canonical}`;
    }
  } catch {
    /* preview / missing table */
  }
}

export async function emailHoldStatus(email: string | null | undefined): Promise<EmailHold> {
  const canon = canonicalEmail(email);
  const empty: EmailHold = { blocked: false, status: "", recreateAfter: null, message: "" };
  if (!canon.includes("@")) return empty;
  try {
    await purgeExpiredClosedAccounts();
    const sql = await getSql();
    await ensureClosedAccountsSchema(sql);
    const rows = await sql<{ status: string; recreate_after: Date | string }>`
      select status, recreate_after from closed_accounts where email_canonical = ${canon} limit 1
    `;
    const row = rows[0];
    if (!row) return empty;
    const until = new Date(row.recreate_after);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) return empty;
    if (row.status !== "held") return empty;
    return {
      blocked: true,
      status: row.status,
      recreateAfter: until.toISOString(),
      message: holdMessage(until),
    };
  } catch {
    return empty;
  }
}

/** Throws a user-facing error if this email cannot create an account. */
export async function assertEmailCanSignup(email: string | null | undefined): Promise<void> {
  const hold = await emailHoldStatus(email);
  if (hold.blocked) throw new Error(hold.message);
}

export async function requestDeleteHold(opts: {
  userId: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const canon = canonicalEmail(opts.email);
  if (!canon.includes("@")) return { ok: false, error: "This account has no email to confirm with." };
  const sql = await getSql();
  await ensureClosedAccountsSchema(sql);
  const token = newToken();
  const recreate = new Date(Date.now() + DELETE_HOLD_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    insert into closed_accounts (email_canonical, requested_at, recreate_after, confirm_token, status, user_id)
    values (${canon}, now(), ${recreate.toISOString()}::timestamptz, ${token}, ${"pending_email"}, ${opts.userId})
    on conflict (email_canonical) do update set
      requested_at = now(),
      recreate_after = excluded.recreate_after,
      confirm_token = excluded.confirm_token,
      status = ${"pending_email"},
      user_id = excluded.user_id,
      confirmed_at = null
  `;
  const origin = (await publicOrigin()).replace(/\/$/, "");
  const link = `${origin}/goodbye?token=${encodeURIComponent(token)}`;
  const subject = "Confirm you want to delete your Stomp Lab account";
  const text = [
    "You asked to delete your Stomp Lab account.",
    "",
    "Confirm here (expires in 24 hours):",
    link,
    "",
    `If you confirm, we keep the records for ${DELETE_HOLD_DAYS} days so this email cannot open a new free account, then we erase them. You cannot create a new account on this email until that hold ends.`,
    "",
    `If you did not ask for this, ignore the email — nothing is deleted. Help: ${PUBLIC_SUPPORT_EMAIL}.`,
  ].join("\n");
  const html = `<p>You asked to delete your Stomp Lab account.</p>
<p><a href="${link.replace(/"/g, "")}">Confirm account deletion</a></p>
<p>This link expires in ${DELETE_CONFIRM_HOURS} hours. If you confirm, we keep the records for ${DELETE_HOLD_DAYS} days so this email cannot open a new free account, then we erase them.</p>
<p>If the button does not open, paste this address into your browser:</p>
<p style="word-break:break-all;font-family:ui-monospace,monospace;font-size:13px">${link.replace(/</g, "")}</p>
<p>If you had a Polar subscription, the confirm page will send you to Polar to cancel billing. Canceling Polar by itself would leave the Lab account open.</p>
<p>If you did not ask for this, ignore the email — nothing is deleted.</p>`;
  await sendLabEmail({ to: canon, subject, text, html });
  return { ok: true };
}

export async function confirmDeleteHold(token: string): Promise<{
  ok: true;
  email: string;
  recreateAfter: string;
} | { ok: false; error: string }> {
  const t = token.trim();
  if (t.length < 16) return { ok: false, error: "That confirmation link is not valid." };
  const sql = await getSql();
  await ensureClosedAccountsSchema(sql);
  const rows = await sql<{
    email_canonical: string;
    user_id: string | null;
    requested_at: Date | string;
    status: string;
    recreate_after: Date | string;
  }>`
    select email_canonical, user_id, requested_at, status, recreate_after
    from closed_accounts
    where confirm_token = ${t}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "That confirmation link is invalid or already used." };
  if (row.status === "held") {
    return {
      ok: true,
      email: row.email_canonical,
      recreateAfter: new Date(row.recreate_after).toISOString(),
    };
  }
  const requested = new Date(row.requested_at).getTime();
  if (requested && Date.now() - requested > DELETE_CONFIRM_HOURS * 60 * 60 * 1000) {
    return { ok: false, error: "That confirmation link expired. Request delete again from Account." };
  }
  const recreate = new Date(Date.now() + DELETE_HOLD_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    update closed_accounts
    set status = ${"held"},
        confirmed_at = now(),
        recreate_after = ${recreate.toISOString()}::timestamptz,
        confirm_token = null
    where email_canonical = ${row.email_canonical}
  `;
  if (row.user_id) await disableLogin(sql, row.user_id);
  return { ok: true, email: row.email_canonical, recreateAfter: recreate.toISOString() };
}

/** Admin: hold + disable login without waiting for the confirmation email. */
export async function forceCloseAccount(email: string): Promise<
  { ok: true; email: string; userId: string | null; recreateAfter: string } | { ok: false; error: string }
> {
  const canon = canonicalEmail(email);
  if (!canon.includes("@")) return { ok: false, error: "That email doesn't look right." };
  const sql = await getSql();
  await ensureClosedAccountsSchema(sql);
  let userId: string | null = null;
  try {
    const users = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${email.trim().toLowerCase()} or lower(email) = ${canon} limit 1
    `;
    userId = users[0]?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return { ok: false, error: "No Lab account with that email." };
  const recreate = new Date(Date.now() + DELETE_HOLD_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    insert into closed_accounts (email_canonical, requested_at, confirmed_at, recreate_after, confirm_token, status, user_id)
    values (${canon}, now(), now(), ${recreate.toISOString()}::timestamptz, null, ${"held"}, ${userId})
    on conflict (email_canonical) do update set
      confirmed_at = now(),
      recreate_after = excluded.recreate_after,
      confirm_token = null,
      status = ${"held"},
      user_id = excluded.user_id
  `;
  await disableLogin(sql, userId);
  return { ok: true, email: canon, userId, recreateAfter: recreate.toISOString() };
}

export const checkEmailHold = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ email: z.string().min(3).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const hold = await emailHoldStatus(data.email);
    if (hold.blocked) return { ok: false, error: hold.message };
    return { ok: true };
  });
