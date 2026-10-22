import { useEffect } from "react";
import { TAURI_EVENTS } from "@/core/config/app";
import { syncBus } from "@/core/sync/syncBus";
import { fetchStageMessage } from "@/core/ipc/commands";
import { useCommunicationStore } from "./store";
import type { CommunicationAlert } from "./types";

export function useCommunicationSync(): void {
  const applyRemote = useCommunicationStore((s) => s.applyRemote);
  const activeAlert = useCommunicationStore((s) => s.activeAlert);

  useEffect(() => {
    let disposed = false;

    // 1. Busca alerta ativo inicial
    void fetchStageMessage().then((initial) => {
      if (!disposed && initial !== undefined) {
        applyRemote(initial);
      }
    });

    // 2. Escuta eventos em tempo real (Tauri events no desktop e /ws no navegador)
    const unsubscribe = syncBus.subscribe<CommunicationAlert | null>(
      TAURI_EVENTS.stageMessage,
      (payload) => {
        if (!disposed) {
          applyRemote(payload ?? null);
        }
      },
    );

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [applyRemote]);

  // 3. Auto-dismiss client-side safety timer
  useEffect(() => {
    if (!activeAlert?.autoDismissSeconds || activeAlert.autoDismissSeconds <= 0) {
      return;
    }

    const elapsedMs = Date.now() - new Date(activeAlert.createdAt).getTime();
    const totalMs = activeAlert.autoDismissSeconds * 1000;
    const remainingMs = Math.max(500, totalMs - elapsedMs);

    const timer = setTimeout(() => {
      const current = useCommunicationStore.getState().activeAlert;
      if (current?.id === activeAlert.id) {
        useCommunicationStore.getState().applyRemote(null);
      }
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [activeAlert]);
}
