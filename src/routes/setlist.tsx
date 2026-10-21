import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { PaywallCard } from "@/components/layout/paywall-card";
import { ResearchProgress } from "@/components/layout/research-progress";
import { SongTypeahead } from "@/components/layout/song-typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEVICE_MAP } from "@/data/categories";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import type { Preset } from "@/data/types";
import { PAID_BUILD_LINE } from "@/lib/copy";
import { exportExtension } from "@/lib/hlx";
import { notifyResearchSource } from "@/lib/notify";
import { overlayUserGear } from "@/lib/preset-schema";
import { resolveNamedPreset, withStompModel } from "@/lib/preset-utils";
import {
  SETLIST_CAP,
  SETLIST_SONG_CAP,
  addToSetlist,
  exportSetlist,
  moveItem,
  newSetlist,
  removeItem,
  setlistZipName,
  type Setlist,
} from "@/lib/setlist";
import { buildSong } from "@/lib/song-build";
import { looksLikeRealSong } from "@/lib/song-check";
import { trackDownload } from "@/lib/track";
import { usePlan } from "@/lib/use-plan";
import { applyWahPreference } from "@/lib/wah";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/setlist")({
  validateSearch: (s: Record<string, unknown>): { id?: string; add?: string } => ({
    id: typeof s.id === "string" && s.id.length ? s.id : undefined,
    add: typeof s.add === "string" && s.add.length ? s.add : undefined,
  }),
  component: SetlistPage,
});

function presetTitle(p: Preset) {
  return (p.song || p.name || "Preset").trim();
}

function SetlistPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { plan, isPending } = usePlan();
  const setlists = useAppStore((s) => s.setlists);
  const saveSetlist = useAppStore((s) => s.saveSetlist);
  const presets = useAppStore((s) => s.presets);
  const stompModel = useAppStore((s) => s.stompModel);
  const subscribed = plan.paid || plan.admin;

  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!subscribed) {
    return (
      <PaywallCard
        title="Setlists"
        body="Put Sunday's songs in order and download the whole set as one file, ready for HX Edit. Setlists come with a subscription."
      />
    );
  }

  const adding = search.add ? findPreset(search.add, presets, stompModel) : null;
  const current = search.id ? setlists.find((s) => s.id === search.id) : undefined;

  function addTo(set: Setlist, preset: Preset) {
    if (set.items.length >= SETLIST_SONG_CAP) {
      toast.error(`A setlist holds ${SETLIST_SONG_CAP} songs.`);
      return;
    }
    saveSetlist(addToSetlist(set, preset));
    toast.success(`Added ${presetTitle(preset)} to ${set.name}.`);
    void navigate({ to: "/setlist", search: { id: set.id } });
  }

  if (adding) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-16">
        <PageHeader kicker="Setlists" title="Add to setlist">
          {presetTitle(adding)}
          {adding.artist ? ` — ${adding.artist}` : ""}
        </PageHeader>
        <div className="space-y-2">
          {setlists.map((s) => (
            <Button
              key={s.id}
              type="button"
              variant="secondary"
              className="h-11 w-full justify-between"
              onClick={() => addTo(s, adding)}
            >
              <span className="truncate">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.items.length} songs</span>
            </Button>
          ))}
        </div>
        <NewSetlistForm
          label="Or start a new one"
          onCreate={(name) => {
            const set = newSetlist(name);
            addTo(set, adding);
          }}
          disabled={setlists.length >= SETLIST_CAP}
        />
      </div>
    );
  }

  if (current) return <SetlistEditor set={current} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <PageHeader kicker="Setlists" title="Setlists">
        Songs in order for the next gig. Download the set as one zip, one file per song.
      </PageHeader>
      <NewSetlistForm
        label="New setlist"
        disabled={setlists.length >= SETLIST_CAP}
        onCreate={(name) => {
          const set = newSetlist(name);
          saveSetlist(set);
          void navigate({ to: "/setlist", search: { id: set.id } });
        }}
      />
      {setlists.length ? (
        <ul className="space-y-2">
          {setlists.map((s) => (
            <li key={s.id}>
              <Link
                to="/setlist"
                search={{ id: s.id }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0 truncate font-medium">{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.items.length} song{s.items.length === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No setlists yet.</p>
      )}
    </div>
  );
}

function findPreset(id: string, presets: Preset[], unit: Preset["stompModel"]): Preset | null {
  return presets.find((p) => p.id === id) ?? resolveNamedPreset(id, unit, presets);
}

function NewSetlistForm({
  label,
  onCreate,
  disabled,
}: {
  label: string;
  onCreate: (name: string) => void;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) {
          toast.error(`You can keep ${SETLIST_CAP} setlists. Delete one first.`);
          return;
        }
        onCreate(name.trim() || "Sunday");
        setName("");
      }}
    >
      <label htmlFor="new-setlist" className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id="new-setlist"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sunday 9am"
          className="h-11 min-w-0 flex-1"
        />
        <Button type="submit" className="h-11 shrink-0">
          Create
        </Button>
      </div>
    </form>
  );
}

function SetlistEditor({ set }: { set: Setlist }) {
  const navigate = useNavigate();
  const { plan, isPending: planPending, refresh } = usePlan();
  const saveSetlist = useAppStore((s) => s.saveSetlist);
  const removeSetlist = useAppStore((s) => s.removeSetlist);
  const savePreset = useAppStore((s) => s.savePreset);
  const presets = useAppStore((s) => s.presets);
  const stompModel = useAppStore((s) => s.stompModel);
  const instrument = useAppStore((s) => s.instrument);
  const gear = useAppStore((s) => s.gear);
  const wahMode = useAppStore((s) => s.wahMode);
  const wahModelId = useAppStore((s) => s.wahModelId);
  const [q, setQ] = useState("");
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [picked, setPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const device = DEVICE_MAP[stompModel];
  const ext = exportExtension(stompModel);
  const editor = ext === "pgp" ? "POD Go Edit" : "HX Edit";
  const full = set.items.length >= SETLIST_SONG_CAP;
  const history = presets.filter((p) => p.source !== "featured");
  const historyHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return history
      .filter((p) => !needle || `${p.song ?? ""} ${p.artist ?? ""} ${p.name}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [history, q]);
  const demos = FEATURED.filter((p) => p.instrument === instrument && (DEMO_IDS as readonly string[]).includes(p.id));
  const needsSong = !picked && !looksLikeRealSong(song, artist);

  function add(preset: Preset) {
    if (full) {
      toast.error(`A setlist holds ${SETLIST_SONG_CAP} songs.`);
      return;
    }
    saveSetlist(addToSetlist(set, preset));
    toast.success(`Added ${presetTitle(preset)}.`);
  }

  function addDemo(src: Preset) {
    add(
      applyWahPreference(
        overlayUserGear(withStompModel({ ...src, createdAt: Date.now() }, stompModel), gear),
        wahMode,
        wahModelId,
      ),
    );
  }

  async function onBuild(e: React.FormEvent) {
    e.preventDefault();
    if (full) {
      toast.error(`A setlist holds ${SETLIST_SONG_CAP} songs.`);
      return;
    }
    let tick = 0;
    setStatus("");
    try {
      const outcome = await buildSong(
        { song, artist, instrument, stompModel, playbackTarget: useAppStore.getState().playbackTarget, gear, wahMode, wahModelId },
        { plan, planPending },
        {
          onStart: () => {
            setBusy(true);
            setProgress(8);
            tick = window.setInterval(() => setProgress((p) => (p >= 94 ? 94 : p + 3)), 450);
          },
          login: () => void navigate({ to: "/login", search: { next: "/setlist" } }),
          upgrade: () => void navigate({ to: "/upgrade" }),
        },
      );
      if (outcome.kind === "login") {
        await navigate({ to: "/login", search: { next: "/setlist" } });
        return;
      }
      if (outcome.kind === "upgrade") {
        await navigate({ to: "/upgrade" });
        return;
      }
      if (outcome.kind === "stopped") {
        if (outcome.status) setStatus(outcome.status);
        return;
      }
      savePreset(outcome.preset);
      notifyResearchSource(outcome.source);
      if (outcome.counted) await refresh();
      add(outcome.preset);
      setSong("");
      setArtist("");
      setPicked(false);
    } finally {
      if (tick) window.clearInterval(tick);
      setBusy(false);
      setProgress(0);
    }
  }

  function onDownload() {
    const result = exportSetlist(set, presets, stompModel, plan);
    for (const s of result.skipped) toast.message(`${s.title}: ${s.reason}`);
    if (!result.zip) {
      if (!result.skipped.length) toast.error("Add a song first.");
      return;
    }
    const blob = new Blob([result.zip as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = setlistZipName(set.name);
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      trackDownload();
      toast.success(`Saved ${setlistZipName(set.name)} (${result.files.length} file${result.files.length === 1 ? "" : "s"}).`);
    } catch {
      toast.error("Download was blocked. Try again, or download each song from its page.");
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <div className="space-y-4">
        <Link to="/setlist" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" />
          All setlists
        </Link>
        <Input
          aria-label="Setlist name"
          defaultValue={set.name}
          key={set.id}
          maxLength={60}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== set.name) saveSetlist({ ...set, name, updatedAt: Date.now() });
          }}
          className="h-12 text-xl font-semibold"
        />
        <p className="text-sm text-muted-foreground">
          {set.items.length} song{set.items.length === 1 ? "" : "s"} · files for your {device?.name ?? "unit"}
        </p>
      </div>

      {set.items.length ? (
        <ol className="space-y-2">
          {set.items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-2 rounded-xl border border-border bg-card py-1 pl-3 pr-1">
              <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.artist ? <p className="truncate text-xs text-muted-foreground">{item.artist}</p> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Move ${item.title} up`}
                disabled={i === 0}
                onClick={() => saveSetlist(moveItem(set, i, -1))}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Move ${item.title} down`}
                disabled={i === set.items.length - 1}
                onClick={() => saveSetlist(moveItem(set, i, 1))}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Remove ${item.title}`}
                onClick={() => saveSetlist(removeItem(set, item.id))}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No songs yet. Add them below in the order you play them.
        </p>
      )}

      {set.items.length && ext ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <Button type="button" className="h-11 w-full" onClick={onDownload}>
            Download set (.zip)
          </Button>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Import</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Unzip the file. Each song is numbered in set order.</li>
              <li>In {editor}, pick an empty preset slot for song 1.</li>
              <li>File → Import each file into a setlist in this order.</li>
              <li>Put the unit in Snapshot mode so the switches recall each part.</li>
            </ol>
          </div>
        </section>
      ) : null}
      {!ext ? (
        <p className="text-sm text-muted-foreground">{device?.name ?? "This unit"} does not load preset files.</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Add from History</h2>
        {history.length ? (
          <>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your builds"
              aria-label="Search History"
              className="h-11"
            />
            <ul className="space-y-1">
              {historyHits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {presetTitle(p)}
                      {p.artist ? <span className="text-muted-foreground"> — {p.artist}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-primary">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing in History yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Add a demo</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {demos.map((p) => (
            <Button key={p.id} type="button" variant="secondary" className="h-11 justify-start" onClick={() => addDemo(p)}>
              <span className="truncate">{p.song}</span>
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Add a new song</h2>
        <p className="text-sm text-muted-foreground">Uses one custom build. {PAID_BUILD_LINE}</p>
        <form noValidate onSubmit={(e) => void onBuild(e)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <SongTypeahead
            song={song}
            artist={artist}
            instrument={instrument}
            onSong={(v) => {
              setSong(v);
              setPicked(false);
            }}
            onArtist={(v) => {
              setArtist(v);
              setPicked(false);
            }}
            onPick={(hit) => {
              setSong(hit.song);
              setArtist(hit.artist);
              setPicked(true);
            }}
          />
          <Button type="submit" className="h-11 w-full" disabled={busy || planPending || needsSong || full}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Researching" : "Build and add"}
          </Button>
          {busy ? <ResearchProgress pct={progress} /> : null}
          {status && !busy ? <p className="text-sm text-destructive">{status}</p> : null}
        </form>
      </section>

      <section className="border-t border-border pt-6">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Delete {set.name}?</span>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => {
                removeSetlist(set.id);
                void navigate({ to: "/setlist", search: {} });
              }}
            >
              Delete
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            Delete setlist
          </Button>
        )}
      </section>
    </div>
  );
}
