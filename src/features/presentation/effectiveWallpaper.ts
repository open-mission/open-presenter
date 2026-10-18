export function resolveEffectiveWallpaper(
  eventWallpaper: string | null | undefined,
  publicWallpaper: string | null | undefined,
): string | null {
  if (eventWallpaper && eventWallpaper.trim() !== "") return eventWallpaper;
  if (publicWallpaper && publicWallpaper.trim() !== "") return publicWallpaper;
  return null;
}
