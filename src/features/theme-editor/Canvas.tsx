import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Lock } from "lucide-react";
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
import { createFrameCoalescer, type FrameCoalescer } from "@/core/lib/frameCoalescer";
import { ThemeRenderer } from "../slide-themes/ThemeRenderer";
import { useThemeEditorStore } from "./store";
import { buildSnapBoxes, type ElementBox } from "./snapBoxes";
import {
  FALLBACK_SIZE,
  LOGICAL_H,
  LOGICAL_W,
  type Rect,
  elementRect,
  unionRects,
  visualRect,
} from "./geometry";
import { SelectionOverlay } from "./SelectionOverlay";
import { groupMemberIds } from "./selection";
import { elementRotation } from "./transform";

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
  onChange: (el: ThemeElement) => void;
  showGrid: boolean;
  gridSize: number;
  showLimit: boolean;
  showRulers?: boolean;
  showGuides?: boolean;
  snap: boolean;
  zoom?: "fit" | number;
  resolution?: { width: number; height: number };
  simulateCamera?: boolean;
}

type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface Gesture {
  id?: string;
  mode: "move" | "resize";
  dir?: ResizeDir;
  baseIds: string[];
  ids: string[];
  startLX: number;
  startLY: number;
  origBox: Rect;
  last: Rect;
  memberOrigs: Record<string, Rect>;
  snapBoxes: Map<string, ElementBox>;
  orig?: Rect;
}

type PreviewPatch = Partial<Pick<ThemeElement, "x" | "y">> & {
  css?: Record<string, string>;
};

type PointerPos = { clientX: number; clientY: number };

export interface SmartGuide {
  type: "vertical" | "horizontal";
  pos: number;
  label?: string;
}

const MIN_SIZE = 20;

const EMPTY_SNAP_BOXES: ReadonlyMap<string, ElementBox> = new Map();

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

function RulerTop({ width }: { width: number }) {
  const step = 100;
  const ticks = [];
  for (let x = 0; x <= width; x += 20) {
    const isMajor = x % step === 0;
    const isMid = x % (step / 2) === 0;
    const h = isMajor ? 14 : isMid ? 9 : 5;
    ticks.push(
      <g key={x}>
        <line x1={x} y1={20 - h} x2={x} y2={20} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
        {isMajor && x > 0 && (
          <text x={x + 3} y={11} fill="rgba(255,255,255,0.7)" fontSize={9} fontFamily="monospace">
            {x}
          </text>
        )}
      </g>
    );
  }
  return (
    <div className="absolute top-0 left-0 right-0 h-5 bg-card/85 border-b border-border/70 z-30 pointer-events-none select-none overflow-hidden">
      <svg width={width} height={20} className="w-full h-full">
        {ticks}
      </svg>
    </div>
  );
}

function RulerLeft({ height }: { height: number }) {
  const step = 100;
  const ticks = [];
  for (let y = 0; y <= height; y += 20) {
    const isMajor = y % step === 0;
    const isMid = y % (step / 2) === 0;
    const w = isMajor ? 14 : isMid ? 9 : 5;
    ticks.push(
      <g key={y}>
        <line x1={20 - w} y1={y} x2={20} y2={y} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
        {isMajor && y > 0 && (
          <text
            x={11}
            y={y - 3}
            fill="rgba(255,255,255,0.7)"
            fontSize={9}
            fontFamily="monospace"
            transform={`rotate(-90, 11, ${y - 3})`}
          >
            {y}
          </text>
        )}
      </g>
    );
  }
  return (
    <div className="absolute top-0 bottom-0 left-0 w-5 bg-card/85 border-r border-border/70 z-30 pointer-events-none select-none overflow-hidden">
      <svg width={20} height={height} className="w-full h-full">
        {ticks}
      </svg>
    </div>
  );
}

export function Canvas({
  theme,
  asset,
  props: sampleProps,
  onChange,
  showGrid,
  gridSize,
  showLimit,
  showRulers = false,
  showGuides = true,
  snap,
  zoom = "fit",
  resolution,
  simulateCamera = false,
}: CanvasProps) {
  const logicalW = resolution?.width ?? LOGICAL_W;
  const logicalH = resolution?.height ?? LOGICAL_H;

  const selection = useThemeEditorStore((s) => s.selection);
  const select = useThemeEditorStore((s) => s.select);
  const toggleSelect = useThemeEditorStore((s) => s.toggleSelect);
  const enterGroup = useThemeEditorStore((s) => s.enterGroup);
  const clearSelection = useThemeEditorStore((s) => s.clearSelection);

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

  const updateGestureRef = useRef<(pos: PointerPos) => void>(() => {});
  const gestureFrameRef = useRef<FrameCoalescer<PointerPos> | null>(null);
  const gestureListenersRef = useRef<(() => void) | null>(null);

  updateGestureRef.current = updateGesture;

  if (gestureFrameRef.current === null) {
    gestureFrameRef.current = createFrameCoalescer<PointerPos>((pos) => {
      updateGestureRef.current(pos);
    });
  }

  useEffect(() => {
    return () => {
      gestureFrameRef.current?.cancel();
      gestureListenersRef.current?.();
    };
  }, []);

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
    const root = stage.querySelector<HTMLElement>("#theme");
    if (!root) return;

    const measure = () => {
      const next: Record<string, { w: number; h: number }> = {};
      root
        .querySelectorAll<HTMLElement>("[data-theme-element-id]")
        .forEach((target) => {
          const id = target.dataset.themeElementId;
          if (!id) return;
          if (target.offsetWidth > 0 && target.offsetHeight > 0) {
            next[id] = { w: target.offsetWidth, h: target.offsetHeight };
          }
        });
      setMeasured((previous) => {
        const same =
          Object.keys(next).length === Object.keys(previous).length &&
          Object.entries(next).every(
            ([id, box]) =>
              previous[id]?.w === box.w && previous[id]?.h === box.h,
          );
        return same ? previous : next;
      });
    };

    const frame = requestAnimationFrame(measure);
    let disposed = false;
    void document.fonts?.ready.then(() => {
      if (!disposed) measure();
    });

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    Array.from(root.children).forEach((child) => observer.observe(child));

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
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

  function resolveBox(el: ThemeElement): Rect {
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

  function resolveVisualBox(el: ThemeElement): Rect {
    return visualRect(resolveBox(el), elementRotation(withPatch(el)));
  }

  function selectionBoxFor(ids: readonly string[]): Rect | null {
    const idSet = new Set(ids);
    return unionRects(
      theme.elements.filter((el) => idSet.has(el.id)).map(resolveVisualBox),
    );
  }

  function handleEmptyPointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
  ): void {
    if (e.target !== e.currentTarget) return;
    if (editingId) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    clearSelection();
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
    boxes: ReadonlyMap<string, ElementBox>,
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
      for (const [otherId, box] of boxes) {
        const otherRight = box.left + box.width;
        const otherCenterX = box.left + box.width / 2;

        if (Math.abs(left - box.left) <= SNAP_DIST) {
          left = box.left;
          guides.push({ type: "vertical", pos: box.left, label: otherId });
          snappedX = true;
          break;
        }
        if (Math.abs(right - otherRight) <= SNAP_DIST) {
          left = otherRight - width;
          guides.push({ type: "vertical", pos: otherRight, label: otherId });
          snappedX = true;
          break;
        }
        if (Math.abs(centerX - otherCenterX) <= SNAP_DIST) {
          left = Math.round(otherCenterX - width / 2);
          guides.push({ type: "vertical", pos: otherCenterX, label: otherId });
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
      for (const [otherId, box] of boxes) {
        const otherBottom = box.top + box.height;
        const otherCenterY = box.top + box.height / 2;

        if (Math.abs(top - box.top) <= SNAP_DIST) {
          top = box.top;
          guides.push({ type: "horizontal", pos: box.top, label: otherId });
          snappedY = true;
          break;
        }
        if (Math.abs(bottom - otherBottom) <= SNAP_DIST) {
          top = otherBottom - height;
          guides.push({ type: "horizontal", pos: otherBottom, label: otherId });
          snappedY = true;
          break;
        }
        if (Math.abs(centerY - otherCenterY) <= SNAP_DIST) {
          top = Math.round(otherCenterY - height / 2);
          guides.push({ type: "horizontal", pos: otherCenterY, label: otherId });
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

  function clearPreview(ids: readonly string[]): void {
    setPreview((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  function commitGesture(g: Gesture): void {
    setActiveGuides([]);
    clearPreview(g.mode === "move" ? g.ids : [g.id ?? ""]);

    if (g.mode === "move") {
      const dx = Math.round(g.last.left - g.origBox.left);
      const dy = Math.round(g.last.top - g.origBox.top);
      if (dx === 0 && dy === 0) return;
      const patches: { id: string; patch: Partial<ThemeElement> }[] = [];
      for (const [id, orig] of Object.entries(g.memberOrigs)) {
        const el = theme.elements.find((item) => item.id === id);
        if (!el) continue;
        const left = Math.max(0, Math.round(orig.left + dx));
        const top = Math.max(0, Math.round(orig.top + dy));
        patches.push({
          id,
          patch: {
            x: left,
            y: top,
            css: { ...el.css, left: `${left}px`, top: `${top}px` },
          },
        });
      }
      if (patches.length > 0) {
        useThemeEditorStore.getState().updateElements(patches);
      }
      return;
    }

    const orig = theme.elements.find((el) => el.id === g.id);
    const base = g.orig;
    if (!orig || !base) return;
    const left = Math.max(0, Math.round(g.last.left));
    const top = Math.max(0, Math.round(g.last.top));
    const width = Math.max(MIN_SIZE, Math.round(g.last.width));
    const height = Math.max(MIN_SIZE, Math.round(g.last.height));
    if (
      left === Math.max(0, Math.round(base.left)) &&
      top === Math.max(0, Math.round(base.top)) &&
      width === Math.max(MIN_SIZE, Math.round(base.width)) &&
      height === Math.max(MIN_SIZE, Math.round(base.height))
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
        g.origBox.left,
        g.origBox.top,
        dx,
        dy,
        g.origBox.width,
        g.origBox.height,
        g.snapBoxes ?? EMPTY_SNAP_BOXES,
      );
      g.last = { ...g.origBox, left: snapped.left, top: snapped.top };
      setActiveGuides(snapped.guides);

      const effectiveDx = snapped.left - g.origBox.left;
      const effectiveDy = snapped.top - g.origBox.top;
      setPreview((prev) => {
        const next = { ...prev };
        for (const [id, orig] of Object.entries(g.memberOrigs)) {
          const left = Math.round(orig.left + effectiveDx);
          const top = Math.round(orig.top + effectiveDy);
          next[id] = {
            x: left,
            y: top,
            css: { left: `${left}px`, top: `${top}px` },
          };
        }
        return next;
      });
      return;
    }

    const snapped = calculateResizeSnap(
      g.orig ?? g.origBox,
      g.dir ?? "se",
      dx,
      dy,
    );
    g.last = snapped;
    setActiveGuides(snapped.guides);

    const id = g.id;
    if (!id) return;
    const { left, top, width, height } = g.last;
    setPreview((prev) => ({
      ...prev,
      [id]: {
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
    gestureListenersRef.current?.();
    gestureListenersRef.current = null;
    setActiveGuides([]);
    gestureFrameRef.current?.cancel();
    if (g) commitGesture(g);
  }

  function cancelGesture(): void {
    const g = gestureRef.current;
    gestureRef.current = null;
    gestureListenersRef.current?.();
    gestureListenersRef.current = null;
    setActiveGuides([]);
    gestureFrameRef.current?.cancel();
    if (g) clearPreview(g.mode === "move" ? g.ids : [g.id ?? ""]);
  }

  function trackGesture(): void {
    const move = (event: PointerEvent) => {
      gestureFrameRef.current?.push({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
    const finish = () => {
      gestureFrameRef.current?.flush();
      endGesture();
    };
    const cancel = () => cancelGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    gestureListenersRef.current = cleanup;
  }

  function beginMove(
    e: ReactPointerEvent<HTMLElement>,
    ids: readonly string[],
  ): void {
    gestureFrameRef.current?.cancel();
    const idSet = new Set(ids);
    const memberOrigs: Record<string, Rect> = {};
    for (const member of theme.elements) {
      if (idSet.has(member.id) && !member.locked) {
        memberOrigs[member.id] = resolveBox(member);
      }
    }
    if (Object.keys(memberOrigs).length === 0) return;
    const origBox = selectionBoxFor(ids);
    if (!origBox || origBox.width <= 0 || origBox.height <= 0) return;
    const pos = toLogical(e);
    gestureRef.current = {
      mode: "move",
      baseIds: [...ids],
      ids: Object.keys(memberOrigs),
      startLX: pos.x,
      startLY: pos.y,
      origBox,
      last: { ...origBox },
      memberOrigs,
      snapBoxes: buildSnapBoxes(visibleElements, idSet, resolveVisualBox),
    };
    trackGesture();
  }

  function beginResize(
    e: ReactPointerEvent<HTMLDivElement>,
    el: ThemeElement,
    dir: ResizeDir,
  ): void {
    gestureFrameRef.current?.cancel();
    const pos = toLogical(e);
    const box = resolveBox(el);
    gestureRef.current = {
      id: el.id,
      mode: "resize",
      dir,
      baseIds: [el.id],
      ids: [el.id],
      startLX: pos.x,
      startLY: pos.y,
      origBox: box,
      last: { ...box },
      memberOrigs: { [el.id]: box },
      snapBoxes: EMPTY_SNAP_BOXES as Map<string, ElementBox>,
      orig: box,
    };
    trackGesture();
  }

  function commitText(el: ThemeElement, text: string): void {
    setEditingId(null);
    if (text !== (el.text ?? "")) {
      onChange({ ...el, text });
    }
  }

  const stageWidth = Math.round(logicalW * scale);
  const stageHeight = Math.round(logicalH * scale);
  const selectionBox =
    selection.ids.length >= 2 ? selectionBoxFor(selection.ids) : null;

  return (
    <div
      ref={wrapRef}
      className="relative flex-1 size-full min-h-0 overflow-auto flex items-center justify-center p-6 rounded-md border border-border"
      style={{
        backgroundImage:
          "conic-gradient(#1b1b1f 25%, #131316 0 50%, #1b1b1f 0 75%, #131316 0)",
        backgroundSize: "24px 24px",
      }}
      onPointerDown={handleEmptyPointerDown}
    >
      <div
        className="relative shrink-0 shadow-2xl overflow-hidden border border-white/10 rounded-sm"
        style={{
          width: stageWidth,
          height: stageHeight,
        }}
        onPointerDown={handleEmptyPointerDown}
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
          {simulateCamera && (
            <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `
                    radial-gradient(ellipse at 50% 30%, rgba(99, 102, 241, 0.35) 0%, transparent 60%),
                    radial-gradient(circle at 20% 45%, rgba(244, 63, 94, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 45%, rgba(56, 189, 248, 0.25) 0%, transparent 50%),
                    linear-gradient(to bottom, #090d16 0%, #15192c 40%, #05070c 100%)
                  `,
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-md border border-white/10 bg-black/70 px-2.5 py-1 font-mono text-[11px] text-emerald-400 backdrop-blur-md">
                <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                SIMULAÇÃO DE CÂMERA (OBS)
              </div>
            </div>
          )}
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
            {showRulers && (
              <>
                <RulerTop width={logicalW} />
                <RulerLeft height={logicalH} />
              </>
            )}
            {showGuides && (
              <>
                {/* Guia Central Vertical */}
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-20 border-l border-dashed border-indigo-400/40"
                  style={{ left: `${logicalW / 2}px` }}
                />
                {/* Guia Central Horizontal */}
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20 border-t border-dashed border-indigo-400/40"
                  style={{ top: `${logicalH / 2}px` }}
                />
                {/* Margem de Título Segura (80%) */}
                <div
                  className="pointer-events-none absolute rounded-sm border border-dotted border-amber-400/30 z-20"
                  style={{
                    left: logicalW * 0.1,
                    top: logicalH * 0.1,
                    width: logicalW * 0.8,
                    height: logicalH * 0.8,
                  }}
                >
                  <span className="absolute -top-4 left-0 text-[9px] text-amber-400/70 font-mono">
                    Margem de Título (80%)
                  </span>
                </div>
              </>
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
            <div className="absolute inset-0" onPointerDown={handleEmptyPointerDown}>
              {visibleElements.map((el) => {
                const box = resolveBox(el);
                const selected =
                  selection.ids.length === 1 && selection.ids[0] === el.id;
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
                      if (e.button !== 0) return;
                      const canGesture = !el.locked && !editingId;
                      if (e.shiftKey) {
                        toggleSelect(el.id);
                        return;
                      }
                      const mod = e.metaKey || e.ctrlKey;
                      if (el.groupId && mod) {
                        enterGroup(el.groupId, el.id);
                        if (canGesture) beginMove(e, [el.id]);
                        return;
                      }
                      if (el.groupId && selection.enteredGroupId === el.groupId) {
                        select([el.id], {
                          anchorId: el.id,
                          enteredGroupId: el.groupId,
                        });
                        if (canGesture) beginMove(e, [el.id]);
                        return;
                      }
                      if (el.groupId) {
                        const ids = groupMemberIds(theme.elements, el.groupId);
                        select(ids, { anchorId: el.id });
                        if (canGesture) beginMove(e, ids);
                        return;
                      }
                      if (
                        selection.ids.length > 1 &&
                        selection.ids.includes(el.id)
                      ) {
                        if (canGesture) beginMove(e, selection.ids);
                        return;
                      }
                      select([el.id], { anchorId: el.id });
                      if (canGesture) beginMove(e, [el.id]);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (el.locked) return;
                      gestureRef.current = null;
                      clearPreview([el.id]);
                      if (el.groupId) enterGroup(el.groupId, el.id);
                      if (el.type === "TEXT") setEditingId(el.id);
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
                              />
                            );
                          },
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {selectionBox && <SelectionOverlay box={selectionBox} />}
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
