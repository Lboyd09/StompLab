import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { PresetWorkspace } from "@/components/preset/preset-workspace";
import { overlayUserGear } from "@/lib/preset-schema";
import { featuredBaseId, resolveNamedPreset, stompModelFromId } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/preset/$id")({ component: PresetPage });

function PresetPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const presets = useAppStore((s) => s.presets);
  const savePreset = useAppStore((s) => s.savePreset);
  const hydrate = useAppStore((s) => s.hydrate);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const gear = useAppStore((s) => s.gear);
  const syncedId = useRef<string | null>(null);
  const wroteId = useRef<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const urlModel = stompModelFromId(id);
    if (urlModel && syncedId.current !== id) {
      syncedId.current = id;
      if (urlModel !== stompModel) setStompModel(urlModel);
    }
  }, [id, stompModel, setStompModel]);

  const urlModel = stompModelFromId(id);
  const model = urlModel && syncedId.current !== id ? urlModel : stompModel;

  const preset = useMemo(() => {
    const resolved = resolveNamedPreset(id, model, presets);
    if (!resolved) return null;
    const inStore = presets.some(
      (p) => p.id === resolved.id || featuredBaseId(p.id) === featuredBaseId(id),
    );
    if (resolved.source === "featured" && !inStore) {
      return overlayUserGear(resolved, gear);
    }
    return resolved;
  }, [id, presets, model, gear]);

  useEffect(() => {
    if (!preset) return;
    if (wroteId.current !== preset.id) {
      savePreset(preset);
      wroteId.current = preset.id;
    }
    if (preset.source === "featured" && preset.id !== id) {
      void navigate({ to: "/preset/$id", params: { id: preset.id }, replace: true });
    }
  }, [preset, id, savePreset, navigate]);

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
        wroteId.current = next.id;
        savePreset(next);
      }}
    />
  );
}
