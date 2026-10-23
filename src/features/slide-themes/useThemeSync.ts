import { useEffect } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { TAURI_EVENTS } from "@/core/config/app";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import { useSlideThemesStore } from "./store";

/**
 * Recarrega a lista de temas quando outra janela (ex.: editor de temas)
 * salva ou exclui um tema. Sem isso, cada janela fica com um snapshot antigo.
 */
export function useThemesSync(): void {
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: UnlistenFn | null = null;
    let disposed = false;

    void (async () => {
      const fn = await listenCommand(TAURI_EVENTS.themesChanged, () => {
        void useSlideThemesStore.getState().load();
      });
      if (disposed) fn?.();
      else unlisten = fn;
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
