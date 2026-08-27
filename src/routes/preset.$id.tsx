import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { FEATURED } from "@/data/featured";
import { PresetWorkspace } from "@/components/preset/preset-workspace";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/preset/$id")({ component: PresetPage });

function PresetPage() {
  const { id } = Route.useParams();
  const presets = useAppStore((s) => s.presets);
  const savePreset = useAppStore((s) => s.savePreset);
  const hydrate = useAppStore((s) => s.hydrate);
  const stompModel = useAppStore((s) => s.stompModel);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const preset = useMemo(() => {
    const fromStore = presets.find((p) => p.id === id);
    if (fromStore) return fromStore;
    const featured = FEATURED.find((p) => p.id === id || `${p.id}-${stompModel}` === id);
    if (!featured) return null;
    return {
      ...featured,
      id,
      stompModel,
      createdAt: Date.now(),
      footswitches:
        stompModel === "hx-stomp"
          ? featured.footswitches.filter((f) => f.index <= 3)
          : featured.footswitches,
    };
  }, [id, presets, stompModel]);

  if (!preset) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">Preset not found</h1>
        <p className="text-sm text-muted-foreground">It may have been cleared from this browser.</p>
        <Link to="/" className="text-sm underline">
          Back to Lab
        </Link>
      </div>
    );
  }

  return (
    <PresetWorkspace
      preset={preset}
      onChange={(next) => {
        savePreset(next);
      }}
    />
  );
}
