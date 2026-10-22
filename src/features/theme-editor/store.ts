import { create } from "zustand";
import type { SlideTheme, ThemeContext, ThemeElement, ThemePage } from "../../core/types/index.ts";
import { getTheme, saveTheme } from "../../core/ipc/commands.ts";
import { cloneTheme, createPage, getActivePage } from "../slide-themes/pages.ts";
import {
  groupElementsInList,
  ungroupElementsInList,
  renameGroupInList,
  toggleGroupVisibleInList,
  toggleGroupLockedInList,
  moveGroupInList,
  removeGroupInList,
  updateElementsInList,
} from "./groups.ts";

const HISTORY_LIMIT = 50;

function clone(theme: SlideTheme): SlideTheme {
  return structuredClone(theme);
}

function firstPageId(theme: SlideTheme): string | null {
  return theme.pages?.[0]?.id ?? null;
}

function validPageId(theme: SlideTheme, current: string | null): string | null {
  if (theme.pages?.some((page) => page.id === current)) return current;
  return firstPageId(theme);
}

interface ThemeEditorState {
  guid: string | null;
  draft: SlideTheme | null;
  savedJson: string | null;
  past: SlideTheme[];
  future: SlideTheme[];
  error: string | null;
  activePageId: string | null;
  load(guid: string): Promise<void>;
  updateCss(patch: Record<string, string>): void;
  updateElement(id: string, patch: Partial<ThemeElement>): void;
  updateElements(patches: { id: string; patch: Partial<ThemeElement> }[]): void;
  groupElements(ids: string[], name?: string): string;
  ungroupElements(groupId: string): void;
  renameGroup(groupId: string, name: string): void;
  toggleGroupVisible(groupId: string): void;
  toggleGroupLocked(groupId: string): void;
  moveGroup(groupId: string, dir: 1 | -1): void;
  removeGroup(groupId: string): void;
  addElement(el: ThemeElement): void;
  addElements(els: ThemeElement[]): void;
  removeElement(id: string): void;
  moveElement(id: string, dir: 1 | -1): void;
  toggleVisible(id: string): void;
  toggleLocked(id: string): void;
  setTitle(title: string): void;
  setCategory(category: SlideTheme["category"]): void;
  selectPage(pageId: string): void;
  addPage(context: ThemeContext, mode: "duplicate" | "blank"): void;
  removePage(pageId: string): void;
  addPresentationSlide(mode: "duplicate" | "blank"): void;
  duplicatePage(pageId: string): void;
  movePage(pageId: string, dir: -1 | 1): void;
  renamePage(pageId: string, name: string): void;
  upgradeToV2(context: ThemeContext, category?: SlideTheme["category"]): void;
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
    activePageId: null,

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
            activePageId: null,
          });
          return;
        }
        const themeDraft = clone(theme);
        if (
          themeDraft.category === "presentation" &&
          (!themeDraft.pages || themeDraft.pages.length === 0)
        ) {
          themeDraft.pages = [
            {
              id: crypto.randomUUID(),
              context: "text",
              name: "Slide 1",
              css: { ...(themeDraft.css ?? {}) },
              elements: structuredClone(themeDraft.elements ?? []),
            },
          ];
        }
        set({
          guid,
          draft: themeDraft,
          savedJson: JSON.stringify(themeDraft),
          past: [],
          future: [],
          error: null,
          activePageId: firstPageId(themeDraft),
        });
      } catch {
        set({
          guid,
          draft: null,
          savedJson: null,
          past: [],
          future: [],
          error: "Tema não encontrado",
          activePageId: null,
        });
      }
    },

    updateCss: (patch) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.css = { ...page.css, ...patch };
      else next.css = { ...next.css, ...patch };
      mutate(next);
    },

    updateElement: (id, patch) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      const elements = page ? page.elements : next.elements;
      if (!elements.some((el) => el.id === id)) return;
      const update = (list: ThemeElement[]) =>
        list.map((el) => (el.id === id ? { ...el, ...patch, id: el.id } : el));
      if (page) page.elements = update(page.elements);
      else next.elements = update(next.elements);
      mutate(next);
    },

    updateElements: (patches) => {
      const { draft, activePageId } = get();
      if (!draft || patches.length === 0) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = updateElementsInList(page.elements, patches);
      else next.elements = updateElementsInList(next.elements, patches);
      mutate(next);
    },

    groupElements: (ids, name) => {
      const { draft, activePageId } = get();
      if (!draft || ids.length < 2) return "";
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      const list = page ? page.elements : next.elements;
      const res = groupElementsInList(list, ids, name);
      if (!res.groupId) return "";
      if (page) page.elements = res.elements;
      else next.elements = res.elements;
      mutate(next);
      return res.groupId;
    },

    ungroupElements: (groupId) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = ungroupElementsInList(page.elements, groupId);
      else next.elements = ungroupElementsInList(next.elements, groupId);
      mutate(next);
    },

    renameGroup: (groupId, name) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = renameGroupInList(page.elements, groupId, name);
      else next.elements = renameGroupInList(next.elements, groupId, name);
      mutate(next);
    },

    toggleGroupVisible: (groupId) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = toggleGroupVisibleInList(page.elements, groupId);
      else next.elements = toggleGroupVisibleInList(next.elements, groupId);
      mutate(next);
    },

    toggleGroupLocked: (groupId) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = toggleGroupLockedInList(page.elements, groupId);
      else next.elements = toggleGroupLockedInList(next.elements, groupId);
      mutate(next);
    },

    moveGroup: (groupId, dir) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = moveGroupInList(page.elements, groupId, dir);
      else next.elements = moveGroupInList(next.elements, groupId, dir);
      mutate(next);
    },

    removeGroup: (groupId) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = removeGroupInList(page.elements, groupId);
      else next.elements = removeGroupInList(next.elements, groupId);
      mutate(next);
    },

    addElement: (el) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      if (page) page.elements = [...page.elements, structuredClone(el)];
      else next.elements = [...next.elements, structuredClone(el)];
      mutate(next);
    },

    addElements: (els) => {
      const { draft, activePageId } = get();
      if (!draft || els.length === 0) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      const clones = els.map((el) => structuredClone(el));
      if (page) page.elements = [...page.elements, ...clones];
      else next.elements = [...next.elements, ...clones];
      mutate(next);
    },

    removeElement: (id) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      const elements = page ? page.elements : next.elements;
      if (!elements.some((el) => el.id === id)) return;
      if (!page && elements.length <= 1) return;
      const remove = (list: ThemeElement[]) => list.filter((el) => el.id !== id);
      if (page) page.elements = remove(page.elements);
      else next.elements = remove(next.elements);
      mutate(next);
    },

    moveElement: (id, dir) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      const list = page ? page.elements : next.elements;
      const index = list.findIndex((el) => el.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= list.length) return;
      const [moved] = list.splice(index, 1);
      list.splice(target, 0, moved);
      if (page) page.elements = list;
      else next.elements = list;
      mutate(next);
    },

    toggleVisible: (id) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const page = getActivePage(draft, activePageId);
      const el = (page?.elements ?? draft.elements).find((e) => e.id === id);
      if (!el) return;
      get().updateElement(id, { visible: !el.visible });
    },

    toggleLocked: (id) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const page = getActivePage(draft, activePageId);
      const el = (page?.elements ?? draft.elements).find((e) => e.id === id);
      if (!el) return;
      get().updateElement(id, { locked: !el.locked });
    },

    setTitle: (title) => {
      const { draft } = get();
      if (!draft) return;
      mutate({ ...clone(draft), title });
    },

    setCategory: (category) => {
      const { draft } = get();
      if (!draft) return;
      mutate({ ...clone(draft), category });
    },

    selectPage: (pageId) => {
      const { draft } = get();
      if (!draft?.pages?.some((page) => page.id === pageId)) return;
      set({ activePageId: pageId });
    },

    addPage: (context, mode) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      if (draft.pages?.some((page) => page.context === context)) return;
      const source = getActivePage(draft, activePageId);
      const page = createPage(draft, context, mode, source);
      const next = clone(draft);
      next.pages = [...(next.pages ?? []), page];
      mutate(next);
      set({ activePageId: page.id });
    },

    removePage: (pageId) => {
      const { draft } = get();
      if (!draft?.pages || draft.pages.length <= 1) return;
      const index = draft.pages.findIndex((page) => page.id === pageId);
      if (index < 0) return;
      const next = clone(draft);
      const pages = draft.pages.filter((page) => page.id !== pageId);
      next.pages = pages;
      const nextActive = pages[Math.max(0, index - 1)]?.id ?? pages[0].id;
      mutate(next);
      set({ activePageId: nextActive });
    },

    addPresentationSlide: (mode) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = clone(draft);
      const pages = next.pages ? [...next.pages] : [];
      const current = getActivePage(next, activePageId) ?? pages[0];
      const newPage: ThemePage = {
        id: crypto.randomUUID(),
        context: "text",
        name: `Slide ${pages.length + 1}`,
        css: mode === "duplicate" && current ? { ...current.css } : { ...(next.css ?? {}) },
        elements:
          mode === "duplicate" && current ? structuredClone(current.elements) : [],
      };
      const activeIdx = pages.findIndex((p) => p.id === activePageId);
      if (activeIdx >= 0) {
        pages.splice(activeIdx + 1, 0, newPage);
      } else {
        pages.push(newPage);
      }
      next.pages = pages;
      mutate(next);
      set({ activePageId: newPage.id });
    },

    duplicatePage: (pageId) => {
      const { draft } = get();
      if (!draft) return;
      const next = clone(draft);
      if (!next.pages) return;
      const idx = next.pages.findIndex((p) => p.id === pageId);
      if (idx < 0) return;
      const src = next.pages[idx];
      const newPage: ThemePage = {
        id: crypto.randomUUID(),
        context: src.context,
        name: `${src.name || `Slide ${idx + 1}`} (Cópia)`,
        css: { ...src.css },
        elements: structuredClone(src.elements),
      };
      next.pages.splice(idx + 1, 0, newPage);
      mutate(next);
      set({ activePageId: newPage.id });
    },

    movePage: (pageId, dir) => {
      const { draft } = get();
      if (!draft) return;
      const next = clone(draft);
      if (!next.pages) return;
      const idx = next.pages.findIndex((p) => p.id === pageId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= next.pages.length) return;
      const [moved] = next.pages.splice(idx, 1);
      next.pages.splice(target, 0, moved);
      mutate(next);
    },

    renamePage: (pageId, name) => {
      const { draft } = get();
      if (!draft) return;
      const next = clone(draft);
      if (!next.pages) return;
      const page = next.pages.find((p) => p.id === pageId);
      if (!page) return;
      page.name = name;
      mutate(next);
    },

    upgradeToV2: (context, category) => {
      const { draft } = get();
      if (!draft || draft.pages?.length) return;
      const page: ThemePage = {
        id: crypto.randomUUID(),
        context,
        css: { ...draft.css },
        elements: structuredClone(draft.elements),
      };
      const guid = draft.guid;
      const next = cloneTheme(draft, draft.title);
      next.guid = guid;
      next.category = category ?? draft.category ?? "theme";
      next.pages = [page];
      next.css = {};
      next.elements = [];
      mutate(next);
      set({ activePageId: page.id });
    },

    undo: () => {
      const { draft, past, future } = get();
      if (!draft || past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        draft: clone(previous),
        activePageId: validPageId(previous, get().activePageId),
        past: past.slice(0, -1),
        future: [clone(draft), ...future],
      });
    },

    redo: () => {
      const { draft, past, future } = get();
      if (!draft || future.length === 0) return;
      const [nextTheme, ...rest] = future;
      set({
        draft: clone(nextTheme),
        activePageId: validPageId(nextTheme, get().activePageId),
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
        const toSave = clone(draft);
        if (toSave.category === "presentation" && toSave.pages?.length) {
          toSave.elements = structuredClone(toSave.pages[0].elements);
          toSave.css = { ...toSave.pages[0].css };
        }
        await saveTheme(toSave);
        set({ savedJson: JSON.stringify(toSave), draft: toSave, error: null });
      } catch {
        set({ error: "Falha ao salvar tema" });
      }
    },

    revert: () => {
      const { draft, savedJson } = get();
      if (!draft || savedJson === null) return;
      const restored = JSON.parse(savedJson) as SlideTheme;
      if (
        restored.category === "presentation" &&
        (!restored.pages || restored.pages.length === 0)
      ) {
        restored.pages = [
          {
            id: crypto.randomUUID(),
            context: "text",
            name: "Slide 1",
            css: { ...(restored.css ?? {}) },
            elements: structuredClone(restored.elements ?? []),
          },
        ];
      }
      mutate(restored);
      set({ activePageId: firstPageId(restored) });
    },
  };
});
