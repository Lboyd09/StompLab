import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PAID_MONTHLY_BUILDS, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, LAUNCH_DISCOUNT_PERCENT, priceMonthlyLaunchUsd, formatUsd } from "@/lib/plan";

export function PaywallCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-8 py-6">
      <div className="space-y-3">
        <p className="sl-kicker">Subscribe</p>
        <h1 className="sl-hero-title text-[clamp(2.2rem,6vw,3.2rem)]">{title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-7">
        <p className="sl-hero-title text-4xl tabular-nums">
          {formatUsd(priceMonthlyLaunchUsd())}
          <span className="ml-2 text-base font-normal tracking-normal text-muted-foreground">
            first mo · or {formatUsd(PRICE_YEARLY_USD)}/yr
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          Launch {LAUNCH_DISCOUNT_PERCENT}% off the first month. Then {formatUsd(PRICE_MONTHLY_USD)}/mo. Yearly is{" "}
          {formatUsd(PRICE_YEARLY_USD)} — no discount on the year plan.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Type a song. Get that guitar rig — a .hlx HX Edit can import.</li>
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
