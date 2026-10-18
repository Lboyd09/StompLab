import { Link } from "@tanstack/react-router";
import { Check, Copy, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { copyText } from "@/lib/clipboard";
import { inviteUrl, REFERRAL_BONUS, REFERRAL_CAP, REFERRAL_SUBSCRIBE_PERCENT } from "@/lib/referral-code";
import { PRICE_YEARLY_USD, subscriptionCanceled } from "@/lib/plan";
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
  const [code, setCode] = useState("");
  const [invited, setInvited] = useState(0);
  const [cap, setCap] = useState(REFERRAL_CAP);
  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
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

  const signedIn = Boolean(user);
  const showCode = signedIn;
  const remaining = Math.max(0, cap - invited);
  const paidInvite = plan.paid && !subscriptionCanceled(plan);
  const url = code && origin ? inviteUrl(origin, code, paidInvite ? "half" : "builds") : "";

  async function copyLink() {
    if (!url) return;
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.success("Invite link copied. They land on Create account.");
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      toast.message("Select the link and copy it.");
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
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 sl-card",
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
          <h2 className="sl-hero-title text-2xl">
            {paidInvite ? "Give a friend 50% off" : `Give a friend ${REFERRAL_BONUS} free builds`}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {paidInvite
              ? `When a friend makes a new account with your link, you both get ${REFERRAL_BONUS} extra custom builds, and you each get ${REFERRAL_SUBSCRIBE_PERCENT}% off one monthly invoice.`
              : `When a friend makes a new account with your link, you both get ${REFERRAL_BONUS} extra custom builds.`}{" "}
            Up to {cap} friends.
          </p>
        </div>
      </div>

      {isPending && !signedIn ? null : !showCode ? (
        <div className="mt-5">
          <Button asChild>
            <Link to="/login" search={{ next: "/account", mode: "up" }}>
              Create an account for your invite link
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 min-w-0 space-y-3">
          {code ? (
            <>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <code className="max-w-full overflow-x-auto rounded-lg bg-secondary px-3 py-2 font-mono text-sm tracking-[0.18em] text-foreground">
                  {code}
                </code>
                <Button type="button" variant="secondary" onClick={() => void copyLink()} className="w-full sm:w-auto">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy invite link"}
                </Button>
              </div>
              {url ? (
                <Input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Invite link"
                  className="w-full min-w-0 font-mono text-xs"
                />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Invite codes need the database.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {invited} of {cap} used.{remaining ? ` ${remaining} left.` : " Cap reached."}
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
