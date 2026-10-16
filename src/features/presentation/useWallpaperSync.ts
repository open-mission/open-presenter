import { useEffect } from "react";
import { TAURI_EVENTS } from "@/core/config/app";
import { fetchPublicWallpaper } from "@/core/ipc/commands";
import { syncBus } from "@/core/sync/syncBus";
import { useWallpaperStore } from "./wallpaperStore";

/** Espelha o papel de parede público sincronizado pelo Rust / WebSocket. */
export function useWallpaperSync(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    async function wire(): Promise<void> {
      await syncBus.init();
      if (disposed) return;
      unsubscribe = syncBus.subscribe<string | null>(
        TAURI_EVENTS.wallpaper,
        (wallpaper) => {
          if (!disposed) useWallpaperStore.getState().applyRemote(wallpaper);
        },
      );
      const initial = await fetchPublicWallpaper();
      if (!disposed && initial !== null) {
        useWallpaperStore.getState().applyRemote(initial);
      }
    }

    void wire();
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
}
