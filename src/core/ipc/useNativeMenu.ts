import { useEffect } from "react";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import { openShortcutsWindow } from "@/core/ipc/commands";
import { usePreferencesStore } from "@/features/preferences/store";
import { useSongsStore } from "@/features/songs/store";
import { usePresentationStore } from "@/features/presentation/store";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useUpdatesStore } from "@/features/updates/store";

export function useNativeMenu() {
  useEffect(() => {
    let unlistenNewEvent: (() => void) | null = null;
    let unlistenNewSong: (() => void) | null = null;
    let unlistenSearchOnline: (() => void) | null = null;
    let unlistenImport: (() => void) | null = null;
    let unlistenPrefs: (() => void) | null = null;
    let unlistenShortcuts: (() => void) | null = null;
    let unlistenWhatsNew: (() => void) | null = null;

    function handleOpenShortcuts() {
      if (isTauri()) {
        void openShortcutsWindow();
      } else {
        window.open("/#/shortcuts", "_blank", "width=700,height=580");
      }
    }

    // Listen to native menu items from Tauri (macOS/desktop)
    void listenCommand("new-event", () => {
      useSetlistStore.getState().openNewEventDialog();
    }).then((fn) => {
      unlistenNewEvent = fn;
    });

    void listenCommand("new-song", () => {
      useSongsStore.getState().startNewSong();
    }).then((fn) => {
      unlistenNewSong = fn;
    });

    void listenCommand("search-online-lyrics", () => {
      useSongsStore.getState().openOnlineSearch();
    }).then((fn) => {
      unlistenSearchOnline = fn;
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

    void listenCommand("open-shortcuts", () => {
      handleOpenShortcuts();
    }).then((fn) => {
      unlistenShortcuts = fn;
    });

    void listenCommand("whats-new", () => {
      useUpdatesStore.getState().openWhatsNew();
    }).then((fn) => {
      unlistenWhatsNew = fn;
    });

    // Keyboard shortcut fallback for browser & desktop environments
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        handleOpenShortcuts();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        useSongsStore.getState().openOnlineSearch();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        useSetlistStore.getState().openNewEventDialog();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useSongsStore.getState().startNewSong();
        return;
      }

      if (e.key === "Escape") {
        const target = e.target as HTMLElement | null;
        if (
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable
        ) {
          return;
        }

        const hasOpenDialog = Boolean(
          document.querySelector(
            '[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"]'
          )
        );
        if (hasOpenDialog) {
          return;
        }

        const live = usePresentationStore.getState().live;
        const isPresenting =
          !live.cleared && !live.blackout && live.content.kind !== "blank";
        const runnerIndex = useSetlistStore.getState().runnerIndex;

        if (isPresenting || runnerIndex !== null) {
          e.preventDefault();
          void usePresentationStore.getState().clearLive();
          useSetlistStore.setState({ runnerIndex: null });
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unlistenNewEvent?.();
      unlistenNewSong?.();
      unlistenSearchOnline?.();
      unlistenImport?.();
      unlistenPrefs?.();
      unlistenShortcuts?.();
      unlistenWhatsNew?.();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
