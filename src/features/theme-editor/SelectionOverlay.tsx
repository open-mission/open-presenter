import type { Rect } from "./geometry";

export function SelectionOverlay({ box }: { box: Rect }) {
  return (
    <div
      className="pointer-events-none absolute z-30 border-2 border-dashed border-fuchsia-400"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  );
}
