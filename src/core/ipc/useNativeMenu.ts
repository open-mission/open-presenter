import { useEffect } from "react";
import { listenCommand } from "@/core/ipc/tauri";
import { usePreferencesStore } from "@/features/preferences/store";
import { useSongsStore } from "@/features/songs/store";

export function useNativeMenu() {
  useEffect(() => {
    let unlistenNewSong: (() => void) | null = null;
    let unlistenImport: (() => void) | null = null;
    let unlistenPrefs: (() => void) | null = null;

    // Listen to native menu items from Tauri (macOS/desktop)
    void listenCommand("new-song", () => {
      useSongsStore.getState().startNewSong();
    }).then((fn) => {
      unlistenNewSong = fn;
    });

    void listenCommand("import-holyrics", () => {
      void useSongsStore.getState().startHolyricsImport();
    }).then((fn) => {
      unlistenImport = fn;
    });

    void listenCommand("open-preferences", () => {
      usePreferencesStore.getState().openPreferences();
    }).then((fn) => {
      unlistenPrefs = fn;
    });

    // Keyboard shortcut fallback for browser & desktop environments
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useSongsStore.getState().startNewSong();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unlistenNewSong?.();
      unlistenImport?.();
      unlistenPrefs?.();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
