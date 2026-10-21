import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEVICE_MAP, STOMP_DEVICES } from "@/data/categories";
import type { StompModelId } from "@/data/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

/** Phone header: one chip ("HX Stomp · Guitar") that opens a small sheet for unit and instrument. */
export function UnitChip({ className }: { className?: string }) {
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const device = DEVICE_MAP[stompModel] ?? STOMP_DEVICES[0];

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Unit and instrument: ${device.name}, ${instrument}. Change`}
        className="inline-flex h-11 max-w-full items-center gap-1 rounded-full bg-secondary px-3 text-sm font-medium"
      >
        <span className="truncate">
          {device.name}
          {/* Long unit names have no room for the instrument on a phone; bass is the one worth flagging. */}
          <span className={device.name.length > 8 && instrument === "guitar" ? "hidden sm:inline" : ""}>
            {" · "}
            <span className="capitalize">{instrument === "bass" ? "Bass" : "Guitar"}</span>
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Unit and instrument">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Your setup</p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 place-items-center rounded-md text-muted-foreground"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">Playing</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["guitar", "bass"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={instrument === id}
                  onClick={() => setInstrument(id)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-medium capitalize",
                    instrument === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
            <p className="mb-2 text-xs text-muted-foreground">Unit</p>
            <div className="grid gap-2">
              {STOMP_DEVICES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={stompModel === d.id}
                  onClick={() => {
                    setStompModel(d.id as StompModelId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-11 items-center justify-between rounded-lg border px-3 text-sm font-medium",
                    stompModel === d.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  <span>{d.name}</span>
                  <span className="font-mono text-xs uppercase text-muted-foreground">.{d.exportFormat}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
