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
}: {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (width: number) => void;
  label: string;
}) {
  const start = useRef({ x: 0, value });
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, value };
    setDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const delta = e.clientX - start.current.x;
    onChange(clampPanelWidth(start.current.value + delta, min, max));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(clampPanelWidth(value - 16, min, max));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(clampPanelWidth(value + 16, min, max));
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
      aria-orientation="vertical"
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
        "relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none",
        "bg-transparent hover:bg-primary/20 focus-visible:bg-primary/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        dragging && "bg-primary/30",
      )}
      title="Arraste para redimensionar · duplo clique para restaurar"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/60" />
    </div>
  );
}