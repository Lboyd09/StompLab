import { useLayoutEffect } from "react";
import type { StompModelId } from "@/data/types";
import { parseStompModelId } from "@/data/types";

export const ONBOARD_KEY = "stomplab.onboarded.v3";
const PROFILE_KEY = "stomplab.profile.v1";

type ProfileDraft = {
  displayName: string;
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  genres: string[];
};

const DEFAULT_DRAFT: ProfileDraft = {
  displayName: "",
  instrument: "guitar",
  stompModel: "hx-stomp",
  genres: [],
};

export function loadDraft(): ProfileDraft {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      instrument: parsed.instrument === "bass" ? "bass" : "guitar",
      stompModel: parseStompModelId(parsed.stompModel),
      genres: Array.isArray(parsed.genres) ? parsed.genres.filter((g) => typeof g === "string") : [],
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function persistDraft(draft: ProfileDraft) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function persistInstrumentUnit(instrument: "guitar" | "bass", stompModel: StompModelId) {
  persistDraft({ ...loadDraft(), instrument, stompModel });
}

/** First-run lives in Tutorial v7. This only backfills the onboard flag. */
export function Onboarding({ onFinished }: { onFinished?: () => void }) {
  useLayoutEffect(() => {
    try {
      if (
        (window.localStorage.getItem("stomplab.tutorial.v7") ||
          window.localStorage.getItem("stomplab.tutorial.v6")) &&
        !window.localStorage.getItem(ONBOARD_KEY)
      ) {
        window.localStorage.setItem(ONBOARD_KEY, "1");
      }
    } catch {
      /* ignore */
    }
  }, []);
  void onFinished;
  return null;
}
