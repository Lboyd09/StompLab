import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { PresetWorkspace } from "@/components/preset/preset-workspace";
import { Button } from "@/components/ui/button";
import { DEVICE_MAP } from "@/data/categories";
import { featuredForPlayer, openFeatured } from "@/lib/open-featured";
import { featuredOriginal, resolveNamedPreset, stompModelFromId } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/preset/$id")({ component: PresetPage });

function PresetPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const presets = useAppStore((s) => s.presets);
  const savePreset = useAppStore((s) => s.savePreset);
  const patchCurrent = useAppStore((s) => s.patchCurrent);
  const historyReady = useAppStore((s) => s.historyReady);
  const hydrate = useAppStore((s) => s.hydrate);
  const stompModel = useAppStore((s) => s.stompModel);
  const gear = useAppStore((s) => s.gear);
  const wahMode = useAppStore((s) => s.wahMode);
  const wahModelId = useAppStore((s) => s.wahModelId);
  const playbackTarget = useAppStore((s) => s.playbackTarget);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // A link opens at the unit it names (a friend's Helix link stays Helix); the player's own
  // unit setting is never changed by opening a link.
  const urlModel = stompModelFromId(id);
  const exact = presets.find((p) => p.id === id);
  const model = urlModel ?? exact?.stompModel ?? stompModel;

  const preset = useMemo(() => {
    const resolved = resolveNamedPreset(id, model, presets);
    if (!resolved) return null;
    const inStore = presets.some((p) => p.id === resolved.id);
    const src = featuredOriginal(id);
    if (resolved.source === "featured" && !inStore && src) {
      return featuredForPlayer(
        { ...src, createdAt: resolved.createdAt },
        { stompModel: model, gear, wahMode, wahModelId, playbackTarget },
      );
    }
    return resolved;
  }, [id, presets, model, gear, wahMode, wahModelId, playbackTarget]);

  const inStore = preset ? presets.some((p) => p.id === preset.id) : false;
  const otherUnit = urlModel && urlModel !== stompModel ? urlModel : null;

  useEffect(() => {
    if (!preset) return;
    // Wait for this account's History before writing, and never write over a stored (maybe edited)
    // copy. A link for another unit stays out of History until "Open on my …".
    if (historyReady && !inStore && !otherUnit) savePreset(preset);
    if (preset.source === "featured" && preset.id !== id) {
      void navigate({ to: "/preset/$id", params: { id: preset.id }, replace: true });
    }
  }, [preset, inStore, otherUnit, historyReady, id, savePreset, navigate]);

  function openOnMyUnit() {
    if (!preset) return;
    const settings = { stompModel, gear, wahMode, wahModelId, playbackTarget };
    const opened = openFeatured(preset.id, settings, presets);
    if (opened) {
      if (opened.save) savePreset(opened.preset);
      void navigate({ to: "/preset/$id", params: { id: opened.preset.id } });
    }
  }

  if (!preset || !id) {
    if (!historyReady) {
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your presets…
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <h1 className="sl-hero-title text-3xl">Preset not found</h1>
        <p className="text-sm text-muted-foreground">It may have been cleared from this browser.</p>
        <Link to="/" className="text-sm underline">
          Back to Lab
        </Link>
      </div>
    );
  }

  return (
    <>
      {otherUnit && featuredOriginal(preset.id) ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">This link is for the {DEVICE_MAP[otherUnit]?.name ?? "other unit"}.</span>
          <Button type="button" size="sm" variant="secondary" onClick={openOnMyUnit}>
            Open on my {DEVICE_MAP[stompModel]?.name ?? "unit"}
          </Button>
        </div>
      ) : null}
      <PresetWorkspace
        preset={preset}
        onChange={(next) => {
          // Memory now, disk once the knob stops moving.
          patchCurrent({ ...next, userEdited: true });
        }}
      />
    </>
  );
}
