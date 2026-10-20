import { create } from "zustand";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/core/theme/theme";
import { isTauri } from "@/core/ipc/tauri";
import { closePreferencesWindow, openPreferencesWindow } from "@/core/ipc/commands";
import type { WeekStart } from "@/core/types";
import type { OutputsSection, PreferencesTab } from "./types";

const WEEK_START_KEY = "open_presenter_week_start";

function readStoredWeekStart(): WeekStart {
  if (typeof window === "undefined") return "sunday";
  try {
    return localStorage.getItem(WEEK_START_KEY) === "monday" ? "monday" : "sunday";
  } catch {
    return "sunday";
  }
}

interface PreferencesState {
  isOpen: boolean;
  activeTab: PreferencesTab;
  outputsSection: OutputsSection;
  theme: ThemeMode;
  weekStart: WeekStart;
  openPreferences(tab?: PreferencesTab, section?: OutputsSection): void;
  closePreferences(): void;
  setTab(tab: PreferencesTab): void;
  setOutputsSection(section: OutputsSection): void;
  setTheme(theme: ThemeMode): void;
  setWeekStart(weekStart: WeekStart): void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  isOpen: false,
  activeTab: "general",
  outputsSection: "public",
  theme: getStoredTheme(),
  weekStart: readStoredWeekStart(),
  openPreferences: (tab, section) => {
    if (tab) {
      try {
        localStorage.setItem("open_presenter_pref_tab", tab);
      } catch {}
    }
    if (section) {
      try {
        localStorage.setItem("open_presenter_outputs_section", section);
      } catch {}
    }
    if (isTauri()) {
      set((state) => ({
        activeTab: tab ?? state.activeTab,
        outputsSection: section ?? state.outputsSection,
      }));
      void openPreferencesWindow();
    } else {
      set((state) => ({
        isOpen: true,
        activeTab: tab ?? state.activeTab,
        outputsSection: section ?? state.outputsSection,
      }));
    }
  },
  closePreferences: () => {
    if (isTauri()) {
      void closePreferencesWindow();
    }
    set({ isOpen: false });
  },
  setTab: (activeTab) => {
    try {
      localStorage.setItem("open_presenter_pref_tab", activeTab);
    } catch {}
    set({ activeTab });
  },
  setOutputsSection: (outputsSection) => {
    try {
      localStorage.setItem("open_presenter_outputs_section", outputsSection);
    } catch {}
    set({ outputsSection });
  },
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  setWeekStart: (weekStart) => {
    try {
      localStorage.setItem(WEEK_START_KEY, weekStart);
    } catch {}
    set({ weekStart });
  },
}));

// A janela de Preferências é separada da janela principal no app desktop,
// então a alteração precisa chegar nas outras janelas via evento "storage".
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== WEEK_START_KEY || !event.newValue) return;
    const weekStart: WeekStart = event.newValue === "monday" ? "monday" : "sunday";
    usePreferencesStore.setState({ weekStart });
  });
}
