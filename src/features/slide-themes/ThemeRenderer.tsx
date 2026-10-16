import type { CSSProperties } from "react";
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
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

function ThemeElementView({
  element,
  props,
}: {
  element: ThemeElement;
  props: Record<string, string>;
}) {
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
      return (
        <img src={element.src ?? element.url ?? ""} alt="" style={style} />
      );
    case "VIDEO":
      return (
        <video
          src={element.src ?? element.url ?? ""}
          autoPlay
          muted
          loop
          playsInline
          style={style}
        />
      );
    case "RECTANGLE":
      return (
        <div
          style={
            element.fill ? { ...style, background: element.fill } : style
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

  return (
    <div
      id="theme"
      className="absolute inset-0 h-full w-full overflow-hidden"
      style={theme.css as CSSProperties}
    >
      {elements.map((element) => (
        <ThemeElementView key={element.id} element={element} props={props} />
      ))}
    </div>
  );
}
