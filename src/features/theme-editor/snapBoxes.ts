import type { ThemeElement } from "@/core/types";

export interface ElementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function buildSnapBoxes(
  elements: readonly ThemeElement[],
  excludeIds: ReadonlySet<string>,
  boxOf: (element: ThemeElement) => ElementBox,
): Map<string, ElementBox> {
  const boxes = new Map<string, ElementBox>();
  for (const element of elements) {
    if (excludeIds.has(element.id)) continue;
    boxes.set(element.id, boxOf(element));
  }
  return boxes;
}