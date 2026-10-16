import { useLayoutEffect, useRef, useState } from "react";
import type { SlideTheme, ThemeAsset } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { ThemeRenderer } from "./ThemeRenderer";

export const LOGICAL_W = 1920;
export const LOGICAL_H = 1080;

/**
 * Renderiza um tema sempre no palco lógico de 1920×1080 e o reduz por
 * transform para caber no contêiner (mantendo 16:9, centralizado).
 *
 * Os temas usam medidas absolutas (fontes, posições e margens em px). Sem
 * esse palco fixo, cada superfície interpretaria os px no tamanho do próprio
 * contêiner — texto desproporcional e margens fora de lugar.
 */
export function ScaledStage({
  theme,
  asset,
  props,
  className,
}: {
  theme: SlideTheme;
  asset: ThemeAsset;
  props: Record<string, string>;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        setScale(0);
        return;
      }
      setScale(Math.min(width / LOGICAL_W, height / LOGICAL_H));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("absolute inset-0 overflow-hidden", className)}
    >
      {scale > 0 && (
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: LOGICAL_W,
            height: LOGICAL_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <ThemeRenderer theme={theme} asset={asset} props={props} />
        </div>
      )}
    </div>
  );
}