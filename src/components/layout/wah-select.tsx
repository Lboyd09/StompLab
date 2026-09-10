import { Label } from "@/components/ui/label";
import { WAH_MODELS, type WahMode } from "@/lib/wah";

const MODES: { id: WahMode; label: string; hint: string }[] = [
  {
    id: "pedal",
    label: "I have a wah pedal",
    hint: "We leave wah out of the Helix chain. Plug yours in front of the unit.",
  },
  {
    id: "exp",
    label: "Helix wah + expression pedal",
    hint: "Adds a wah block and assigns EXP 1 to Position when the song used a wah.",
  },
  {
    id: "fs",
    label: "Helix wah + footswitch",
    hint: "Adds a wah block you stomp on/off. Park Position if you sweep by hand.",
  },
];

export function WahSelect({
  mode,
  modelId,
  onMode,
  onModel,
}: {
  mode: WahMode;
  modelId: string;
  onMode: (mode: WahMode) => void;
  onModel: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <Label>Wah</Label>
      <p className="text-xs text-muted-foreground">
        A wah only belongs in the Helix chain if you want the modeler to do it. Otherwise use the pedal
        you already own.
      </p>
      <div className="flex flex-col gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMode(m.id)}
            className={`rounded-xl border px-4 py-3 text-left ${
              mode === m.id ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/60"
            }`}
          >
            <span className="block text-sm font-medium">{m.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>
      {mode !== "pedal" ? (
        <div className="space-y-2">
          <Label>Which Helix wah</Label>
          <div className="flex flex-wrap gap-2">
            {WAH_MODELS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onModel(w.id)}
                className={`h-10 rounded-full px-4 text-sm ${
                  modelId === w.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
