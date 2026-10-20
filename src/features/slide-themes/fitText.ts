export type FitMode = "fixed" | "shrink" | "fit";

export interface FitBounds {
  mode: FitMode;
  base: number;
  min: number;
  max: number;
}

export interface FitBox {
  width: number;
  height: number;
}

export interface FitMeasure {
  width: number;
  height: number;
}

export type FitMeasureFn = (fontSize: number) => FitMeasure;

export const DEFAULT_FONT_SIZE = 48;
export const DEFAULT_MIN_FONT_SIZE = 16;
export const DEFAULT_LINE_HEIGHT_RATIO = 1.25;
export const FIT_MAX_SCALE = 2.5;
export const MAX_FONT_SIZE = 1000;

function isTrue(value: unknown): boolean {
  return value === true || value === "true";
}

function isFalse(value: unknown): boolean {
  return value === false || value === "false";
}

export function parseFontPx(
  value: unknown,
  fallback = DEFAULT_FONT_SIZE,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(?:px|%)?$/);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveFitMode(css: Record<string, string | undefined>): FitMode {
  const explicit = css.fitMode;
  if (explicit === "fixed" || explicit === "shrink" || explicit === "fit") {
    return explicit;
  }
  if (isTrue(css.autoFit)) return "fit";
  if (isFalse(css.autoShrink)) return "fixed";
  return "shrink";
}

/**
 * Resolve os limites do fit aplicando a semântica do Holyrics: o tamanho
 * configurado é um teto, nunca um piso. Em "shrink" o texto só diminui; em
 * "fit" pode crescer até `maxFontSize` (default 2.5× a base). O mínimo jamais
 * ultrapassa o máximo — um mínimo acima da base é rebaixado para a base.
 */
export function resolveFitBounds(
  css: Record<string, string | undefined>,
): FitBounds {
  const mode = resolveFitMode(css);
  const base = Math.round(
    Math.min(MAX_FONT_SIZE, Math.max(1, parseFontPx(css.fontSize))),
  );
  const rawMin = Math.round(
    Math.min(MAX_FONT_SIZE, Math.max(1, parseFontPx(css.minFontSize, DEFAULT_MIN_FONT_SIZE))),
  );

  if (mode !== "fit") {
    return { mode, base, min: Math.min(rawMin, base), max: base };
  }

  const rawMax = Math.round(
    Math.min(
      MAX_FONT_SIZE,
      Math.max(1, parseFontPx(css.maxFontSize, base * FIT_MAX_SCALE)),
    ),
  );
  const max = Math.max(base, rawMax);
  return { mode, base, min: Math.min(rawMin, max), max };
}

/** Razão de line-height em relação ao tamanho base (px também vira razão). */
export function resolveLineHeightRatio(
  value: unknown,
  baseFontSize: number,
): number {
  const base = baseFontSize > 0 ? baseFontSize : DEFAULT_FONT_SIZE;
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string") return DEFAULT_LINE_HEIGHT_RATIO;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_LINE_HEIGHT_RATIO;

  if (trimmed.endsWith("%")) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) && pct > 0 ? pct / 100 : DEFAULT_LINE_HEIGHT_RATIO;
  }
  if (trimmed.endsWith("px")) {
    const px = parseFloat(trimmed);
    return Number.isFinite(px) && px > 0 ? px / base : DEFAULT_LINE_HEIGHT_RATIO;
  }
  const num = parseFloat(trimmed);
  return Number.isFinite(num) && num > 0 ? num : DEFAULT_LINE_HEIGHT_RATIO;
}

export function lineHeightPx(fontSize: number, ratio: number): number {
  return Math.max(1, Math.round(fontSize * (ratio > 0 ? ratio : DEFAULT_LINE_HEIGHT_RATIO)));
}

export interface FitResult {
  size: number;
  overflow: boolean;
}

/**
 * Maior tamanho inteiro que cabe em `box`, dentro de `[min, max]`.
 *
 * Busca lower-bound com sentinela `max + 1`: nunca devolve acima do máximo nem
 * abaixo do mínimo. Se nem o mínimo cabe, devolve o mínimo com `overflow: true`
 * (o chamador decide cortar, avisar ou ignorar o piso).
 */
export function fitFontSize(
  measure: FitMeasureFn,
  box: FitBox,
  bounds: FitBounds,
  epsilon = 0.5,
): FitResult {
  const min = Math.max(1, Math.round(bounds.min));
  const max = Math.max(min, Math.round(bounds.max));

  if (bounds.mode === "fixed") {
    return { size: Math.max(min, Math.min(max, Math.round(bounds.base))), overflow: false };
  }
  if (!(box.width > 0) || !(box.height > 0)) {
    return {
      size: Math.max(min, Math.min(max, Math.round(bounds.base))),
      overflow: false,
    };
  }

  const fits = (size: number) => {
    const result = measure(size);
    return (
      result.width <= box.width + epsilon && result.height <= box.height + epsilon
    );
  };

  if (!fits(min)) return { size: min, overflow: true };
  if (fits(max)) return { size: max, overflow: false };

  let low = min;
  let high = max + 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (fits(mid)) low = mid;
    else high = mid;
  }

  // A quebra de linha pode criar platôs (palavras longas); confirma até 4 px
  // acima do ponto encontrado, como o fallback linear do Holyrics.
  for (let size = low + 1, checked = 0; size <= max && checked < 4; size++, checked++) {
    if (fits(size)) low = size;
  }

  return { size: low, overflow: false };
}

export interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function spacingValue(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  if (match) return Number(match[1]);
  const num = Number(value.trim());
  return Number.isFinite(num) ? num : null;
}

/** Lê `padding` (1 a 4 valores) + `paddingTop/Right/Bottom/Left` em px. */
export function parsePadding(css: Record<string, string | undefined>): BoxSpacing {
  const shorthand = (css.padding ?? "").trim().split(/\s+/).filter(Boolean);
  const values = shorthand.map(spacingValue);
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  if (values.length === 1 && values[0] !== null) {
    top = right = bottom = left = values[0];
  } else if (values.length === 2) {
    top = bottom = values[0] ?? 0;
    right = left = values[1] ?? 0;
  } else if (values.length === 3) {
    top = values[0] ?? 0;
    right = left = values[1] ?? 0;
    bottom = values[2] ?? 0;
  } else if (values.length >= 4) {
    top = values[0] ?? 0;
    right = values[1] ?? 0;
    bottom = values[2] ?? 0;
    left = values[3] ?? 0;
  }

  return {
    top: spacingValue(css.paddingTop) ?? top,
    right: spacingValue(css.paddingRight) ?? right,
    bottom: spacingValue(css.paddingBottom) ?? bottom,
    left: spacingValue(css.paddingLeft) ?? left,
  };
}
