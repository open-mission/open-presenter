import { create } from "zustand";
import type { LiveThemes, SlideTheme } from "@/core/types";

const EMPTY_THEMES: LiveThemes = { public: null, stage: null };

function asTheme(value: unknown): SlideTheme | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<SlideTheme>;
  if (typeof candidate.guid !== "string" || !Array.isArray(candidate.elements)) {
    return null;
  }
  return candidate as SlideTheme;
}

function normalize(value: unknown): LiveThemes {
  if (typeof value !== "object" || value === null) return EMPTY_THEMES;
  const record = value as Record<string, unknown>;
  return {
    public: asTheme(record.public),
    stage: asTheme(record.stage),
  };
}

interface LiveThemesState {
  themes: LiveThemes;
  applyRemote(themes: unknown): void;
}

/**
 * Temas resolvidos pelo operador e recebidos pelas saídas via syncBus
 * (eventos Tauri no desktop, WebSocket `/ws` no navegador).
 */
export const useLiveThemesStore = create<LiveThemesState>((set) => ({
  themes: EMPTY_THEMES,
  applyRemote: (themes) => set({ themes: normalize(themes) }),
}));

export { EMPTY_THEMES };