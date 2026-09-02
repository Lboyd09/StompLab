import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PAID_MONTHLY_BUILDS, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, formatUsd } from "@/lib/plan";

export function PaywallCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Subscribe</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <p className="font-display text-4xl font-semibold tabular-nums">
          {formatUsd(PRICE_MONTHLY_USD)}
          <span className="ml-2 text-base font-normal text-muted-foreground">
            / mo · or {formatUsd(PRICE_YEARLY_USD)} / year
          </span>
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Type any song. Download a .hlx HX Edit can import.</li>
          <li>History of the songs you built. Gear locker and extra snapshots after subscribe.</li>
          <li>{PAID_MONTHLY_BUILDS} custom builds a month. The three demos stay free.</li>
        </ul>
        <Button asChild className="w-full">
          <Link to="/upgrade">See monthly and yearly</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Not ready?{" "}
        <a href="/" className="text-primary underline underline-offset-2">
          Play Sandman, Teen Spirit, or Comfortably Numb
        </a>
        .
      </p>
    </div>
  );
}
