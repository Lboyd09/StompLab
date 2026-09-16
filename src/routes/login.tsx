import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mark } from "@/components/layout/mark";
import { PageWash } from "@/components/layout/page-wash";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { FORGOT_PASSWORD_COPY } from "@/lib/copy";
import { MIN_PASSWORD_LENGTH, SIGN_IN_PASSWORD_MIN, RESET_TOKEN_MINUTES } from "@/lib/password-policy";
import { parseCheckoutId, parseNext } from "@/lib/next-path";
import { LegalAgree } from "@/components/layout/legal-agree";
import { recordLegalAccept } from "@/lib/legal";
import { captureReferralCode, peekReferralCode, clearReferralCode } from "@/lib/referral-code";
import { redeemReferral } from "@/lib/referrals";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string; checkout_id?: string; ref?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
    checkout_id: typeof s.checkout_id === "string" ? s.checkout_id : undefined,
    ref: typeof s.ref === "string" && s.ref.length ? s.ref : undefined,
  }),
  component: LoginPage,
});

function friendlyAuthError(raw: string, mode: "in" | "up"): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid origin") || m.includes("forbidden") || m.includes("csrf")) {
    return "Could not sign in from this address. Refresh the page and try again.";
  }
  if (m.includes("already exists") || m.includes("user already")) {
    return "That email already has an account. Sign in instead.";
  }
  if (m.includes("invalid email or password") || m.includes("invalid password") || m.includes("credential")) {
    return "Email or password didn't match. Use the same email you signed up with — creating a second account starts over.";
  }
  if (m.includes("password") && (m.includes("12") || m.includes("8") || m.includes("least") || m.includes("short"))) {
    return `Password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (m.includes("invalid email") || m.includes("email")) {
    return "That email doesn't look right.";
  }
  return raw || (mode === "up" ? "Could not create that account." : "Could not sign in.");
}

function LoginPage() {
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [invite, setInvite] = useState("");
  const next = parseNext(search.next);
  const checkoutId = parseCheckoutId(search.checkout_id);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("stomplab.email");
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
    if (search.ref) captureReferralCode(search.ref);
    const existing = peekReferralCode();
    if (existing) setInvite(existing);
  }, [search.ref]);

  async function waitForSession() {
    for (let i = 0; i < 12; i++) {
      const session = await authClient.getSession().catch(() => null);
      if (session?.data?.user) return session;
      await new Promise((r) => window.setTimeout(r, 140 * (i + 1)));
    }
    return null;
  }

  function rememberEmail(value: string) {
    try {
      window.localStorage.setItem("stomplab.email", value);
    } catch {
      /* ignore */
    }
  }

  async function applyInviteIfAny() {
    const code = invite.trim() || peekReferralCode();
    if (code.length < 4) return;
    try {
      await redeemReferral({ data: { code } });
    } catch {
      /* invite is optional — don't block sign-up */
    }
    clearReferralCode();
  }

  async function goAfterAuth() {
    const dest = checkoutId
      ? `/upgrade?checkout_id=${encodeURIComponent(checkoutId)}`
      : next || "/";
    window.location.assign(dest);
  }

  if (!isPending && user) {
    if (checkoutId) return <Navigate to="/upgrade" search={{ checkout_id: checkoutId }} />;
    return <Navigate to={next} />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!authEnabled) {
      setError("Sign-in is not enabled on this copy.");
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("That email doesn't look right.");
      return;
    }
    if (mode === "reset") {
      setBusy(true);
      try {
        const { error: err } = await authClient.requestPasswordReset({
          email: trimmed,
          redirectTo: "/reset-password",
        });
        if (err) {
          setError(err.message || "Could not send the reset email.");
          return;
        }
        rememberEmail(trimmed);
        setResetSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send the reset email.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (mode === "up" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (mode === "in" && password.length < SIGN_IN_PASSWORD_MIN) {
      setError("Password didn't match.");
      return;
    }
    if (mode === "up" && !agreed) {
      setError("Check the box to agree to the Terms and Privacy Policy.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: trimmed,
          password,
          name: name.trim() || trimmed.split("@")[0] || "Player",
        });
        if (err) {
          if (/already/i.test(err.message || "")) {
            const { error: signErr } = await authClient.signIn.email({
              email: trimmed,
              password,
              rememberMe: true,
            });
            if (!signErr) {
              const session = await waitForSession();
              if (session?.data?.user) {
                rememberEmail(trimmed);
                await applyInviteIfAny();
                await goAfterAuth();
                return;
              }
            }
            setMode("in");
            setError("That email already has an account. Sign in with the password you set.");
            return;
          }
          setError(friendlyAuthError(err.message || "", "up"));
          return;
        }
        recordLegalAccept("signup");
      }
      const { error: err } = await authClient.signIn.email({
        email: trimmed,
        password,
        rememberMe: true,
      });
      if (err) {
        // Sign-up already created the account — treat a follow-up sign-in
        // failure as a cookie/session problem, not a bad password.
        if (mode === "up") {
          const session = await waitForSession();
          if (session?.data?.user) {
            rememberEmail(trimmed);
            await applyInviteIfAny();
            await goAfterAuth();
            return;
          }
        }
        setError(friendlyAuthError(err.message || "", mode === "up" ? "in" : "in"));
        return;
      }
      const session = await waitForSession();
      if (!session?.data?.user) {
        setError("Signed in, but this browser didn't keep the session. Allow cookies for this site and try again.");
        return;
      }
      rememberEmail(trimmed);
      if (mode === "up") await applyInviteIfAny();
      await goAfterAuth();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : "", mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-x-clip bg-background px-4 py-10 text-foreground">
      <PageWash />
      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="space-y-4">
          <a href="/" className="inline-flex items-center gap-3" aria-label="Stomp Lab">
            <Mark size="md" />
            <span className="font-display text-base font-semibold uppercase tracking-[0.2em]">Stomp Lab</span>
          </a>
          <div className="space-y-2">
            <p className="sl-kicker">
              {mode === "in" ? "Welcome back" : mode === "up" ? "Join the Lab" : "Account"}
            </p>
            <h1 className="font-display text-5xl font-semibold uppercase leading-[0.88] tracking-tight">
              {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Reset password"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === "reset"
                ? `We'll email a reset link to this address. It expires in ${RESET_TOKEN_MINUTES} minutes.`
                : mode === "up"
                  ? "Email and a password. A friend’s invite code gives you both 3 extra custom builds."
                  : "Email and a password. Use the same address every time — a second account starts over."}
            </p>
          </div>
        </div>

        {!authEnabled ? (
          <p className="text-sm text-muted-foreground">Sign-in is disabled on this copy.</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            {mode === "up" ? (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@email.com"
                inputMode="email"
              />
            </div>
            {mode !== "reset" ? (
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={mode === "up" ? MIN_PASSWORD_LENGTH : SIGN_IN_PASSWORD_MIN}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  placeholder={mode === "up" ? `${MIN_PASSWORD_LENGTH}+ characters` : "Your password"}
                />
              </div>
            ) : null}
            {mode === "up" ? (
              <div className="space-y-1.5">
                <Label htmlFor="invite">Invite code (optional)</Label>
                <Input
                  id="invite"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value.toUpperCase())}
                  autoComplete="off"
                  placeholder="From a friend"
                  maxLength={12}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. You and your friend each get 3 extra custom builds.
                </p>
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {resetSent ? (
              <p className="text-sm text-muted-foreground">
                If that email has an account, a reset link is on the way. It expires in {RESET_TOKEN_MINUTES}{" "}
                minutes. Check spam.
              </p>
            ) : null}
            {mode === "up" ? <LegalAgree kind="signup" checked={agreed} onChange={setAgreed} /> : null}
            <Button type="submit" className="w-full" disabled={busy || (mode === "up" && !agreed)}>
              {busy
                ? "Working…"
                : mode === "in"
                  ? "Sign in"
                  : mode === "up"
                    ? "Create account"
                    : "Email me a reset link"}
            </Button>
          </form>
        )}

        <div className="flex flex-col items-start gap-2">
        {mode === "in" ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setMode("reset");
              setError("");
              setResetSent(false);
            }}
          >
            Forgot password? Email me a reset
          </button>
        ) : null}

        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            setMode(mode === "up" ? "in" : "up");
            setError("");
            setResetSent(false);
          }}
        >
          {mode === "up" ? "Already have an account? Sign in" : "Need an account? Create one"}
        </button>

        {mode === "reset" ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setMode("in");
              setError("");
              setResetSent(false);
            }}
          >
            Back to sign in
          </button>
        ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Help</p>
          <details>
            <summary className="cursor-pointer font-medium">Forgot password?</summary>
            <p className="mt-2 text-muted-foreground">{FORGOT_PASSWORD_COPY}</p>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Sign-in isn't working</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Use the email you typed when you created the account — not a nickname.</li>
              <li>Existing passwords still work. New passwords need {MIN_PASSWORD_LENGTH}+ characters.</li>
              <li>Refresh the page once and try again. A stuck session is the usual culprit.</li>
              <li>This is email + password only. There is no Google or X button.</li>
            </ul>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Create account failed</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>If it says the email already exists, switch to Sign in.</li>
              <li>Pick a password of {MIN_PASSWORD_LENGTH}+ characters. Spaces at the ends count.</li>
              <li>
                After it works you should land in the Lab automatically. If you stay here, sign in
                with the same email.
              </li>
            </ul>
          </details>
        </div>

        <p className="text-xs text-muted-foreground">
          Three custom songs are free after you sign in. Featured demos never need an account.{" "}
          <a href="/" className="text-primary underline underline-offset-2">
            Back to Lab
          </a>
        </p>
      </div>
    </main>
  );
}
