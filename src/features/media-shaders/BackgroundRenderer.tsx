import type { BackgroundLayer } from "@/core/types";
import { cn } from "@/core/lib/utils";

export function BackgroundRenderer({
  background,
  className,
}: {
  background: BackgroundLayer;
  className?: string;
}) {
  if (background.kind === "image") {
    return (
      <img
        src={background.value}
        alt=""
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
    );
  }

  if (background.kind === "video") {
    return (
      <video
        src={background.value}
        autoPlay
        muted
        loop
        playsInline
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
    );
  }

  if (background.kind === "css") {
    return (
      <div
        className={cn("absolute inset-0", className)}
        style={{ background: background.value }}
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
