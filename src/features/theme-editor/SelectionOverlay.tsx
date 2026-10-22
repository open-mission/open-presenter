import type { MouseEvent, PointerEvent } from "react";
import type { Rect } from "./geometry";

export type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLE_CURSORS: Record<ResizeDir, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

export const HANDLE_OFFSETS: Record<ResizeDir, { x: number; y: number }> = {
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 },
};

interface SelectionOverlayProps {
  box: Rect;
  rotation?: number;
  variant: "item" | "group";
  showHandles?: boolean;
  showRotateHandle?: boolean;
  onMoveStart?: (e: PointerEvent<HTMLDivElement>) => void;
  onResizeStart?: (dir: ResizeDir, e: PointerEvent<HTMLDivElement>) => void;
  onRotateStart?: (e: PointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export function SelectionOverlay({
  box,
  rotation,
  variant,
  showHandles = false,
  showRotateHandle = false,
  onMoveStart,
  onResizeStart,
  onRotateStart,
  onDoubleClick,
}: SelectionOverlayProps) {
  return (
    <div
      className={
        variant === "item"
          ? "pointer-events-none absolute z-30 border-2 border-primary"
          : "pointer-events-none absolute z-30 border-2 border-dashed border-fuchsia-400"
      }
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
      {onMoveStart && (
        <div
          className="pointer-events-auto absolute inset-0 cursor-move"
          onPointerDown={onMoveStart}
          onDoubleClick={onDoubleClick}
        />
      )}
      {showRotateHandle && (
        <>
          <div
            className="pointer-events-none absolute left-1/2 h-3 w-px -translate-x-1/2 bg-primary"
            style={{ top: -18 }}
          />
          <div
            role="button"
            aria-label="Rotacionar seleção"
            className="pointer-events-auto absolute left-1/2 size-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-background shadow"
            style={{ top: -30 }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onRotateStart?.(e);
            }}
          />
        </>
      )}
      {showHandles &&
        (Object.keys(HANDLE_OFFSETS) as ResizeDir[]).map((dir) => {
          const offset = HANDLE_OFFSETS[dir];
          return (
            <div
              key={dir}
              className="pointer-events-auto absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-primary bg-background shadow"
              style={{
                left: `${offset.x * 100}%`,
                top: `${offset.y * 100}%`,
                cursor: HANDLE_CURSORS[dir],
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizeStart?.(dir, e);
              }}
            />
          );
        })}
    </div>
  );
}
