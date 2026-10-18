import { useEffect, useState } from "react";
import { TAURI_EVENTS } from "@/core/config/app";
import { getServerStatus } from "@/core/ipc/commands";
import { isTauri, listenCommand } from "@/core/ipc/tauri";

/**
 * Base usada para servir a biblioteca de mídias.
 * - Web: vazio (caminho relativo `/theme-media/...` no mesmo host).
 * - Desktop: servidor HTTP local (permite Range/streaming); se estiver parado,
 *   cai para o protocolo customizado `media://`.
 */
export function useMediaBaseUrl(): string {
  const [base, setBase] = useState<string>(() => (isTauri() ? "media://" : ""));

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    let unlisten: (() => void) | null = null;

    async function refresh(): Promise<void> {
      const status = await getServerStatus();
      if (!alive) return;
      if (status?.running) {
        setBase(`http://127.0.0.1:${status.port}`);
      } else {
        setBase("media://");
      }
    }

    void refresh();
    void listenCommand(TAURI_EVENTS.outputs, () => {
      void refresh();
    }).then((fn) => {
      if (alive) unlisten = fn;
      else fn?.();
    });

    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  return base;
}
