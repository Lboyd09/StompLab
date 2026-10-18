import { Link } from "@tanstack/react-router";
import { Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Preset } from "@/data/types";
import { submitAuthedFeedbackFn } from "@/lib/billing";
import { FREE_BUILD_LINE } from "@/lib/copy";
import { canShareFile, shareFile } from "@/lib/share-file";
import { usePlan } from "@/lib/use-plan";

const TAGS = [
  "Spot on",
  "Too much gain",
  "Not enough gain",
  "Too dark",
  "Too bright",
  "Wrong amp",
  "Wrong effect",
  "Delay or reverb off",
  "Parts jump in volume",
  "Too quiet",
] as const;

const RATED_KEY = (id: string) => `stomplab.rated.${id}`;
const LATER_KEY = (id: string) => `stomplab.rateLater.${id}`;

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the ask just comes back */
  }
}

/** True when the player said "after I play" on an earlier visit and hasn't rated yet. */
export function shouldAskAgain(presetId: string): boolean {
  if (readLocal(RATED_KEY(presetId))) return false;
  const later = Number(readLocal(LATER_KEY(presetId)) || 0);
  return later > 0 && Date.now() - later > 10 * 60 * 1000;
}

/**
 * Opens right after a download: how to import it, then how close it was.
 * The ratings, tags and the preset itself feed the prompt once an admin approves them.
 */
export function PostDownloadDialog({
  open,
  preset,
  filename,
  editor,
  unitName,
  modeLabel,
  fsMode,
  getJson,
  showImport,
  onClose,
}: {
  open: boolean;
  preset: Preset;
  filename: string | null;
  editor: string;
  unitName: string;
  modeLabel: string;
  fsMode: "snapshot" | "stomp";
  getJson: () => string;
  showImport: boolean;
  onClose: () => void;
}) {
  const { plan } = usePlan();
  const [rating, setRating] = useState<number | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState("");
  const [changed, setChanged] = useState("");
  const [busy, setBusy] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (!open || !filename || !showImport) return;
    try {
      setCanShare(canShareFile(getJson(), filename));
    } catch {
      setCanShare(false);
    }
    // Fresh on each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filename, showImport]);

  if (!open || typeof document === "undefined") return null;

  const song = preset.song || preset.name;
  const hasAnswer = Boolean(rating) || tags.length > 0 || changed.trim().length >= 4;

  function later() {
    writeLocal(LATER_KEY(preset.id), String(Date.now()));
    onClose();
  }

  async function send() {
    if (!hasAnswer) return;
    setBusy(true);
    try {
      await submitAuthedFeedbackFn({
        data: {
          kind: "preset",
          song,
          rating,
          closerTweaks: changed.trim(),
          message: changed.trim() || tags.join(", ") || (rating ? `Rated ${rating}/5` : ""),
          context: {
            unit: preset.stompModel,
            artist: preset.artist,
            presetId: preset.id,
            snapshot: snapshot || undefined,
            tags,
            fsMode,
            preset,
          },
        },
      });
      writeLocal(RATED_KEY(preset.id), "1");
      writeLocal(LATER_KEY(preset.id), null);
      toast.success("Thanks. That goes straight into making the next preset closer.");
      onClose();
    } catch {
      toast.error("Could not send that. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  async function onShareFile() {
    if (!filename) return;
    const res = await shareFile(getJson(), filename, `${unitName} preset`);
    if (res === "unsupported") toast.error("Sharing is not available here. Use the downloaded file in Files.");
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-background/90 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="post-dl-title">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{showImport ? "Downloaded" : "You played it"}</p>
            <h2 id="post-dl-title" className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {showImport ? "Import it, play it, tell us" : `How close was ${song}?`}
            </h2>
          </div>
          <button type="button" onClick={later} className="-mr-2 grid size-11 shrink-0 place-items-center text-muted-foreground" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
          {showImport && filename ? (
            <section className="space-y-2 rounded-xl bg-secondary/60 p-4">
              <ol className="space-y-1.5 text-sm leading-relaxed">
                <li>1. On your computer, open {editor}.</li>
                <li>2. File, then Import. Pick {filename}.</li>
                <li>3. Put the {unitName} in {modeLabel} mode and play.</li>
              </ol>
              {canShare ? (
                <Button type="button" variant="secondary" className="h-11 w-full" onClick={() => void onShareFile()}>
                  <Share2 className="size-4" />
                  Send the file to my computer
                </Button>
              ) : null}
            </section>
          ) : null}

          {plan.signedIn ? (
            <section className="space-y-4">
              <div>
                <p className="text-sm font-medium">How close to the record? Your answer trains the next presets.</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} out of 5`}
                      aria-pressed={rating === n}
                      className={`h-11 rounded-md border text-sm font-medium ${
                        rating === n ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">What was off?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TAGS.map((t) => {
                    const on = tags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]))}
                        className={`min-h-11 rounded-full border px-3 text-sm ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              {preset.snapshots.length > 1 ? (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Which part?</span>
                  <select
                    value={snapshot}
                    onChange={(e) => setSnapshot(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-border bg-background px-2 text-base"
                  >
                    <option value="">All of it</option>
                    {preset.snapshots.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">What did you change on the unit to get closer?</span>
                <Textarea
                  value={changed}
                  onChange={(e) => setChanged(e.target.value)}
                  placeholder="Drive down to 4, swapped the cab to a Greenback, delay mix lower…"
                  className="min-h-20 text-base"
                />
              </label>
            </section>
          ) : (
            <section className="space-y-2 rounded-xl border border-primary/40 bg-primary/10 p-4">
              <p className="text-sm font-medium">Want a song you actually play?</p>
              <p className="text-sm text-muted-foreground">{FREE_BUILD_LINE}</p>
              <Button asChild className="h-11 w-full">
                <Link to="/login" search={{ mode: "up" }} onClick={onClose}>
                  Create a free account
                </Link>
              </Button>
            </section>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {plan.signedIn ? (
            <>
              <Button type="button" className="h-11 w-full" disabled={busy || !hasAnswer} onClick={() => void send()}>
                {busy ? "Sending…" : "Send"}
              </Button>
              <button type="button" onClick={later} className="block min-h-11 w-full text-center text-sm text-muted-foreground underline underline-offset-2">
                I'll rate it after I play
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="block min-h-11 w-full text-center text-sm text-muted-foreground underline underline-offset-2">
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
