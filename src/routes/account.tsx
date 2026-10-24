import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { InviteCard } from "@/components/layout/invite-card";
import { authClient, authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { FORGOT_PASSWORD_COPY } from "@/lib/copy";
import {
  openCustomerPortal,
  cancelMySubscription,
  resumeMySubscription,
  switchMyPlanToYearly,
} from "@/lib/billing";
import { requestAccountDelete } from "@/lib/account-delete";
import {
  FREE_BUILDS,
  PRICE_MONTHLY_USD,
  PRICE_YEARLY_USD,
  firstMonthUsd,
  formatPeriodEnd,
  formatUsd,
  priceLine,
  quotaResetDate,
  subscriptionCanceled,
  subscriptionLapsed,
  type Plan,
} from "@/lib/plan";
import { getReferralMonthOffer } from "@/lib/referrals";
import { requestResetMail } from "@/lib/reset-mail";
import { MIN_PASSWORD_LENGTH, RESET_TOKEN_MINUTES } from "@/lib/password-policy";
import { DELETE_HOLD_DAYS } from "@/lib/closed-accounts";
import { usePlan } from "@/lib/use-plan";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/account")({ component: AccountPage });

const INCLUDED = [
  { to: "/setlist", label: "Setlists" },
  { to: "/gear", label: "Gear locker" },
  { to: "/create", label: "Create" },
  { to: "/catalog", label: "Pedal matching" },
] as const;

function buildsLeft(plan: Plan): number {
  if (plan.paid) return Math.max(0, plan.monthLimit - plan.monthUsed);
  return plan.freeRemaining;
}

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const { plan, refresh, isPending: planPending } = usePlan();
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchArmed, setSwitchArmed] = useState(false);
  const [cancelSheet, setCancelSheet] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteSent, setDeleteSent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  /** Which section the last message belongs to, so it shows next to the button that caused it. */
  const [where, setWhere] = useState<"plan" | "account" | "devices" | "delete">("plan");
  const [monthOff, setMonthOff] = useState(false);

  const userId = user?.id ?? "";
  const freePlan = !plan.paid && !plan.admin;
  useEffect(() => {
    if (!userId || !freePlan) return;
    let cancelled = false;
    void getReferralMonthOffer()
      .then((res) => {
        if (!cancelled && res.ok) setMonthOff(res.eligible);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, freePlan]);

  if (isPending || planPending) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader kicker="Account" title="Your Lab" />
        <div className="space-y-3" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" search={{ next: "/account" }} />;
  }

  const accountEmail = user.primaryEmail;

  async function onEmailReset() {
    setError("");
    setWhere("account");
    setMessage("");
    const email = accountEmail?.trim().toLowerCase();
    if (!email) {
      setError("This account has no email to send to.");
      return;
    }
    setBusy(true);
    try {
      const res = await requestResetMail({ data: { email } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(`Check ${email} for a reset link. It expires in ${RESET_TOKEN_MINUTES} minutes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email.");
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeOtherSessions() {
    setError("");
    setWhere("devices");
    setMessage("");
    setRevoking(true);
    try {
      const { error: err } = await authClient.revokeOtherSessions();
      if (err) {
        setError(err.message || "Could not sign out other devices.");
        return;
      }
      setMessage("Signed out every other device. This one stays signed in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out other devices.");
    } finally {
      setRevoking(false);
    }
  }

  async function onManageSubscription() {
    setError("");
    setWhere("plan");
    setMessage("");
    setPortalBusy(true);
    try {
      const res = await openCustomerPortal();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Polar.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function onCancelSubscription() {
    setError("");
    setWhere("plan");
    setMessage("");
    setCancelBusy(true);
    try {
      const res = await cancelMySubscription();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCancelSheet(false);
      setMessage(`Canceled. You keep the Lab until ${formatPeriodEnd(res.periodEnd ?? plan.currentPeriodEnd)}. Polar will not charge again.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function onResumeSubscription() {
    setError("");
    setWhere("plan");
    setMessage("");
    setResumeBusy(true);
    try {
      const res = await resumeMySubscription();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await refresh();
      setMessage("Resumed. Your plan renews as before.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume.");
    } finally {
      setResumeBusy(false);
    }
  }

  async function onSwitchToYearly() {
    setError("");
    setWhere("plan");
    setMessage("");
    if (!switchArmed) {
      setSwitchArmed(true);
      return;
    }
    setSwitchBusy(true);
    try {
      const res = await switchMyPlanToYearly();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCancelSheet(false);
      setSwitchArmed(false);
      await refresh();
      setMessage(`Switched to yearly: ${formatUsd(PRICE_YEARLY_USD)}/yr.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch the plan.");
    } finally {
      setSwitchBusy(false);
    }
  }

  const canceled = subscriptionCanceled(plan);
  const lapsed = plan.polarLinked && subscriptionLapsed(plan);
  const monthly = plan.paid && !plan.admin && plan.polarLinked && plan.planInterval === "month";
  const left = buildsLeft(plan);
  const cap = plan.paid ? plan.monthLimit : FREE_BUILDS + plan.bonusBuilds;

  const switchButton = monthly ? (
    <Button type="button" variant="secondary" disabled={switchBusy} onClick={() => void onSwitchToYearly()}>
      {switchBusy
        ? "Switching…"
        : switchArmed
          ? `Confirm: ${formatUsd(PRICE_YEARLY_USD)}/yr`
          : `Switch to yearly — ${formatUsd(PRICE_YEARLY_USD)}/yr`}
    </Button>
  ) : null;
  const switchNote = switchArmed ? (
    <p className="text-xs text-muted-foreground">
      Polar credits what's left of this month and bills the rest of the year today. Tap again to switch.
    </p>
  ) : null;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader kicker="Account" title={user.displayName || "Your Lab"}>
        {user.primaryEmail}
      </PageHeader>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            {plan.admin
              ? "Admin"
              : plan.paid
                ? plan.planInterval === "year"
                  ? "Yearly plan"
                  : "Monthly plan"
                : "Free"}
          </h2>
          {plan.paid && !plan.admin ? (
            <span className="text-sm text-muted-foreground tabular-nums">
              {plan.planInterval === "year" ? `${formatUsd(PRICE_YEARLY_USD)}/yr` : `${formatUsd(PRICE_MONTHLY_USD)}/mo`}
            </span>
          ) : null}
        </div>

        {plan.admin ? (
          <p className="text-sm text-muted-foreground">No monthly build cap on this account.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-secondary px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Builds left</dt>
              <dd className="font-medium tabular-nums">
                {left} of {cap}
                {plan.paid ? <span className="font-normal text-muted-foreground"> this month</span> : null}
              </dd>
            </div>
            <div className="rounded-xl bg-secondary px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">
                {plan.paid ? (canceled ? "Ends on" : "Builds reset") : "Demos"}
              </dt>
              <dd className="font-medium">
                {plan.paid ? (canceled ? formatPeriodEnd(plan.currentPeriodEnd) : quotaResetDate()) : "Always free"}
              </dd>
            </div>
          </dl>
        )}

        {canceled && plan.paid ? (
          <p className="text-sm text-foreground">Canceled. Polar will not charge again. Resume any time before it ends.</p>
        ) : null}
        {lapsed ? (
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-foreground">
            Your last payment didn't go through. Update your card to keep your plan.
          </p>
        ) : null}

        {plan.paid ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Included</p>
            <ul className="flex flex-wrap gap-2">
              {INCLUDED.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {priceLine({ inviteHalf: monthOff })} Adds Setlists, the gear locker, Create and pedal matching.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {freePlan && !lapsed ? (
            <Button asChild>
              <Link to="/upgrade">Subscribe — {formatUsd(firstMonthUsd({ inviteHalf: monthOff }))} first month</Link>
            </Button>
          ) : null}
          {lapsed ? (
            <Button type="button" disabled={portalBusy} onClick={() => void onManageSubscription()}>
              {portalBusy ? "Opening Polar…" : "Update card"}
            </Button>
          ) : null}
          {plan.polarLinked && canceled && plan.paid ? (
            <Button type="button" disabled={resumeBusy} onClick={() => void onResumeSubscription()}>
              {resumeBusy ? "Resuming…" : "Resume plan"}
            </Button>
          ) : null}
          {!canceled ? switchButton : null}
          {(plan.polarLinked || (plan.paid && !plan.admin)) && !lapsed ? (
            <Button type="button" variant="secondary" disabled={portalBusy} onClick={() => void onManageSubscription()}>
              {portalBusy ? "Opening Polar…" : "Billing and receipts"}
            </Button>
          ) : null}
          {plan.polarLinked && plan.paid && !canceled ? (
            <Button type="button" variant="outline" onClick={() => setCancelSheet(true)}>
              Cancel plan
            </Button>
          ) : null}
          {import.meta.env.DEV && plan.admin && !plan.polarLinked ? (
            <Button asChild variant="secondary">
              <Link to="/upgrade">Subscribe with Polar (test cancel)</Link>
            </Button>
          ) : null}
          {plan.admin ? (
            <Button asChild variant="secondary">
              <Link to="/admin">Admin dashboard</Link>
            </Button>
          ) : null}
        </div>
        {!cancelSheet ? switchNote : null}
        {error && !cancelSheet && where === "plan" ? <p className="text-sm text-destructive">{error}</p> : null}
        {message && where === "plan" ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </section>

      {cancelSheet ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          onClick={() => !cancelBusy && setCancelSheet(false)}
        >
          <div
            className="w-full max-w-lg space-y-4 rounded-t-2xl bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:rounded-2xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-title" className="font-display text-lg font-semibold">
              Cancel your plan?
            </h2>
            <p className="text-sm text-muted-foreground">
              You keep everything until {formatPeriodEnd(plan.currentPeriodEnd)}. After that you lose:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                {left} custom build{left === 1 ? "" : "s"} left this month, and 50 more each month
              </li>
              <li>Setlists</li>
              <li>Your gear locker on every device</li>
              <li>Create</li>
            </ul>
            <div className="flex flex-col gap-2">
              {switchButton}
              {switchNote}
              <Button type="button" onClick={() => setCancelSheet(false)} disabled={cancelBusy}>
                Keep my plan
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={cancelBusy}
                onClick={() => void onCancelSubscription()}
              >
                {cancelBusy ? "Canceling…" : "Cancel plan"}
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>
      ) : null}

      <div id="invite">
        <InviteCard showRedeem />
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Password</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We email a reset link to {user.primaryEmail || "your account"}. New passwords need {MIN_PASSWORD_LENGTH}+
          characters.
        </p>
        {error && !cancelSheet && where === "account" ? <p className="text-sm text-destructive">{error}</p> : null}
        {message && where === "account" ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button type="button" disabled={busy} onClick={() => void onEmailReset()}>
          {busy ? "Sending…" : "Email me a reset link"}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">{FORGOT_PASSWORD_COPY}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Devices</h2>
        <p className="text-sm text-muted-foreground">
          Signed in on a phone or computer that isn't yours any more? Sign out everywhere else.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled={revoking} onClick={() => void onRevokeOtherSessions()}>
            {revoking ? "Signing out…" : "Sign out other devices"}
          </Button>
          {authEnabled ? (
            <Button
              type="button"
              variant="secondary"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          ) : null}
        </div>
        {error && where === "devices" ? <p className="text-sm text-destructive">{error}</p> : null}
        {message && where === "devices" ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <p className="text-sm text-muted-foreground">
          Theme and unit live in{" "}
          <Link to="/settings" className="text-primary underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Delete account</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We email a link to confirm. Nothing is deleted until you tap it. This email can't start a new free account
          for {DELETE_HOLD_DAYS} days after.
          {plan.polarLinked && plan.paid && !canceled ? " Cancel your plan first." : ""}
        </p>
        {deleteSent ? (
          <p className="text-sm text-muted-foreground">
            Check {user.primaryEmail} and tap the link. It expires in 24 hours.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">Type DELETE</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
                placeholder="DELETE"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={deleteBusy || deleteConfirm !== "DELETE"}
              onClick={() => {
                setError("");
                setWhere("delete");
                setMessage("");
                setDeleteBusy(true);
                void requestAccountDelete()
                  .then((res) => {
                    if (!res?.ok) {
                      setError(res && "error" in res ? res.error : "Could not send the confirmation email.");
                      return;
                    }
                    setDeleteSent(true);
                  })
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : "Could not send the confirmation email.");
                  })
                  .finally(() => setDeleteBusy(false));
              }}
            >
              {deleteBusy ? "Sending…" : "Email me the delete link"}
            </Button>
          </>
        )}
        {error && !cancelSheet && where === "delete" ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>
    </div>
  );
}
