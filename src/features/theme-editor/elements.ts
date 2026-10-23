import type { ThemeElement } from "@/core/types";
import { elementRect } from "./geometry.ts";

export type ReorderDirection = "front" | "back" | "forward" | "backward";

export interface DuplicateOptions {
  offset?: number;
  makeId?: () => string;
  makeGroupId?: () => string;
}

export function duplicateElementsInList(
  list: ThemeElement[],
  ids: readonly string[],
  options: DuplicateOptions = {},
): { elements: ThemeElement[]; newIds: string[] } {
  const {
    offset = 20,
    makeId = () => crypto.randomUUID(),
    makeGroupId = () => crypto.randomUUID(),
  } = options;
  const idSet = new Set(ids);
  const selected = list.filter((el) => idSet.has(el.id));
  if (selected.length === 0) return { elements: list, newIds: [] };

  const groupMembers = new Map<string, ThemeElement[]>();
  for (const el of list) {
    if (!el.groupId) continue;
    const members = groupMembers.get(el.groupId) ?? [];
    members.push(el);
    groupMembers.set(el.groupId, members);
  }

  const newGroupIds = new Map<string, string>();
  for (const [groupId, members] of groupMembers) {
    if (members.every((member) => idSet.has(member.id))) {
      newGroupIds.set(groupId, makeGroupId());
    }
  }

  const copies = selected.map((el) => {
    const box = elementRect(el);
    const left = Math.round(box.left + offset);
    const top = Math.round(box.top + offset);
    const copy = structuredClone(el);
    copy.id = makeId();
    copy.x = left;
    copy.y = top;
    copy.css = { ...el.css, left: `${left}px`, top: `${top}px` };
    const newGroupId = el.groupId ? newGroupIds.get(el.groupId) : undefined;
    if (newGroupId) {
      copy.groupId = newGroupId;
    } else {
      delete copy.groupId;
      delete copy.groupName;
    }
    return copy;
  });

  const lastIndex = list.reduce(
    (acc, el, index) => (idSet.has(el.id) ? index : acc),
    -1,
  );
  const insertAt = lastIndex + 1;
  return {
    elements: [...list.slice(0, insertAt), ...copies, ...list.slice(insertAt)],
    newIds: copies.map((copy) => copy.id),
  };
}

export function removeElementsInList(
  list: ThemeElement[],
  ids: readonly string[],
  options: { minKeep?: number } = {},
): ThemeElement[] {
  const { minKeep = 0 } = options;
  const idSet = new Set(ids);
  const remaining = list.filter((el) => !idSet.has(el.id));
  if (remaining.length === list.length) return list;
  if (remaining.length < minKeep) return list;
  return dropOrphanGroups(remaining);
}

export function dropOrphanGroups(list: readonly ThemeElement[]): ThemeElement[] {
  const counts = new Map<string, number>();
  for (const el of list) {
    if (!el.groupId) continue;
    counts.set(el.groupId, (counts.get(el.groupId) ?? 0) + 1);
  }
  return list.map((el) => {
    if (!el.groupId) return el;
    if ((counts.get(el.groupId) ?? 0) > 1) return el;
    const { groupId: _groupId, groupName: _groupName, ...rest } = el;
    return rest as ThemeElement;
  });
}

export function reorderElementsInList(
  list: ThemeElement[],
  ids: readonly string[],
  direction: ReorderDirection,
): ThemeElement[] {
  const idSet = new Set(ids);
  const block = list.filter((el) => idSet.has(el.id));
  if (block.length === 0) return list;
  const rest = list.filter((el) => !idSet.has(el.id));
  const firstIndex = list.findIndex((el) => idSet.has(el.id));
  const before = list.slice(0, firstIndex).filter((el) => !idSet.has(el.id)).length;

  let insertAt: number;
  switch (direction) {
    case "back":
      insertAt = 0;
      break;
    case "front":
      insertAt = rest.length;
      break;
    case "backward":
      insertAt = Math.max(0, before - 1);
      break;
    case "forward":
      insertAt = Math.min(rest.length, before + 1);
      break;
  }

  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
}
