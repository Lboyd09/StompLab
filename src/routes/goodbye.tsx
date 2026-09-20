import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/layout/mark";
import { PageWash } from "@/components/layout/page-wash";
import { confirmAccountDelete } from "@/lib/account-delete";
import { signOut } from "@/lib/auth/client";
import { DELETE_HOLD_DAYS } from "@/lib/closed-accounts";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";

export const Route = createFileRoute("/goodbye")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === "string" && s.token.length ? s.token : undefined,
  }),
  component: GoodbyePage,
});

function GoodbyePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"idle" | "working" | "ok" | "err">(token ? "working" : "idle");
  const [error, setError] = useState("");
  const [until, setUntil] = useState("");
  const [polarUrl, setPolarUrl] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void confirmAccountDelete({ data: { token } })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState("err");
          setError(res.error);
          return;
        }
        const d = new Date(res.recreateAfter);
        setUntil(d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
        if (res.polarPortalUrl) setPolarUrl(res.polarPortalUrl);
        await signOut().catch(() => undefined);
        setState("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        setState("err");
        setError(err instanceof Error ? err.message : "Could not confirm the delete.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (state !== "ok" || !polarUrl) return;
    const t = window.setTimeout(() => {
      window.location.assign(polarUrl);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [state, polarUrl]);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-x-clip bg-background px-4 py-10 text-foreground">
      <PageWash />
      <div className="relative z-10 w-full max-w-md space-y-6">
        <a href="/" className="inline-flex items-center gap-3" aria-label="Stomp Lab">
          <Mark size="md" />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Stomp Lab</span>
        </a>
        <p className="sl-kicker">Account</p>
        <h1 className="sl-hero-title text-4xl sm:text-5xl">
          {state === "ok" ? "Account closed." : state === "working" ? "Confirming…" : "Delete confirmation"}
        </h1>
        {state === "working" ? (
          <p className="text-sm leading-relaxed text-muted-foreground">One moment — we’re locking the account.</p>
        ) : null}
        {state === "ok" ? (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              You’re signed out. We keep the records for {DELETE_HOLD_DAYS} days so this email cannot open a new
              free account. You can create a new one after {until}. Exported presets on your unit are yours.
            </p>
            {polarUrl ? (
              <p className="rounded-xl border border-border bg-card p-4 text-foreground">
                Next: Polar billing. Closing the Lab does not keep a Polar plan running — we’re opening Polar’s
                cancel page. Unsubscribing from Polar by itself would have left this account open.
              </p>
            ) : (
              <p>If you never subscribed, there is nothing else to cancel.</p>
            )}
          </div>
        ) : null}
        {state === "idle" ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Open the link we emailed you to confirm the delete. If you didn’t ask for this, you can ignore it —
            nothing is deleted. Help: {PUBLIC_SUPPORT_EMAIL}.
          </p>
        ) : null}
        {state === "err" ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          {polarUrl ? (
            <Button asChild>
              <a href={polarUrl} rel="noreferrer">
                Cancel Polar subscription
              </a>
            </Button>
          ) : null}
          <Button asChild variant={polarUrl ? "secondary" : "default"}>
            <Link to="/">Back to the Lab</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
