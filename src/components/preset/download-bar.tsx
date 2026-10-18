import { Link } from "@tanstack/react-router";
import { Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { canShareFile, shareFile } from "@/lib/share-file";
import { cn } from "@/lib/utils";

/** Which footswitch mode the file opens in on the unit. Separate from the view tabs on the replica. */
export type ExportMode = "snapshot" | "stomp";

export const EXPORT_MODE_LABEL: Record<ExportMode, string> = {
  snapshot: "Snapshot",
  stomp: "Stomp",
};

export function ExportModePicker({
  value,
  onChange,
  className,
}: {
  value: ExportMode;
  onChange: (mode: ExportMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p id="export-mode-label" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        File opens in
      </p>
      <div role="radiogroup" aria-labelledby="export-mode-label" className="flex rounded-full bg-secondary p-1">
        {(["snapshot", "stomp"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            className={cn(
              "h-11 flex-1 rounded-full px-3 text-xs font-medium sm:flex-none sm:px-4 md:h-9",
              value === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {EXPORT_MODE_LABEL[id]} mode{id === "snapshot" ? " (best)" : ""}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === "snapshot"
          ? "Numbered switches recall the song sections."
          : "Switches turn single effects on and off."}
      </p>
    </div>
  );
}

/** After a download: what to do next, and a way to rate it once the player has played it. Not a modal. */
export function ImportPanel({
  unitName,
  editor,
  filename,
  mode,
  getJson,
  onClose,
  onRate,
  upsell,
}: {
  unitName: string;
  editor: string;
  filename: string;
  mode: ExportMode;
  getJson: () => string;
  onClose: () => void;
  onRate: () => void;
  /** Shown to players without a plan: the next step after a free demo. */
  upsell?: React.ReactNode;
}) {
  const [json, setJson] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    try {
      const text = getJson();
      setJson(text);
      setCanShare(canShareFile(text, filename));
    } catch {
      setCanShare(false);
    }
    // The panel is opened fresh after each download.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, mode]);

  async function onShare() {
    if (!json) return;
    const res = await shareFile(json, filename, `${unitName} preset`);
    if (res === "unsupported") toast.error("Sharing is not available here. Use the downloaded file in Files.");
  }

  return (
    <div className="max-h-[55dvh] overflow-y-auto border-b border-border bg-card px-4 py-4" role="region" aria-label="Import steps">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Saved {filename}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{editor} is a computer app. Get the file there, then import.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground"
          aria-label="Close import steps"
        >
          <X className="size-5" />
        </button>
      </div>
      {canShare ? (
        <Button type="button" variant="secondary" className="mt-3 h-11 w-full sm:w-auto" onClick={() => void onShare()}>
          <Share2 className="size-4" />
          Send to my computer
        </Button>
      ) : null}
      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">On your computer</p>
        <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
          <li>1. Open {editor}.</li>
          <li>2. File, then Import. Pick {filename}.</li>
          <li>
            3. Put the {unitName} in {EXPORT_MODE_LABEL[mode]} mode.
          </li>
        </ol>
      </div>
      {upsell ? <div className="mt-4">{upsell}</div> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2">
        <p className="text-sm">After you play it: how close was it?</p>
        <button
          type="button"
          onClick={onRate}
          className="h-11 rounded-full px-3 text-sm font-medium text-primary underline underline-offset-4"
        >
          Rate it
        </button>
      </div>
    </div>
  );
}

/** Sticky bar above the phone nav: unit, file type, Download. */
export function DownloadBar({
  unitName,
  ext,
  mode,
  onMode,
  canDownload,
  signInNext,
  onDownload,
  panel,
}: {
  unitName: string;
  ext: string;
  mode: ExportMode;
  onMode: (mode: ExportMode) => void;
  canDownload: boolean;
  /** Shared link: the page to return to after sign-in. Replaces Subscribe. */
  signInNext?: string;
  onDownload: () => void;
  panel?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 backdrop-blur md:bottom-0">
      {panel}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{unitName}</p>
          {canDownload ? (
            <button
              type="button"
              onClick={() => onMode(mode === "snapshot" ? "stomp" : "snapshot")}
              aria-label={`File opens in ${EXPORT_MODE_LABEL[mode]} mode. Tap to switch.`}
              className="-my-2 flex min-h-11 max-w-full items-center truncate text-xs text-muted-foreground"
            >
              .{ext} · opens in {EXPORT_MODE_LABEL[mode]} mode
              <span className="ml-1.5 text-primary underline underline-offset-2">change</span>
            </button>
          ) : (
            <p className="truncate text-xs text-muted-foreground">.{ext} file</p>
          )}
        </div>
        {canDownload ? (
          <Button type="button" size="lg" className="h-11 shrink-0 px-5" onClick={onDownload}>
            Download .{ext}
          </Button>
        ) : signInNext ? (
          <Button asChild size="lg" className="h-11 shrink-0 px-5">
            <Link to="/login" search={{ next: signInNext }}>
              Sign in
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="h-11 shrink-0 px-5">
            <Link to="/upgrade">Subscribe</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
