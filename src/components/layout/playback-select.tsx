import { PLAYBACK_TARGETS } from "@/data/playback";
import type { PlaybackTarget } from "@/data/types";
import { Label } from "@/components/ui/label";

export function PlaybackSelect({
  value,
  onChange,
}: {
  value: PlaybackTarget;
  onChange: (v: PlaybackTarget) => void;
}) {
  const current = PLAYBACK_TARGETS.find((t) => t.id === value) ?? PLAYBACK_TARGETS[0];
  return (
    <div className="space-y-1.5">
      <Label htmlFor="playback">Running out of</Label>
      <select
        id="playback"
        value={value}
        onChange={(e) => onChange(e.target.value as PlaybackTarget)}
        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
      >
        {PLAYBACK_TARGETS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{current.hint}</p>
    </div>
  );
}
