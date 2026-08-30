import { create } from "zustand";
import type { Preset, StompModelId, UserGear } from "@/data/types";
import {
  deletePreset,
  loadGear,
  loadGeminiKey,
  loadPresets,
  loadSettings,
  patchSettings,
  saveGear,
  saveGeminiKey,
  type FsModePref,
  type Settings,
  type ThemeId,
  upsertPreset,
} from "@/lib/storage";

type LcdView = "play" | "edit" | "tuner" | "assign";
type FsMode = "stomp" | "snapshot" | "preset";

type AppState = {
  hydrated: boolean;
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  theme: ThemeId;
  defaultFsMode: FsModePref;
  showDsp: boolean;
  confirmDownload: boolean;
  showFsNumbers: boolean;
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
  setInstrument: (instrument: "guitar" | "bass") => void;
  setStompModel: (stompModel: StompModelId) => void;
  setTheme: (theme: ThemeId) => void;
  setDefaultFsMode: (mode: FsModePref) => void;
  setShowDsp: (show: boolean) => void;
  setShowFsNumbers: (show: boolean) => void;
  setConfirmDownload: (confirm: boolean) => void;
  setGeminiKey: (key: string) => void;
  savePreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
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
  instrument: "guitar",
  stompModel: "hx-stomp",
  theme: "dark",
  defaultFsMode: "auto",
  showDsp: true,
  showFsNumbers: false,
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
      confirmDownload: settings.confirmDownload,
      geminiKey: loadGeminiKey(),
      presets: loadPresets(),
      gear: loadGear(),
    });
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
  setConfirmDownload: (confirmDownload) => {
    persist({ confirmDownload });
    set({ confirmDownload });
  },
  setGeminiKey: (geminiKey) => {
    saveGeminiKey(geminiKey);
    set({ geminiKey });
  },
  savePreset: (preset) => set({ presets: upsertPreset(preset) }),
  removePreset: (id) => set({ presets: deletePreset(id) }),
  setGear: (gear) => {
    saveGear(gear);
    set({ gear });
  },
  addGear: (item) => {
    const gear = [item, ...get().gear];
    saveGear(gear);
    set({ gear });
  },
  removeGear: (id) => {
    const gear = get().gear.filter((g) => g.id !== id);
    saveGear(gear);
    set({ gear });
  },
  selectBlock: (id) => set({ selectedBlockId: id, lcdView: id ? "edit" : "play", paramPage: 0 }),
  setLcdView: (lcdView) => set({ lcdView }),
  setFsMode: (fsMode) => set({ fsMode }),
  setParamPage: (paramPage) => set({ paramPage }),
  setActiveSnapshot: (activeSnapshot) => set({ activeSnapshot }),
  setAssignFsIndex: (assignFsIndex) => set({ assignFsIndex }),
  patchCurrent: (preset) => set({ presets: upsertPreset(preset) }),
}));
