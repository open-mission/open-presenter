import type { BackgroundLayer } from "@/core/types";
import { isCssColor, isCssGradient, stripMediaFit } from "../../core/lib/cssValue.ts";

export function wallpaperToBackground(value: string): BackgroundLayer {
  const url = stripMediaFit(value);

  if (isCssColor(url)) {
    return { id: "wallpaper", kind: "color", value: url };
  }

  if (isCssGradient(url)) {
    return { id: "wallpaper", kind: "css", value: url };
  }

  const lower = url.toLowerCase();
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.startsWith("data:video/")
  ) {
    return { id: "wallpaper", kind: "video", value };
  }

  return { id: "wallpaper", kind: "image", value };
}
