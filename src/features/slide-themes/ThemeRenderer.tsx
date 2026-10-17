import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
import { resolveThemeMediaUrl } from "@/features/theme-editor/media";
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

function renderHtml(
  template: string | undefined,
  props: Record<string, string>,
): string {
  return escapeHtml(renderTemplate(template ?? "", props)).replace(/\n/g, "<br/>");
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
    typeof theme.css.background === "string" &&
    theme.css.background.includes("url(")
  ) {
    style.background = resolveUrlValue(theme.css.background, host);
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
  if (typeof raw !== "string" || raw.trim() === "") return {};
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
  const autoShrink = element.css.autoShrink === "true";
  const autoFit = element.css.autoFit === "true";

  useLayoutEffect(() => {
    if (!autoShrink && !autoFit) {
      setScaleFactor(1);
      return;
    }
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    content.style.transform = "none";
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const sw = content.scrollWidth;
    const sh = content.scrollHeight;

    if (cw > 0 && ch > 0 && sw > 0 && sh > 0) {
      const scaleW = cw / sw;
      const scaleH = ch / sh;
      let targetScale = Math.min(scaleW, scaleH);

      if (autoShrink && !autoFit) {
        targetScale = Math.min(1, targetScale);
      } else if (autoFit && !autoShrink) {
        targetScale = Math.min(1.5, Math.max(0.35, targetScale));
      } else if (autoShrink && autoFit) {
        targetScale = Math.min(1.3, targetScale);
      }
      const finalScale = Math.max(0.25, targetScale);
      setScaleFactor(finalScale);
    } else {
      setScaleFactor(1);
    }
  }, [html, autoShrink, autoFit, element.css.width, element.css.height, element.css.fontSize]);

  if (!autoShrink && !autoFit) {
    return (
      <p
        style={{ ...style, whiteSpace: "pre-line" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  const textAlign = (element.css.textAlign as CSSProperties["textAlign"]) || "center";
  const originX = textAlign === "left" ? "left" : textAlign === "right" ? "right" : "center";
  const justifyContent = (element.css.justifyContent as CSSProperties["justifyContent"]) || "center";
  const originY = justifyContent === "flex-end" ? "bottom" : justifyContent === "flex-start" ? "top" : "center";

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        justifyContent,
        alignItems: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center",
        overflow: "hidden",
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: "100%",
          whiteSpace: style.whiteSpace ?? "pre-line",
          textAlign,
          transform: scaleFactor !== 1 ? `scale(${scaleFactor})` : undefined,
          transformOrigin: `${originX} ${originY}`,
          transition: "transform 0.1s ease-out",
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
  const resolvedSrc = resolveThemeMediaUrl(mediaSrc, host) ?? mediaSrc;
  const style = elementStyle(element);
  switch (element.type) {
    case "TEXT":
      return <AutoScaledText element={element} props={props} style={style} />;
    case "IMAGE":
      return <img src={resolvedSrc} alt="" style={style} />;
    case "VIDEO":
      return (
        <video
          src={resolvedSrc}
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

  return (
    <div
      id="theme"
      className="absolute inset-0 h-full w-full overflow-hidden"
      style={containerStyle}
    >
      {elements.map((element) => (
        <ThemeElementView key={element.id} element={element} props={props} />
      ))}
    </div>
  );
}
