import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PresetWorkspace } from "@/components/preset/preset-workspace";
import { Button } from "@/components/ui/button";
import { DEVICE_MAP } from "@/data/categories";
import { newId } from "@/lib/preset-utils";
import { getSharedPresetFn } from "@/lib/share";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAppStore } from "@/store/app-store";
import type { Preset } from "@/data/types";

const SITE_NAME = "Stomp Lab";

function unitName(preset: Preset): string {
  return DEVICE_MAP[preset.stompModel]?.name ?? "HX Stomp";
}

export const Route = createFileRoute("/s/$shareId")({
  loader: ({ params }) => getSharedPresetFn({ data: { shareId: params.shareId } }),
  head: ({ loaderData }) => {
    const preset = loaderData?.preset;
    if (!preset) return { meta: [{ title: `Shared preset · ${SITE_NAME}` }] };
    const title = `${preset.song || preset.name}${preset.artist ? ` — ${preset.artist}` : ""} · ${SITE_NAME} preset for ${unitName(preset)}`;
    return {
      meta: [
        { title },
        { name: "description", content: preset.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: preset.summary },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: preset.summary },
      ],
    };
  },
  component: SharedPresetPage,
});

function SharedPresetPage() {
  const { shareId } = Route.useParams();
  const { preset } = Route.useLoaderData();
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const hydrate = useAppStore((s) => s.hydrate);
  const savePreset = useAppStore((s) => s.savePreset);
  const viewerModel = useAppStore((s) => s.stompModel);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!preset) {
    return (
      <div className="space-y-3">
        <h1 className="sl-hero-title text-3xl">Preset not found</h1>
        <p className="text-sm text-muted-foreground">This link may be wrong or the preset was removed.</p>
        <Link to="/" className="text-sm underline">
          Back to Lab
        </Link>
      </div>
    );
  }

  const unit = unitName(preset);
  const title = preset.song ? `${preset.song}${preset.artist ? ` — ${preset.artist}` : ""}` : preset.name;
  const here = `/s/${shareId}`;

  function onSave() {
    if (!preset) return;
    // The id ends in the unit so the preset page opens on the unit it was built for.
    const id = `${newId("shared")}-${preset.stompModel}`;
    savePreset({ ...preset, id, createdAt: Date.now(), userEdited: true });
    void navigate({ to: "/preset/$id", params: { id } });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">
          Shared preset · {title} · {unit}
        </p>
        {viewerModel !== preset.stompModel ? (
          <p className="text-xs text-muted-foreground">Built for {unit}.</p>
        ) : null}
        {user ? (
          <Button type="button" className="h-11 w-full sm:w-auto" onClick={onSave}>
            Save to my Lab
          </Button>
        ) : (
          <Button asChild className="h-11 w-full sm:w-auto">
            <Link to="/login" search={{ next: here }}>
              Save to my Lab
            </Link>
          </Button>
        )}
      </div>
      <PresetWorkspace preset={preset} readOnly signInToDownload={here} />
    </div>
  );
}
