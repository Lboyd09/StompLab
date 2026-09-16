import { Link } from "@tanstack/react-router";
import { Check, Copy, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { REFERRAL_BONUS, REFERRAL_CAP, REFERRAL_SUBSCRIBE_PERCENT } from "@/lib/referral-code";
import { getMyReferral, redeemReferral } from "@/lib/referrals";
import { usePlan } from "@/lib/use-plan";
import { cn } from "@/lib/utils";

export function InviteCard({
  className,
  showRedeem = false,
}: {
  className?: string;
  showRedeem?: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  const { plan, refresh } = usePlan();
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [invited, setInvited] = useState(0);
  const [cap, setCap] = useState(REFERRAL_CAP);
  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getMyReferral()
      .then((res) => {
        if (cancelled || !res.ok) return;
        setCode(res.code);
        setInvited(res.invited);
        setCap(res.cap);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const showCode = ready && !isPending && Boolean(user);

  function inviteUrl(value: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/login?ref=${encodeURIComponent(value)}`;
  }

  async function copyLink() {
    if (!code) return;
    const url = inviteUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.message(url);
    }
  }

  async function onRedeem(e: React.FormEvent) {
    e.preventDefault();
    const raw = redeemInput.trim();
    if (raw.length < 4) return;
    setBusy(true);
    setNote("");
    try {
      const res = await redeemReferral({ data: { code: raw } });
      if (res.ok) {
        setNote(`Invite applied. You got ${res.bonus} extra custom build${res.bonus === 1 ? "" : "s"}.`);
        setRedeemInput("");
        await refresh();
      } else {
        setNote(res.error);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not apply that invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6",
        className,
      )}
    >
      <span className="sl-form-bar" aria-hidden />
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-pop">
          <UserPlus className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="sl-kicker">Invite</p>
          <h2 className="font-display text-2xl font-semibold uppercase leading-none tracking-tight">
            Bring a friend
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Share a link. They create a new account — you both get {REFERRAL_BONUS} extra custom
            builds. Cap {cap} friends.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Already subscribed? Their first monthly invoice is {REFERRAL_SUBSCRIBE_PERCENT}% off. If you pay
            monthly too, so is your next one. Yearly stays full price.
          </p>
        </div>
      </div>

      {!showCode ? (
        <div className="mt-5">
          <Button asChild>
            <Link to="/login" search={{ next: "/account" }}>
              Sign in for your invite link
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {code ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-secondary px-3 py-2 font-mono text-sm tracking-[0.18em] text-foreground">
                {code}
              </code>
              <Button type="button" variant="secondary" onClick={() => void copyLink()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy invite link"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Invite codes need the database.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {invited} of {cap} used.
            {plan.bonusBuilds
              ? ` You have ${plan.bonusBuilds} bonus build${plan.bonusBuilds === 1 ? "" : "s"}.`
              : ""}
          </p>
        </div>
      )}

      {showRedeem && showCode ? (
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => void onRedeem(e)}>
          <Input
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
            placeholder="Have a code?"
            maxLength={12}
            className="max-w-40"
            aria-label="Invite code"
          />
          <Button type="submit" variant="secondary" disabled={busy || redeemInput.trim().length < 4}>
            {busy ? "Applying…" : "Apply code"}
          </Button>
        </form>
      ) : null}
      {note ? <p className="mt-3 text-sm text-muted-foreground">{note}</p> : null}
    </section>
  );
}
