import type { MaskConfig } from "@/core/types";

/**
 * Máscara da camada superior da saída. `rounded`/`ellipse` recortam o conteúdo
 * via box-shadow; `bars`/`pillarbox` desenham faixas opacas.
 */
export function MaskOverlay({ mask }: { mask: MaskConfig }) {
  if (!mask || mask.shape === "none") return null;

  const inset = Math.min(40, Math.max(0, mask.inset || 0));
  const color = mask.color || "#000000";

  if (mask.shape === "bars") {
    return (
      <>
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: `${inset}%`, backgroundColor: color }}
        />
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${inset}%`, backgroundColor: color }}
        />
      </>
    );
  }

  if (mask.shape === "pillarbox") {
    return (
      <>
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${inset}%`, backgroundColor: color }}
        />
        <div
          className="absolute inset-y-0 right-0"
          style={{ width: `${inset}%`, backgroundColor: color }}
        />
      </>
    );
  }

  const borderRadius =
    mask.shape === "ellipse" ? "50%" : `${Math.max(0, mask.radius || 0)}px`;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute"
        style={{
          left: `${inset}%`,
          right: `${inset}%`,
          top: `${inset}%`,
          bottom: `${inset}%`,
          borderRadius,
          boxShadow: `0 0 0 100vmax ${color}`,
        }}
      />
    </div>
  );
}
