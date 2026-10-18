import { useEffect } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { TAURI_EVENTS } from "@/core/config/app";
import { setLiveThemes } from "@/core/ipc/commands";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import { usePresentationStore } from "@/features/presentation/store";
import { useSlideThemesStore } from "./store";

/**
 * Recarrega a lista de temas quando outro janela (ex.: editor de temas)
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

/**
 * Publica os temas resolvidos (público e palco) para todas as saídas via
 * Rust/syncBus. Roda apenas na janela admin — é ela quem decide o tema.
 */
export function useLiveThemesPublisher(): void {
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const stageThemeGuid = useSlideThemesStore((s) => s.stageThemeGuid);
  const liveKind = usePresentationStore((s) => s.live.content.kind);
  const liveMediaThemeId = usePresentationStore((s) => s.live.content.media?.themeId);

  useEffect(() => {
    if (!isTauri()) return;
    const store = useSlideThemesStore.getState();
    void setLiveThemes({
      public: store.resolveTheme("public", liveKind, liveMediaThemeId),
      stage: store.resolveStageTheme(),
    });
  }, [themes, bindings, stageThemeGuid, liveKind, liveMediaThemeId]);
}