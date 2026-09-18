import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { InviteCard } from "@/components/layout/invite-card";
import { authClient, authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { FORGOT_PASSWORD_COPY } from "@/lib/copy";
import { openCustomerPortal, cancelMySubscription } from "@/lib/billing";
import { requestAccountDelete } from "@/lib/account-delete";
import { FREE_BUILDS, PRICE_MONTHLY_USD, buildsUsedCopy, formatUsd, canceledCopy, subscriptionCanceled } from "@/lib/plan";
import { requestResetMail } from "@/lib/reset-mail";
import { MIN_PASSWORD_LENGTH, RESET_TOKEN_MINUTES, SESSION_DAYS } from "@/lib/password-policy";
import { DELETE_HOLD_DAYS } from "@/lib/closed-accounts";
import { usePlan } from "@/lib/use-plan";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const { plan, isPending: planPending } = usePlan();
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteSent, setDeleteSent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (isPending || planPending) {
    return <p className="text-sm text-muted-foreground">Loading account…</p>;
  }
  if (!user) {
    return <Navigate to="/login" search={{ next: "/account" }} />;
  }

  const accountEmail = user.primaryEmail;

  async function onEmailReset() {
    setError("");
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
    setMessage("");
    setCancelBusy(true);
    try {
      const res = await cancelMySubscription();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        res.already
          ? canceledCopy({ ...plan, currentPeriodEnd: res.periodEnd ?? plan.currentPeriodEnd, subscriptionStatus: "canceled" })
          : `Canceled. You keep the Lab until ${res.periodEnd ? new Date(res.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "the end of the period you already paid for"}. Polar will not charge again.`,
      );
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    } finally {
      setCancelBusy(false);
    }
  }

  const canceled = subscriptionCanceled(plan);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader kicker="Account" title={user.displayName || "Your Lab"}>
        {user.primaryEmail}
      </PageHeader>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Plan</h2>
        {canceled ? (
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-foreground">{canceledCopy(plan)}</p>
        ) : null}
        {plan.admin ? (
          <p className="text-sm text-muted-foreground">
            Admin test account — full Lab, no monthly build cap. Exact match: {user.primaryEmail}. Use Polar
            below to test cancel and invites the same way a paying player would.
          </p>
        ) : plan.paid ? (
          <p className="text-sm text-muted-foreground">{buildsUsedCopy(plan)}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Free plan. {plan.freeRemaining} of {FREE_BUILDS + plan.bonusBuilds} custom builds left. Three demos
              always work. Catalog is open. Gear locker is paid.
            </p>
            <Button asChild>
              <Link to="/upgrade">Subscribe — {formatUsd(PRICE_MONTHLY_USD)}/mo</Link>
            </Button>
          </>
        )}
        {plan.admin && !plan.polarLinked ? (
          <Button asChild variant="secondary">
            <Link to="/upgrade">Subscribe with Polar (test cancel)</Link>
          </Button>
        ) : null}
        {plan.paid || plan.admin ? (
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={portalBusy} onClick={() => void onManageSubscription()}>
              {portalBusy ? "Opening Polar…" : "Manage subscription"}
            </Button>
            {plan.polarLinked && !canceled ? (
              <Button type="button" variant="outline" disabled={cancelBusy} onClick={() => void onCancelSubscription()}>
                {cancelBusy ? "Canceling…" : "Cancel subscription"}
              </Button>
            ) : null}
          </div>
        ) : null}
        {plan.admin ? (
          <Button asChild variant="secondary">
            <Link to="/admin">Admin dashboard</Link>
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Cancel here or on Polar’s customer portal. You keep paid access until the period you already paid for
          ends. Stomp Lab never sees your card.
        </p>
      </section>

      <InviteCard showRedeem />

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Password</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We email a reset link to {user.primaryEmail || "your account"}. You cannot change the password from this
          page. New passwords need {MIN_PASSWORD_LENGTH}+ characters. The link dies in {RESET_TOKEN_MINUTES}{" "}
          minutes.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button type="button" disabled={busy} onClick={() => void onEmailReset()}>
          {busy ? "Sending…" : "Email me a reset link"}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">{FORGOT_PASSWORD_COPY}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Security</h2>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          <li>Session cookies are host-only and expire after {SESSION_DAYS} days of inactivity.</li>
          <li>Password reset signs you in only after you pick the new password from the emailed link.</li>
          <li>Sign out other devices if you think someone else used this account.</li>
        </ul>
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
              {signingOut ? "Signing out…" : "Sign out this device"}
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Theme, unit, and the replica live in{" "}
          <Link to="/settings" className="text-primary underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Delete account</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We email {user.primaryEmail || "this account"} a confirmation link first. After you click it, we keep
          the records for {DELETE_HOLD_DAYS} days so this email cannot open a new free account, then we erase
          them. Type DELETE, then send the email.
        </p>
        {deleteSent ? (
          <p className="text-sm text-muted-foreground">
            Check {user.primaryEmail} and tap the confirm link. It expires in 24 hours. Nothing is deleted until
            you confirm.
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
                setMessage("");
                setDeleteBusy(true);
                void requestAccountDelete()
                  .then((res) => {
                    if (!res?.ok) {
                      setError(res && "error" in res ? res.error : "Could not send the confirmation email.");
                      return;
                    }
                    setDeleteSent(true);
                    setMessage(`Check ${user.primaryEmail} to confirm. Nothing is deleted until you tap the link.`);
                  })
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : "Could not send the confirmation email.");
                  })
                  .finally(() => setDeleteBusy(false));
              }}
            >
              {deleteBusy ? "Sending…" : "Email me a delete confirmation"}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
