import type { ThemeElement } from "@/core/types";
import {
  type AlignEdge,
  type Point,
  type Rect,
  elementBox,
  elementRect,
  parseCssPx,
  parseRotateDeg,
  rotatePoint,
  visualRect,
} from "./geometry.ts";

export function normalizeDeg(deg: number): number {
  const norm = deg % 360;
  if (norm > 180) return norm - 360;
  if (norm <= -180) return norm + 360;
  return norm;
}

export function elementRotation(el: ThemeElement): number {
  return parseRotateDeg(el.css.rotate);
}

export function setElementRotation(el: ThemeElement, deg: number): ThemeElement {
  const norm = normalizeDeg(deg);
  if (norm === 0) {
    const { rotate: _rotate, ...css } = el.css;
    return { ...el, css };
  }
  return { ...el, css: { ...el.css, rotate: `${norm}deg` } };
}

function movedLayout(el: ThemeElement, left: number, top: number): ThemeElement {
  const l = Math.max(0, Math.round(left));
  const t = Math.max(0, Math.round(top));
  return { ...el, x: l, y: t, css: { ...el.css, left: `${l}px`, top: `${t}px` } };
}

export function translateElementsInList(
  list: ThemeElement[],
  ids: readonly string[],
  dx: number,
  dy: number,
): ThemeElement[] {
  const idSet = new Set(ids);
  return list.map((el) => {
    if (!idSet.has(el.id) || el.locked) return el;
    const box = elementRect(el);
    return movedLayout(el, box.left + dx, box.top + dy);
  });
}

export function scaleElementsInList(
  list: ThemeElement[],
  base: Rect,
  target: Rect,
  minSize = 20,
): ThemeElement[] {
  if (
    base.width <= 0 ||
    base.height <= 0 ||
    target.width <= 0 ||
    target.height <= 0
  ) {
    return list;
  }
  const fx = target.width / base.width;
  const fy = target.height / base.height;
  const fontFactor = (fx + fy) / 2;

  return list.map((el) => {
    if (el.locked) return el;
    const box = elementBox(el);
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const newCx = target.left + (cx - base.left) * fx;
    const newCy = target.top + (cy - base.top) * fy;
    const width = Math.max(minSize, Math.round(box.width * fx));
    const height = Math.max(minSize, Math.round(box.height * fy));
    const left = Math.max(0, Math.round(newCx - width / 2));
    const top = Math.max(0, Math.round(newCy - height / 2));
    const css: Record<string, string> = {
      ...el.css,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
    const fontSize = parseCssPx(el.css.fontSize);
    if (el.type === "TEXT" && fontSize !== null) {
      css.fontSize = `${Math.round(fontSize * fontFactor)}px`;
    }
    return { ...el, x: left, y: top, css };
  });
}

export function rotateElementsInList(
  list: ThemeElement[],
  center: Point,
  deltaDeg: number,
): ThemeElement[] {
  return list.map((el) => {
    if (el.locked) return el;
    const box = elementBox(el);
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const next = rotatePoint({ x: cx, y: cy }, center, deltaDeg);
    const left = Math.round((next.x - box.width / 2) * 100) / 100;
    const top = Math.round((next.y - box.height / 2) * 100) / 100;
    const rotated = setElementRotation(el, elementRotation(el) + deltaDeg);
    return {
      ...rotated,
      x: left,
      y: top,
      css: { ...rotated.css, left: `${left}px`, top: `${top}px` },
    };
  });
}

function visualBoxOf(el: ThemeElement): Rect {
  return visualRect(elementBox(el), elementRotation(el));
}

export function alignElementsInList(
  list: ThemeElement[],
  ids: readonly string[],
  edge: AlignEdge,
  target: Rect,
): ThemeElement[] {
  const idSet = new Set(ids);
  return list.map((el) => {
    if (!idSet.has(el.id) || el.locked) return el;
    const box = visualBoxOf(el);
    const layout = elementRect(el);
    let dx = 0;
    let dy = 0;
    switch (edge) {
      case "left":
        dx = target.left - box.left;
        break;
      case "centerX":
        dx = target.left + target.width / 2 - (box.left + box.width / 2);
        break;
      case "right":
        dx = target.left + target.width - (box.left + box.width);
        break;
      case "top":
        dy = target.top - box.top;
        break;
      case "middle":
        dy = target.top + target.height / 2 - (box.top + box.height / 2);
        break;
      case "bottom":
        dy = target.top + target.height - (box.top + box.height);
        break;
    }
    return movedLayout(el, layout.left + dx, layout.top + dy);
  });
}

export function distributeElementsInList(
  list: ThemeElement[],
  ids: readonly string[],
  axis: "x" | "y",
): ThemeElement[] {
  const idSet = new Set(ids);
  const items = list.filter((el) => idSet.has(el.id) && !el.locked);
  if (items.length < 3) return list;

  const boxes = new Map(items.map((el) => [el.id, visualBoxOf(el)]));
  const sorted = [...items].sort((a, b) => {
    const boxA = boxes.get(a.id)!;
    const boxB = boxes.get(b.id)!;
    return axis === "x" ? boxA.left - boxB.left : boxA.top - boxB.top;
  });

  const first = boxes.get(sorted[0].id)!;
  const last = boxes.get(sorted[sorted.length - 1].id)!;
  const start = axis === "x" ? first.left : first.top;
  const end = axis === "x" ? last.left + last.width : last.top + last.height;
  const total = sorted.reduce((sum, el) => {
    const box = boxes.get(el.id)!;
    return sum + (axis === "x" ? box.width : box.height);
  }, 0);
  const gap = (end - start - total) / (sorted.length - 1);

  const positions = new Map<string, number>();
  let cursor = start;
  sorted.forEach((el, index) => {
    const box = boxes.get(el.id)!;
    if (index > 0 && index < sorted.length - 1) positions.set(el.id, cursor);
    cursor += (axis === "x" ? box.width : box.height) + gap;
  });

  return list.map((el) => {
    const pos = positions.get(el.id);
    if (pos === undefined) return el;
    const box = boxes.get(el.id)!;
    const layout = elementRect(el);
    return axis === "x"
      ? movedLayout(el, layout.left + (pos - box.left), layout.top)
      : movedLayout(el, layout.left, layout.top + (pos - box.top));
  });
}
