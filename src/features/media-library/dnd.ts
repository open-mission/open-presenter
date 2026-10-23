import type { DragEvent } from "react";
import type { DisplayOutput } from "@/core/types";
import { applyBackgroundToOutput, applyThemeToOutput } from "./applyAsset";
import { ASSET_DND_MIME, type AssetDragPayload } from "./types";

export function setAssetDragData(event: DragEvent, payload: AssetDragPayload): void {
  event.dataTransfer.setData(ASSET_DND_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "copy";
}

export function handleAssetDragOver(event: DragEvent): void {
  if (!event.dataTransfer.types.includes(ASSET_DND_MIME)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

export function handleAssetDrop(event: DragEvent, output: DisplayOutput): void {
  const raw = event.dataTransfer.getData(ASSET_DND_MIME);
  if (!raw) return;
  event.preventDefault();
  try {
    const payload = JSON.parse(raw) as AssetDragPayload;
    if (payload.type === "theme") applyThemeToOutput(output, payload.themeGuid);
    else applyBackgroundToOutput(output, payload.asset);
  } catch {
    // payload inválido: ignora o drop
  }
}
