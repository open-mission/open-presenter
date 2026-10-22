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

export function parseCssLength(
  value: string | undefined,
  base: number,
): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  const px = parseCssPx(trimmed);
  if (px !== null) return px;
  const pct = trimmed.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pct) return (Number(pct[1]) / 100) * base;
  const bare = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
  return bare ? Number(bare[1]) : null;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const FALLBACK_SIZE: Record<
  ThemeElement["type"],
  { w: number; h: number }
> = {
  TEXT: { w: 400, h: 100 },
  IMAGE: { w: 320, h: 180 },
  VIDEO: { w: 320, h: 180 },
  RECTANGLE: { w: 200, h: 120 },
  CIRCLE: { w: 160, h: 160 },
  TRIANGLE: { w: 160, h: 160 },
  STAR: { w: 180, h: 180 },
};

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
  const left = parseCssLength(el.css.left, W) ?? toPx(el.x, W);
  const top = parseCssLength(el.css.top, H) ?? toPx(el.y, H);
  return {
    left,
    top,
    width: parseCssLength(el.css.width, W),
    height: parseCssLength(el.css.height, H),
  };
}

export function elementBox(
  el: ThemeElement,
  measured?: { w: number; h: number },
): Rect {
  const rect = elementRect(el);
  const fallback = FALLBACK_SIZE[el.type] ?? { w: 200, h: 100 };
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width ?? measured?.w ?? fallback.w,
    height: rect.height ?? measured?.h ?? fallback.h,
  };
}

export function parseRotateDeg(value: string | undefined): number {
  if (value === undefined) return 0;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)deg$/);
  return match ? Number(match[1]) : 0;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function rotatePoint(point: Point, center: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function rotatedCorners(
  rect: Rect,
  deg: number,
): [Point, Point, Point, Point] {
  const center = rectCenter(rect);
  const corners: [Point, Point, Point, Point] = [
    { x: rect.left, y: rect.top },
    { x: rect.left + rect.width, y: rect.top },
    { x: rect.left + rect.width, y: rect.top + rect.height },
    { x: rect.left, y: rect.top + rect.height },
  ];
  return corners.map((p) => rotatePoint(p, center, deg)) as [
    Point,
    Point,
    Point,
    Point,
  ];
}

export function visualRect(rect: Rect, deg: number): Rect {
  const corners = rotatedCorners(rect, deg);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
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
