import type { ThemeElement } from "@/core/types";

export const LOGICAL_W = 1920;
export const LOGICAL_H = 1080;

export function toPct(px: number, base: number): number {
  return (px / base) * 100;
}

export function toPx(pct: number, base: number): number {
  return (pct / 100) * base;
}

export function parseCssPx(value: string | undefined): number | null {
  if (value === undefined) return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

export interface ElementRect {
  left: number;
  top: number;
  width: number | null;
  height: number | null;
}

export function elementRect(
  el: ThemeElement,
  W = LOGICAL_W,
  H = LOGICAL_H,
): ElementRect {
  const left = parseCssPx(el.css.left) ?? toPx(el.x, W);
  const top = parseCssPx(el.css.top) ?? toPx(el.y, H);
  return {
    left,
    top,
    width: parseCssPx(el.css.width),
    height: parseCssPx(el.css.height),
  };
}

export type AlignEdge =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "middle"
  | "bottom";

export function alignToScreen(
  el: ThemeElement,
  edge: AlignEdge,
  W = LOGICAL_W,
  H = LOGICAL_H,
): Partial<ThemeElement> {
  const box = elementRect(el, W, H);
  const w = box.width ?? 0;
  const h = box.height ?? 0;
  let x = box.left;
  let y = box.top;
  switch (edge) {
    case "left":
      x = 0;
      break;
    case "centerX":
      x = (W - w) / 2;
      break;
    case "right":
      x = W - w;
      break;
    case "top":
      y = 0;
      break;
    case "middle":
      y = (H - h) / 2;
      break;
    case "bottom":
      y = H - h;
      break;
  }
  x = Math.max(0, Math.round(x));
  y = Math.max(0, Math.round(y));
  return { x, y, css: { ...el.css, left: `${x}px`, top: `${y}px` } };
}
