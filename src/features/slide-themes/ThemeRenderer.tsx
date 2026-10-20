import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
import { useMediaPort } from "@/core/config/mediaPort";
import { resolveThemeMediaUrl } from "@/features/theme-editor/media";
import { isIsfBackground } from "@/features/media-shaders/isfEngine";
import { ShaderCanvas } from "@/features/media-shaders/ShaderCanvas";
import { renderTemplate } from "./themeTemplate";

const BACKGROUND_KEYS = new Set([
  "background",
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "backgroundAttachment",
  "backgroundClip",
  "backgroundOrigin",
]);

function currentHost(): string {
  return typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeHtml(val: string): boolean {
  return /<(?:div|span|p|br|b|i|strong|em|code)\b[^>]*>/i.test(val);
}

function renderHtml(
  template: string | undefined,
  props: Record<string, string>,
): string {
  const rendered = renderTemplate(template ?? "", props);
  if (isSafeHtml(rendered)) {
    return rendered.replace(/\n/g, "<br/>");
  }
  return escapeHtml(rendered).replace(/\n/g, "<br/>");
}

function elementStyle(element: ThemeElement): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    ...(element.css as CSSProperties),
  };
  if (!("top" in element.css)) style.top = `${element.y}%`;
  if (!("left" in element.css)) style.left = `${element.x}%`;
  return style;
}

function resolveUrlValue(value: string, host: string): string {
  if (isIsfBackground(value)) return "";
  const match = value.match(/url\(\s*(['"]?)(.*?)\1\s*\)/);
  if (!match) return value;
  const resolved = resolveThemeMediaUrl(match[2], host);
  if (!resolved || resolved === match[2]) return value;
  return value.replace(match[2], resolved);
}

/**
 * Estilo do contêiner do tema. Com `withBackground` desligado, os atributos de
 * fundo são removidos: o fundo passa a ser desenhado em tela cheia por
 * `themeBackgroundStyle` (ScaledStage), sem duplicar o gradiente no palco 16:9.
 */
export function themeContainerStyle(
  theme: SlideTheme,
  withBackground: boolean,
): CSSProperties {
  const host = currentHost();
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.css)) {
    if (!withBackground && BACKGROUND_KEYS.has(key)) continue;
    style[key] = value;
  }
  if (
    withBackground &&
    typeof theme.css.background === "string"
  ) {
    if (isIsfBackground(theme.css.background)) {
      delete style.background;
      delete style.backgroundColor;
      delete style.backgroundImage;
    } else if (theme.css.background.includes("url(")) {
      style.background = resolveUrlValue(theme.css.background, host);
    }
  }
  return style as CSSProperties;
}

/**
 * Fundo do tema para preencher a superfície inteira (cover). Assim uma saída
 * que não seja 16:9 não fica com barras pretas: o fundo cobre tudo e apenas o
 * conteúdo permanece na área segura 16:9.
 */
export function themeBackgroundStyle(theme: SlideTheme): CSSProperties {
  const raw = theme.css.background;
  if (typeof raw !== "string" || raw.trim() === "" || isIsfBackground(raw)) return {};
  return {
    background: resolveUrlValue(raw, currentHost()),
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

function AutoScaledText({
  element,
  props,
  style,
}: {
  element: ThemeElement;
  props: Record<string, string>;
  style: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);

  const html = renderHtml(element.text, props);
  const autoShrink = (element.css.autoShrink as unknown) !== false && element.css.autoShrink !== "false";
  const autoFit = (element.css.autoFit as unknown) === true || element.css.autoFit === "true";

  const textAlign = (element.css.textAlign as CSSProperties["textAlign"]) || "center";
  const originX = textAlign === "left" ? "left" : textAlign === "right" ? "right" : "center";

  const rawVAlign =
    (element.css.justifyContent as string | undefined) ||
    (element.css.verticalAlign as string | undefined) ||
    (element.css.alignItems as string | undefined);

  const vAlign: CSSProperties["justifyContent"] =
    rawVAlign === "flex-end" || rawVAlign === "end" || rawVAlign === "bottom"
      ? "flex-end"
      : rawVAlign === "flex-start" || rawVAlign === "start" || rawVAlign === "top"
      ? "flex-start"
      : "center";

  const originY = vAlign === "flex-end" ? "bottom" : vAlign === "flex-start" ? "top" : "center";

  const isNoWrap = element.css.whiteSpace === "nowrap" || style.whiteSpace === "nowrap";

  useLayoutEffect(() => {
    if (!autoShrink && !autoFit) {
      setScaleFactor(1);
      return;
    }
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measureAndScale = () => {
      content.style.transform = "none";
      const cw = container.clientWidth;
      let ch = container.clientHeight;

      // Se a caixa do elemento não tem height explícito (ex: só width: 80% e top: 30%),
      // o container pode se expandir livremente com o scrollHeight.
      // Nesse caso, o limite inferior disponível da tela do tema é calculado:
      if (!element.css.height && container.parentElement) {
        const parentH = container.parentElement.clientHeight || 1080;
        const availableH = parentH - container.offsetTop - (parentH * 0.05);
        if (availableH > 0 && ch > availableH) {
          ch = availableH;
        }
      }

      const sw = content.scrollWidth;
      const sh = content.scrollHeight;

      if (cw > 0 && ch > 0 && sw > 0 && sh > 0) {
        const scaleW = cw / sw;
        const scaleH = ch / sh;
        let targetScale = Math.min(scaleW, scaleH);

        // Aplica margem de segurança de 4% para evitar cortes de ascendentes/descendentes
        const safeScale = targetScale * 0.96;

        if (autoShrink && !autoFit) {
          targetScale = Math.min(1, safeScale);
        } else if (autoFit && !autoShrink) {
          targetScale = Math.min(1.5, Math.max(0.35, safeScale));
        } else if (autoShrink && autoFit) {
          targetScale = Math.min(1.3, safeScale);
        }

        // Respeitar minFontSize se configurado
        const rawMinFontSize = element.css.minFontSize;
        const baseFontSize = parseFloat(element.css.fontSize ?? "48") || 48;
        let minScale = 0.2;
        if (rawMinFontSize) {
          const minFontPx = parseFloat(rawMinFontSize);
          if (minFontPx > 0 && baseFontSize > 0) {
            minScale = Math.max(0.05, minFontPx / baseFontSize);
          }
        }

        const finalScale = Math.max(minScale, targetScale);
        setScaleFactor(finalScale);
      } else {
        setScaleFactor(1);
      }
    };

    measureAndScale();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        measureAndScale();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }
  }, [
    html,
    autoShrink,
    autoFit,
    isNoWrap,
    element.css.width,
    element.css.height,
    element.css.fontSize,
    element.css.minFontSize,
    element.css.whiteSpace,
  ]);

  const {
    display: _display,
    flexDirection: _flexDirection,
    justifyContent: _justifyContent,
    alignItems: _alignItems,
    ...baseContainerStyle
  } = style;

  return (
    <div
      ref={containerRef}
      data-theme-element-id={element.id}
      style={{
        ...baseContainerStyle,
        maxHeight:
          style.maxHeight ??
          (!element.css.height
            ? `calc(96% - ${style.top ?? `${element.y}%`})`
            : undefined),
        display: "flex",
        flexDirection: "column",
        justifyContent: vAlign,
        alignItems: "stretch",
        overflow: style.overflow ?? "hidden",
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: isNoWrap ? "max-content" : "100%",
          maxWidth: isNoWrap ? "none" : "100%",
          whiteSpace: isNoWrap
            ? "nowrap"
            : ((style.whiteSpace as CSSProperties["whiteSpace"]) ?? "pre-wrap"),
          wordBreak: isNoWrap
            ? "normal"
            : ((element.css.wordBreak as CSSProperties["wordBreak"]) ?? "break-word"),
          overflowWrap: isNoWrap ? "normal" : "break-word",
          textWrap: isNoWrap
            ? "nowrap"
            : ((element.css.textWrap as CSSProperties["textWrap"]) ?? "pretty"),
          textAlign,
          transform: scaleFactor !== 1 ? `scale(${scaleFactor})` : undefined,
          transformOrigin: `${originX} ${originY}`,
          transition: "transform 0.08s ease-out",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function ThemeElementView({
  element,
  props,
}: {
  element: ThemeElement;
  props: Record<string, string>;
}) {
  const mediaPort = useMediaPort();
  // `slide`/`nextSlide` keyword mapping is future work — skip unmapped media for now.
  const mediaSrc = (element.src ?? element.url ?? "").trim();
  if (
    (element.type === "IMAGE" || element.type === "VIDEO") &&
    (mediaSrc === "" || mediaSrc === "slide" || mediaSrc === "nextSlide")
  ) {
    return null;
  }
  if (element.type === "RECTANGLE" && element.fill === "web" && !mediaSrc) {
    return null;
  }
  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "localhost";
  const resolvedSrc =
    resolveThemeMediaUrl(mediaSrc, host, mediaPort ?? undefined) ?? mediaSrc;
  const style = elementStyle(element);
  switch (element.type) {
    case "TEXT":
      return <AutoScaledText element={element} props={props} style={style} />;
    case "IMAGE":
      return <img data-theme-element-id={element.id} src={resolvedSrc} crossOrigin="anonymous" alt="" style={style} />;
    case "VIDEO":
      return (
        <video
          data-theme-element-id={element.id}
          src={resolvedSrc}
          crossOrigin="anonymous"
          autoPlay
          muted
          loop
          playsInline
          style={style}
        />
      );
    case "RECTANGLE":
      if (element.fill === "web") {
        return (
          <div
            data-theme-element-id={element.id}
            style={{
              ...style,
              backgroundImage: `url("${resolvedSrc}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        );
      }
      return (
        <div
          data-theme-element-id={element.id}
          style={
            element.fill
              ? { ...style, background: resolveUrlValue(element.fill, host) }
              : style
          }
        />
      );
  }
}

export function ThemeRenderer({
  theme,
  asset,
  props,
  withBackground = true,
}: {
  theme: SlideTheme;
  asset: ThemeAsset;
  props: Record<string, string>;
  withBackground?: boolean;
}) {
  const elements = theme.elements.filter(
    (element) =>
      element.visible &&
      (!element.assetTypeVisibility ||
        element.assetTypeVisibility.length === 0 ||
        element.assetTypeVisibility.includes(asset)),
  );
  const containerStyle = themeContainerStyle(theme, withBackground);
  const isShaderBg = withBackground && isIsfBackground(theme.css.background);

  return (
    <div
      id="theme"
      className="absolute inset-0 h-full w-full overflow-hidden"
      style={containerStyle}
    >
      {isShaderBg && (
        <div className="absolute inset-0 pointer-events-none">
          <ShaderCanvas shader={theme.css.background} />
        </div>
      )}
      {elements.map((element) => (
        <ThemeElementView key={element.id} element={element} props={props} />
      ))}
    </div>
  );
}
