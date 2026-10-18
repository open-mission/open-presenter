import { useEffect } from "react";
import { TAURI_EVENTS } from "@/core/config/app";
import { fetchServerHost } from "@/core/ipc/commands";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import type { OutputRuntime } from "@/core/types";
import { syncBus } from "@/core/sync/syncBus";
import { useOutputManagerStore } from "./store";

export function useOutputsSync(): void {
  useEffect(() => {
    let disposed = false;
    let unsubSync: (() => void) | null = null;
    let unlistenTauri: (() => void) | null = null;

    async function refreshHost(): Promise<void> {
      const host = await fetchServerHost();
      if (disposed) return;
      if (host) {
        useOutputManagerStore.getState().setHost(host);
        return;
      }
      if (!isTauri() && typeof window !== "undefined" && window.location.hostname) {
        useOutputManagerStore.getState().setHost(window.location.hostname);
      }
    }

    void refreshHost();
    const hostTimer = window.setInterval(() => void refreshHost(), 10_000);
    const handleFocus = () => void refreshHost();
    window.addEventListener("focus", handleFocus);

    async function wire(): Promise<void> {
      await syncBus.init();
      if (disposed) return;
      const apply = (list: OutputRuntime[]) => {
        if (disposed) return;
        const store = useOutputManagerStore.getState();
        store.applyRuntime(list);
        void store.refreshConfigsAndServer();
      };
      unsubSync = syncBus.subscribe<OutputRuntime[]>(
        TAURI_EVENTS.outputs,
        apply,
      );
      unlistenTauri =
        (await listenCommand<OutputRuntime[]>(TAURI_EVENTS.outputs, apply)) ??
        null;
      if (disposed) return;
      await useOutputManagerStore.getState().load();
    }

    void wire();
    return () => {
      disposed = true;
      window.clearInterval(hostTimer);
      window.removeEventListener("focus", handleFocus);
      unsubSync?.();
      unlistenTauri?.();
    };
  }, []);
}
