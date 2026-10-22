import { useEffect } from "react";
import { isTauri } from "@/core/ipc/tauri";

/**
 * Previne recargas acidentais de página (F5, Cmd+R, Ctrl+R), fechamento indevido
 * por Cmd+W / Ctrl+W e atalhos de zoom web no desktop, preservando o comportamento
 * nativo de uma aplicação desktop.
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

      // 2. No desktop (Tauri), previne fechar a janela abruptamente via Cmd+W / Ctrl+W
      // para passar pelo fluxo de fechamento seguro / confirmação
      if (isTauri() && modifier && key === "w") {
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
