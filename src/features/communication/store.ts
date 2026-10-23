import { create } from "zustand";
import type {
  CommunicationAlert,
  CommunicationDisplayMode,
  CommunicationLevel,
  CommunicationTarget,
  QuickPreset,
} from "./types.ts";
import {
  clearStageMessage,
  openCommunicationWindow,
  sendStageMessage,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import { DEFAULT_PRESETS } from "./presets.ts";

interface CommunicationState {
  activeAlert: CommunicationAlert | null;
  isOpen: boolean;
  draftText: string;
  displayMode: CommunicationDisplayMode;
  targets: CommunicationTarget[];
  scroll: boolean;
  level: CommunicationLevel;
  autoDismissSeconds: number;
  presets: QuickPreset[];
  history: CommunicationAlert[];

  openWindow: () => Promise<void>;
  openDialog: () => void;
  closeDialog: () => void;
  toggleDialog: () => void;

  setDraftText: (text: string) => void;
  setDisplayMode: (mode: CommunicationDisplayMode) => void;
  setTargets: (targets: CommunicationTarget[]) => void;
  toggleTarget: (target: CommunicationTarget) => void;
  setScroll: (scroll: boolean) => void;
  setLevel: (level: CommunicationLevel) => void;
  setAutoDismissSeconds: (seconds: number) => void;

  usePreset: (preset: QuickPreset) => void;
  addPreset: (preset: QuickPreset) => void;
  updatePreset: (id: string, updated: Partial<QuickPreset>) => void;
  removePreset: (id: string) => void;
  resetDefaultPresets: () => void;

  sendAlert: (customText?: string) => Promise<void>;
  clearAlert: () => Promise<void>;
  applyRemote: (alert: CommunicationAlert | null) => void;
}

const STORAGE_KEY_HISTORY = "open_presenter_comm_history";
const STORAGE_KEY_PRESETS = "open_presenter_comm_presets";

function loadHistory(): CommunicationAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: CommunicationAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

function loadPresets(): QuickPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p) => ({
        ...p,
        targets: Array.isArray(p.targets) && p.targets.length > 0 ? p.targets : ["stage"],
      }));
    }
    return DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

function savePresets(list: QuickPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(list));
  } catch {}
}

export const useCommunicationStore = create<CommunicationState>((set, get) => ({
  activeAlert: null,
  isOpen: false,
  draftText: "",
  displayMode: "banner_top",
  targets: ["stage", "public"],
  scroll: true,
  level: "info",
  autoDismissSeconds: 0,
  presets: typeof window !== "undefined" ? loadPresets() : DEFAULT_PRESETS,
  history: typeof window !== "undefined" ? loadHistory() : [],

  openWindow: async () => {
    if (isTauri()) {
      await openCommunicationWindow();
    } else if (typeof window !== "undefined") {
      window.open("/#/communication", "_blank", "width=1120,height=700");
    }
  },

  openDialog: () => set({ isOpen: true }),
  closeDialog: () => set({ isOpen: false }),
  toggleDialog: () => set((s) => ({ isOpen: !s.isOpen })),

  setDraftText: (draftText) => set({ draftText }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setTargets: (targets) => set({ targets: targets.length > 0 ? targets : ["stage"] }),
  toggleTarget: (target) =>
    set((s) => {
      const exists = s.targets.includes(target);
      if (exists) {
        if (s.targets.length === 1) return s; // Mantém pelo menos um alvo
        return { targets: s.targets.filter((t) => t !== target) };
      }
      return { targets: [...s.targets, target] };
    }),
  setScroll: (scroll) => set({ scroll }),
  setLevel: (level) => set({ level }),
  setAutoDismissSeconds: (autoDismissSeconds) => set({ autoDismissSeconds }),

  usePreset: (preset) => {
    set({
      draftText: preset.text,
      level: preset.level,
      displayMode: preset.displayMode,
      targets: preset.targets && preset.targets.length > 0 ? preset.targets : ["stage"],
      scroll: preset.scroll ?? true,
    });
  },

  addPreset: (preset) => {
    set((s) => {
      const next = [...s.presets, preset];
      savePresets(next);
      return { presets: next };
    });
  },

  updatePreset: (id, updated) => {
    set((s) => {
      const next = s.presets.map((p) => (p.id === id ? { ...p, ...updated } : p));
      savePresets(next);
      return { presets: next };
    });
  },

  removePreset: (id) => {
    set((s) => {
      const next = s.presets.filter((p) => p.id !== id);
      savePresets(next);
      return { presets: next };
    });
  },

  resetDefaultPresets: () => {
    savePresets(DEFAULT_PRESETS);
    set({ presets: DEFAULT_PRESETS });
  },

  sendAlert: async (customText) => {
    const state = get();
    const text = (customText ?? state.draftText).trim();
    if (!text) return;

    const targets = state.targets.length > 0 ? state.targets : (["stage", "public"] as CommunicationTarget[]);

    const alert: CommunicationAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      displayMode: state.displayMode,
      scroll: state.scroll,
      level: state.level,
      sender: "Operador",
      target: targets[0] ?? "stage",
      targets,
      autoDismissSeconds:
        state.autoDismissSeconds > 0 ? state.autoDismissSeconds : undefined,
      createdAt: new Date().toISOString(),
    };

    set((s) => {
      const nextHistory = [alert, ...s.history.filter((h) => h.text !== text)].slice(0, 20);
      saveHistory(nextHistory);
      return {
        activeAlert: alert,
        history: nextHistory,
        isOpen: false,
      };
    });

    await sendStageMessage(alert);
  },

  clearAlert: async () => {
    set({ activeAlert: null });
    await clearStageMessage();
  },

  applyRemote: (alert) => {
    set({ activeAlert: alert });
  },
}));
