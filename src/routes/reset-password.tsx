import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mark } from "@/components/layout/mark";
import { authClient } from "@/lib/auth/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof s.token === "string" && s.token.length ? s.token : undefined,
    error: typeof s.error === "string" && s.error.length ? s.error : undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const search = Route.useSearch();
  const token = useMemo(() => {
    if (search.token) return search.token;
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, [search.token]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(search.error ? "This reset link is invalid or expired." : "");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing a token. Request a new email from Sign in.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`New password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (err) {
        setError(err.message || "Could not reset that password. Request a new email.");
        return;
      }
      await authClient.revokeOtherSessions().catch(() => undefined);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset that password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <a href="/" className="inline-flex items-center gap-3" aria-label="Stomp Lab">
          <Mark size="md" />
          <span className="font-display text-base font-semibold uppercase tracking-[0.2em]">Stomp Lab</span>
        </a>
        <div className="space-y-2">
          <h1 className="font-display text-5xl font-semibold uppercase leading-[0.88] tracking-tight">
            New password
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {done
              ? "Password updated. Sign in with the new one. Other devices were signed out."
              : `Pick a password of ${MIN_PASSWORD_LENGTH}+ characters. This link works once.`}
          </p>
        </div>
        {done ? (
          <Button asChild className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={`${MIN_PASSWORD_LENGTH}+ characters`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy || !token}>
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          Link expired?{" "}
          <Link to="/login" className="text-primary underline underline-offset-2">
            Request another from Sign in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
