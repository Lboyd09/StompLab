import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SAMPLE_SETLISTS, sampleMeta, type SampleSetlist } from "@/data/sample-setlists";
import { PRICE_MONTHLY_USD, formatUsd, priceMonthlyLaunchUsd } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { cn } from "@/lib/utils";

/** One price line, same numbers as the Subscribe page. */
export function samplePriceLine() {
  return `${formatUsd(priceMonthlyLaunchUsd())} first month, then ${formatUsd(PRICE_MONTHLY_USD)}/mo. Cancel any time.`;
}

export function SetToggle({
  value,
  onChange,
}: {
  value: SampleSetlist["id"];
  onChange: (id: SampleSetlist["id"]) => void;
}) {
  return (
    <div role="tablist" aria-label="Sample set" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {SAMPLE_SETLISTS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={value === s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            "min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors",
            value === s.id ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted-foreground",
          )}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

/** Preview card shown on the locked Setlists tab. */
export function PaywallSample() {
  const [id, setId] = useState<SampleSetlist["id"]>("worship");
  const set = SAMPLE_SETLISTS.find((s) => s.id === id) ?? SAMPLE_SETLISTS[0];
  return (
    <section className="space-y-4" aria-label="Sample setlist">
      <div className="space-y-1">
        <p className="sl-kicker">Sample</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight">What a setlist looks like</h2>
      </div>
      <SetToggle value={id} onChange={setId} />
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">{set.blurb}</p>
        <ol className="mt-3 divide-y divide-border">
          {set.songs.map((song, i) => (
            <li key={song.id} className="flex items-start gap-3 py-2.5">
              <span className="w-5 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {song.title} <span className="font-normal text-muted-foreground">· {song.artist}</span>
                </p>
                <p className="text-xs text-muted-foreground">{sampleMeta(song)}</p>
                <p className="text-xs text-muted-foreground">{song.parts.map((p) => p.name).join(" / ")}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          {set.songs.length} songs, one file each, in this order. Sample only, not a download.
        </p>
        <Button asChild className="mt-4 h-11 w-full">
          <Link to="/setlist/demo" search={{ set: id }}>
            See the full demo
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** Clean gate for any action the sample page can't do. Signed-out -> account, free -> subscribe. */
export function SampleGate({ action, onClose }: { action: string; onClose: () => void }) {
  const { plan } = usePlan();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const paid = plan.paid || plan.admin;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-gate-title"
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="size-4" />
          <span className="text-xs uppercase tracking-wide">Sample setlist</span>
        </div>
        <h2 id="sample-gate-title" className="font-display text-2xl font-semibold tracking-tight">
          {paid ? "This one is a sample" : plan.signedIn ? "Subscribe to " + action : "Create a free account to " + action}
        </h2>
        {paid ? (
          <p className="text-sm text-muted-foreground">
            Your own setlists download for real. Build one from your History or the demos.
          </p>
        ) : plan.signedIn ? (
          <p className="text-sm text-muted-foreground">
            Setlists come with a subscription. {samplePriceLine()}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Free to join. You get the demos and 3 free custom builds. Setlists come with a subscription.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {paid ? (
            <Button asChild className="h-11">
              <Link to="/setlist" search={{}}>
                Go to my setlists
              </Link>
            </Button>
          ) : plan.signedIn ? (
            <Button asChild className="h-11">
              <Link to="/upgrade">Subscribe</Link>
            </Button>
          ) : (
            <Button asChild className="h-11">
              <Link to="/login" search={{ mode: "up", next: "/setlist/demo" }}>
                Create a free account
              </Link>
            </Button>
          )}
          <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
            Keep looking
          </Button>
        </div>
      </div>
    </div>
  );
}
