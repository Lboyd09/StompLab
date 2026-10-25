import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { PresetWorkspace } from "@/components/preset/preset-workspace";
import { Button } from "@/components/ui/button";
import { DEVICE_MAP } from "@/data/categories";
import { featuredForPlayer, featuredRev, isOutdatedFeatured, openFeatured } from "@/lib/open-featured";
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
  const model = urlModel ?? stompModel;

  const settings = useMemo(
    () => ({ stompModel: model, gear, wahMode, wahModelId, playbackTarget }),
    [model, gear, wahMode, wahModelId, playbackTarget],
  );

  // A demo copy the player never changed is always rebuilt from the latest demo, so fixes reach
  // everyone. A copy they changed is kept, with an offer to swap in the new version.
  const { preset, needsSave } = useMemo(() => {
    const resolved = resolveNamedPreset(id, model, presets);
    if (!resolved) return { preset: null, needsSave: false };
    const stored = presets.find((p) => p.id === resolved.id);
    const src = featuredOriginal(id);
    if (resolved.source === "featured" && src && !stored?.userEdited && stored?.featuredRev !== featuredRev(src)) {
      return { preset: featuredForPlayer({ ...src, createdAt: resolved.createdAt }, settings), needsSave: true };
    }
    return { preset: resolved, needsSave: !stored };
  }, [id, presets, model, settings]);

  const outdated = preset?.userEdited ? isOutdatedFeatured(preset) : false;
  const otherUnit = urlModel && urlModel !== stompModel ? urlModel : null;

  useEffect(() => {
    if (!preset) return;
    // Wait for this account's History before writing. A link for another unit stays out of
    // History until "Open on my …".
    if (historyReady && needsSave && !otherUnit) savePreset(preset);
    if (preset.source === "featured" && preset.id !== id) {
      void navigate({ to: "/preset/$id", params: { id: preset.id }, replace: true });
    }
  }, [preset, needsSave, otherUnit, historyReady, id, savePreset, navigate]);

  function takeNewVersion() {
    const src = preset ? featuredOriginal(preset.id) : undefined;
    if (!preset || !src) return;
    savePreset(featuredForPlayer({ ...src, createdAt: preset.createdAt }, settings));
    toast.success("Updated to the newest version of this demo.");
  }

  function openOnMyUnit() {
    if (!preset) return;
    const opened = openFeatured(preset.id, { ...settings, stompModel }, presets);
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
      {outdated ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">We improved this demo since you changed it. Your changes are kept until you swap.</span>
          <Button type="button" size="sm" variant="secondary" onClick={takeNewVersion}>
            Get the new version
          </Button>
        </div>
      ) : null}
      <PresetWorkspace
        preset={preset}
        onChange={(next, opts) => {
          // Memory now, disk once the knob stops moving. Only the player's own changes mark it edited.
          patchCurrent({ ...next, userEdited: opts?.userEdit === false ? !!next.userEdited : true });
        }}
      />
    </>
  );
}
