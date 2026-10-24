import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Download, GripVertical, Lock } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SampleGate, SetToggle, samplePriceLine } from "@/components/layout/paywall-sample";
import { Button } from "@/components/ui/button";
import { sampleMeta, sampleModelName, sampleSetlist, type SampleSong } from "@/data/sample-setlists";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/setlist_/demo")({
  validateSearch: (s: Record<string, unknown>): { set?: "worship" | "cover" } => ({
    set: s.set === "cover" ? "cover" : s.set === "worship" ? "worship" : undefined,
  }),
  component: SetlistDemo,
});

function SetlistDemo() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = sampleSetlist(search.set);
  const [open, setOpen] = useState<string | null>(set.songs[0]?.id ?? null);
  const [gate, setGate] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <PageHeader kicker="Sample setlist" title={set.name}>
        {set.blurb} This is a sample with made-up settings. Look around. Downloading and editing unlock with an account.
      </PageHeader>

      <SetToggle
        value={set.id}
        onChange={(id) => {
          void navigate({ search: { set: id }, replace: true });
          setOpen(sampleSetlist(id).songs[0]?.id ?? null);
        }}
      />

      <p className="text-sm text-muted-foreground">
        {set.songs.length} songs · files for your HX Stomp
      </p>

      <ol className="space-y-2">
        {set.songs.map((song, i) => (
          <SongRow
            key={song.id}
            song={song}
            index={i}
            open={open === song.id}
            onToggle={() => setOpen(open === song.id ? null : song.id)}
            onGate={setGate}
          />
        ))}
      </ol>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <Button type="button" className="h-11 w-full" onClick={() => setGate("download the whole set")}>
          <Download className="size-4" />
          Download whole set (.zip)
        </Button>
        <Button type="button" variant="secondary" className="h-11 w-full" onClick={() => setGate("add your own songs")}>
          Add a song
        </Button>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Import</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Unzip the file. Each song is numbered in set order.</li>
            <li>In HX Edit, pick an empty preset slot for song 1.</li>
            <li>File, Import each file in this order.</li>
            <li>Put the unit in Snapshot mode so the switches recall each part.</li>
          </ol>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl font-semibold tracking-tight">Make this for your own songs</h2>
        <p className="text-sm text-muted-foreground">{samplePriceLine()}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="h-11 sm:flex-1">
            <Link to="/upgrade">Subscribe</Link>
          </Button>
          <Button asChild variant="secondary" className="h-11 sm:flex-1">
            <Link to="/login" search={{ mode: "up", next: "/setlist/demo" }}>
              Create a free account
            </Link>
          </Button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Sample settings are examples, not copies of the records, and not affiliated with Line 6.
      </p>

      {gate ? <SampleGate action={gate} onClose={() => setGate(null)} /> : null}
    </div>
  );
}

function SongRow({
  song,
  index,
  open,
  onToggle,
  onGate,
}: {
  song: SampleSong;
  index: number;
  open: boolean;
  onToggle: () => void;
  onGate: (action: string) => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1 py-1 pl-2 pr-1">
        <span
          aria-hidden
          title="Drag to reorder (unlocked with an account)"
          className="flex size-8 shrink-0 cursor-not-allowed items-center justify-center text-muted-foreground/40"
        >
          <GripVertical className="size-4" />
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{song.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {song.artist} · {sampleMeta(song)}
            </span>
          </span>
          <ChevronDown className={cn("mr-2 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parts (Snapshot mode)</p>
            <ul className="grid gap-2 sm:grid-cols-3">
              {song.parts.map((p) => (
                <li key={p.fs} className="rounded-lg border border-border bg-muted/30 p-2.5">
                  <p className="text-xs text-muted-foreground">FS{p.fs}</p>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.note}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signal chain</p>
            <ol className="space-y-2">
              {song.chain.map((b, i) => (
                <li key={`${b.modelId}-${i}`} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{sampleModelName(b.modelId)}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">{b.role}</p>
                  </div>
                  <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {Object.entries(b.knobs).map(([k, v]) => (
                      <div key={k} className="flex gap-1">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="h-11 sm:flex-1" onClick={() => onGate(`download ${song.title}`)}>
              <Download className="size-4" />
              Download .hlx
            </Button>
            <Button type="button" variant="secondary" className="h-11 sm:flex-1" onClick={() => onGate("edit knobs")}>
              <Lock className="size-4" />
              Edit knobs
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
