import type { BackgroundLayer } from "@/core/types";
import { cn } from "@/core/lib/utils";
import {
  resolveThemeMediaUrl,
  resolveCssMediaUrls,
  parseMediaWithFit,
  FIT_CLASSES,
} from "@/features/theme-editor/media";

export function BackgroundRenderer({
  background,
  className,
}: {
  background: BackgroundLayer;
  className?: string;
}) {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const port =
    typeof window !== "undefined" && window.location.port
      ? Number(window.location.port)
      : 5050;

  if (background.kind === "image") {
    const { url, fit } = parseMediaWithFit(background.value);
    const resolved = resolveThemeMediaUrl(url, host, port) ?? url;
    return (
      <img
        src={resolved}
        alt=""
        className={cn("absolute inset-0 h-full w-full", FIT_CLASSES[fit], className)}
      />
    );
  }

  if (background.kind === "video") {
    const { url, fit } = parseMediaWithFit(background.value);
    const resolved = resolveThemeMediaUrl(url, host, port) ?? url;
    return (
      <video
        src={resolved}
        autoPlay
        muted
        loop
        playsInline
        className={cn("absolute inset-0 h-full w-full", FIT_CLASSES[fit], className)}
      />
    );
  }

  if (background.kind === "css") {
    const resolved = resolveCssMediaUrls(background.value, host, port) ?? background.value;
    return (
      <div
        className={cn("absolute inset-0", className)}
        style={{ background: resolved }}
      />
    );
  }

  if (background.kind === "isf") {
    return <div className={cn("isf-fallback absolute inset-0", className)} />;
  }

  return (
    <div
      className={cn("absolute inset-0", className)}
      style={{ backgroundColor: background.value }}
    />
  );
}
