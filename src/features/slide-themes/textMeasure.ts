import type { FitMeasure } from "./fitText.ts";

export interface TextTypography {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: string;
  textTransform: string;
  whiteSpace: string;
  wordBreak: string;
  overflowWrap: string;
  textWrap: string;
}

export const DEFAULT_FONT_FAMILY =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

interface MeasureRequest {
  html: string;
  width: number;
  fontSize: number;
  lineHeight: number;
  typography: TextTypography;
}

const CACHE_LIMIT = 400;
const cache = new Map<string, FitMeasure>();
let measurer: HTMLDivElement | null = null;
let fontsListenerAttached = false;

function cssValue(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

export function typographyFromCss(
  css: Record<string, string | undefined>,
  overrides: Partial<TextTypography> = {},
): TextTypography {
  return {
    fontFamily: cssValue(css.fontFamily, DEFAULT_FONT_FAMILY),
    fontWeight: cssValue(css.fontWeight, "400"),
    fontStyle: cssValue(css.fontStyle, "normal"),
    letterSpacing: cssValue(css.letterSpacing, "normal"),
    textTransform: cssValue(css.textTransform, "none"),
    whiteSpace: cssValue(css.whiteSpace, "pre-wrap"),
    wordBreak: cssValue(css.wordBreak, "break-word"),
    overflowWrap: cssValue(css.overflowWrap, "break-word"),
    textWrap: cssValue(css.textWrap, "pretty"),
    ...overrides,
  };
}

function cacheKey(request: MeasureRequest): string {
  const t = request.typography;
  return [
    request.html,
    Math.round(request.width * 10) / 10,
    Math.round(request.fontSize * 10) / 10,
    Math.round(request.lineHeight * 10) / 10,
    t.fontFamily,
    t.fontWeight,
    t.fontStyle,
    t.letterSpacing,
    t.textTransform,
    t.whiteSpace,
    t.wordBreak,
    t.overflowWrap,
    t.textWrap,
  ].join("\u0000");
}

function getMeasurer(): HTMLDivElement | null {
  if (typeof document === "undefined" || !document.body) return null;
  if (measurer?.isConnected) return measurer;

  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.opTextMeasure = "true";
  el.style.position = "fixed";
  el.style.left = "-100000px";
  el.style.top = "0";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.zIndex = "-1";
  el.style.boxSizing = "content-box";
  el.style.padding = "0";
  el.style.border = "0";
  el.style.margin = "0";
  el.style.minWidth = "0";
  el.style.maxWidth = "none";
  el.style.height = "auto";
  el.style.display = "block";
  el.style.contain = "layout style";
  document.body.appendChild(el);
  measurer = el;

  if (!fontsListenerAttached && document.fonts) {
    fontsListenerAttached = true;
    document.fonts.addEventListener("loadingdone", () => cache.clear());
  }
  return el;
}

function applyStyles(
  el: HTMLDivElement,
  request: MeasureRequest,
): void {
  const { typography: t } = request;
  el.style.fontFamily = t.fontFamily;
  el.style.fontWeight = t.fontWeight;
  el.style.fontStyle = t.fontStyle;
  el.style.letterSpacing = t.letterSpacing;
  el.style.textTransform = t.textTransform;
  el.style.whiteSpace = t.whiteSpace;
  el.style.wordBreak = t.wordBreak;
  el.style.overflowWrap = t.overflowWrap;
  el.style.setProperty("text-wrap", t.textWrap);
  el.style.fontSize = `${request.fontSize}px`;
  el.style.lineHeight = `${request.lineHeight}px`;
  el.style.width = `${request.width}px`;
}

function measureWith(
  request: MeasureRequest,
  mode: "html" | "text",
): FitMeasure {
  const key = `${mode}\u0000${cacheKey(request)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const el = getMeasurer();
  if (!el) return { width: 0, height: 0 };

  applyStyles(el, request);
  if (mode === "html") el.innerHTML = request.html;
  else el.textContent = request.html;

  // Força um único layout e mede a largura real de cada linha de texto.
  const box = el.getBoundingClientRect();
  let width = 0;
  if (mode === "html" ? request.html.length > 0 : request.html.trim().length > 0) {
    const range = document.createRange();
    range.selectNodeContents(el);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width > width) width = rect.width;
    }
  }

  const measurement: FitMeasure = { width, height: box.height };
  if (cache.size >= CACHE_LIMIT) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, measurement);
  return measurement;
}

/** Mede HTML (com `<br>`, `<b>`, spans etc.) no layout nativo do browser. */
export function measureTextHtml(
  html: string,
  width: number,
  typography: TextTypography,
  fontSize: number,
  lineHeight: number,
): FitMeasure {
  return measureWith({ html, width, typography, fontSize, lineHeight }, "html");
}

/** Mede texto puro; `pre-wrap` preserva `\n`. */
export function measurePlainText(
  text: string,
  width: number,
  typography: TextTypography,
  fontSize: number,
  lineHeight: number,
): FitMeasure {
  return measureWith({ html: text, width, typography, fontSize, lineHeight }, "text");
}

export async function ensureFontLoaded(
  typography: TextTypography,
  size = 64,
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const family = typography.fontFamily.split(",")[0]?.trim();
  if (!family) return;
  try {
    await document.fonts.load(
      `${typography.fontStyle} ${typography.fontWeight} ${size}px ${family}`,
    );
  } catch {
    // Fonte indisponível: medir com o fallback é melhor que travar o render.
  }
}

export function clearTextMeasureCache(): void {
  cache.clear();
}
