import { create } from "zustand";
import type { MasterLayerId, SlideTheme, ThemeContext, ThemeElement, ThemePage } from "../../core/types/index.ts";
import { getTheme, saveTheme } from "../../core/ipc/commands.ts";
import { cloneTheme, createPage, getActivePage } from "../slide-themes/pages.ts";
import { defaultLayerForElement } from "../slide-themes/layers.ts";
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
import type { AlignEdge } from "./geometry.ts";
import { type ReorderDirection, reorderElementsInList } from "./elements.ts";
import {
  type EditorSelection,
  EMPTY_SELECTION,
  alignmentTargetFor,
  duplicateSelectionInList,
  groupSelectionInList,
  pruneSelection,
  removeSelectionInList,
  selectableIds,
  selectionVisualBox,
  toggleInSelection,
} from "./selection.ts";
import {
  type GuideAxis,
  addGuideToTheme,
  clearGuidesInTheme,
  guidesOfTheme,
  moveGuideInTheme,
  removeGuideFromTheme,
} from "./guides.ts";
import {
  alignElementsInList,
  distributeElementsInList,
  rotateElementsInList,
  scaleElementsInList,
  setElementRotation,
  translateElementsInList,
} from "./transform.ts";

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
  selection: EditorSelection;
  load(guid: string): Promise<void>;
  select(
    ids: string | string[],
    options?: { anchorId?: string; enteredGroupId?: string | null },
  ): void;
  toggleSelect(id: string): void;
  clearSelection(): void;
  enterGroup(groupId: string, itemId: string): void;
  selectAll(): void;
  duplicateSelection(): void;
  removeSelection(): void;
  groupSelection(name?: string): string;
  ungroupSelection(): void;
  translateSelection(dx: number, dy: number): void;
  scaleSelection(factorX: number, factorY: number): void;
  rotateSelectionBy(deltaDeg: number): void;
  setSelectionRotation(deg: number): void;
  alignSelection(edge: AlignEdge): void;
  distributeSelection(axis: "x" | "y"): void;
  reorderSelection(direction: ReorderDirection): void;
  addGuide(axis: GuideAxis, pos: number): string;
  moveGuide(id: string, pos: number): void;
  removeGuide(id: string): void;
  clearGuides(): void;
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
  moveElementsToLayer(ids: string[], layer: MasterLayerId): void;
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

  function activeElements(theme: SlideTheme, pageId: string | null): ThemeElement[] {
    const page = getActivePage(theme, pageId);
    return page ? page.elements : theme.elements;
  }

  function withElements(
    theme: SlideTheme,
    pageId: string | null,
    elements: ThemeElement[],
  ): void {
    const page = getActivePage(theme, pageId);
    if (page) page.elements = elements;
    else theme.elements = elements;
  }

  return {
    guid: null,
    draft: null,
    savedJson: null,
    past: [],
    future: [],
    error: null,
    activePageId: null,
    selection: EMPTY_SELECTION,

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
            selection: EMPTY_SELECTION,
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
          selection: EMPTY_SELECTION,
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
          selection: EMPTY_SELECTION,
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

    select: (ids, options) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const list = activeElements(draft, activePageId);
      const existing = new Set(list.map((el) => el.id));
      const wanted = (Array.isArray(ids) ? ids : [ids]).filter((id) =>
        existing.has(id),
      );
      if (wanted.length === 0) {
        set({ selection: EMPTY_SELECTION });
        return;
      }
      const anchorId =
        options?.anchorId && wanted.includes(options.anchorId)
          ? options.anchorId
          : wanted[0];
      set({
        selection: {
          ids: wanted,
          anchorId,
          enteredGroupId: options?.enteredGroupId ?? null,
        },
      });
    },

    toggleSelect: (id) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      set({
        selection: toggleInSelection(
          activeElements(draft, activePageId),
          get().selection,
          id,
        ),
      });
    },

    clearSelection: () => set({ selection: EMPTY_SELECTION }),

    enterGroup: (groupId, itemId) => {
      get().select([itemId], { anchorId: itemId, enteredGroupId: groupId });
    },

    selectAll: () => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const ids = selectableIds(activeElements(draft, activePageId));
      get().select(ids, { anchorId: ids[0] });
    },

    duplicateSelection: () => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0) return;
      const list = activeElements(draft, activePageId);
      const result = duplicateSelectionInList(list, selection);
      if (result.elements === list) return;
      const next = clone(draft);
      withElements(next, activePageId, result.elements);
      mutate(next);
      set({ selection: result.selection });
    },

    removeSelection: () => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0) return;
      const list = activeElements(draft, activePageId);
      const page = getActivePage(draft, activePageId);
      const result = removeSelectionInList(list, selection, {
        minKeep: page ? 0 : 1,
      });
      if (result.elements === list) return;
      const next = clone(draft);
      withElements(next, activePageId, result.elements);
      mutate(next);
      set({ selection: result.selection });
    },

    groupSelection: (name) => {
      const { draft, activePageId, selection } = get();
      if (!draft) return "";
      const list = activeElements(draft, activePageId);
      const result = groupSelectionInList(list, selection, name);
      if (!result.groupId) return "";
      const next = clone(draft);
      withElements(next, activePageId, result.elements);
      mutate(next);
      set({ selection: result.selection });
      return result.groupId;
    },

    ungroupSelection: () => {
      const { draft, activePageId, selection } = get();
      if (!draft) return;
      const list = activeElements(draft, activePageId);
      const idSet = new Set(selection.ids);
      const groupId =
        selection.enteredGroupId ??
        list.find((el) => idSet.has(el.id) && el.groupId)?.groupId;
      if (!groupId) return;
      const elements = ungroupElementsInList(list, groupId);
      const next = clone(draft);
      withElements(next, activePageId, elements);
      mutate(next);
      set({ selection: pruneSelection(elements, selection) });
    },

    translateSelection: (dx, dy) => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0 || (dx === 0 && dy === 0)) return;
      const list = activeElements(draft, activePageId);
      const elements = translateElementsInList(list, selection.ids, dx, dy);
      const next = clone(draft);
      withElements(next, activePageId, elements);
      mutate(next);
    },

    scaleSelection: (factorX, factorY) => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0) return;
      const list = activeElements(draft, activePageId);
      const box = selectionVisualBox(list, selection.ids);
      if (!box || box.width <= 0 || box.height <= 0) return;
      const elements = scaleElementsInList(list, box, {
        ...box,
        width: box.width * factorX,
        height: box.height * factorY,
      });
      const next = clone(draft);
      withElements(next, activePageId, elements);
      mutate(next);
    },

    rotateSelectionBy: (deltaDeg) => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0 || deltaDeg === 0) return;
      const list = activeElements(draft, activePageId);
      const box = selectionVisualBox(list, selection.ids);
      if (!box) return;
      const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const elements = rotateElementsInList(list, center, deltaDeg);
      const next = clone(draft);
      withElements(next, activePageId, elements);
      mutate(next);
    },

    setSelectionRotation: (deg) => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length !== 1) return;
      const list = activeElements(draft, activePageId);
      const el = list.find((item) => item.id === selection.ids[0]);
      if (!el) return;
      get().updateElement(el.id, { css: setElementRotation(el, deg).css });
    },

    alignSelection: (edge) => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0) return;
      const list = activeElements(draft, activePageId);
      const target = alignmentTargetFor(list, selection);
      const elements = alignElementsInList(list, selection.ids, edge, target);
      const next = clone(draft);
      withElements(next, activePageId, elements);
      mutate(next);
    },

    distributeSelection: (axis) => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0) return;
      const list = activeElements(draft, activePageId);
      const elements = distributeElementsInList(list, selection.ids, axis);
      const next = clone(draft);
      withElements(next, activePageId, elements);
      mutate(next);
    },

    reorderSelection: (direction) => {
      const { draft, activePageId, selection } = get();
      if (!draft || selection.ids.length === 0) return;
      const list = activeElements(draft, activePageId);
      const elements = reorderElementsInList(list, selection.ids, direction);
      if (elements.every((el, index) => el === list[index])) return;
      const next = clone(draft);
      withElements(next, activePageId, elements);
      mutate(next);
    },

    addGuide: (axis, pos) => {
      const { draft, activePageId } = get();
      if (!draft) return "";
      const id = crypto.randomUUID();
      mutate(
        addGuideToTheme(draft, activePageId, { id, axis, pos: Math.round(pos) }),
      );
      return id;
    },

    moveGuide: (id, pos) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      const next = moveGuideInTheme(draft, activePageId, id, Math.round(pos));
      if (next === draft) return;
      mutate(next);
    },

    removeGuide: (id) => {
      const { draft, activePageId } = get();
      if (!draft) return;
      if (!guidesOfTheme(draft, activePageId).some((guide) => guide.id === id)) return;
      mutate(removeGuideFromTheme(draft, activePageId, id));
    },

    clearGuides: () => {
      const { draft, activePageId } = get();
      if (!draft) return;
      if (guidesOfTheme(draft, activePageId).length === 0) return;
      mutate(clearGuidesInTheme(draft, activePageId));
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
      const withLayer = {
        ...structuredClone(el),
        layer: el.layer ?? defaultLayerForElement(el.type),
      };
      if (page) page.elements = [...page.elements, withLayer];
      else next.elements = [...next.elements, withLayer];
      mutate(next);
    },

    addElements: (els) => {
      const { draft, activePageId } = get();
      if (!draft || els.length === 0) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      const clones = els.map((el) => ({
        ...structuredClone(el),
        layer: el.layer ?? defaultLayerForElement(el.type),
      }));
      if (page) page.elements = [...page.elements, ...clones];
      else next.elements = [...next.elements, ...clones];
      mutate(next);
    },

    moveElementsToLayer: (ids, layer) => {
      const { draft, activePageId } = get();
      if (!draft || ids.length === 0) return;
      const next = clone(draft);
      const page = getActivePage(next, activePageId);
      const idSet = new Set(ids);
      const apply = (list: ThemeElement[]) =>
        list.map((el) => (idSet.has(el.id) ? { ...el, layer } : el));
      if (page) page.elements = apply(page.elements);
      else next.elements = apply(next.elements);
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
      set({ activePageId: pageId, selection: EMPTY_SELECTION });
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
      set({ activePageId: page.id, selection: EMPTY_SELECTION });
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
      set({ activePageId: nextActive, selection: EMPTY_SELECTION });
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
      set({ activePageId: newPage.id, selection: EMPTY_SELECTION });
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
      set({ activePageId: newPage.id, selection: EMPTY_SELECTION });
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
      set({ selection: EMPTY_SELECTION });
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
        guides: draft.guides ? structuredClone(draft.guides) : undefined,
      };
      const guid = draft.guid;
      const next = cloneTheme(draft, draft.title);
      next.guid = guid;
      next.category = category ?? draft.category ?? "theme";
      next.pages = [page];
      next.css = {};
      next.elements = [];
      mutate(next);
      set({ activePageId: page.id, selection: EMPTY_SELECTION });
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
        selection: EMPTY_SELECTION,
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
        selection: EMPTY_SELECTION,
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
      } catch (err) {
        set({ error: "Falha ao salvar tema" });
        throw err;
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
