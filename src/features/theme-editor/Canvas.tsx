import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Lock } from "lucide-react";
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
import { ThemeRenderer } from "../slide-themes/ThemeRenderer";
import {
  LOGICAL_H,
  LOGICAL_W,
  elementRect,
} from "./geometry";

export interface CanvasResolution {
  width: number;
  height: number;
  label: string;
}

export const RESOLUTION_PRESETS: CanvasResolution[] = [
  { width: 1920, height: 1080, label: "16:9 Full HD (1920×1080)" },
  { width: 3840, height: 2160, label: "16:9 4K (3840×2160)" },
  { width: 1280, height: 720, label: "16:9 HD (1280×720)" },
  { width: 1920, height: 1200, label: "16:10 (1920×1200)" },
  { width: 1440, height: 1080, label: "4:3 (1440×1080)" },
  { width: 2560, height: 1080, label: "21:9 Ultrawide (2560×1080)" },
  { width: 1080, height: 1920, label: "9:16 Vertical (1080×1920)" },
];

export interface CanvasProps {
  theme: SlideTheme;
  asset: ThemeAsset;
  props: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (el: ThemeElement) => void;
  showGrid: boolean;
  gridSize: number;
  showLimit: boolean;
  snap: boolean;
  zoom?: "fit" | number;
  resolution?: { width: number; height: number };
}

type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface Gesture {
  id: string;
  mode: "move" | "resize";
  dir?: ResizeDir;
  startLX: number;
  startLY: number;
  orig: { left: number; top: number; width: number; height: number };
  last: { left: number; top: number; width: number; height: number };
}

type PreviewPatch = Partial<Pick<ThemeElement, "x" | "y">> & {
  css?: Record<string, string>;
};

export interface SmartGuide {
  type: "vertical" | "horizontal";
  pos: number;
  label?: string;
}

const MIN_SIZE = 20;

const FALLBACK_SIZE: Record<ThemeElement["type"], { w: number; h: number }> = {
  TEXT: { w: 400, h: 100 },
  IMAGE: { w: 320, h: 180 },
  VIDEO: { w: 320, h: 180 },
  RECTANGLE: { w: 200, h: 120 },
};

function isRendered(
  el: ThemeElement,
  asset: ThemeAsset,
): boolean {
  if (
    !el.visible ||
    (el.assetTypeVisibility &&
      el.assetTypeVisibility.length > 0 &&
      !el.assetTypeVisibility.includes(asset))
  ) {
    return false;
  }
  const mediaSrc = (el.src ?? el.url ?? "").trim();
  if (
    (el.type === "IMAGE" || el.type === "VIDEO") &&
    (mediaSrc === "" || mediaSrc === "slide" || mediaSrc === "nextSlide")
  ) {
    return false;
  }
  if (el.type === "RECTANGLE" && el.fill === "web" && !mediaSrc) {
    return false;
  }
  return true;
}

const HANDLE_CURSORS: Record<ResizeDir, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

const HANDLE_OFFSETS: Record<ResizeDir, { x: number; y: number }> = {
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 },
};

export function Canvas({
  theme,
  asset,
  props: sampleProps,
  selectedId,
  onSelect,
  onChange,
  showGrid,
  gridSize,
  showLimit,
  snap,
  zoom = "fit",
  resolution,
}: CanvasProps) {
  const logicalW = resolution?.width ?? LOGICAL_W;
  const logicalH = resolution?.height ?? LOGICAL_H;

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [scale, setScale] = useState(0.5);
  const [preview, setPreview] = useState<Record<string, PreviewPatch>>({});
  const [activeGuides, setActiveGuides] = useState<SmartGuide[]>([]);
  const [measured, setMeasured] = useState<
    Record<string, { w: number; h: number }>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (typeof zoom === "number") {
      setScale(zoom);
      return;
    }
    const node = wrapRef.current;
    if (!node) return;
    const update = () => {
      const padding = 32;
      const availW = Math.max(100, node.clientWidth - padding);
      const availH = Math.max(100, node.clientHeight - padding);
      const sW = availW / logicalW;
      const sH = availH / logicalH;
      const autoScale = Math.min(sW, sH > 0 ? sH : sW);
      setScale(Math.max(0.1, autoScale));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [zoom, logicalW, logicalH]);

  const visibleElements = useMemo(
    () =>
      theme.elements.filter(
        (el) =>
          el.visible &&
          (!el.assetTypeVisibility ||
            el.assetTypeVisibility.length === 0 ||
            el.assetTypeVisibility.includes(asset)),
      ),
    [theme.elements, asset],
  );

  const effectiveTheme = useMemo<SlideTheme>(() => {
    if (Object.keys(preview).length === 0) return theme;
    return {
      ...theme,
      elements: theme.elements.map((el) => {
        const patch = preview[el.id];
        if (!patch) return el;
        return {
          ...el,
          ...(patch.x !== undefined ? { x: patch.x } : null),
          ...(patch.y !== undefined ? { y: patch.y } : null),
          ...(patch.css ? { css: { ...el.css, ...patch.css } } : null),
        };
      }),
    };
  }, [theme, preview]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const root = stage.querySelector(":scope > #theme");
    if (!root) return;
    const rendered = visibleElements.filter((el) => isRendered(el, asset));
    const next: Record<string, { w: number; h: number }> = {};
    Array.from(root.children).forEach((child, index) => {
      const el = rendered[index];
      if (!el) return;
      const target = child as HTMLElement;
      if (target.offsetWidth > 0 && target.offsetHeight > 0) {
        next[el.id] = { w: target.offsetWidth, h: target.offsetHeight };
      }
    });
    setMeasured(next);
  }, [theme, asset, visibleElements]);

  function withPatch(el: ThemeElement): ThemeElement {
    const patch = preview[el.id];
    if (!patch) return el;
    return {
      ...el,
      ...(patch.x !== undefined ? { x: patch.x } : null),
      ...(patch.y !== undefined ? { y: patch.y } : null),
      ...(patch.css ? { css: { ...el.css, ...patch.css } } : null),
    };
  }

  function resolveBox(el: ThemeElement): {
    left: number;
    top: number;
    width: number;
    height: number;
  } {
    const current = withPatch(el);
    const rect = elementRect(current);
    const fallback =
      measured[el.id] ?? FALLBACK_SIZE[el.type] ?? { w: 200, h: 100 };
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width ?? fallback.w,
      height: rect.height ?? fallback.h,
    };
  }

  function toLogical(e: { clientX: number; clientY: number }): {
    x: number;
    y: number;
  } {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const s = rect.width / logicalW;
    return {
      x: (e.clientX - rect.left) / s,
      y: (e.clientY - rect.top) / s,
    };
  }

  function calculateSnap(
    origLeft: number,
    origTop: number,
    dx: number,
    dy: number,
    width: number,
    height: number,
    excludeId: string,
  ): { left: number; top: number; guides: SmartGuide[] } {
    if (!snap) {
      return {
        left: Math.round(origLeft + dx),
        top: Math.round(origTop + dy),
        guides: [],
      };
    }

    const SNAP_DIST = Math.max(8, Math.round(12 / Math.max(scale, 0.1)));
    const guides: SmartGuide[] = [];

    let left = origLeft + dx;
    let top = origTop + dy;
    const right = left + width;
    const bottom = top + height;
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const marginL = logicalW * 0.05;
    const marginR = logicalW * 0.95;
    const centerTargetX = logicalW / 2;

    const otherElements = visibleElements.filter((el) => el.id !== excludeId);

    let snappedX = false;
    if (Math.abs(left - marginL) <= SNAP_DIST) {
      left = marginL;
      guides.push({ type: "vertical", pos: marginL, label: "Margem 5%" });
      snappedX = true;
    } else if (Math.abs(right - marginR) <= SNAP_DIST) {
      left = marginR - width;
      guides.push({ type: "vertical", pos: marginR, label: "Margem 95%" });
      snappedX = true;
    } else if (Math.abs(centerX - centerTargetX) <= SNAP_DIST) {
      left = Math.round(centerTargetX - width / 2);
      guides.push({ type: "vertical", pos: centerTargetX, label: "Centro X" });
      snappedX = true;
    } else if (Math.abs(left - 0) <= SNAP_DIST) {
      left = 0;
      guides.push({ type: "vertical", pos: 0, label: "0px" });
      snappedX = true;
    } else if (Math.abs(right - logicalW) <= SNAP_DIST) {
      left = logicalW - width;
      guides.push({ type: "vertical", pos: logicalW, label: `${logicalW}px` });
      snappedX = true;
    } else {
      for (const other of otherElements) {
        const box = resolveBox(other);
        const otherRight = box.left + box.width;
        const otherCenterX = box.left + box.width / 2;

        if (Math.abs(left - box.left) <= SNAP_DIST) {
          left = box.left;
          guides.push({ type: "vertical", pos: box.left, label: other.id });
          snappedX = true;
          break;
        }
        if (Math.abs(right - otherRight) <= SNAP_DIST) {
          left = otherRight - width;
          guides.push({ type: "vertical", pos: otherRight, label: other.id });
          snappedX = true;
          break;
        }
        if (Math.abs(centerX - otherCenterX) <= SNAP_DIST) {
          left = Math.round(otherCenterX - width / 2);
          guides.push({ type: "vertical", pos: otherCenterX, label: other.id });
          snappedX = true;
          break;
        }
      }
    }

    if (!snappedX && gridSize > 0) {
      left = Math.round(left / gridSize) * gridSize;
    } else {
      left = Math.round(left);
    }

    const marginT = logicalH * 0.05;
    const marginB = logicalH * 0.95;
    const centerTargetY = logicalH / 2;

    let snappedY = false;
    if (Math.abs(top - marginT) <= SNAP_DIST) {
      top = marginT;
      guides.push({ type: "horizontal", pos: marginT, label: "Margem 5%" });
      snappedY = true;
    } else if (Math.abs(bottom - marginB) <= SNAP_DIST) {
      top = marginB - height;
      guides.push({ type: "horizontal", pos: marginB, label: "Margem 95%" });
      snappedY = true;
    } else if (Math.abs(centerY - centerTargetY) <= SNAP_DIST) {
      top = Math.round(centerTargetY - height / 2);
      guides.push({ type: "horizontal", pos: centerTargetY, label: "Centro Y" });
      snappedY = true;
    } else if (Math.abs(top - 0) <= SNAP_DIST) {
      top = 0;
      guides.push({ type: "horizontal", pos: 0, label: "0px" });
      snappedY = true;
    } else if (Math.abs(bottom - logicalH) <= SNAP_DIST) {
      top = logicalH - height;
      guides.push({ type: "horizontal", pos: logicalH, label: `${logicalH}px` });
      snappedY = true;
    } else {
      for (const other of otherElements) {
        const box = resolveBox(other);
        const otherBottom = box.top + box.height;
        const otherCenterY = box.top + box.height / 2;

        if (Math.abs(top - box.top) <= SNAP_DIST) {
          top = box.top;
          guides.push({ type: "horizontal", pos: box.top, label: other.id });
          snappedY = true;
          break;
        }
        if (Math.abs(bottom - otherBottom) <= SNAP_DIST) {
          top = otherBottom - height;
          guides.push({ type: "horizontal", pos: otherBottom, label: other.id });
          snappedY = true;
          break;
        }
        if (Math.abs(centerY - otherCenterY) <= SNAP_DIST) {
          top = Math.round(otherCenterY - height / 2);
          guides.push({ type: "horizontal", pos: otherCenterY, label: other.id });
          snappedY = true;
          break;
        }
      }
    }

    if (!snappedY && gridSize > 0) {
      top = Math.round(top / gridSize) * gridSize;
    } else {
      top = Math.round(top);
    }

    return { left, top, guides };
  }

  function calculateResizeSnap(
    orig: { left: number; top: number; width: number; height: number },
    dir: ResizeDir,
    dx: number,
    dy: number,
  ): { left: number; top: number; width: number; height: number; guides: SmartGuide[] } {
    let { left, top, width, height } = orig;
    const right = orig.left + orig.width;
    const bottom = orig.top + orig.height;

    const SNAP_DIST = Math.max(8, Math.round(12 / Math.max(scale, 0.1)));
    const guides: SmartGuide[] = [];

    const marginL = logicalW * 0.05;
    const marginR = logicalW * 0.95;
    const marginT = logicalH * 0.05;
    const marginB = logicalH * 0.95;

    if (dir.includes("e")) {
      let candRight = right + dx;
      if (snap) {
        if (Math.abs(candRight - marginR) <= SNAP_DIST) {
          candRight = marginR;
          guides.push({ type: "vertical", pos: marginR, label: "Margem 95%" });
        } else if (Math.abs(candRight - logicalW) <= SNAP_DIST) {
          candRight = logicalW;
          guides.push({ type: "vertical", pos: logicalW });
        } else if (Math.abs(candRight - logicalW / 2) <= SNAP_DIST) {
          candRight = logicalW / 2;
          guides.push({ type: "vertical", pos: logicalW / 2 });
        } else if (gridSize > 0) {
          candRight = Math.round(candRight / gridSize) * gridSize;
        }
      }
      width = Math.max(MIN_SIZE, candRight - left);
    }

    if (dir.includes("s")) {
      let candBottom = bottom + dy;
      if (snap) {
        if (Math.abs(candBottom - marginB) <= SNAP_DIST) {
          candBottom = marginB;
          guides.push({ type: "horizontal", pos: marginB, label: "Margem 95%" });
        } else if (Math.abs(candBottom - logicalH) <= SNAP_DIST) {
          candBottom = logicalH;
          guides.push({ type: "horizontal", pos: logicalH });
        } else if (Math.abs(candBottom - logicalH / 2) <= SNAP_DIST) {
          candBottom = logicalH / 2;
          guides.push({ type: "horizontal", pos: logicalH / 2 });
        } else if (gridSize > 0) {
          candBottom = Math.round(candBottom / gridSize) * gridSize;
        }
      }
      height = Math.max(MIN_SIZE, candBottom - top);
    }

    if (dir.includes("w")) {
      let candLeft = left + dx;
      if (snap) {
        if (Math.abs(candLeft - marginL) <= SNAP_DIST) {
          candLeft = marginL;
          guides.push({ type: "vertical", pos: marginL, label: "Margem 5%" });
        } else if (Math.abs(candLeft - 0) <= SNAP_DIST) {
          candLeft = 0;
          guides.push({ type: "vertical", pos: 0 });
        } else if (Math.abs(candLeft - logicalW / 2) <= SNAP_DIST) {
          candLeft = logicalW / 2;
          guides.push({ type: "vertical", pos: logicalW / 2 });
        } else if (gridSize > 0) {
          candLeft = Math.round(candLeft / gridSize) * gridSize;
        }
      }
      candLeft = Math.min(right - MIN_SIZE, candLeft);
      width = right - candLeft;
      left = candLeft;
    }

    if (dir.includes("n")) {
      let candTop = top + dy;
      if (snap) {
        if (Math.abs(candTop - marginT) <= SNAP_DIST) {
          candTop = marginT;
          guides.push({ type: "horizontal", pos: marginT, label: "Margem 5%" });
        } else if (Math.abs(candTop - 0) <= SNAP_DIST) {
          candTop = 0;
          guides.push({ type: "horizontal", pos: 0 });
        } else if (Math.abs(candTop - logicalH / 2) <= SNAP_DIST) {
          candTop = logicalH / 2;
          guides.push({ type: "horizontal", pos: logicalH / 2 });
        } else if (gridSize > 0) {
          candTop = Math.round(candTop / gridSize) * gridSize;
        }
      }
      candTop = Math.min(bottom - MIN_SIZE, candTop);
      height = bottom - candTop;
      top = candTop;
    }

    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
      guides,
    };
  }

  function commitGesture(g: Gesture): void {
    const orig = theme.elements.find((el) => el.id === g.id);
    if (!orig) return;
    const left = Math.max(0, Math.round(g.last.left));
    const top = Math.max(0, Math.round(g.last.top));
    const width = Math.max(MIN_SIZE, Math.round(g.last.width));
    const height = Math.max(MIN_SIZE, Math.round(g.last.height));
    setActiveGuides([]);
    setPreview((prev) => {
      const next = { ...prev };
      delete next[g.id];
      return next;
    });
    const o = g.orig;
    if (
      left === Math.max(0, Math.round(o.left)) &&
      top === Math.max(0, Math.round(o.top)) &&
      width === Math.max(MIN_SIZE, Math.round(o.width)) &&
      height === Math.max(MIN_SIZE, Math.round(o.height))
    ) {
      return;
    }
    onChange({
      ...orig,
      x: left,
      y: top,
      css: {
        ...orig.css,
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      },
    });
  }

  function updateGesture(e: { clientX: number; clientY: number }): void {
    const g = gestureRef.current;
    if (!g) return;
    const pos = toLogical(e);
    const dx = pos.x - g.startLX;
    const dy = pos.y - g.startLY;

    if (g.mode === "move") {
      const snapped = calculateSnap(
        g.orig.left,
        g.orig.top,
        dx,
        dy,
        g.orig.width,
        g.orig.height,
        g.id,
      );
      g.last = {
        ...g.last,
        left: snapped.left,
        top: snapped.top,
      };
      setActiveGuides(snapped.guides);
    } else {
      const snapped = calculateResizeSnap(
        g.orig,
        g.dir ?? "se",
        dx,
        dy,
      );
      g.last = snapped;
      setActiveGuides(snapped.guides);
    }

    const { left, top, width, height } = g.last;
    setPreview((prev) => ({
      ...prev,
      [g.id]: {
        x: Math.round(left),
        y: Math.round(top),
        css: {
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        },
      },
    }));
  }

  function endGesture(): void {
    const g = gestureRef.current;
    gestureRef.current = null;
    setActiveGuides([]);
    if (g) commitGesture(g);
  }

  function beginMove(
    e: ReactPointerEvent<HTMLDivElement>,
    el: ThemeElement,
  ): void {
    const pos = toLogical(e);
    const box = resolveBox(el);
    gestureRef.current = {
      id: el.id,
      mode: "move",
      startLX: pos.x,
      startLY: pos.y,
      orig: box,
      last: { ...box },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function beginResize(
    e: ReactPointerEvent<HTMLDivElement>,
    el: ThemeElement,
    dir: ResizeDir,
  ): void {
    const pos = toLogical(e);
    const box = resolveBox(el);
    gestureRef.current = {
      id: el.id,
      mode: "resize",
      dir,
      startLX: pos.x,
      startLY: pos.y,
      orig: box,
      last: { ...box },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function commitText(el: ThemeElement, text: string): void {
    setEditingId(null);
    if (text !== (el.text ?? "")) {
      onChange({ ...el, text });
    }
  }

  const stageWidth = Math.round(logicalW * scale);
  const stageHeight = Math.round(logicalH * scale);

  return (
    <div
      ref={wrapRef}
      className="relative flex-1 size-full min-h-0 overflow-auto flex items-center justify-center p-6 rounded-md border border-border"
      style={{
        backgroundImage:
          "conic-gradient(#1b1b1f 25%, #131316 0 50%, #1b1b1f 0 75%, #131316 0)",
        backgroundSize: "24px 24px",
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <div
        className="relative shrink-0 shadow-2xl overflow-hidden border border-white/10 rounded-sm"
        style={{
          width: stageWidth,
          height: stageHeight,
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        <div
          ref={stageRef}
          style={{
            width: logicalW,
            height: logicalH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="relative h-full w-full select-none"
        >
            <div id="theme-export-target" className="absolute inset-0 h-full w-full">
              <ThemeRenderer
                theme={effectiveTheme}
                asset={asset}
                props={sampleProps}
              />
            </div>
            {showGrid && gridSize > 0 && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
                  backgroundSize: `${gridSize}px ${gridSize}px`,
                }}
              />
            )}
            {showLimit && (
              <div
                className="pointer-events-none absolute rounded-sm border border-dashed border-cyan-400/50"
                style={{
                  left: logicalW * 0.05,
                  top: logicalH * 0.05,
                  width: logicalW * 0.9,
                  height: logicalH * 0.9,
                }}
              >
                <span className="absolute -top-5 right-0 rounded bg-cyan-950/70 px-1.5 py-0.5 text-[10px] text-cyan-300">
                  Margem de Segurança (90%)
                </span>
              </div>
            )}
            {activeGuides.map((g, idx) => (
              <div
                key={idx}
                className="pointer-events-none absolute z-40"
                style={
                  g.type === "vertical"
                    ? {
                        left: `${g.pos}px`,
                        top: 0,
                        bottom: 0,
                        width: "1.5px",
                        backgroundColor: "#ec4899",
                        boxShadow: "0 0 6px rgba(236, 72, 153, 0.9)",
                      }
                    : {
                        top: `${g.pos}px`,
                        left: 0,
                        right: 0,
                        height: "1.5px",
                        backgroundColor: "#ec4899",
                        boxShadow: "0 0 6px rgba(236, 72, 153, 0.9)",
                      }
                }
              >
                <span
                  className="absolute bg-pink-600 text-white font-mono text-[9px] px-1 py-0.5 rounded shadow pointer-events-none whitespace-nowrap"
                  style={
                    g.type === "vertical"
                      ? { top: "8px", left: "4px" }
                      : { left: "8px", top: "4px" }
                  }
                >
                  {g.label ? `${g.label}: ` : ""}{Math.round(g.pos)}px
                </span>
              </div>
            ))}
            <div className="absolute inset-0">
              {visibleElements.map((el) => {
                const box = resolveBox(el);
                const selected = el.id === selectedId;
                const interactive = !el.locked;
                const editing = editingId === el.id;
                if (editing && el.type === "TEXT") {
                  return (
                    <TextEditor
                      key={el.id}
                      el={el}
                      box={box}
                      maxWidth={logicalW - box.left}
                      onCommit={commitText}
                      onCancel={() => setEditingId(null)}
                    />
                  );
                }
                return (
                  <div
                    key={el.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Elemento ${el.id}`}
                    className={
                      selected
                        ? "absolute border-2 border-primary"
                        : "absolute border border-transparent hover:border-white/40"
                    }
                    style={{
                      left: box.left,
                      top: box.top,
                      width: box.width,
                      height: box.height,
                      cursor: interactive ? "move" : "not-allowed",
                      touchAction: "none",
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect(el.id);
                      if (!interactive || editingId) return;
                      if (e.button !== 0) return;
                      beginMove(e, el);
                    }}
                    onPointerMove={(e) => {
                      if (gestureRef.current?.id === el.id) updateGesture(e);
                    }}
                    onPointerUp={(e) => {
                      if (gestureRef.current?.id === el.id) {
                        e.stopPropagation();
                        endGesture();
                      }
                    }}
                    onPointerCancel={() => {
                      if (gestureRef.current?.id === el.id) {
                        gestureRef.current = null;
                        setPreview((prev) => {
                          const next = { ...prev };
                          delete next[el.id];
                          return next;
                        });
                      }
                    }}
                    onDoubleClick={(e) => {
                      if (el.type !== "TEXT" || !interactive) return;
                      e.stopPropagation();
                      gestureRef.current = null;
                      setPreview((prev) => {
                        const next = { ...prev };
                        delete next[el.id];
                        return next;
                      });
                      setEditingId(el.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Delete" || e.key === "Backspace") {
                        e.stopPropagation();
                      }
                    }}
                  >
                    {el.locked && (
                      <span className="absolute -top-7 left-0 flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        <Lock size={12} />
                        Bloqueado
                      </span>
                    )}
                    {selected && interactive && (
                      <>
                        {(Object.keys(HANDLE_OFFSETS) as ResizeDir[]).map(
                          (dir) => {
                            const offset = HANDLE_OFFSETS[dir];
                            return (
                              <div
                                key={dir}
                                className="absolute z-10 rounded-[2px] border border-primary bg-background shadow"
                                style={
                                  {
                                    width: 18,
                                    height: 18,
                                    left: `calc(${offset.x * 100}% - 9px)`,
                                    top: `calc(${offset.y * 100}% - 9px)`,
                                    cursor: HANDLE_CURSORS[dir],
                                    touchAction: "none",
                                  } as CSSProperties
                                }
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  if (e.button !== 0) return;
                                  beginResize(e, el, dir);
                                }}
                                onPointerMove={(e) => {
                                  if (gestureRef.current?.id === el.id) {
                                    e.stopPropagation();
                                    updateGesture(e);
                                  }
                                }}
                                onPointerUp={(e) => {
                                  if (gestureRef.current?.id === el.id) {
                                    e.stopPropagation();
                                    endGesture();
                                  }
                                }}
                              />
                            );
                          },
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
  );
}

function TextEditor({
  el,
  box,
  maxWidth,
  onCommit,
  onCancel,
}: {
  el: ThemeElement;
  box: { left: number; top: number; width: number; height: number };
  maxWidth: number;
  onCommit: (el: ThemeElement, text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.textContent = el.text ?? "";
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [el]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="absolute z-20 overflow-auto rounded-sm border-2 border-primary bg-black/85 p-2 text-white outline-none"
      style={{
        left: box.left,
        top: box.top,
        minWidth: Math.max(box.width, 200),
        minHeight: Math.max(box.height, 60),
        maxWidth,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => {
        if (cancelledRef.current) return;
        onCommit(el, ref.current?.textContent ?? "");
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          cancelledRef.current = true;
          onCancel();
        }
      }}
    />
  );
}
