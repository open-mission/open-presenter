import { useEffect } from "react";
import { isMainWindow, isTauri } from "@/core/ipc/tauri";

/**
 * Previne recargas acidentais de página (F5, Cmd+R, Ctrl+R), fechamento indevido
 * por Cmd+W / Ctrl+W na janela principal e atalhos de zoom web no desktop, preservando
 * o comportamento nativo de uma aplicação desktop.
 */
export function useDesktopShortcuts(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      // 1. Bloqueia reload: Cmd+R, Ctrl+R, Cmd+Shift+R, Ctrl+Shift+R e F5
      if ((modifier && key === "r") || key === "f5") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // 2. Na janela principal do desktop (Tauri), previne fechar a janela abruptamente via Cmd+W / Ctrl+W
      // para passar pelo fluxo de fechamento seguro / confirmação.
      // Em subjanelas (preferências, atalhos, editores), o atalho deve fechar normalmente a janela ativa.
      if (isTauri() && modifier && key === "w" && isMainWindow()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // 3. Previne zoom involuntário do WebView com atalhos de teclado (+, -, 0)
      if (
        modifier &&
        (key === "+" || key === "=" || key === "-" || key === "_" || key === "0")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);
}
