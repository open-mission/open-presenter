import { useEffect } from "react";
import { isTauri } from "@/core/ipc/tauri";
import { listen } from "@tauri-apps/api/event";
import { TAURI_EVENTS } from "@/core/config/app";
import { syncBus } from "@/core/sync/syncBus";
import type { DisplayOutput } from "@/core/types";
import { useDisplaysStore } from "./store";

function applyOutputs(outputs: DisplayOutput[]) {
  useDisplaysStore.setState((s) => ({
    outputs,
    selectedOutputId:
      s.selectedOutputId && outputs.some((o) => o.id === s.selectedOutputId)
        ? s.selectedOutputId
        : (outputs[0]?.id ?? null),
  }));
}

export function useDisplaysSync() {
  const load = useDisplaysStore((s) => s.load);

  useEffect(() => {
    void load();

    if (!isTauri()) {
      // No navegador/OBS, as saídas chegam pelo snapshot inicial do `/ws` e por
      // `displays://changed`. Também escutamos `storage` para o modo local.
      const unsub = syncBus.subscribe<DisplayOutput[]>(TAURI_EVENTS.displays, (payload) => {
        if (Array.isArray(payload)) applyOutputs(payload);
      });
      void syncBus.init();

      const handleStorage = (e: StorageEvent) => {
        if (e.key === "open_presenter_display_outputs" || e.key === "open_presenter_displays_settings") {
          void load();
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => {
        unsub();
        window.removeEventListener("storage", handleStorage);
      };
    }

    let unlistenOutputs: (() => void) | undefined;
    let unlistenIdentify: (() => void) | undefined;

    listen<DisplayOutput[]>(TAURI_EVENTS.displays, (event) => {
      if (Array.isArray(event.payload)) applyOutputs(event.payload);
    }).then((unsub) => {
      unlistenOutputs = unsub;
    }).catch(() => {});

    listen<boolean>("displays://identify", (event) => {
      useDisplaysStore.setState({ identifyActive: Boolean(event.payload) });
    }).then((unsub) => {
      unlistenIdentify = unsub;
    }).catch(() => {});

    return () => {
      if (unlistenOutputs) unlistenOutputs();
      if (unlistenIdentify) unlistenIdentify();
    };
  }, [load]);
}
