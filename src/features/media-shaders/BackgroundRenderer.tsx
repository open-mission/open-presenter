import type { BackgroundLayer } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { isCssGradient } from "@/core/lib/cssValue";
import { useMediaPort } from "@/core/config/mediaPort";
import {
  resolveThemeMediaUrl,
  resolveCssMediaUrls,
  parseMediaWithFit,
  FIT_CLASSES,
} from "@/features/theme-editor/media";
import { ShaderCanvas } from "./ShaderCanvas";

export function BackgroundRenderer({
  background,
  className,
}: {
  background: BackgroundLayer;
  className?: string;
}) {
  const mediaPort = useMediaPort();
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const port = mediaPort ?? undefined;

  if (background.kind === "image") {
    const { url, fit } = parseMediaWithFit(background.value);
    if (isCssGradient(url)) {
      const resolved = resolveCssMediaUrls(url, host, port) ?? url;
      return (
        <div
          className={cn("absolute inset-0", className)}
          style={{ background: resolved }}
        />
      );
    }
    const resolved = resolveThemeMediaUrl(url, host, port) ?? url;
    if (!resolved) return null;
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
    if (!resolved) return null;
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
    if (
      background.value.startsWith("isf:") ||
      (background.value.includes("/*{") && background.value.includes("void main"))
    ) {
      return (
        <div className={cn("absolute inset-0 overflow-hidden", className)}>
          <ShaderCanvas shader={background.value} />
        </div>
      );
    }
    const resolved = resolveCssMediaUrls(background.value, host, port) ?? background.value;
    return (
      <div
        className={cn("absolute inset-0", className)}
        style={{ background: resolved }}
      />
    );
  }

  if (background.kind === "isf") {
    return (
      <div className={cn("absolute inset-0 overflow-hidden", className)}>
        <ShaderCanvas shader={background.value} />
      </div>
    );
  }

  return (
    <div
      className={cn("absolute inset-0", className)}
      style={{ backgroundColor: background.value }}
    />
  );
}
