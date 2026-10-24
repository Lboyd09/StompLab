import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DEVICE_MAP } from "@/data/categories";
import { PAID_BUILD_LINE } from "@/lib/copy";
import { useAppStore } from "@/store/app-store";
import { PRICE_MONTHLY_USD, PRICE_YEARLY_USD, LAUNCH_DISCOUNT_PERCENT, priceMonthlyLaunchUsd, formatUsd } from "@/lib/plan";

export function PaywallCard({ title, body, sample }: { title: string; body: string; sample?: ReactNode }) {
  const stompModel = useAppStore((s) => s.stompModel);
  const device = DEVICE_MAP[stompModel];
  const ext = device?.exportFormat === "pgp" ? "pgp" : "hlx";
  const editor = ext === "pgp" ? "POD Go Edit" : "HX Edit";
  return (
    <div className="mx-auto max-w-lg space-y-8 py-6">
      <div className="space-y-3">
        <p className="sl-kicker">Subscribe</p>
        <h1 className="sl-hero-title text-[clamp(2.2rem,6vw,3.2rem)]">{title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {sample}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-7">
        <p className="sl-hero-title text-4xl tabular-nums">
          {formatUsd(priceMonthlyLaunchUsd())}
          <span className="ml-2 text-base font-normal tracking-normal text-muted-foreground">
            first mo · or {formatUsd(PRICE_YEARLY_USD)}/yr
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {LAUNCH_DISCOUNT_PERCENT}% off the first month, then {formatUsd(PRICE_MONTHLY_USD)}/mo. Cancel any time.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Any song as a .{ext} that {editor} imports for your {device?.name ?? "unit"}.</li>
          <li>{PAID_BUILD_LINE}</li>
          <li>Create, the gear locker, and every rig in the library.</li>
        </ul>
        <Button asChild className="w-full">
          <Link to="/upgrade">Subscribe</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Not ready?{" "}
        <Link to="/" className="text-primary underline underline-offset-2">
          Try the free demos
        </Link>
        .
      </p>
    </div>
  );
}
