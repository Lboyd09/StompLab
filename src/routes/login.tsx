import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { parseNext } from "@/lib/next-path";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
  }),
  component: LoginPage,
});

function friendlyAuthError(raw: string, mode: "in" | "up"): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid origin") || m.includes("forbidden") || m.includes("csrf")) {
    return "This page couldn't talk to the sign-in server. Refresh once and try again.";
  }
  if (m.includes("already exists") || m.includes("user already")) {
    return "That email already has an account. Sign in instead.";
  }
  if (m.includes("invalid email or password") || m.includes("invalid password") || m.includes("credential")) {
    return "Email or password didn't match. Check both, or create a new account.";
  }
  if (m.includes("password") && (m.includes("8") || m.includes("least") || m.includes("short"))) {
    return "Password needs at least 8 characters.";
  }
  if (m.includes("invalid email") || m.includes("email")) {
    return "That email doesn't look right.";
  }
  return raw || (mode === "up" ? "Could not create that account." : "Could not sign in.");
}

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = parseNext(search.next);

  if (!isPending && user) {
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
    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
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
          const msg = friendlyAuthError(err.message || "", "up");
          setError(msg);
          if (/already/i.test(err.message || "") || /already/i.test(msg)) setMode("in");
          return;
        }
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
          const session = await authClient.getSession().catch(() => null);
          if (session?.data?.user) {
            await navigate({ to: next, replace: true });
            return;
          }
        }
        setError(friendlyAuthError(err.message || "", mode === "up" ? "in" : "in"));
        return;
      }
      const session = await authClient.getSession().catch(() => null);
      if (!session?.data?.user) {
        setError("Signed in, but this browser didn't keep the session. Allow cookies for this site and try again.");
        return;
      }
      await navigate({ to: next, replace: true });
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : "", mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <a href="/" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="grid size-10 place-items-center rounded-md bg-mark font-display text-lg font-bold tracking-[-0.08em] normal-case text-mark-foreground">
              SL
            </span>
            Back to Lab
          </a>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {mode === "in" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Email and a password. That's it — no Google, no X. Unlock sticks to this email after
            checkout.
          </p>
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
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                placeholder="8+ characters"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>
        )}

        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError("");
          }}
        >
          {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>

        <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Help</p>
          <details>
            <summary className="cursor-pointer font-medium">Forgot password?</summary>
            <p className="mt-2 text-muted-foreground">
              Stomp Lab does not email reset links — there is no mailbox on this site. Try the
              password you picked, or create a new account with a different email. If you already
              unlocked, sign in with the same email you used at checkout. The unlock follows that
              address.
            </p>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Sign-in isn't working</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Use the email you typed when you created the account — not a nickname.</li>
              <li>Password is at least 8 characters, exactly as you set it.</li>
              <li>Refresh the page once and try again. A stuck session is the usual culprit.</li>
              <li>This is email + password only. There is no Google or X button.</li>
            </ul>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Create account failed</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>If it says the email already exists, switch to Sign in.</li>
              <li>Pick a password of 8+ characters. Spaces at the ends count.</li>
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
