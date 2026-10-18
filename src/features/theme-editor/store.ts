import { create } from "zustand";
import type { SlideTheme, ThemeElement } from "@/core/types";
import { getTheme, saveTheme } from "@/core/ipc/commands";

const HISTORY_LIMIT = 50;

function clone(theme: SlideTheme): SlideTheme {
  return structuredClone(theme);
}

interface ThemeEditorState {
  guid: string | null;
  draft: SlideTheme | null;
  savedJson: string | null;
  past: SlideTheme[];
  future: SlideTheme[];
  error: string | null;
  load(guid: string): Promise<void>;
  updateCss(patch: Record<string, string>): void;
  updateElement(id: string, patch: Partial<ThemeElement>): void;
  addElement(el: ThemeElement): void;
  removeElement(id: string): void;
  moveElement(id: string, dir: 1 | -1): void;
  toggleVisible(id: string): void;
  toggleLocked(id: string): void;
  setTitle(title: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  isDirty(): boolean;
  save(): Promise<void>;
  revert(): void;
}

export const useThemeEditorStore = create<ThemeEditorState>((set, get) => {
  function mutate(next: SlideTheme): void {
    const { draft, past } = get();
    if (!draft) return;
    set({
      draft: next,
      past: [...past, clone(draft)].slice(-HISTORY_LIMIT),
      future: [],
    });
  }

  return {
    guid: null,
    draft: null,
    savedJson: null,
    past: [],
    future: [],
    error: null,

    load: async (guid) => {
      try {
        const theme = await getTheme(guid);
        if (!theme) {
          set({
            guid,
            draft: null,
            savedJson: null,
            past: [],
            future: [],
            error: "Tema não encontrado",
          });
          return;
        }
        set({
          guid,
          draft: clone(theme),
          savedJson: JSON.stringify(theme),
          past: [],
          future: [],
          error: null,
        });
      } catch {
        set({
          guid,
          draft: null,
          savedJson: null,
          past: [],
          future: [],
          error: "Tema não encontrado",
        });
      }
    },

    updateCss: (patch) => {
      const { draft } = get();
      if (!draft) return;
      mutate({ ...clone(draft), css: { ...draft.css, ...patch } });
    },

    updateElement: (id, patch) => {
      const { draft } = get();
      if (!draft) return;
      if (!draft.elements.some((el) => el.id === id)) return;
      const next = clone(draft);
      next.elements = next.elements.map((el) =>
        el.id === id ? { ...el, ...patch, id: el.id } : el,
      );
      mutate(next);
    },

    addElement: (el) => {
      const { draft } = get();
      if (!draft) return;
      const next = clone(draft);
      next.elements = [...next.elements, structuredClone(el)];
      mutate(next);
    },

    removeElement: (id) => {
      const { draft } = get();
      if (!draft) return;
      if (draft.elements.length <= 1) return;
      if (!draft.elements.some((el) => el.id === id)) return;
      const next = clone(draft);
      next.elements = next.elements.filter((el) => el.id !== id);
      mutate(next);
    },

    moveElement: (id, dir) => {
      const { draft } = get();
      if (!draft) return;
      const index = draft.elements.findIndex((el) => el.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= draft.elements.length) return;
      const next = clone(draft);
      const [moved] = next.elements.splice(index, 1);
      next.elements.splice(target, 0, moved);
      mutate(next);
    },

    toggleVisible: (id) => {
      const { draft } = get();
      if (!draft) return;
      const el = draft.elements.find((e) => e.id === id);
      if (!el) return;
      get().updateElement(id, { visible: !el.visible });
    },

    toggleLocked: (id) => {
      const { draft } = get();
      if (!draft) return;
      const el = draft.elements.find((e) => e.id === id);
      if (!el) return;
      get().updateElement(id, { locked: !el.locked });
    },

    setTitle: (title) => {
      const { draft } = get();
      if (!draft) return;
      mutate({ ...clone(draft), title });
    },

    undo: () => {
      const { draft, past, future } = get();
      if (!draft || past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        draft: clone(previous),
        past: past.slice(0, -1),
        future: [clone(draft), ...future],
      });
    },

    redo: () => {
      const { draft, past, future } = get();
      if (!draft || future.length === 0) return;
      const [next, ...rest] = future;
      set({
        draft: clone(next),
        past: [...past, clone(draft)].slice(-HISTORY_LIMIT),
        future: rest,
      });
    },

    canUndo: () => get().past.length > 0,

    canRedo: () => get().future.length > 0,

    isDirty: () => {
      const { draft, savedJson } = get();
      if (!draft || savedJson === null) return false;
      return JSON.stringify(draft) !== savedJson;
    },

    save: async () => {
      const { draft } = get();
      if (!draft) return;
      try {
        await saveTheme(draft);
        set({ savedJson: JSON.stringify(draft), error: null });
      } catch {
        set({ error: "Falha ao salvar tema" });
      }
    },

    revert: () => {
      const { draft, savedJson } = get();
      if (!draft || savedJson === null) return;
      mutate(JSON.parse(savedJson) as SlideTheme);
    },
  };
});
