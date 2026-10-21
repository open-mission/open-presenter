import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
import { useMediaPort } from "@/core/config/mediaPort";
import { resolveThemeMediaUrl } from "@/features/theme-editor/media";
import { isIsfBackground } from "@/features/media-shaders/isfEngine";
import { ShaderCanvas } from "@/features/media-shaders/ShaderCanvas";
import { renderTemplate } from "./themeTemplate";
import { hasNoiseLayer } from "./noiseGenerator";
import { getAnimationNames } from "./transitions";
import {
  lineHeightPx,
  resolveFitBounds,
  resolveLineHeightRatio,
} from "./fitText.ts";
import { typographyFromCss } from "./textMeasure.ts";
import { useAutoFit } from "./useAutoFit.ts";
import { buildFitGeometryKey } from "./fitGeometry.ts";
import { areElementRenderPropsEqual } from "./elementMemo.ts";

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
  return value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (fullMatch, quote, innerUrl) => {
    if (innerUrl.startsWith("data:")) return fullMatch;
    const resolved = resolveThemeMediaUrl(innerUrl, host);
    if (!resolved || resolved === innerUrl) return fullMatch;
    return `url(${quote}${resolved}${quote})`;
  });
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
  const isNoise = hasNoiseLayer(raw);
  return {
    background: resolveUrlValue(raw, currentHost()),
    backgroundSize: isNoise ? "auto, cover" : "cover",
    backgroundPosition: isNoise ? "top left, center" : "center",
    backgroundRepeat: isNoise ? "repeat, no-repeat" : "no-repeat",
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

  const baseFontSize = parseFloat(element.css.fontSize ?? "48") || 48;
  const rawLineHeight = element.css.lineHeight ?? style.lineHeight;
  const lineHeightRatio = resolveLineHeightRatio(rawLineHeight, baseFontSize);

  const rawHtml = renderHtml(element.text, props);

  const blinkColon =
    element.css.blinkColon === "true" ||
    (element.css.blinkColon as unknown) === true ||
    (Boolean(element.text?.includes("{clock}")) && element.css.blinkColon !== "false");

  const html = useMemo(() => {
    if (!blinkColon) return rawHtml;
    return rawHtml.replace(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g, (fullMatch) => {
      return fullMatch.replace(/:/g, '<span class="op-clock-colon-blink">:</span>');
    });
  }, [rawHtml, blinkColon]);

  const [currentHtml, setCurrentHtml] = useState(html);
  const [outgoing, setOutgoing] = useState<{
    html: string;
    fontSize?: number;
    lineHeight?: number;
    key: string;
  } | null>(null);
  const isFirstMount = useRef(true);

  const isPersistent =
    element.css.isPersistent === "true" || (element.css.isPersistent as unknown) === true;
  const transitionType = isPersistent ? "none" : (element.css.transitionType ?? "fade");
  const durationMs =
    transitionType === "none"
      ? 0
      : parseInt(element.css.transitionDuration ?? "250ms", 10) || 250;
  const { inAnimation, outAnimation } = getAnimationNames(transitionType);

  const textAlign = (element.css.textAlign as CSSProperties["textAlign"]) || "center";
  const hFlexAlign: CSSProperties["alignItems"] =
    textAlign === "center"
      ? "center"
      : textAlign === "right"
      ? "flex-end"
      : textAlign === "justify"
      ? "stretch"
      : "flex-start";

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

  const isNoWrap = element.css.whiteSpace === "nowrap" || style.whiteSpace === "nowrap";

  const fitBounds = useMemo(
    () => resolveFitBounds(element.css),
    [
      element.css.fitMode,
      element.css.fontSize,
      element.css.minFontSize,
      element.css.maxFontSize,
      element.css.autoFit,
      element.css.autoShrink,
    ],
  );

  const typography = useMemo(
    () =>
      typographyFromCss(element.css, {
        whiteSpace: isNoWrap
          ? "nowrap"
          : ((style.whiteSpace as string | undefined) ?? "pre-wrap"),
        wordBreak: isNoWrap ? "normal" : element.css.wordBreak,
        overflowWrap: isNoWrap ? "normal" : element.css.overflowWrap,
        textWrap: isNoWrap
          ? "nowrap"
          : ((style.textWrap as string | undefined) ?? element.css.textWrap ?? "pretty"),
      }),
    [
      element.css.fontFamily,
      element.css.fontWeight,
      element.css.fontStyle,
      element.css.letterSpacing,
      element.css.textTransform,
      element.css.wordBreak,
      element.css.overflowWrap,
      element.css.textWrap,
      isNoWrap,
      style.whiteSpace,
      style.textWrap,
    ],
  );

  const autoHeight = !element.css.height || element.css.height === "auto";

  const geometryKey = buildFitGeometryKey(element, autoHeight);

  const { fontSize: activeFontSize, overflow: textOverflow } = useAutoFit({
    containerRef,
    html,
    bounds: fitBounds,
    lineHeightRatio,
    typography,
    autoHeight,
    geometryKey,
  });
  const activeLineHeight = lineHeightPx(activeFontSize, lineHeightRatio);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (html !== currentHtml) {
      if (transitionType !== "none" && durationMs > 0 && currentHtml.trim()) {
        setOutgoing({
          html: currentHtml,
          fontSize: activeFontSize,
          lineHeight: activeLineHeight,
          key: `${Date.now()}`,
        });
      }
      setCurrentHtml(html);

      if (transitionType !== "none" && durationMs > 0) {
        const timer = setTimeout(() => {
          setOutgoing(null);
        }, durationMs);

        return () => clearTimeout(timer);
      } else {
        setOutgoing(null);
      }
    }
  }, [html, currentHtml, activeFontSize, activeLineHeight, transitionType, durationMs]);

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
      data-text-overflow={textOverflow ? "true" : undefined}
      data-fit-font-size={activeFontSize}
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
        alignItems: hFlexAlign,
        overflow: style.overflow ?? "hidden",
        position: style.position ?? "absolute",
      }}
    >
      {outgoing && outAnimation !== "none" && (
        <div
          key={outgoing.key}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: vAlign,
            alignItems: hFlexAlign,
            pointerEvents: "none",
            animation: `${outAnimation} ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          }}
        >
          <div
            style={{
              width: isNoWrap ? "max-content" : "100%",
              maxWidth: isNoWrap ? "none" : "100%",
              alignSelf: isNoWrap ? hFlexAlign : "stretch",
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
              fontSize: outgoing.fontSize ? `${outgoing.fontSize}px` : undefined,
              lineHeight: outgoing.lineHeight ? `${outgoing.lineHeight}px` : undefined,
            }}
            dangerouslySetInnerHTML={{ __html: outgoing.html }}
          />
        </div>
      )}

      <div
        key={`act-${currentHtml}`}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: vAlign,
          alignItems: hFlexAlign,
          animation:
            outgoing && inAnimation !== "none"
              ? `${inAnimation} ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`
              : undefined,
        }}
      >
        <div
          style={{
            width: isNoWrap ? "max-content" : "100%",
            maxWidth: isNoWrap ? "none" : "100%",
            alignSelf: isNoWrap ? hFlexAlign : "stretch",
            whiteSpace: isNoWrap
              ? "nowrap"
              : ((style.whiteSpace as CSSProperties["whiteSpace"]) ?? "pre-wrap"),
            wordBreak: isNoWrap
              ? "normal"
              : ((element.css.wordBreak as CSSProperties["wordBreak"]) ?? "break-word"),
            overflowWrap: isNoWrap
              ? "normal"
              : ((element.css.overflowWrap as CSSProperties["overflowWrap"]) ?? "break-word"),
            textWrap: isNoWrap
              ? "nowrap"
              : ((element.css.textWrap as CSSProperties["textWrap"]) ?? "pretty"),
            textAlign,
            fontSize: `${activeFontSize}px`,
            lineHeight: `${activeLineHeight}px`,
          }}
          dangerouslySetInnerHTML={{ __html: currentHtml }}
        />
      </div>
    </div>
  );
}

const ThemeElementView = memo(function ThemeElementViewImpl({
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
}, areElementRenderPropsEqual);

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
      <style>{`
        @keyframes op-clock-colon-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.15; }
        }
        .op-clock-colon-blink {
          animation: op-clock-colon-blink 1s step-start infinite;
          display: inline-block;
        }
      `}</style>
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
