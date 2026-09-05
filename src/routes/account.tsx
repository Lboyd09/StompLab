import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { FORGOT_PASSWORD_COPY } from "@/lib/copy";
import { openCustomerPortal } from "@/lib/billing";
import { FREE_BUILDS, PRICE_MONTHLY_USD, buildsUsedCopy, formatUsd } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const { plan, isPending: planPending } = usePlan();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (isPending || planPending) {
    return <p className="text-sm text-muted-foreground">Loading account…</p>;
  }
  if (!user) {
    return <Navigate to="/login" search={{ next: "/account" }} />;
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (next.length < 8) {
      setError("New password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (err) {
        setError(err.message || "Could not change password.");
        return;
      }
      setCurrent("");
      setNext("");
      setMessage("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setBusy(false);
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
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Account</p>
        <h1 className="font-display text-4xl font-semibold uppercase leading-[0.9] tracking-tight">
          {user.displayName || "Your Lab"}
        </h1>
        <p className="text-sm text-muted-foreground">{user.primaryEmail}</p>
      </header>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
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
              Free plan. {plan.freeRemaining} of {FREE_BUILDS} custom builds left. Three demos always work. Catalog
              is open. Gear locker is paid.
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

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Password</h2>
        <form onSubmit={(e) => void onChangePassword(e)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">New password</Label>
            <Input
              id="next"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
        <p className="text-xs leading-relaxed text-muted-foreground">{FORGOT_PASSWORD_COPY}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Session</h2>
        <p className="text-sm text-muted-foreground">
          Always use stomplab.app — not www. Look and feel lives in{" "}
          <Link to="/settings" className="text-primary underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
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
      </section>
    </div>
  );
}
