import { create } from "zustand";
import type { SlideTheme } from "@/core/types";
import { deleteTheme, listThemes, saveTheme } from "@/core/ipc/commands";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_THEME,
  DEFAULT_STREAM_THEME,
  DEFAULT_STREAM_THEME_GUID,
  createEmptyStudioTheme,
} from "./seedThemes";
import { cloneTheme } from "./pages";

interface SlideThemesState {
  themes: SlideTheme[];
  eventThemeGuid: string | null;
  load(): Promise<void>;
  ensureSeeded(): Promise<void>;
  save(theme: SlideTheme): Promise<void>;
  remove(guid: string): Promise<void>;
  setEventThemeGuid(guid: string | null): void;
  duplicate(guid: string): Promise<SlideTheme>;
  createPresentation(title?: string, bgGradient?: string): Promise<SlideTheme>;
}

/**
 * Catálogo de temas. A escolha de tema por saída vive no plano (`OutputPlan`)
 * e nos overrides do admin; aqui só guardamos os documentos.
 */
export const useSlideThemesStore = create<SlideThemesState>((set, get) => ({
  themes: [],
  eventThemeGuid: null,
  load: async () => {
    try {
      set({ themes: await listThemes() });
    } catch {
      set({ themes: [] });
    }
  },
  ensureSeeded: async () => {
    let themes: SlideTheme[];
    try {
      themes = await listThemes();
    } catch {
      themes = get().themes;
    }
    if (themes.length > 0) {
      if (!themes.some((t) => t.guid === DEFAULT_STREAM_THEME_GUID)) {
        await saveTheme(DEFAULT_STREAM_THEME);
        themes = [...themes, DEFAULT_STREAM_THEME];
      }
      set({ themes });
      return;
    }
    await saveTheme(DEFAULT_PUBLIC_THEME);
    await saveTheme(DEFAULT_STREAM_THEME);
    await saveTheme(DEFAULT_STAGE_THEME);
    await saveTheme(DEFAULT_STAGE_REST_THEME);
    set({
      themes: [
        DEFAULT_PUBLIC_THEME,
        DEFAULT_STREAM_THEME,
        DEFAULT_STAGE_THEME,
        DEFAULT_STAGE_REST_THEME,
      ],
    });
  },
  save: async (theme) => {
    await saveTheme(theme);
    set((s) => ({
      themes: s.themes.some((t) => t.guid === theme.guid)
        ? s.themes.map((t) => (t.guid === theme.guid ? theme : t))
        : [...s.themes, theme],
    }));
  },
  remove: async (guid) => {
    await deleteTheme(guid);
    set((s) => ({ themes: s.themes.filter((t) => t.guid !== guid) }));
  },
  setEventThemeGuid: (guid) => {
    set({ eventThemeGuid: guid });
  },
  duplicate: async (guid) => {
    const existing = get().themes.find((t) => t.guid === guid);
    if (!existing) throw new Error("Apresentação não encontrada.");
    const cloned = cloneTheme(existing);
    await get().save(cloned);
    return cloned;
  },
  createPresentation: async (title = "Nova Apresentação", bgGradient?: string) => {
    const theme = createEmptyStudioTheme(title, bgGradient);
    await get().save(theme);
    return theme;
  },
}));
