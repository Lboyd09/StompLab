import { createFileRoute } from "@tanstack/react-router";
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
import { captureReferralCode, peekReferralCode, clearReferralCode, rememberInviteResult } from "@/lib/referral-code";
import { redeemReferral, invitePerkForCode } from "@/lib/referrals";
import { requestResetMail } from "@/lib/reset-mail";
import { checkEmailHold } from "@/lib/closed-accounts";
import { PRICE_YEARLY_USD } from "@/lib/plan";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string; checkout_id?: string; ref?: string; mode?: string; perk?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
    checkout_id: typeof s.checkout_id === "string" ? s.checkout_id : undefined,
    ref: typeof s.ref === "string" && s.ref.length ? s.ref : undefined,
    mode: typeof s.mode === "string" ? s.mode : undefined,
    perk: s.perk === "half" || s.perk === "builds" ? s.perk : undefined,
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
  if (m.includes("14-day") || m.includes("deleted account") || m.includes("hold after a delete")) {
    return raw;
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
  const [mode, setMode] = useState<"in" | "up" | "reset">(() => {
    if (search.mode === "reset") return "reset";
    if (search.mode === "up" || search.ref) return "up";
    return "in";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [invite, setInvite] = useState("");
  const [paidInvite, setPaidInvite] = useState(search.perk === "half");
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
    if (search.mode === "up" || search.ref || existing) setMode("up");
    if (search.mode === "reset") setMode("reset");
    const code = search.ref || existing;
    if (code && code.length >= 4) {
      void invitePerkForCode({ data: { code } })
        .then((res) => {
          if (res.ok) setPaidInvite(res.paid);
        })
        .catch(() => undefined);
    } else if (search.perk === "builds") {
      setPaidInvite(false);
    }
  }, [search.ref, search.mode, search.perk]);

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

  async function applyInviteIfAny(): Promise<void> {
    const code = invite.trim() || peekReferralCode();
    if (code.length < 4) return;
    let last = "Could not apply that invite.";
    for (let i = 0; i < 5; i++) {
      try {
        const res = await redeemReferral({ data: { code } });
        if (res.ok) {
          rememberInviteResult({ ok: true, bonus: res.bonus });
          clearReferralCode();
          return;
        }
        last = res.error;
        if (/already used|can't invite|maximum|48 hours|before you research|doesn't look right|no account uses/i.test(res.error)) {
          rememberInviteResult({ ok: false, error: res.error });
          return;
        }
      } catch (err) {
        last = err instanceof Error ? err.message : last;
      }
      await new Promise((r) => window.setTimeout(r, 180 * (i + 1)));
    }
    rememberInviteResult({ ok: false, error: last });
  }

  async function goAfterAuth() {
    const dest = checkoutId
      ? `/upgrade?checkout_id=${encodeURIComponent(checkoutId)}`
      : next || "/";
    window.location.assign(dest);
  }

  if (!isPending && user) {
    return (
      <SignedInClaim
        next={next}
        checkoutId={checkoutId}
        invite={invite || search.ref || peekReferralCode()}
      />
    );
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
        const res = await requestResetMail({ data: { email: trimmed } });
        if (!res.ok) {
          setError(res.error);
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
      const hold = await checkEmailHold({ data: { email: trimmed } });
      if (!hold.ok) {
        setError(hold.error);
        return;
      }
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
    <main className="relative grid min-h-dvh place-items-center overflow-x-clip bg-background px-5 py-14 text-foreground">
      <PageWash />
      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="space-y-4">
          <a href="/" className="inline-flex items-center gap-3" aria-label="Stomp Lab">
            <Mark size="md" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Stomp Lab</span>
          </a>
          <div className="space-y-2">
            <p className="sl-kicker">
              {search.ref && mode === "up"
                ? paidInvite
                  ? "Paid invite — 50% off + 3 builds"
                  : "Invite — 3 extra free builds"
                : mode === "in"
                  ? "Welcome back"
                  : mode === "up"
                    ? "Join the Lab"
                    : "Account"}
            </p>
            <h1 className="sl-hero-title text-[clamp(2.6rem,8vw,3.6rem)]">
              {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Reset password"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === "reset"
                ? `We'll email a reset link to this address. It expires in ${RESET_TOKEN_MINUTES} minutes.`
                : mode === "up"
                  ? search.ref
                    ? paidInvite
                      ? "Your friend subscribes. Create a new account from this link — you both get 3 extra custom builds, and your first monthly invoice is 50% off. Yearly stays $" +
                        PRICE_YEARLY_USD +
                        ". Existing accounts cannot use this."
                      : "Your friend is on the free plan. Create a new account from this link — you both get 3 extra custom builds. That’s all this invite does. Polar’s 50% off only comes from a paying friend’s invite."
                    : "Email and a password. A friend’s invite code (optional) gives you both 3 extra custom builds."
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
                  Optional. Paste the code or use your friend’s link. New account, first 48 hours, before you research a song. You both get 3 extra custom builds.
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

function SignedInClaim({
  next,
  checkoutId,
  invite,
}: {
  next: string;
  checkoutId?: string;
  invite: string;
}) {
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const code = (invite || peekReferralCode()).trim();
      if (code.length >= 4) {
        let last = "";
        for (let i = 0; i < 5; i++) {
          try {
            const res = await redeemReferral({ data: { code } });
            if (cancelled) return;
            if (res.ok) {
              rememberInviteResult({ ok: true, bonus: res.bonus });
              clearReferralCode();
              break;
            }
            last = res.error;
            if (/already used|can't invite|maximum|48 hours|before you research/i.test(res.error)) {
              rememberInviteResult({ ok: false, error: res.error });
              break;
            }
          } catch (err) {
            last = err instanceof Error ? err.message : "Could not apply that invite.";
          }
          await new Promise((r) => window.setTimeout(r, 180 * (i + 1)));
        }
        if (last && !peekReferralCode()) {
          /* already stored */
        } else if (last) {
          rememberInviteResult({ ok: false, error: last });
        }
      }
      if (cancelled) return;
      if (checkoutId) {
        window.location.assign(`/upgrade?checkout_id=${encodeURIComponent(checkoutId)}`);
        return;
      }
      window.location.assign(next || "/");
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [checkoutId, invite, next]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
      <p className="text-sm text-muted-foreground">Applying your invite…</p>
    </main>
  );
}
