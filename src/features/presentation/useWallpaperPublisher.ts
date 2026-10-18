import { useEffect } from "react";
import { setPublicWallpaper } from "@/core/ipc/commands";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { resolveEffectiveWallpaper } from "./effectiveWallpaper";
import { useWallpaperStore } from "./wallpaperStore";

/**
 * Mantém o wallpaper exibido no admin e no servidor público alinhados.
 *
 * O wallpaper do evento ativo é o mais específico; o padrão da saída pública
 * serve como fallback. Como o servidor não conhece o evento ativo, a publicação
 * precisa partir da janela do admin, que é a fonte da verdade.
 */
export function useWallpaperPublisher(): void {
  useEffect(() => {
    let last: string | null | undefined;

    function sync(): void {
      const eventWallpaper = useSetlistStore.getState().event?.wallpaper;
      const publicWallpaper =
        useOutputManagerStore.getState().configs.public?.wallpaper;
      const effective = resolveEffectiveWallpaper(eventWallpaper, publicWallpaper);

      if (effective === last) return;
      last = effective;

      useWallpaperStore.getState().applyRemote(effective);
      void setPublicWallpaper(effective);
    }

    const unsubscribeEvent = useSetlistStore.subscribe(sync);
    const unsubscribeOutputs = useOutputManagerStore.subscribe(sync);

    sync();

    return () => {
      unsubscribeEvent();
      unsubscribeOutputs();
    };
  }, []);
}
