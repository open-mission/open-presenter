import type { ThemeElement } from "@/core/types";
import {
  LOGICAL_H,
  LOGICAL_W,
  type Rect,
  elementBox,
  unionRects,
  visualRect,
} from "./geometry.ts";
import {
  type DuplicateOptions,
  dropOrphanGroups,
  duplicateElementsInList,
  removeElementsInList,
} from "./elements.ts";
import { groupElementsInList, ungroupElementsInList } from "./groups.ts";
import { elementRotation } from "./transform.ts";

export interface EditorSelection {
  ids: string[];
  anchorId: string | null;
  enteredGroupId: string | null;
}

export const EMPTY_SELECTION: EditorSelection = {
  ids: [],
  anchorId: null,
  enteredGroupId: null,
};

export function groupMemberIds(
  elements: readonly ThemeElement[],
  groupId: string,
): string[] {
  return elements.filter((el) => el.groupId === groupId).map((el) => el.id);
}

export function resolveClickSelection(
  elements: readonly ThemeElement[],
  id: string,
  enteredGroupId: string | null,
): EditorSelection {
  const el = elements.find((item) => item.id === id);
  if (!el) return EMPTY_SELECTION;
  if (!el.groupId) return { ids: [id], anchorId: id, enteredGroupId: null };
  if (el.groupId === enteredGroupId) {
    return { ids: [id], anchorId: id, enteredGroupId };
  }
  return {
    ids: groupMemberIds(elements, el.groupId),
    anchorId: id,
    enteredGroupId: null,
  };
}

export function toggleInSelection(
  elements: readonly ThemeElement[],
  selection: EditorSelection,
  id: string,
): EditorSelection {
  if (!elements.some((el) => el.id === id)) return selection;
  if (!selection.ids.includes(id)) {
    return {
      ids: [...selection.ids, id],
      anchorId: selection.anchorId ?? id,
      enteredGroupId: null,
    };
  }
  const ids = selection.ids.filter((current) => current !== id);
  if (ids.length === 0) return EMPTY_SELECTION;
  const anchorId =
    selection.anchorId && ids.includes(selection.anchorId)
      ? selection.anchorId
      : ids[ids.length - 1];
  return { ids, anchorId, enteredGroupId: null };
}

export function selectableIds(elements: readonly ThemeElement[]): string[] {
  return elements
    .filter((el) => el.visible && !el.locked)
    .map((el) => el.id);
}

export function pruneSelection(
  elements: readonly ThemeElement[],
  selection: EditorSelection,
): EditorSelection {
  const existing = new Set(elements.map((el) => el.id));
  const ids = selection.ids.filter((id) => existing.has(id));
  if (ids.length === 0) return EMPTY_SELECTION;
  const anchorId =
    selection.anchorId && ids.includes(selection.anchorId)
      ? selection.anchorId
      : ids[0];
  const enteredGroupId =
    selection.enteredGroupId &&
    elements.some((el) => el.groupId === selection.enteredGroupId)
      ? selection.enteredGroupId
      : null;
  return { ids, anchorId, enteredGroupId };
}

export function selectionVisualBox(
  elements: readonly ThemeElement[],
  ids: readonly string[],
): Rect | null {
  const idSet = new Set(ids);
  const rects = elements
    .filter((el) => idSet.has(el.id))
    .map((el) => visualRect(elementBox(el), elementRotation(el)));
  return unionRects(rects);
}

export function alignmentTargetFor(
  elements: readonly ThemeElement[],
  selection: EditorSelection,
  W = LOGICAL_W,
  H = LOGICAL_H,
): Rect {
  const canvas: Rect = { left: 0, top: 0, width: W, height: H };
  if (selection.ids.length >= 2) {
    return selectionVisualBox(elements, selection.ids) ?? canvas;
  }
  if (selection.ids.length === 1) {
    const el = elements.find((item) => item.id === selection.ids[0]);
    if (el?.groupId) {
      return selectionVisualBox(elements, groupMemberIds(elements, el.groupId)) ?? canvas;
    }
  }
  return canvas;
}

export function duplicateSelectionInList(
  list: ThemeElement[],
  selection: EditorSelection,
  options: DuplicateOptions = {},
): { elements: ThemeElement[]; selection: EditorSelection } {
  const result = duplicateElementsInList(list, selection.ids, options);
  if (result.newIds.length === 0) return { elements: list, selection };
  return {
    elements: result.elements,
    selection: {
      ids: result.newIds,
      anchorId: result.newIds[0],
      enteredGroupId: null,
    },
  };
}

export function removeSelectionInList(
  list: ThemeElement[],
  selection: EditorSelection,
  options: { minKeep?: number } = {},
): { elements: ThemeElement[]; selection: EditorSelection } {
  const elements = removeElementsInList(list, selection.ids, options);
  if (elements === list) return { elements: list, selection };
  return { elements, selection: EMPTY_SELECTION };
}

export function groupSelectionInList(
  list: ThemeElement[],
  selection: EditorSelection,
  name?: string,
): { elements: ThemeElement[]; selection: EditorSelection; groupId: string } {
  const idSet = new Set(selection.ids);
  const ids = list.filter((el) => idSet.has(el.id)).map((el) => el.id);
  if (ids.length < 2) return { elements: list, selection, groupId: "" };
  const result = groupElementsInList(list, ids, name);
  if (!result.groupId) return { elements: list, selection, groupId: "" };
  return {
    elements: dropOrphanGroups(result.elements),
    selection: {
      ids,
      anchorId:
        selection.anchorId && ids.includes(selection.anchorId)
          ? selection.anchorId
          : ids[0],
      enteredGroupId: null,
    },
    groupId: result.groupId,
  };
}

export function ungroupSelectionInList(
  list: ThemeElement[],
  selection: EditorSelection,
): { elements: ThemeElement[]; selection: EditorSelection } {
  const idSet = new Set(selection.ids);
  const groupIds = new Set<string>();
  for (const el of list) {
    if (idSet.has(el.id) && el.groupId) groupIds.add(el.groupId);
  }
  let elements = list;
  for (const groupId of groupIds) {
    elements = ungroupElementsInList(elements, groupId);
  }
  if (elements === list) return { elements: list, selection };
  const existing = new Set(elements.map((el) => el.id));
  const ids = selection.ids.filter((id) => existing.has(id));
  return {
    elements,
    selection: {
      ids,
      anchorId:
        selection.anchorId && ids.includes(selection.anchorId)
          ? selection.anchorId
          : ids[0] ?? null,
      enteredGroupId: null,
    },
  };
}
