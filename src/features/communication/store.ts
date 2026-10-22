import { create } from "zustand";
import type {
  CommunicationAlert,
  CommunicationDisplayMode,
  CommunicationLevel,
} from "./types.ts";
import { clearStageMessage, sendStageMessage } from "@/core/ipc/commands";
import type { QuickPreset } from "./types.ts";

interface CommunicationState {
  activeAlert: CommunicationAlert | null;
  isOpen: boolean;
  draftText: string;
  displayMode: CommunicationDisplayMode;
  scroll: boolean;
  level: CommunicationLevel;
  autoDismissSeconds: number;
  history: CommunicationAlert[];

  openDialog: () => void;
  closeDialog: () => void;
  toggleDialog: () => void;

  setDraftText: (text: string) => void;
  setDisplayMode: (mode: CommunicationDisplayMode) => void;
  setScroll: (scroll: boolean) => void;
  setLevel: (level: CommunicationLevel) => void;
  setAutoDismissSeconds: (seconds: number) => void;

  usePreset: (preset: QuickPreset) => void;
  sendAlert: (customText?: string) => Promise<void>;
  clearAlert: () => Promise<void>;
  applyRemote: (alert: CommunicationAlert | null) => void;
}

const STORAGE_KEY_HISTORY = "open_presenter_comm_history";

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

export const useCommunicationStore = create<CommunicationState>((set, get) => ({
  activeAlert: null,
  isOpen: false,
  draftText: "",
  displayMode: "banner_top",
  scroll: true,
  level: "info",
  autoDismissSeconds: 0,
  history: typeof window !== "undefined" ? loadHistory() : [],

  openDialog: () => set({ isOpen: true }),
  closeDialog: () => set({ isOpen: false }),
  toggleDialog: () => set((s) => ({ isOpen: !s.isOpen })),

  setDraftText: (draftText) => set({ draftText }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setScroll: (scroll) => set({ scroll }),
  setLevel: (level) => set({ level }),
  setAutoDismissSeconds: (autoDismissSeconds) => set({ autoDismissSeconds }),

  usePreset: (preset) => {
    set({
      draftText: preset.text,
      level: preset.level,
      displayMode: preset.displayMode,
      scroll: preset.scroll ?? true,
    });
  },

  sendAlert: async (customText) => {
    const state = get();
    const text = (customText ?? state.draftText).trim();
    if (!text) return;

    const alert: CommunicationAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      displayMode: state.displayMode,
      scroll: state.scroll,
      level: state.level,
      sender: "Operador",
      target: "stage",
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
