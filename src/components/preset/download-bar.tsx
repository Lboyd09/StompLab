import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Which footswitch mode the file opens in on the unit. Separate from the view tabs on the replica. */
export type ExportMode = "snapshot" | "stomp";

export const EXPORT_MODE_LABEL: Record<ExportMode, string> = {
  snapshot: "Snapshot",
  stomp: "Stomp",
};

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
