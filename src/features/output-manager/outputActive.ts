import type { OutputMode } from "@/core/types";

export function isOutputActive(
  mode: OutputMode,
  runtimeOpen: boolean,
  serverRunning: boolean,
): boolean {
  if (mode === "off") return false;
  if (mode === "web") return serverRunning;
  if (mode === "both") return serverRunning || runtimeOpen;
  return runtimeOpen;
}
