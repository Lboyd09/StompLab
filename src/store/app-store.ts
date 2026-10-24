import type { PlaybackTarget } from "@/data/types";
import { create } from "zustand";
import type { Preset, StompModelId, UserGear } from "@/data/types";
import {
  adoptLegacyLocal,
  loadGear,
  loadGeminiKey,
  loadPresets,
  loadSettings,
  loadSetlistsRaw,
  mergeHistory,
  parseIrSlot,
  patchSettings,
  saveGear,
  saveGeminiKey,
  savePresets,
  saveSetlistsRaw,
  storageOwnerKey,
  type FsModePref,
  type Settings,
  type ThemeId,
  upsertInto,
} from "@/lib/storage";
import type { GuitarRole } from "@/lib/guitar-role";
import { cleanSetlists, type Setlist } from "@/lib/setlist";
import type { WahMode } from "@/lib/wah";

type LcdView = "play" | "edit" | "tuner" | "assign";
type FsMode = "stomp" | "snapshot" | "preset";

/** A Lab build that is still researching. Kept here so leaving the Lab doesn't lose it. */
export type LabBuild = { song: string; artist: string; startedAt: number };

type AppState = {
  hydrated: boolean;
  ownerId: string;
  /** History for `ownerId` has been read from this browser. Before that, saves stay in memory. */
  ownerLoaded: boolean;
  /** History for the current account is settled (local read plus the account merge, or signed out). */
  historyReady: boolean;
  /** Bumped when a save should reach the account now instead of on the slow debounce. */
  syncTick: number;
  labBuild: LabBuild | null;
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  theme: ThemeId;
  defaultFsMode: FsModePref;
  showDsp: boolean;
  confirmDownload: boolean;
  showFsNumbers: boolean;
  largeControls: boolean;
  lcdBright: boolean;
  reduceMotion: boolean;
  wahMode: WahMode;
  wahModelId: string;
  guitarRole: GuitarRole;
  irSlot: number | null;
  playbackTarget: PlaybackTarget;
  geminiKey: string;
  presets: Preset[];
  gear: UserGear[];
  setlists: Setlist[];
  selectedBlockId: string | null;
  lcdView: LcdView;
  fsMode: FsMode;
  paramPage: number;
  activeSnapshot: number;
  assignFsIndex: number;
  hydrate: () => void;
  hydrateOwner: (userId: string | null) => { presets: Preset[]; gear: UserGear[] };
  setInstrument: (instrument: "guitar" | "bass") => void;
  setStompModel: (stompModel: StompModelId) => void;
  setTheme: (theme: ThemeId) => void;
  setDefaultFsMode: (mode: FsModePref) => void;
  setShowDsp: (show: boolean) => void;
  setShowFsNumbers: (show: boolean) => void;
  setLargeControls: (large: boolean) => void;
  setLcdBright: (bright: boolean) => void;
  setReduceMotion: (reduce: boolean) => void;
  setConfirmDownload: (confirm: boolean) => void;
  setWahMode: (mode: WahMode) => void;
  setWahModelId: (id: string) => void;
  setGuitarRole: (role: GuitarRole) => void;
  setIrSlot: (slot: number | null) => void;
  setPlaybackTarget: (target: PlaybackTarget) => void;
  setGeminiKey: (key: string) => void;
  /** A build, an open, a revise: saved now and pushed to the account right away. */
  savePreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  replacePresets: (presets: Preset[]) => void;
  setHistoryReady: (ready: boolean) => void;
  setLabBuild: (build: LabBuild | null) => void;
  setGear: (gear: UserGear[]) => void;
  addGear: (item: UserGear) => void;
  removeGear: (id: string) => void;
  saveSetlist: (setlist: Setlist) => void;
  removeSetlist: (id: string) => void;
  replaceSetlists: (setlists: Setlist[]) => void;
  selectBlock: (id: string | null) => void;
  setLcdView: (view: LcdView) => void;
  setFsMode: (mode: FsMode) => void;
  setParamPage: (page: number) => void;
  setActiveSnapshot: (index: number) => void;
  setAssignFsIndex: (index: number) => void;
  /** A knob turn: memory now, disk a moment later (one write per drag, not per tick). */
  patchCurrent: (preset: Preset) => void;
  flushPresets: () => void;
};

function persist(partial: Partial<Settings>) {
  return patchSettings(partial);
}

const PERSIST_DELAY_MS = 400;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistOwner: string | null = null;

function cancelPersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  persistOwner = null;
}

export const useAppStore = create<AppState>((set, get) => {
  /** Write the in-memory history for `owner`, now. Skipped until that owner's history was read. */
  const writeNow = (owner: string) => {
    const state = get();
    if (!state.ownerLoaded || state.ownerId !== owner) return;
    savePresets(state.presets, owner);
  };
  const flushPresets = () => {
    const owner = persistOwner;
    cancelPersist();
    if (owner) writeNow(owner);
  };
  const schedulePersist = () => {
    const owner = get().ownerId;
    if (persistOwner && persistOwner !== owner) flushPresets();
    persistOwner = owner;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(flushPresets, PERSIST_DELAY_MS);
  };
  const persistNow = () => {
    cancelPersist();
    writeNow(get().ownerId);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushPresets);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPresets();
    });
  }
  return {
  hydrated: false,
  ownerId: "anon",
  ownerLoaded: false,
  historyReady: false,
  syncTick: 0,
  labBuild: null,
  instrument: "guitar",
  stompModel: "hx-stomp",
  theme: "dark",
  defaultFsMode: "auto",
  showDsp: true,
  showFsNumbers: true,
  largeControls: false,
  lcdBright: false,
  reduceMotion: false,
  wahMode: "pedal",
  wahModelId: "teardrop-310",
  guitarRole: "both",
  irSlot: null,
  playbackTarget: "frfr",
  confirmDownload: false,
  geminiKey: "",
  presets: [],
  gear: [],
  setlists: [],
  selectedBlockId: null,
  lcdView: "play",
  fsMode: "stomp",
  paramPage: 0,
  activeSnapshot: 0,
  assignFsIndex: 1,
  hydrate: () => {
    if (get().hydrated) return;
    const settings = loadSettings();
    set({
      hydrated: true,
      instrument: settings.instrument,
      stompModel: settings.stompModel,
      theme: settings.theme,
      defaultFsMode: settings.defaultFsMode,
      showDsp: settings.showDsp,
      showFsNumbers: settings.showFsNumbers,
      largeControls: settings.largeControls,
      lcdBright: settings.lcdBright,
      reduceMotion: settings.reduceMotion,
      confirmDownload: settings.confirmDownload,
      wahMode: settings.wahMode,
      wahModelId: settings.wahModelId,
      guitarRole: settings.guitarRole,
      irSlot: settings.irSlot,
      playbackTarget: settings.playbackTarget,
      geminiKey: loadGeminiKey(),
    });
  },
  hydrateOwner: (userId) => {
    const owner = storageOwnerKey(userId);
    if (get().ownerId === owner && get().ownerLoaded) {
      return { presets: get().presets, gear: get().gear };
    }
    flushPresets();
    // Anything saved before the first history read (a demo opened while the account was loading).
    const early = get().ownerLoaded ? [] : get().presets;
    const adopted = adoptLegacyLocal(owner);
    const stored = adopted.presets.length ? adopted.presets : loadPresets(owner);
    const presets = early.length ? mergeHistory(early, stored) : stored;
    const gear = adopted.gear.length ? adopted.gear : loadGear(owner);
    set({ ownerId: owner, ownerLoaded: true, presets, gear, setlists: cleanSetlists(loadSetlistsRaw(owner)) });
    if (early.length) savePresets(presets, owner);
    return { presets, gear };
  },
  setInstrument: (instrument) => {
    persist({ instrument });
    set({ instrument });
  },
  setStompModel: (stompModel) => {
    persist({ stompModel });
    set({ stompModel });
  },
  setTheme: (theme) => {
    persist({ theme });
    set({ theme });
  },
  setDefaultFsMode: (defaultFsMode) => {
    persist({ defaultFsMode });
    set({ defaultFsMode });
  },
  setShowDsp: (showDsp) => {
    persist({ showDsp });
    set({ showDsp });
  },
  setShowFsNumbers: (showFsNumbers) => {
    persist({ showFsNumbers });
    set({ showFsNumbers });
  },
  setLargeControls: (largeControls) => {
    persist({ largeControls });
    set({ largeControls });
  },
  setLcdBright: (lcdBright) => {
    persist({ lcdBright });
    set({ lcdBright });
  },
  setReduceMotion: (reduceMotion) => {
    persist({ reduceMotion });
    set({ reduceMotion });
  },
  setConfirmDownload: (confirmDownload) => {
    persist({ confirmDownload });
    set({ confirmDownload });
  },
  setWahMode: (wahMode) => {
    persist({ wahMode });
    set({ wahMode });
  },
  setWahModelId: (wahModelId) => {
    persist({ wahModelId });
    set({ wahModelId });
  },
  setGuitarRole: (guitarRole) => {
    persist({ guitarRole });
    set({ guitarRole });
  },
  setPlaybackTarget: (playbackTarget) => {
    persist({ playbackTarget });
    set({ playbackTarget });
  },
  setIrSlot: (slot) => {
    const irSlot = parseIrSlot(slot);
    persist({ irSlot });
    set({ irSlot });
  },
  setGeminiKey: (geminiKey) => {
    saveGeminiKey(geminiKey);
    set({ geminiKey });
  },
  savePreset: (preset) => {
    set({ presets: upsertInto(get().presets, { ...preset, updatedAt: Date.now() }), syncTick: get().syncTick + 1 });
    persistNow();
  },
  removePreset: (id) => {
    set({ presets: get().presets.filter((p) => p.id !== id), syncTick: get().syncTick + 1 });
    persistNow();
  },
  replacePresets: (presets) => {
    set({ presets });
    persistNow();
  },
  setHistoryReady: (historyReady) => set({ historyReady }),
  setLabBuild: (labBuild) => set({ labBuild }),
  setGear: (gear) => {
    saveGear(gear, get().ownerId);
    set({ gear });
  },
  addGear: (item) => {
    const gear = [item, ...get().gear];
    saveGear(gear, get().ownerId);
    set({ gear });
  },
  removeGear: (id) => {
    const gear = get().gear.filter((g) => g.id !== id);
    saveGear(gear, get().ownerId);
    set({ gear });
  },
  saveSetlist: (setlist) => {
    const setlists = cleanSetlists([setlist, ...get().setlists.filter((s) => s.id !== setlist.id)]);
    saveSetlistsRaw(setlists, get().ownerId);
    set({ setlists });
  },
  removeSetlist: (id) => {
    const setlists = get().setlists.filter((s) => s.id !== id);
    saveSetlistsRaw(setlists, get().ownerId);
    set({ setlists });
  },
  replaceSetlists: (next) => {
    const setlists = cleanSetlists(next);
    saveSetlistsRaw(setlists, get().ownerId);
    set({ setlists });
  },
  selectBlock: (id) => set({ selectedBlockId: id, lcdView: id ? "edit" : "play", paramPage: 0 }),
  setLcdView: (lcdView) => set({ lcdView }),
  setFsMode: (fsMode) => set({ fsMode }),
  setParamPage: (paramPage) => set({ paramPage }),
  setActiveSnapshot: (activeSnapshot) => set({ activeSnapshot }),
  setAssignFsIndex: (assignFsIndex) => set({ assignFsIndex }),
  patchCurrent: (preset) => {
    set({ presets: upsertInto(get().presets, { ...preset, updatedAt: Date.now() }) });
    schedulePersist();
  },
  flushPresets,
  };
});
