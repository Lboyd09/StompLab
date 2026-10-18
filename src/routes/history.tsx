import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import { DEVICE_MAP } from "@/data/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { FREE_BUILD_LINE } from "@/lib/copy";
import { canExportHlx, downloadHlx, exportExtension, hlxFilename } from "@/lib/hlx";
import type { Preset } from "@/data/types";
import { HISTORY_CAP } from "@/lib/storage";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const presets = useAppStore((s) => s.presets);
  const removePreset = useAppStore((s) => s.removePreset);
  const savePreset = useAppStore((s) => s.savePreset);
  const stompModel = useAppStore((s) => s.stompModel);
  const { plan, isPending } = usePlan();
  const [q, setQ] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "song" | "custom">("all");
  const user = presets.filter((p) => p.source !== "featured");
  const demos = FEATURED.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return user.filter((p) => {
      if (filter === "song" && p.source !== "song") return false;
      if (filter === "custom" && p.source !== "custom") return false;
      if (!needle) return true;
      const hay = `${p.song ?? ""} ${p.artist ?? ""} ${p.name} ${p.summary}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [user, q, filter]);

  function onDelete(p: Preset) {
    removePreset(p.id);
    setConfirmId(null);
    toast.message(`Deleted ${p.song || p.name}.`, {
      action: { label: "Undo", onClick: () => savePreset(p) },
      duration: 8000,
    });
  }

  function onRedownload(p: Preset) {
    const ok = downloadHlx(p, { fsMode: "snapshot" });
    if (ok) toast.success(`Saved ${hlxFilename(p)}.`);
    else toast.error("Could not save that file. Open the preset and try Download there.");
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!plan.signedIn) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-4">
        <PageHeader kicker="Your builds" title="History">
          Every preset you build is saved here, on your phone and your computer. {FREE_BUILD_LINE}
        </PageHeader>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/login" search={{ next: "/history", mode: "up" }}>
              Create a free account
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/login" search={{ next: "/history" }}>
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 md:pb-8">
      <PageHeader kicker="Your builds" title="History">
        Saved to your account, so they're here on your phone and your computer. Newest first.
      </PageHeader>

      {user.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Nothing built yet. Type a song on the Lab page and it lands here.
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
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs, artists, sounds…"
              className="h-11 pl-9"
              aria-label="Search history"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["song", "Songs"],
                ["custom", "Create"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "h-11 rounded-full px-4 text-sm font-medium transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  filter === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
            <p className="ml-auto self-center text-xs tabular-nums text-muted-foreground">
              {visible.length} of {user.length}
            </p>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((p) => (
                <li
                  key={p.id}
                  className="sl-card flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <Link to="/preset/$id" params={{ id: p.id }} className="min-w-0 flex-1 overflow-hidden">
                    <div className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {p.source === "custom" ? "Create" : "Song"} · {p.instrument} · {DEVICE_MAP[p.stompModel]?.short ?? p.stompModel}
                    </div>
                    <div className="truncate font-medium">
                      {p.song ? `${p.song}${p.artist ? ` — ${p.artist}` : ""}` : p.name}
                    </div>
                    <p className="line-clamp-2 break-words text-sm text-muted-foreground">{p.summary}</p>
                    {p.createdAt ? (
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    ) : null}
                  </Link>
                  {confirmId === p.id ? (
                    <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                      <Button type="button" variant="destructive" className="h-11" onClick={() => onDelete(p)}>
                        Delete
                      </Button>
                      <Button type="button" variant="secondary" className="h-11" onClick={() => setConfirmId(null)}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center">
                      {canExportHlx(p.stompModel) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          aria-label={`Download .${exportExtension(p.stompModel) ?? "hlx"} again`}
                          onClick={() => onRedownload(p)}
                        >
                          <Download className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={`Delete ${p.song || p.name}`}
                        onClick={() => setConfirmId(p.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{p.artist}</div>
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
