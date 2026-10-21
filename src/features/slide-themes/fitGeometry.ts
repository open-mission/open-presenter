export interface FitGeometrySource {
  css: Record<string, string | undefined>;
  x?: number;
  y?: number;
}

export function buildFitGeometryKey(
  source: FitGeometrySource,
  autoHeight: boolean,
): string {
  const css = source.css;
  const parts = [
    css.width,
    css.height,
    css.maxHeight,
    css.padding,
    css.paddingTop,
    css.paddingRight,
    css.paddingBottom,
    css.paddingLeft,
  ];
  if (autoHeight) {
    parts.push(css.top, css.marginTop, source.y === undefined ? "" : String(source.y));
  }
  return parts.map((part) => part ?? "").join("|");
}