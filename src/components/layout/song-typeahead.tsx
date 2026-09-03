import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestSongsFn, type SongHit } from "@/lib/songs";

function hitKey(h: Pick<SongHit, "song" | "artist">) {
  return `${h.song.trim().toLowerCase()}|${h.artist.trim().toLowerCase()}`;
}

export function SongTypeahead({
  song,
  artist,
  instrument,
  onSong,
  onArtist,
  onPick,
}: {
  song: string;
  artist: string;
  instrument: "guitar" | "bass";
  onSong: (v: string) => void;
  onArtist: (v: string) => void;
  onPick: (hit: SongHit) => void;
}) {
  const [hits, setHits] = useState<SongHit[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ignoreBlur = useRef(false);
  const picked = useRef("");
  const lastPick = useRef(0);

  function pick(hit: SongHit) {
    const now = Date.now();
    if (now - lastPick.current < 250) return;
    lastPick.current = now;
    ignoreBlur.current = true;
    picked.current = hitKey(hit);
    setHits([]);
    setOpen(false);
    onPick(hit);
    window.setTimeout(() => {
      ignoreBlur.current = false;
    }, 600);
  }

  useEffect(() => {
    const q = song.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    if (picked.current && picked.current === hitKey({ song, artist })) {
      setOpen(false);
      return;
    }
    const handle = window.setTimeout(() => {
      void suggestSongsFn({ data: { q, instrument } })
        .then((rows) => {
          if (picked.current && picked.current === hitKey({ song, artist })) {
            setOpen(false);
            return;
          }
          setHits(rows);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [song, artist, instrument]);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_180px]" data-tour="song">
      <div className="relative space-y-1.5" ref={box}>
        <Label htmlFor="song">Song</Label>
        <Input
          id="song"
          value={song}
          onChange={(e) => {
            picked.current = "";
            onSong(e.target.value);
            setOpen(true);
          }}
          onFocus={() => hits.length && !picked.current && setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (!ignoreBlur.current) setOpen(false);
            }, 220);
          }}
          placeholder="Smells Like Teen Spirit"
          required
          autoComplete="off"
        />
        {open && hits.length ? (
          <ul
            className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={() => {
              ignoreBlur.current = true;
            }}
          >
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(h);
                  }}
                >
                  {h.artwork ? (
                    <img
                      src={h.artwork}
                      alt=""
                      className="size-10 shrink-0 rounded-sm object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-secondary font-mono text-[10px] text-muted-foreground">
                      SL
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{h.song}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {h.artist}
                      {h.album ? ` · ${h.album}` : ""}
                    </span>
                  </span>
                  {h.featuredId ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Lab
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="artist">Artist</Label>
        <Input
          id="artist"
          value={artist}
          onChange={(e) => onArtist(e.target.value)}
          placeholder="Nirvana"
        />
      </div>
    </div>
  );
}
