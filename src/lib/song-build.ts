import { toast } from "sonner";
import { FEATURED } from "@/data/featured";
import type { PlaybackTarget, Preset, StompModelId, UserGear } from "@/data/types";
import { notifyResearchError } from "./notify";
import type { Plan } from "./plan";
import { overlayUserGear } from "./preset-schema";
import { isDemoId, withStompModel } from "./preset-utils";
import { matchFeatured, researchSongFn } from "./research";
import { applyWahPreference, type WahMode } from "./wah";
import { applyRouting } from "./rig-routing";

export type SongBuildInput = {
  song: string;
  artist: string;
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  playbackTarget: PlaybackTarget;
  gear: UserGear[];
  wahMode: WahMode;
  wahModelId: string;
};

export type SongBuildOutcome =
  /** `counted` is true when the server took a custom build (refresh the plan after). */
  | { kind: "preset"; preset: Preset; source: "library" | "gemini" | "cache"; counted: boolean }
  | { kind: "login" }
  /** "limit": free builds are used up. "library": a featured rig that needs a plan. */
  | { kind: "upgrade"; reason: "limit" | "library" }
  /** Toasts were shown already; `status` is the line to keep under the form, if any. */
  | { kind: "stopped"; status?: string };

/**
 * Typing a song and pressing Build, without the page around it: demos and the
 * featured library first, then the account and quota checks, then research.
 * The Lab and Setlists both call this so the paywall and quota rules live once.
 */
export async function buildSong(
  input: SongBuildInput,
  account: { plan: Plan; planPending: boolean },
  hooks: { onStart: () => void; login: () => void; upgrade: () => void },
): Promise<SongBuildOutcome> {
  const { plan, planPending } = account;
  const song = input.song.trim();
  const artist = input.artist.trim();
  if (!song) {
    toast.error("Type a song title first.");
    return { kind: "stopped", status: "Type a song title first." };
  }
  // The server builds the lead part for two-guitar songs; nothing to pick here.
  const roleForBuild = "both" as const;
  const finish = (p: Preset) =>
    applyRouting(
      applyWahPreference(overlayUserGear(withStompModel(p, input.stompModel), input.gear), input.wahMode, input.wahModelId),
      input.playbackTarget,
    );
  const featuredHit = matchFeatured(song, artist || undefined, input.instrument, input.stompModel, roleForBuild);
  if (featuredHit) {
    const src = FEATURED.find((p) => p.instrument === featuredHit.instrument && p.song === featuredHit.song);
    if (src && isDemoId(src.id)) {
      return { kind: "preset", preset: finish(featuredHit), source: "library", counted: false };
    }
    if (src && !plan.paid) return { kind: "upgrade", reason: "library" };
    if (src && plan.paid) {
      return { kind: "preset", preset: finish(featuredHit), source: "library", counted: false };
    }
  }
  if (planPending) {
    toast.message("Still loading your account. Try again in a second.");
    return { kind: "stopped" };
  }
  if (!plan.signedIn) return { kind: "login" };
  if (!plan.canResearch) {
    if (plan.paid) {
      toast.error("You've used this month's custom builds. Demos still work. Resets next calendar month.");
      return { kind: "stopped" };
    }
    return { kind: "upgrade", reason: "limit" };
  }
  hooks.onStart();
  try {
    const result = await researchSongFn({
      data: {
        song,
        artist: artist || undefined,
        instrument: input.instrument,
        stompModel: input.stompModel,
        playbackTarget: input.playbackTarget,
        userGear: input.gear,
        wahMode: input.wahMode,
        wahModelId: input.wahModelId,
        guitarRole: roleForBuild,
      },
    });
    if (!result || !result.ok) {
      const fail =
        result && !result.ok
          ? result
          : { ok: false as const, error: "Research failed. Try a demo, then try that song again." };
      if (fail.reason === "quota") {
        toast.error(fail.error);
        return { kind: "stopped", status: fail.error };
      }
      if (fail.reason === "paywall") return { kind: "upgrade", reason: "limit" };
      if (fail.reason === "signin") return { kind: "login" };
      notifyResearchError(fail, { login: hooks.login, upgrade: hooks.upgrade });
      return { kind: "stopped", status: fail.error };
    }
    return { kind: "preset", preset: result.preset, source: result.source, counted: true };
  } catch (err) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : "Could not research that song. Try a demo, then try again.";
    if (message === "Unauthorized") return { kind: "login" };
    toast.error(message);
    return { kind: "stopped", status: message };
  }
}
