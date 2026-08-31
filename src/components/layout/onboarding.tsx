import { useLayoutEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import { saveMyProfile } from "@/lib/billing";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

const KEY = "stomplab.onboarded.v2";
const PROFILE_KEY = "stomplab.profile.v1";

const GENRES = [
  "Rock",
  "Metal",
  "Blues",
  "Indie",
  "Punk",
  "Funk",
  "Country",
  "Worship",
  "Jazz",
  "Pop",
  "Shoegaze",
  "Ambient",
] as const;

type ProfileDraft = {
  displayName: string;
  instrument: "guitar" | "bass";
  stompModel: "hx-stomp" | "hx-stomp-xl";
  genres: string[];
};

const DEFAULT_DRAFT: ProfileDraft = {
  displayName: "",
  instrument: "guitar",
  stompModel: "hx-stomp",
  genres: [],
};

function loadDraft(): ProfileDraft {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      instrument: parsed.instrument === "bass" ? "bass" : "guitar",
      stompModel: parsed.stompModel === "hx-stomp-xl" ? "hx-stomp-xl" : "hx-stomp",
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

export function Onboarding() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const setInstrument = useAppStore((s) => s.setInstrument);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const savePreset = useAppStore((s) => s.savePreset);
  const gear = useAppStore((s) => s.gear);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_DRAFT);

  useLayoutEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) {
        setDraft(loadDraft());
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function patch(partial: Partial<ProfileDraft>) {
    setDraft((d) => {
      const next = { ...d, ...partial };
      persistDraft(next);
      return next;
    });
  }

  function finish(openDemoId?: string) {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setInstrument(draft.instrument);
    setStompModel(draft.stompModel);
    persistDraft(draft);
    if (user) {
      void saveMyProfile({
        data: {
          displayName: draft.displayName,
          instrument: draft.instrument,
          stompModel: draft.stompModel,
          genres: draft.genres,
        },
      }).catch(() => undefined);
    }
    setOpen(false);
    if (openDemoId) {
      const src = FEATURED.find((p) => p.id === openDemoId);
      if (src) {
        const preset = overlayUserGear(
          withStompModel({ ...src, createdAt: Date.now() }, draft.stompModel),
          gear,
        );
        savePreset(preset);
        void navigate({ to: "/preset/$id", params: { id: preset.id } });
      }
    }
  }

  if (!open) return null;

  const demos = FEATURED.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-4 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Welcome · {step + 1} / 5
        </p>

        {step === 0 ? (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">What do you play?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We’ll tune the Lab to your instrument. You can change this any time in the header.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["guitar", "bass"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ instrument: id })}
                  className={cn(
                    "rounded-lg border px-4 py-5 text-left",
                    draft.instrument === id
                      ? "border-primary bg-secondary text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="block font-display text-lg font-semibold capitalize">{id}</span>
                  <span className="mt-1 block text-xs">
                    {id === "guitar" ? "Six-string, offsets, high-gain" : "4/5-string, DI, grit"}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Which unit?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The replica and the .hlx file follow this. XL gets eight switches and four snapshots.
            </p>
            <div className="mt-5 grid gap-2">
              {(
                [
                  ["hx-stomp", "HX Stomp", "3 switches · 3 snapshots"],
                  ["hx-stomp-xl", "HX Stomp XL", "8 switches · 4 snapshots"],
                ] as const
              ).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ stompModel: id })}
                  className={cn(
                    "rounded-lg border px-4 py-4 text-left",
                    draft.stompModel === id
                      ? "border-primary bg-secondary text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs">{hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">What do you listen to?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pick a few. This helps us feature the right starting points — skip if you want.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const on = draft.genres.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      patch({
                        genres: on ? draft.genres.filter((x) => x !== g) : [...draft.genres, g],
                      })
                    }
                    className={cn(
                      "h-9 rounded-full border px-3 text-xs font-medium",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">What should we call you?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Optional. Shows on your account. You can leave it blank.
            </p>
            <Input
              className="mt-5"
              value={draft.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              placeholder="Name"
              autoComplete="nickname"
              maxLength={80}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Hear it on the replica</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Open a demo. No account. See the song on the unit, then download the .hlx. That’s the Lab.
            </p>
            <div className="mt-5 grid gap-2">
              {demos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => finish(p.id)}
                  className="rounded-lg border border-border px-4 py-3 text-left hover:border-primary/50"
                >
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {p.artist}
                  </span>
                  <span className="block font-medium">{p.song}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {step < 4 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 0) setInstrument(draft.instrument);
                if (step === 1) setStompModel(draft.stompModel);
                setStep((s) => s + 1);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => finish()}>
              I’ll look around first
            </Button>
          )}
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => finish()}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
