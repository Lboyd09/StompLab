import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import { DEVICE_MAP } from "@/data/categories";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const presets = useAppStore((s) => s.presets);
  const removePreset = useAppStore((s) => s.removePreset);
  const savePreset = useAppStore((s) => s.savePreset);
  const stompModel = useAppStore((s) => s.stompModel);
  const { plan, isPending } = usePlan();
  const user = presets.filter((p) => p.source !== "featured");
  const demos = FEATURED.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!plan.signedIn) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-4">
        <PageHeader kicker="Your builds" title="History">
          Sign in to keep the songs you research. Free accounts keep their 3 custom builds here. Demos
          never need an account.
        </PageHeader>
        <Button asChild>
          <Link to="/login" search={{ next: "/history" }}>
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader kicker="Your builds" title="History">
        Songs you researched and sounds you built with your free or paid builds.
      </PageHeader>

      {user.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No researched presets yet. Build one from the Lab or Create page.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/">Type a song</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/create">Describe a sound</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {user.map((p) => (
            <li key={p.id} className="sl-card flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <Link to="/preset/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {p.source} · {p.instrument} · {DEVICE_MAP[p.stompModel]?.short ?? p.stompModel}
                </div>
                <div className="font-medium">
                  {p.song ? `${p.song}${p.artist ? ` — ${p.artist}` : ""}` : p.name}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
              </Link>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => removePreset(p.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Demos</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {demos.map((p) => {
            const id = `${p.id}-${stompModel}`;
            return (
              <li key={p.id}>
                <Link
                  to="/preset/$id"
                  params={{ id }}
                  className="block rounded-xl border border-border bg-card p-4"
                  onClick={() => {
                    savePreset({
                      ...p,
                      id,
                      stompModel,
                      createdAt: Date.now(),
                    });
                  }}
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{p.artist}</div>
                  <div className="font-medium">{p.song}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
