import type { CSSProperties } from "react";
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
import { resolveThemeMediaUrl } from "@/features/theme-editor/media";
import { renderTemplate } from "./themeTemplate";

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
}: {
  theme: SlideTheme;
  asset: ThemeAsset;
  props: Record<string, string>;
}) {
  const elements = theme.elements.filter(
    (element) =>
      element.visible &&
      (!element.assetTypeVisibility ||
        element.assetTypeVisibility.length === 0 ||
        element.assetTypeVisibility.includes(asset)),
  );
  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "localhost";
  const containerCss = theme.css as CSSProperties;
  const containerStyle: CSSProperties =
    typeof theme.css.background === "string" &&
    theme.css.background.includes("url(")
      ? {
          ...containerCss,
          background: resolveUrlValue(theme.css.background, host),
        }
      : containerCss;

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
