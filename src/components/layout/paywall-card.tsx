import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LAUNCH_USD, PRICE_USD } from "@/lib/plan";

export function PaywallCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Unlock</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <p className="font-display text-4xl font-semibold tabular-nums">
          ${LAUNCH_USD}
          <span className="ml-2 text-base font-normal text-muted-foreground">
            launch · then ${PRICE_USD} one time
          </span>
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Type any song. Download a .hlx HX Edit can import.</li>
          <li>History, gear locker, and XL snapshot 4.</li>
          <li>50 custom builds a month. The three demos stay free.</li>
        </ul>
        <Button asChild className="w-full">
          <Link to="/upgrade">See the full unlock</Link>
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
