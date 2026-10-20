import { create } from "zustand";
import type {
  MediaKind,
  OutputTarget,
  SlideKind,
  SlideTheme,
  ThemeBinding,
} from "@/core/types";
import { deleteTheme, listThemes, saveTheme } from "@/core/ipc/commands";
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_PUBLIC_THEME_GUID,
  DEFAULT_STREAM_THEME,
  DEFAULT_STREAM_THEME_GUID,
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_REST_THEME_GUID,
  DEFAULT_STAGE_THEME,
  DEFAULT_STAGE_THEME_GUID,
  createEmptyStudioTheme,
} from "./seedThemes";
import {
  cloneTheme,
  getPageForContext,
  materializePage,
} from "./pages";
import { resolveLiveTheme } from "./themeResolution";

const BINDINGS_KEY = "open_presenter_theme_bindings";
const STAGE_THEME_KEY = "open_presenter_stage_theme";
const STAGE_REST_THEME_KEY = "open_presenter_stage_rest_theme";
const stageRestPageCache = new WeakMap<SlideTheme, SlideTheme>();

function bindingKey(target: OutputTarget, asset: SlideKind): string {
  return `${target}:${asset}`;
}

function loadStoredBindings(): ThemeBinding[] {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is ThemeBinding =>
        typeof b === "object" &&
        b !== null &&
        "target" in b &&
        "asset" in b &&
        "themeGuid" in b,
    );
  } catch {
    return [];
  }
}

function persistBindings(bindings: ThemeBinding[]): void {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch {}
}

function loadStoredStageTheme(): string | null {
  try {
    return localStorage.getItem(STAGE_THEME_KEY);
  } catch {
    return null;
  }
}

function persistStageTheme(guid: string | null): void {
  try {
    if (guid === null) localStorage.removeItem(STAGE_THEME_KEY);
    else localStorage.setItem(STAGE_THEME_KEY, guid);
  } catch {}
}

function loadStoredStageRestTheme(): string | null {
  try {
    return localStorage.getItem(STAGE_REST_THEME_KEY);
  } catch {
    return null;
  }
}

function persistStageRestTheme(guid: string | null): void {
  try {
    if (guid === null) localStorage.removeItem(STAGE_REST_THEME_KEY);
    else localStorage.setItem(STAGE_REST_THEME_KEY, guid);
  } catch {}
}

interface SlideThemesState {
  themes: SlideTheme[];
  bindings: ThemeBinding[];
  stageThemeGuid: string | null;
  stageRestThemeGuid: string | null;
  eventThemeGuid: string | null;
  load(): Promise<void>;
  ensureSeeded(): Promise<void>;
  save(theme: SlideTheme): Promise<void>;
  remove(guid: string): Promise<void>;
  setBinding(target: OutputTarget, asset: SlideKind, guid: string): void;
  clearBinding(target: OutputTarget, asset: SlideKind): void;
  setStageTheme(guid: string | null): void;
  setStageRestTheme(guid: string | null): void;
  setEventThemeGuid(guid: string | null): void;
  resolveTheme(
    target: OutputTarget,
    kind: SlideKind,
    customThemeId?: string | null,
    mediaKind?: MediaKind | null,
  ): SlideTheme | null;
  resolveStageTheme(): SlideTheme | null;
  resolveStageRestTheme(): SlideTheme | null;
  duplicate(guid: string): Promise<SlideTheme>;
  createPresentation(title?: string, bgGradient?: string): Promise<SlideTheme>;
}

export const useSlideThemesStore = create<SlideThemesState>((set, get) => ({
  themes: [],
  bindings: loadStoredBindings(),
  stageThemeGuid: loadStoredStageTheme(),
  stageRestThemeGuid: loadStoredStageRestTheme(),
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
        get().setBinding("stream", "lyric", DEFAULT_STREAM_THEME_GUID);
        get().setBinding("stream", "custom", DEFAULT_STREAM_THEME_GUID);
        get().setBinding("stream", "scripture", DEFAULT_STREAM_THEME_GUID);
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
    get().setBinding("public", "lyric", DEFAULT_PUBLIC_THEME_GUID);
    get().setBinding("public", "custom", DEFAULT_PUBLIC_THEME_GUID);
    get().setBinding("public", "scripture", DEFAULT_PUBLIC_THEME_GUID);
    get().setBinding("stream", "lyric", DEFAULT_STREAM_THEME_GUID);
    get().setBinding("stream", "custom", DEFAULT_STREAM_THEME_GUID);
    get().setBinding("stream", "scripture", DEFAULT_STREAM_THEME_GUID);
    get().setStageTheme(DEFAULT_STAGE_THEME_GUID);
    get().setStageRestTheme(DEFAULT_STAGE_REST_THEME_GUID);
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
    set((s) => {
      const bindings = s.bindings.filter((b) => b.themeGuid !== guid);
      persistBindings(bindings);
      const stageThemeGuid = s.stageThemeGuid === guid ? null : s.stageThemeGuid;
      if (s.stageThemeGuid === guid) persistStageTheme(null);
      const stageRestThemeGuid =
        s.stageRestThemeGuid === guid ? null : s.stageRestThemeGuid;
      if (s.stageRestThemeGuid === guid) persistStageRestTheme(null);
      return {
        themes: s.themes.filter((t) => t.guid !== guid),
        bindings,
        stageThemeGuid,
        stageRestThemeGuid,
      };
    });
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
  setBinding: (target, asset, guid) => {
    const key = bindingKey(target, asset);
    set((s) => {
      const bindings = [
        ...s.bindings.filter((b) => bindingKey(b.target, b.asset) !== key),
        { target, asset, themeGuid: guid },
      ];
      persistBindings(bindings);
      return { bindings };
    });
  },
  clearBinding: (target, asset) => {
    const key = bindingKey(target, asset);
    set((s) => {
      const bindings = s.bindings.filter(
        (b) => bindingKey(b.target, b.asset) !== key,
      );
      persistBindings(bindings);
      return { bindings };
    });
  },
  setStageTheme: (guid) => {
    persistStageTheme(guid);
    set({ stageThemeGuid: guid });
  },
  setEventThemeGuid: (guid) => {
    set({ eventThemeGuid: guid });
  },
  resolveTheme: (target, kind, customThemeId, mediaKind) => {
    return resolveLiveTheme({
      kind,
      mediaKind: mediaKind ?? null,
      mediaThemeId: customThemeId ?? null,
      eventThemeGuid: get().eventThemeGuid,
      themes: get().themes,
      bindings: get().bindings,
      target,
      defaultTheme: DEFAULT_PUBLIC_THEME,
    });
  },
  setStageRestTheme: (guid) => {
    persistStageRestTheme(guid);
    set({ stageRestThemeGuid: guid });
  },
  resolveStageTheme: () => {
    const configuredGuid = get().stageThemeGuid;
    if (configuredGuid) {
      const explicit = get().themes.find((t) => t.guid === configuredGuid);
      if (explicit) return explicit;
    }
    const defaultCandidate = get().themes.find(
      (t) => t.guid === DEFAULT_STAGE_THEME_GUID,
    );
    if (defaultCandidate) return defaultCandidate;
    const fallback = get().themes.find(
      (t) =>
        t.category !== "presentation" &&
        (t.category === "stage" ||
          t.title.toLowerCase().includes("retorno") ||
          t.title.toLowerCase().includes("palco") ||
          t.title.toLowerCase().includes("stage")),
    );
    return fallback ?? DEFAULT_STAGE_THEME;
  },
  resolveStageRestTheme: () => {
    const stageTheme = get().resolveStageTheme() ?? DEFAULT_STAGE_THEME;
    if (stageTheme.pages?.length) {
      const page = getPageForContext(stageTheme, "rest");
      if (page) {
        let cached = stageRestPageCache.get(stageTheme);
        if (!cached) {
          cached = materializePage(stageTheme, page);
          stageRestPageCache.set(stageTheme, cached);
        }
        return cached;
      }
    } else if (stageTheme) {
      return stageTheme;
    }
    const guid = get().stageRestThemeGuid ?? DEFAULT_STAGE_REST_THEME_GUID;
    const found = get().themes.find(
      (t) => t.guid === guid && t.category !== "presentation",
    );
    if (found) return found;
    const fallback = get().themes.find(
      (t) =>
        t.category !== "presentation" &&
        (t.title.toLowerCase().includes("descanso") ||
          t.title.toLowerCase().includes("espera") ||
          t.title.toLowerCase().includes("relogio") ||
          t.title.toLowerCase().includes("relógio")),
    );
    return fallback ?? DEFAULT_STAGE_REST_THEME;
  },
}));
