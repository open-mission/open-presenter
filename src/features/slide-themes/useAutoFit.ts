import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { fitFontSize, lineHeightPx, type FitBounds, type FitBox } from "./fitText.ts";
import {
  ensureFontLoaded,
  measureTextHtml,
  type TextTypography,
} from "./textMeasure.ts";

export interface AutoFitResult {
  fontSize: number;
  overflow: boolean;
}

interface UseAutoFitArgs {
  containerRef: RefObject<HTMLDivElement | null>;
  html: string;
  bounds: FitBounds;
  lineHeightRatio: number;
  typography: TextTypography;
  autoHeight: boolean;
  geometryKey: string;
}

const FALLBACK_STAGE_HEIGHT = 1080;
const BOTTOM_MARGIN_RATIO = 0.05;

function readBox(container: HTMLElement, autoHeight: boolean): FitBox {
  const style = getComputedStyle(container);
  const paddingX =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const paddingY =
    (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);

  const width = container.clientWidth - paddingX;
  let height = container.clientHeight - paddingY;

  if (autoHeight) {
    // Caixa determinística: o palco manda, não a altura atual do texto.
    const stage = container.parentElement;
    const stageHeight = stage?.clientHeight || FALLBACK_STAGE_HEIGHT;
    height =
      stageHeight - container.offsetTop - stageHeight * BOTTOM_MARGIN_RATIO - paddingY;
    const maxHeight = parseFloat(style.maxHeight);
    if (Number.isFinite(maxHeight) && maxHeight > 0) {
      height = Math.min(height, maxHeight - paddingY);
    }
  }

  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * Mede o texto num elemento oculto e devolve o maior tamanho inteiro que cabe
 * na caixa, respeitando mínimo/máximo. Não escreve no DOM visível: o render
 * aplica o tamanho uma única vez.
 */
export function useAutoFit({
  containerRef,
  html,
  bounds,
  lineHeightRatio,
  typography,
  autoHeight,
  geometryKey,
}: UseAutoFitArgs): AutoFitResult {
  const initialSize = Math.max(
    bounds.min,
    Math.min(bounds.max, Math.round(bounds.base)),
  );
  const [result, setResult] = useState<AutoFitResult>({
    fontSize: initialSize,
    overflow: false,
  });
  const frameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const apply = (next: AutoFitResult) => {
      setResult((previous) =>
        previous.fontSize === next.fontSize && previous.overflow === next.overflow
          ? previous
          : next,
      );
    };

    const run = () => {
      if (cancelled) return;
      if (!html.trim()) {
        apply({ fontSize: initialSize, overflow: false });
        return;
      }

      const box = readBox(container, autoHeight);
      const next = fitFontSize(
        (size) =>
          measureTextHtml(
            html,
            box.width,
            typography,
            size,
            lineHeightPx(size, lineHeightRatio),
          ),
        box,
        bounds,
      );
      apply({ fontSize: next.size, overflow: next.overflow });
    };

    run();

    void ensureFontLoaded(typography).then(() => {
      if (!cancelled) run();
    });
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) run();
      });
    }

    const schedule = () => {
      if (cancelled) return;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        run();
      });
    };

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      // O palco cobre mudanças de resolução/zoom; o container só é observado
      // quando tem altura fixa (com altura automática ele realimentaria o fit).
      observer.observe(container.parentElement ?? container);
      if (!autoHeight) observer.observe(container);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // `bounds` e `typography` entram por valor para evitar re-execuções por
    // identidade de objeto.
  }, [
    containerRef,
    html,
    bounds.mode,
    bounds.base,
    bounds.min,
    bounds.max,
    lineHeightRatio,
    autoHeight,
    geometryKey,
    initialSize,
    typography.fontFamily,
    typography.fontWeight,
    typography.fontStyle,
    typography.letterSpacing,
    typography.textTransform,
    typography.whiteSpace,
    typography.wordBreak,
    typography.overflowWrap,
    typography.textWrap,
  ]);

  return result;
}
