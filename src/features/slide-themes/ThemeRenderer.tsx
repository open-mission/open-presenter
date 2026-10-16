import type { CSSProperties } from "react";
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
      return (
        <p
          style={{ ...style, whiteSpace: "pre-line" }}
          dangerouslySetInnerHTML={{
            __html: renderHtml(element.text, props),
          }}
        />
      );
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
