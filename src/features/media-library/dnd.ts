import type { DragEvent } from "react";
import type { DisplayOutput } from "@/core/types";
import { applyBackgroundToOutput, applyThemeToOutput } from "./applyAsset";
import { ASSET_DND_MIME, type AssetDragPayload } from "./types";

export function setAssetDragData(event: DragEvent, payload: AssetDragPayload): void {
  const json = JSON.stringify(payload);
  event.dataTransfer.setData(ASSET_DND_MIME, json);
  // Fallback: alguns WebViews não expõem tipos customizados no dragover/drop.
  event.dataTransfer.setData("text/plain", json);
  event.dataTransfer.effectAllowed = "copy";
}

export function handleAssetDragOver(event: DragEvent): void {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

export function readAssetPayload(
  dataTransfer: DataTransfer,
): AssetDragPayload | null {
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
    return null;
  } catch {
    return null;
  }
}

export function handleAssetDrop(event: DragEvent, output: DisplayOutput): void {
  event.preventDefault();
  const payload = readAssetPayload(event.dataTransfer);
  if (!payload) return;
  if (payload.type === "theme") applyThemeToOutput(output, payload.themeGuid);
  else applyBackgroundToOutput(output, payload.asset);
}
