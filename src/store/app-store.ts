import { create } from "zustand";
import type { Preset, StompModelId, UserGear } from "@/data/types";
import {
  adoptLegacyLocal,
  deletePreset,
  loadGear,
  loadGeminiKey,
  loadPresets,
  loadSettings,
  patchSettings,
  saveGear,
  saveGeminiKey,
  savePresets,
  storageOwnerKey,
  type FsModePref,
  type Settings,
  type ThemeId,
  upsertPreset,
} from "@/lib/storage";

type LcdView = "play" | "edit" | "tuner" | "assign";
type FsMode = "stomp" | "snapshot" | "preset";

type AppState = {
  hydrated: boolean;
  ownerId: string;
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
  geminiKey: string;
  presets: Preset[];
  gear: UserGear[];
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
  setGeminiKey: (key: string) => void;
  savePreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  replacePresets: (presets: Preset[]) => void;
  setGear: (gear: UserGear[]) => void;
  addGear: (item: UserGear) => void;
  removeGear: (id: string) => void;
  selectBlock: (id: string | null) => void;
  setLcdView: (view: LcdView) => void;
  setFsMode: (mode: FsMode) => void;
  setParamPage: (page: number) => void;
  setActiveSnapshot: (index: number) => void;
  setAssignFsIndex: (index: number) => void;
  patchCurrent: (preset: Preset) => void;
};

function persist(partial: Partial<Settings>) {
  return patchSettings(partial);
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  ownerId: "anon",
  instrument: "guitar",
  stompModel: "hx-stomp",
  theme: "dark",
  defaultFsMode: "auto",
  showDsp: true,
  showFsNumbers: true,
  largeControls: false,
  lcdBright: false,
  reduceMotion: false,
  confirmDownload: false,
  geminiKey: "",
  presets: [],
  gear: [],
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
      geminiKey: loadGeminiKey(),
    });
  },
  hydrateOwner: (userId) => {
    const owner = storageOwnerKey(userId);
    if (get().ownerId === owner && get().hydrated) {
      return { presets: get().presets, gear: get().gear };
    }
    const adopted = adoptLegacyLocal(owner);
    const presets = adopted.presets.length ? adopted.presets : loadPresets(owner);
    const gear = adopted.gear.length ? adopted.gear : loadGear(owner);
    set({ ownerId: owner, presets, gear });
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
  setGeminiKey: (geminiKey) => {
    saveGeminiKey(geminiKey);
    set({ geminiKey });
  },
  savePreset: (preset) => set({ presets: upsertPreset(preset, get().ownerId) }),
  removePreset: (id) => set({ presets: deletePreset(id, get().ownerId) }),
  replacePresets: (presets) => {
    savePresets(presets, get().ownerId);
    set({ presets });
  },
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
  selectBlock: (id) => set({ selectedBlockId: id, lcdView: id ? "edit" : "play", paramPage: 0 }),
  setLcdView: (lcdView) => set({ lcdView }),
  setFsMode: (fsMode) => set({ fsMode }),
  setParamPage: (paramPage) => set({ paramPage }),
  setActiveSnapshot: (activeSnapshot) => set({ activeSnapshot }),
  setAssignFsIndex: (assignFsIndex) => set({ assignFsIndex }),
  patchCurrent: (preset) => set({ presets: upsertPreset(preset, get().ownerId) }),
}));
