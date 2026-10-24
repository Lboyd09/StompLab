import { useEffect, useState } from "react";
import { PLAYBACK_MAP, PLAYBACK_TARGETS, playbackOptionsFor } from "@/data/playback";
import type { PlaybackTarget, StompModelId } from "@/data/types";
import { Label } from "@/components/ui/label";

export function PlaybackSelect({
  value,
  onChange,
  stompModel,
}: {
  value: PlaybackTarget;
  onChange: (v: PlaybackTarget) => void;
  /** Hides rigs this unit cannot do (4-cable needs a send/return, power amp needs an amp model). */
  stompModel?: StompModelId;
}) {
  const options = stompModel ? playbackOptionsFor(stompModel) : PLAYBACK_TARGETS.filter((t) => t.id !== "guitar-amp");
  const offered = options.some((t) => t.id === value);
  useEffect(() => {
    if (!offered) onChange("frfr");
  }, [offered, onChange]);
  const current = (offered && PLAYBACK_MAP[value]) || options[0];
  return (
    <div className="space-y-1.5">
      <Label htmlFor="playback" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Playing through
      </Label>
      <select
        id="playback"
        value={current.id}
        onChange={(e) => onChange(e.target.value as PlaybackTarget)}
        className="h-11 w-full rounded-md border border-border bg-card px-3 text-base"
      >
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <p className="text-xs leading-relaxed text-muted-foreground">{current.hint}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{current.detail}</p>
    </div>
  );
}

/** Home: one line. The full select opens only when the player taps "change". */
export function PlaybackLine({
  value,
  onChange,
  stompModel,
}: {
  value: PlaybackTarget;
  onChange: (v: PlaybackTarget) => void;
  stompModel: StompModelId;
}) {
  const [editing, setEditing] = useState(false);
  const options = playbackOptionsFor(stompModel);
  const offered = options.some((t) => t.id === value);
  useEffect(() => {
    if (!offered) onChange("frfr");
  }, [offered, onChange]);
  const current = (offered && PLAYBACK_MAP[value]) || options[0];
  if (editing) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="playback" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Playing through
        </Label>
        <select
          id="playback"
          value={current.id}
          autoFocus
          onChange={(e) => {
            onChange(e.target.value as PlaybackTarget);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          className="h-11 w-full rounded-md border border-border bg-card px-3 text-base"
        >
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <p className="flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground">
      <span className="min-w-0 truncate">
        Playing through: <span className="font-medium text-foreground">{current.label}</span>
      </span>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-11 shrink-0 px-1 font-medium text-primary underline underline-offset-2"
      >
        change
      </button>
    </p>
  );
}
