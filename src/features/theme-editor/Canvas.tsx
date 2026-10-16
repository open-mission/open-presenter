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
}: CanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [scale, setScale] = useState(0.5);
  const [preview, setPreview] = useState<Record<string, PreviewPatch>>({});
  const [measured, setMeasured] = useState<
    Record<string, { w: number; h: number }>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const update = () => {
      setScale(node.clientWidth / LOGICAL_W);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    const s = rect.width / LOGICAL_W;
    return {
      x: (e.clientX - rect.left) / s,
      y: (e.clientY - rect.top) / s,
    };
  }

  function snapValue(v: number): number {
    if (!snap || gridSize <= 0) return Math.round(v);
    return Math.round(v / gridSize) * gridSize;
  }

  function commitGesture(g: Gesture): void {
    const orig = theme.elements.find((el) => el.id === g.id);
    if (!orig) return;
    const left = Math.max(0, Math.round(g.last.left));
    const top = Math.max(0, Math.round(g.last.top));
    const width = Math.max(MIN_SIZE, Math.round(g.last.width));
    const height = Math.max(MIN_SIZE, Math.round(g.last.height));
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
      g.last = {
        ...g.last,
        left: snapValue(g.orig.left + dx),
        top: snapValue(g.orig.top + dy),
      };
    } else {
      const dir = g.dir ?? "se";
      let { left, top, width, height } = g.orig;
      const right = g.orig.left + g.orig.width;
      const bottom = g.orig.top + g.orig.height;
      if (dir.includes("e")) width = Math.max(MIN_SIZE, right + dx - left);
      if (dir.includes("s")) height = Math.max(MIN_SIZE, bottom + dy - top);
      if (dir.includes("w")) {
        left = Math.min(right - MIN_SIZE, left + dx);
        width = right - left;
      }
      if (dir.includes("n")) {
        top = Math.min(bottom - MIN_SIZE, top + dy);
        height = bottom - top;
      }
      if (snap && gridSize > 0) {
        if (dir.includes("e")) width = snapValue(width);
        if (dir.includes("s")) height = snapValue(height);
        if (dir.includes("w")) {
          const snappedLeft = snapValue(left);
          width = Math.max(MIN_SIZE, right - snappedLeft);
          left = right - width;
        }
        if (dir.includes("n")) {
          const snappedTop = snapValue(top);
          height = Math.max(MIN_SIZE, bottom - snappedTop);
          top = bottom - height;
        }
      } else {
        left = Math.round(left);
        top = Math.round(top);
        width = Math.round(width);
        height = Math.round(height);
      }
      g.last = { left, top, width, height };
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

  const stageHeight = Math.round(LOGICAL_H * scale);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden rounded-md border border-border"
      style={{
        backgroundImage:
          "conic-gradient(#1b1b1f 25%, #131316 0 50%, #1b1b1f 0 75%, #131316 0)",
        backgroundSize: "24px 24px",
      }}
    >
      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden"
        style={{ height: stageHeight > 0 ? stageHeight : undefined }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        <div
          style={{
            width: LOGICAL_W,
            height: LOGICAL_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div ref={stageRef} className="relative h-full w-full">
            <ThemeRenderer
              theme={effectiveTheme}
              asset={asset}
              props={sampleProps}
            />
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
                className="pointer-events-none absolute rounded-sm border border-dashed border-white/25"
                style={{
                  left: LOGICAL_W * 0.05,
                  top: LOGICAL_H * 0.05,
                  width: LOGICAL_W * 0.9,
                  height: LOGICAL_H * 0.9,
                }}
              >
                <span className="absolute -top-6 right-0 text-xs text-white/40">
                  Limite 90%
                </span>
              </div>
            )}
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
    </div>
  );
}

function TextEditor({
  el,
  box,
  onCommit,
  onCancel,
}: {
  el: ThemeElement;
  box: { left: number; top: number; width: number; height: number };
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
        maxWidth: LOGICAL_W - box.left,
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
