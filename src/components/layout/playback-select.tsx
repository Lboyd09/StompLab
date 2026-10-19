import { useEffect } from "react";
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
