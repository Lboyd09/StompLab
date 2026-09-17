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
import { openCustomerPortal } from "@/lib/billing";
import { requestResetMail } from "@/lib/reset-mail";
import { deleteMyAccount } from "@/lib/account-delete";
import { FREE_BUILDS, PRICE_MONTHLY_USD, buildsUsedCopy, formatUsd } from "@/lib/plan";
import { MIN_PASSWORD_LENGTH, RESET_TOKEN_MINUTES, SESSION_DAYS } from "@/lib/password-policy";
import { usePlan } from "@/lib/use-plan";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const { plan, isPending: planPending } = usePlan();
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
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

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader kicker="Account" title={user.displayName || "Your Lab"}>
        {user.primaryEmail}
      </PageHeader>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Plan</h2>
        {plan.admin ? (
          <p className="text-sm text-muted-foreground">
            Admin — full Lab, no monthly build cap. Exact match: {user.primaryEmail}.
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
        {plan.paid && !plan.admin ? (
          <Button type="button" variant="secondary" disabled={portalBusy} onClick={() => void onManageSubscription()}>
            {portalBusy ? "Opening Polar…" : "Manage subscription"}
          </Button>
        ) : null}
        {plan.admin ? (
          <Button asChild variant="secondary">
            <Link to="/admin">Admin dashboard</Link>
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Billing, card, and cancel live on Polar’s customer portal. Stomp Lab never sees your card.
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
          This erases your Lab account, presets, locker, invites, and build history. If you subscribe,
          we ask Polar to cancel so you are not billed again. Type DELETE to confirm.
        </p>
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
            void deleteMyAccount({ data: { confirm: "DELETE" } })
              .then(async (res) => {
                if (!res?.ok) {
                  setError("Could not delete the account. Email support if it keeps happening.");
                  return;
                }
                await signOut().catch(() => undefined);
                window.location.assign("/");
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : "Could not delete the account.");
              })
              .finally(() => setDeleteBusy(false));
          }}
        >
          {deleteBusy ? "Deleting…" : "Delete my account"}
        </Button>
      </section>
    </div>
  );
}
