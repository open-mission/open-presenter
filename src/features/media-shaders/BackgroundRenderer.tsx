import type { BackgroundLayer } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { resolveThemeMediaUrl, resolveCssMediaUrls } from "@/features/theme-editor/media";

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
    const resolved = resolveThemeMediaUrl(background.value, host, port) ?? background.value;
    return (
      <img
        src={resolved}
        crossOrigin="anonymous"
        alt=""
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
    );
  }

  if (background.kind === "video") {
    const resolved = resolveThemeMediaUrl(background.value, host, port) ?? background.value;
    return (
      <video
        src={resolved}
        crossOrigin="anonymous"
        autoPlay
        muted
        loop
        playsInline
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
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
