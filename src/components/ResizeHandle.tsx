import { useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { clampPanelWidth } from "@/core/lib/panelLayout";
import { cn } from "@/core/lib/utils";

export function ResizeHandle({
  value,
  min,
  max,
  defaultValue,
  onChange,
  label,
  direction = "horizontal",
  invertVerticalDelta = false,
}: {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (value: number) => void;
  label: string;
  /** "horizontal": colunas lado a lado (redimensiona largura). "vertical": painéis empilhados (altura). */
  direction?: "horizontal" | "vertical";
  /** Para painéis no topo, arrastar para baixo aumenta a altura. */
  invertVerticalDelta?: boolean;
}) {
  const start = useRef({ pointer: 0, value });
  const [dragging, setDragging] = useState(false);
  const isColumnResize = direction === "horizontal";

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = {
      pointer: isColumnResize ? e.clientX : e.clientY,
      value,
    };
    setDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const rawDelta = isColumnResize
      ? e.clientX - start.current.pointer
      : invertVerticalDelta
      ? e.clientY - start.current.pointer
      : start.current.pointer - e.clientY;
    onChange(clampPanelWidth(start.current.value + rawDelta, min, max));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (isColumnResize && e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(clampPanelWidth(value - 16, min, max));
    } else if (isColumnResize && e.key === "ArrowRight") {
      e.preventDefault();
      onChange(clampPanelWidth(value + 16, min, max));
    } else if (!isColumnResize && e.key === "ArrowUp") {
      e.preventDefault();
      onChange(clampPanelWidth(value + 16, min, max));
    } else if (!isColumnResize && e.key === "ArrowDown") {
      e.preventDefault();
      onChange(clampPanelWidth(value - 16, min, max));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation={isColumnResize ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative z-10 shrink-0 touch-none bg-transparent hover:bg-primary/20 focus-visible:bg-primary/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isColumnResize ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
        dragging && "bg-primary/30",
      )}
      title="Arraste para redimensionar · duplo clique para restaurar"
    >
      <span
        className={cn(
          "absolute bg-border/60",
          isColumnResize
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2",
        )}
      />
    </div>
  );
}
