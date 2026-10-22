import { toast } from "sonner";
import type { SlideTheme, ThemeElement } from "../../core/types";
import { parseRotateDeg, type Rect } from "./geometry.ts";
import {
  fitFontSize,
  lineHeightPx,
  parseFontPx,
  parsePadding,
  resolveFitBounds,
  resolveLineHeightRatio,
} from "../slide-themes/fitText.ts";
import {
  measurePlainText,
  typographyFromCss,
} from "../slide-themes/textMeasure.ts";

function renderThemeText(
  template: string,
  props: Record<string, string>,
): string {
  let out = template;
  for (const key of Object.keys(props).sort()) {
    if (key.startsWith("__")) continue;
    out = out.split(`{${key}}`).join(props[key]);
  }
  return out.replace(/\{[^}]*\}/g, "");
}

export interface ExportImageOptions {
  fileName?: string;
  format?: "png" | "jpeg";
  quality?: number;
  width?: number;
  height?: number;
  sampleProps?: Record<string, string>;
}

export interface LinearGradientConfig {
  angleDeg: number;
  stops: Array<{ color: string; offset: number }>;
}

/**
 * Faz o parsing de declarações CSS linear-gradient (ex: linear-gradient(135deg, #1e1b4b 0%, #020617 100%))
 */
export function parseCssLinearGradient(gradientStr: string): LinearGradientConfig | null {
  const match = gradientStr.match(/linear-gradient\s*\((.*)\)/i);
  if (!match) return null;
  const content = match[1].trim();

  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of content) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  if (parts.length < 2) return null;

  let angleDeg = 180;
  let stopsStartIdx = 0;

  const first = parts[0].toLowerCase();
  if (first.endsWith("deg")) {
    angleDeg = parseFloat(first);
    stopsStartIdx = 1;
  } else if (first.startsWith("to ")) {
    stopsStartIdx = 1;
    if (first.includes("top") && first.includes("right")) angleDeg = 45;
    else if (first.includes("bottom") && first.includes("right")) angleDeg = 135;
    else if (first.includes("bottom") && first.includes("left")) angleDeg = 225;
    else if (first.includes("top") && first.includes("left")) angleDeg = 315;
    else if (first.includes("top")) angleDeg = 0;
    else if (first.includes("right")) angleDeg = 90;
    else if (first.includes("bottom")) angleDeg = 180;
    else if (first.includes("left")) angleDeg = 270;
  }

  const rawStops = parts.slice(stopsStartIdx);
  const parsedStops: Array<{ color: string; offset?: number }> = [];

  for (const stopStr of rawStops) {
    const stopMatch = stopStr.match(/^(.+?)(?:\s+(\d+(?:\.\d+)?%))?$/);
    if (stopMatch) {
      const color = stopMatch[1].trim();
      const percentStr = stopMatch[2];
      const offset = percentStr ? parseFloat(percentStr) / 100 : undefined;
      parsedStops.push({ color, offset });
    } else {
      parsedStops.push({ color: stopStr.trim() });
    }
  }

  for (let i = 0; i < parsedStops.length; i++) {
    if (parsedStops[i].offset === undefined) {
      if (i === 0) parsedStops[i].offset = 0;
      else if (i === parsedStops.length - 1) parsedStops[i].offset = 1;
      else {
        let nextIdx = i + 1;
        while (nextIdx < parsedStops.length && parsedStops[nextIdx].offset === undefined) {
          nextIdx++;
        }
        const prevOffset = parsedStops[i - 1].offset ?? 0;
        const nextOffset = parsedStops[nextIdx]?.offset ?? 1;
        const step = (nextOffset - prevOffset) / (nextIdx - (i - 1));
        parsedStops[i].offset = prevOffset + step;
      }
    }
  }

  return {
    angleDeg,
    stops: parsedStops.map((s) => ({
      color: s.color,
      offset: Math.max(0, Math.min(1, s.offset ?? 0)),
    })),
  };
}

function applyLinearGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: LinearGradientConfig,
) {
  // Conversão de ângulo CSS para vetor cartesiano no Canvas (Y para baixo)
  const rad = config.angleDeg * (Math.PI / 180);
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);

  const length = Math.abs(w * dx) + Math.abs(h * dy);
  const halfLen = length / 2;
  const cx = w / 2;
  const cy = h / 2;

  const x0 = cx - dx * halfLen;
  const y0 = cy - dy * halfLen;
  const x1 = cx + dx * halfLen;
  const y1 = cy + dy * halfLen;

  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const s of config.stops) {
    try {
      grad.addColorStop(s.offset, s.color);
    } catch {
      // Ignora cores inválidas
    }
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function parseDimension(
  val: string | number | undefined,
  base: number,
  fallback = 0,
): number {
  if (typeof val === "number") {
    return val <= 100 ? (val / 100) * base : val;
  }
  if (!val) return fallback;
  const trimmed = String(val).trim();
  if (trimmed.endsWith("%")) {
    return (parseFloat(trimmed) / 100) * base;
  }
  if (trimmed.endsWith("px")) {
    return parseFloat(trimmed);
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? fallback : num;
}

export function exportElementBox(
  el: ThemeElement,
  width: number,
  height: number,
): Rect {
  const left =
    el.css.left !== undefined
      ? parseDimension(el.css.left, width)
      : (el.x / 100) * width;
  const top =
    el.css.top !== undefined
      ? parseDimension(el.css.top, height)
      : (el.y / 100) * height;
  const boxWidth =
    el.css.width !== undefined
      ? parseDimension(el.css.width, width, width * 0.8)
      : width * 0.8;
  const boxHeight =
    el.css.height !== undefined
      ? parseDimension(el.css.height, height, height * 0.3)
      : height * 0.3;
  return { left, top, width: boxWidth, height: boxHeight };
}

export function textElementBox(
  el: ThemeElement,
  width: number,
  height: number,
): Rect {
  const left =
    el.css.left !== undefined
      ? parseDimension(el.css.left, width)
      : (el.x / 100) * width;
  const top =
    el.css.top !== undefined
      ? parseDimension(el.css.top, height)
      : (el.y / 100) * height;
  const boxWidth =
    el.css.width !== undefined
      ? parseDimension(el.css.width, width, width * 0.8)
      : width * 0.8;
  const boxHeight =
    el.css.height !== undefined
      ? parseDimension(el.css.height, height, height * 0.3)
      : Math.max(0, height - top - height * 0.05);
  return { left, top, width: boxWidth, height: boxHeight };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function htmlToPlainText(value: string): string {
  if (!/[<>]/.test(value)) return value;
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  element: ThemeElement,
  w: number,
  h: number,
  sampleProps: Record<string, string>,
) {
  const rawText = element.text ?? "";
  let text = htmlToPlainText(renderThemeText(rawText, sampleProps));
  if (!text.trim()) return;

  if (element.css.textTransform === "uppercase") {
    text = text.toUpperCase();
  } else if (element.css.textTransform === "lowercase") {
    text = text.toLowerCase();
  } else if (element.css.textTransform === "capitalize") {
    text = text.replace(/\b\p{L}/gu, (char) => char.toUpperCase());
  }

  const box = textElementBox(element, w, h);
  const boxX = box.left;
  const boxY = box.top;
  const boxW = box.width;
  const boxH = box.height;

  const padding = parsePadding(element.css);
  const contentX = boxX + padding.left;
  const contentY = boxY + padding.top;
  const contentW = Math.max(0, boxW - padding.left - padding.right);
  const contentH = Math.max(0, boxH - padding.top - padding.bottom);
  if (contentW <= 0 || contentH <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentX, contentY, contentW, contentH);
  ctx.clip();

  const fontWeight = element.css.fontWeight || "400";
  const fontStyle = element.css.fontStyle === "italic" ? "italic" : "normal";
  const fontFamily =
    element.css.fontFamily ||
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const fontColor = element.css.color || "#ffffff";
  const rawTextAlign = element.css.textAlign || "center";
  const canvasTextAlign: CanvasTextAlign =
    rawTextAlign === "justify" ? "left" : (rawTextAlign as CanvasTextAlign);
  const isNoWrap = element.css.whiteSpace === "nowrap";
  const baseFontSize = parseFontPx(element.css.fontSize, 48);
  const lineHeightRatio = resolveLineHeightRatio(
    element.css.lineHeight,
    baseFontSize,
  );

  const typography = typographyFromCss(element.css, {
    whiteSpace: isNoWrap ? "nowrap" : (element.css.whiteSpace ?? "pre-wrap"),
    wordBreak: isNoWrap ? "normal" : element.css.wordBreak,
    overflowWrap: isNoWrap ? "normal" : element.css.overflowWrap,
    textWrap: isNoWrap ? "nowrap" : (element.css.textWrap ?? "pretty"),
    textTransform: "none",
  });

  const bounds = resolveFitBounds(element.css);
  const fit = fitFontSize(
    (size) =>
      measurePlainText(
        text,
        contentW,
        typography,
        size,
        lineHeightPx(size, lineHeightRatio),
      ),
    { width: contentW, height: contentH },
    bounds,
  );
  let fontSize = fit.size;
  let lineHeight = lineHeightPx(fontSize, lineHeightRatio);

  if (element.css.textShadow && element.css.textShadow !== "none") {
    const shadowMatch = element.css.textShadow.match(
      /(-?\d+px)\s+(-?\d+px)(?:\s+(\d+px))?\s+(.*)/,
    );
    if (shadowMatch) {
      ctx.shadowOffsetX = parseFloat(shadowMatch[1]);
      ctx.shadowOffsetY = parseFloat(shadowMatch[2]);
      ctx.shadowBlur = shadowMatch[3] ? parseFloat(shadowMatch[3]) : 0;
      ctx.shadowColor = shadowMatch[4].trim();
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
    }
  }

  const fontSpec = (size: number) =>
    `${fontStyle} ${fontWeight} ${size}px ${fontFamily}`;

  const getLines = (size: number): string[] => {
    ctx.font = fontSpec(size);
    const paragraphs = text.split("\n");
    const result: string[] = [];
    for (const para of paragraphs) {
      if (isNoWrap) {
        result.push(para);
        continue;
      }
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        result.push("");
        continue;
      }
      let current = "";
      const flush = () => {
        if (current) result.push(current);
        current = "";
      };
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= contentW) {
          current = candidate;
          continue;
        }
        if (current) {
          result.push(current);
          current = "";
        }
        if (ctx.measureText(word).width <= contentW) {
          current = word;
          continue;
        }
        // Palavra sozinha maior que a caixa: quebra por caractere.
        let chunk = "";
        for (const char of word) {
          const next = chunk + char;
          if (ctx.measureText(next).width > contentW && chunk) {
            result.push(chunk);
            chunk = char;
          } else {
            chunk = next;
          }
        }
        current = chunk;
      }
      flush();
    }
    return result;
  };

  let lines = getLines(fontSize);
  ctx.font = fontSpec(fontSize);

  // O browser e o canvas podem quebrar linhas de forma ligeiramente diferente;
  // o canvas é o árbitro final para não exportar texto cortado.
  while (fontSize > bounds.min) {
    const widest = lines.reduce(
      (max, line) => Math.max(max, ctx.measureText(line).width),
      0,
    );
    if (lines.length * lineHeight <= contentH + 0.5 && widest <= contentW + 0.5) {
      break;
    }
    fontSize -= 1;
    lineHeight = lineHeightPx(fontSize, lineHeightRatio);
    lines = getLines(fontSize);
    ctx.font = fontSpec(fontSize);
  }

  ctx.fillStyle = fontColor;
  ctx.textAlign = canvasTextAlign;
  ctx.textBaseline = "middle";

  const letterSpacing = element.css.letterSpacing;
  if (letterSpacing && letterSpacing.endsWith("px")) {
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        letterSpacing;
    } catch {
      // Navegador sem suporte a letterSpacing no canvas.
    }
  }

  const totalH = lines.length * lineHeight;

  const rawVAlign =
    element.css.justifyContent ||
    element.css.verticalAlign ||
    element.css.alignItems ||
    "center";

  let startY: number;
  if (rawVAlign === "flex-start" || rawVAlign === "start" || rawVAlign === "top") {
    startY = contentY + lineHeight / 2;
  } else if (rawVAlign === "flex-end" || rawVAlign === "end" || rawVAlign === "bottom") {
    startY = contentY + contentH - totalH + lineHeight / 2;
  } else {
    startY = contentY + (contentH - totalH) / 2 + lineHeight / 2;
  }

  let lineX: number;
  if (rawTextAlign === "left" || rawTextAlign === "start" || rawTextAlign === "justify") {
    lineX = contentX;
  } else if (rawTextAlign === "right" || rawTextAlign === "end") {
    lineX = contentX + contentW;
  } else {
    lineX = contentX + contentW / 2;
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], lineX, startY + i * lineHeight);
  }

  ctx.restore();
}

async function saveImageFile(
  dataUrl: string,
  fullFileName: string,
  extension: "png" | "jpg",
): Promise<boolean> {
  const isTauri =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

  if (isTauri) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");

      const selectedPath = await save({
        title: "Salvar Apresentação",
        defaultPath: fullFileName,
        filters: [
          {
            name: extension === "jpg" ? "JPEG Image" : "PNG Image",
            extensions: [extension === "jpg" ? "jpeg" : "png", extension],
          },
        ],
      });

      if (!selectedPath) {
        return false;
      }

      const base64Data = dataUrl.split(",")[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await writeFile(selectedPath, bytes);
      const fileNameOnly = selectedPath.split(/[/\\]/).pop() || fullFileName;
      toast.success(`Imagem salva com sucesso: ${fileNameOnly}`);
      return true;
    } catch (tauriErr) {
      console.warn("Falha no diálogo nativo Tauri, tentando fallback para download:", tauriErr);
    }
  }

  const link = document.createElement("a");
  link.download = fullFileName;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success(`Imagem salva com sucesso: ${fullFileName}`);
  return true;
}

/**
 * Exporta um SlideTheme diretamente via Canvas 2D sem recorrer a foreignObject do SVG,
 * evitando tainting e erros de segurança (SecurityError) no WebKit / Safari do macOS.
 */
export async function exportThemeAsImage(
  theme: SlideTheme,
  options: ExportImageOptions = {},
): Promise<string | null> {
  const {
    fileName = theme.title || "apresentacao",
    format = "png",
    quality = 0.95,
    width = 1920,
    height = 1080,
    sampleProps = {
      title: theme.title,
      titulo: theme.title,
      lyrics: theme.title,
      letra: theme.title,
      text: theme.title,
      texto: theme.title,
    },
  } = options;

  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const extension = format === "jpeg" ? "jpg" : "png";
  const safeName = fileName.replace(/[/\\?%*:|"<>]/g, "-").trim() || "apresentacao";
  const fullFileName = `${safeName}.${extension}`;

  try {
    toast.info("Processando imagem para exportação...");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Não foi possível inicializar o canvas de imagem.");
      return null;
    }

    if (format === "jpeg") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
    }

    // 1. Fundo do tema
    const bgRaw = theme.css.background || theme.css.backgroundColor || "";
    if (bgRaw) {
      const gradient = parseCssLinearGradient(bgRaw);
      if (gradient) {
        applyLinearGradient(ctx, width, height, gradient);
      } else if (bgRaw.includes("url(")) {
        const match = bgRaw.match(/url\(\s*['"]?(.*?)['"]?\s*\)/);
        if (match) {
          const img = await loadImage(match[1]);
          if (img) {
            const scale = Math.max(width / img.width, height / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
          }
        }
      } else {
        ctx.fillStyle = bgRaw;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // 2. Elementos do tema
    for (const el of theme.elements) {
      if (!el.visible) continue;

      const box =
        el.type === "TEXT"
          ? textElementBox(el, width, height)
          : exportElementBox(el, width, height);
      const angle = parseRotateDeg(el.css.rotate);

      ctx.save();
      if (angle !== 0) {
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }

      if (el.type === "RECTANGLE" || el.css.backgroundColor) {
        const boxX = box.left;
        const boxY = box.top;
        const boxW = box.width;
        const boxH = box.height;

        ctx.save();
        const bgColor = el.css.backgroundColor || el.fill;
        const radius = parseDimension(el.css.borderRadius, boxW, 0);

        if (bgColor && bgColor !== "transparent") {
          ctx.fillStyle = bgColor;
          if (radius > 0 && typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, radius);
            ctx.fill();
          } else {
            ctx.fillRect(boxX, boxY, boxW, boxH);
          }
        }

        const borderWidth = parseDimension(el.css.borderWidth, boxW, 0);
        const borderColor = el.css.borderColor || el.css.border;
        if (borderWidth > 0 && borderColor && borderColor !== "transparent") {
          ctx.lineWidth = borderWidth;
          ctx.strokeStyle = borderColor;
          if (radius > 0 && typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, radius);
            ctx.stroke();
          } else {
            ctx.strokeRect(boxX, boxY, boxW, boxH);
          }
        }
        ctx.restore();
      }

      if (el.type === "IMAGE" && (el.src || el.url)) {
        const src = el.src || el.url || "";
        const img = await loadImage(src);
        if (img) {
          const boxX = box.left;
          const boxY = box.top;
          const boxW = box.width;
          const boxH = box.height;

          ctx.save();
          const radius = parseDimension(el.css.borderRadius, boxW, 0);
          if (radius > 0 && typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, radius);
            ctx.clip();
          }
          ctx.drawImage(img, boxX, boxY, boxW, boxH);
          ctx.restore();
        }
      }

      if (el.type === "TEXT" || el.text) {
        drawTextElement(ctx, el, width, height, sampleProps);
      }

      ctx.restore();
    }

    const dataUrl = canvas.toDataURL(mimeType, quality);
    await saveImageFile(dataUrl, fullFileName, extension);
    return dataUrl;
  } catch (err) {
    console.error("Erro ao converter e salvar imagem:", err);
    toast.error(err instanceof Error ? err.message : "Erro ao converter imagem.");
    return null;
  }
}

/**
 * Função de retrocompatibilidade para exportar elementos HTML.
 */
export async function exportElementAsImage(
  element: HTMLElement,
  options: ExportImageOptions = {},
): Promise<string | null> {
  const {
    fileName = "apresentacao",
    format = "png",
    quality = 0.95,
    width = 1920,
    height = 1080,
  } = options;

  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const extension = format === "jpeg" ? "jpg" : "png";
  const safeName = fileName.replace(/[/\\?%*:|"<>]/g, "-").trim() || "apresentacao";
  const fullFileName = `${safeName}.${extension}`;

  try {
    toast.info("Processando imagem para exportação...");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Não foi possível inicializar o canvas de imagem.");
      return null;
    }

    if (format === "jpeg") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
    }

    const computed = window.getComputedStyle(element);
    if (computed.background) {
      const gradient = parseCssLinearGradient(computed.background);
      if (gradient) {
        applyLinearGradient(ctx, width, height, gradient);
      } else if (computed.backgroundColor) {
        ctx.fillStyle = computed.backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }
    }

    const dataUrl = canvas.toDataURL(mimeType, quality);
    await saveImageFile(dataUrl, fullFileName, extension);
    return dataUrl;
  } catch (err) {
    console.error("Erro ao exportar elemento:", err);
    toast.error(err instanceof Error ? err.message : "Erro ao converter imagem.");
    return null;
  }
}
