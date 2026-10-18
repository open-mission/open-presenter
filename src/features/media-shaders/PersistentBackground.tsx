import { useEffect, useState } from "react";
import type { BackgroundLayer } from "@/core/types";
import { BackgroundRenderer } from "./BackgroundRenderer";

interface PersistentBackgroundProps {
  background: BackgroundLayer;
  className?: string;
  durationMs?: number;
}

/**
 * Mantém o plano de fundo persistente durante a transição de slides.
 * Quando o usuário avança entre estrofes/versos com o mesmo fundo (vídeo, imagem, shader, gradiente),
 * o componente não desmonta nem pisca, mantendo o vídeo/shader tocando continuamente.
 * Caso o plano de fundo mude, realiza crossfade suave de 400ms entre as mídias.
 */
export function PersistentBackground({
  background,
  className,
  durationMs = 400,
}: PersistentBackgroundProps) {
  const [current, setCurrent] = useState(background);
  const [prev, setPrev] = useState<BackgroundLayer | null>(null);

  useEffect(() => {
    // Só cria transição se o tipo ou valor do plano de fundo realmente mudou
    if (
      current.kind !== background.kind ||
      current.value !== background.value
    ) {
      setPrev(current);
      setCurrent(background);

      const timer = setTimeout(() => {
        setPrev(null);
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [background, current, durationMs]);

  return (
    <div className="relative h-full w-full overflow-hidden pointer-events-none select-none">
      {prev && (
        <div
          key={`prev-${prev.kind}-${prev.value}`}
          className="absolute inset-0"
          style={{
            animation: `slideFadeOut ${durationMs}ms ease-in-out forwards`,
          }}
        >
          <BackgroundRenderer background={prev} className={className} />
        </div>
      )}
      <div
        key={`curr-${current.kind}-${current.value}`}
        className="absolute inset-0"
        style={
          prev
            ? { animation: `slideFadeIn ${durationMs}ms ease-in-out forwards` }
            : undefined
        }
      >
        <BackgroundRenderer background={current} className={className} />
      </div>
    </div>
  );
}
