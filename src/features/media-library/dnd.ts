import type { DragEvent } from "react";
import type { DisplayOutput } from "@/core/types";
import { applyBackgroundToOutput, applyThemeToOutput } from "./applyAsset";
import { ASSET_DND_MIME, type AssetDragPayload } from "./types";

let currentDragPayload: AssetDragPayload | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("dragend", () => {
    currentDragPayload = null;
  });
}

export function setAssetDragData(event: DragEvent, payload: AssetDragPayload): void {
  currentDragPayload = payload;
  const json = JSON.stringify(payload);
  try {
    event.dataTransfer.setData(ASSET_DND_MIME, json);
    event.dataTransfer.setData("text/plain", json);
  } catch {
    // ignore
  }
  event.dataTransfer.effectAllowed = "all";
}

export function clearAssetDragData(): void {
  currentDragPayload = null;
}

export function handleAssetDragOver(event: DragEvent): void {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

export function readAssetPayload(
  dataTransfer?: DataTransfer,
): AssetDragPayload | null {
  if (currentDragPayload) {
    return currentDragPayload;
  }
  if (!dataTransfer) return null;
  const raw =
    dataTransfer.getData(ASSET_DND_MIME) ||
    dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const payload = parsed as AssetDragPayload;
    if (payload.type === "theme" && typeof payload.themeGuid === "string") {
      return payload;
    }
    if (payload.type === "background" && payload.asset) {
      return payload;
    }
    if (payload.type === "scripture" && Array.isArray(payload.verses) && payload.verses.length > 0) {
      return payload;
    }
    if (payload.type === "song" && payload.song) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

export function handleAssetDrop(event: DragEvent, output: DisplayOutput): void {
  event.preventDefault();
  const payload = readAssetPayload(event.dataTransfer);
  clearAssetDragData();
  if (!payload) return;
  if (payload.type === "theme") applyThemeToOutput(output, payload.themeGuid);
  else if (payload.type === "background") applyBackgroundToOutput(output, payload.asset);
}
