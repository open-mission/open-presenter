import type { ThemeElement } from "../../core/types/index.ts";

export function groupElementsInList(
  list: ThemeElement[],
  ids: string[],
  name?: string,
): { elements: ThemeElement[]; groupId: string } {
  if (ids.length < 2) return { elements: list, groupId: "" };

  const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const groupName = name?.trim() || "Grupo";

  const idSet = new Set(ids);
  const groupedEls: ThemeElement[] = [];
  const nonGroupedEls: ThemeElement[] = [];
  let firstIdx = -1;

  list.forEach((el, idx) => {
    if (idSet.has(el.id)) {
      if (firstIdx === -1) firstIdx = idx;
      groupedEls.push({ ...el, groupId, groupName });
    } else {
      nonGroupedEls.push(el);
    }
  });

  if (firstIdx >= 0) {
    nonGroupedEls.splice(firstIdx, 0, ...groupedEls);
  }

  return { elements: nonGroupedEls, groupId };
}

export function ungroupElementsInList(
  list: ThemeElement[],
  groupId: string,
): ThemeElement[] {
  return list.map((el) => {
    if (el.groupId === groupId) {
      const { groupId: _g, groupName: _n, ...rest } = el;
      return rest as ThemeElement;
    }
    return el;
  });
}

export function renameGroupInList(
  list: ThemeElement[],
  groupId: string,
  name: string,
): ThemeElement[] {
  const trimmed = name.trim() || "Grupo";
  return list.map((el) => (el.groupId === groupId ? { ...el, groupName: trimmed } : el));
}

export function toggleGroupVisibleInList(
  list: ThemeElement[],
  groupId: string,
): ThemeElement[] {
  const inGroup = list.filter((e) => e.groupId === groupId);
  if (inGroup.length === 0) return list;
  const allVisible = inGroup.every((e) => e.visible);
  const nextVisible = !allVisible;
  return list.map((el) => (el.groupId === groupId ? { ...el, visible: nextVisible } : el));
}

export function toggleGroupLockedInList(
  list: ThemeElement[],
  groupId: string,
): ThemeElement[] {
  const inGroup = list.filter((e) => e.groupId === groupId);
  if (inGroup.length === 0) return list;
  const allLocked = inGroup.every((e) => e.locked);
  const nextLocked = !allLocked;
  return list.map((el) => (el.groupId === groupId ? { ...el, locked: nextLocked } : el));
}

export function moveGroupInList(
  list: ThemeElement[],
  groupId: string,
  dir: 1 | -1,
): ThemeElement[] {
  const next = [...list];
  const indices = next
    .map((el, i) => (el.groupId === groupId ? i : -1))
    .filter((i) => i !== -1);
  if (indices.length === 0) return list;
  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);

  if (dir === -1) {
    if (minIdx <= 0) return list;
    const targetIdx = minIdx - 1;
    const [item] = next.splice(targetIdx, 1);
    next.splice(maxIdx, 0, item);
  } else {
    if (maxIdx >= next.length - 1) return list;
    const targetIdx = maxIdx + 1;
    const [item] = next.splice(targetIdx, 1);
    next.splice(minIdx, 0, item);
  }
  return next;
}

export function removeGroupInList(
  list: ThemeElement[],
  groupId: string,
): ThemeElement[] {
  return list.filter((el) => el.groupId !== groupId);
}

export function updateElementsInList(
  list: ThemeElement[],
  patches: { id: string; patch: Partial<ThemeElement> }[],
): ThemeElement[] {
  if (patches.length === 0) return list;
  const patchMap = new Map(patches.map((p) => [p.id, p.patch]));
  return list.map((el) => {
    const p = patchMap.get(el.id);
    return p ? { ...el, ...p, id: el.id } : el;
  });
}
