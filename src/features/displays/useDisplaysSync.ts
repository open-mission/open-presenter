import { useEffect } from "react";
import { isTauri } from "@/core/ipc/tauri";
import { listen } from "@tauri-apps/api/event";
import type { DisplayOutput } from "@/core/types";
import { useDisplaysStore } from "./store";

export function useDisplaysSync() {
  const load = useDisplaysStore((s) => s.load);

  useEffect(() => {
    void load();

    if (!isTauri()) {
      const handleStorage = (e: StorageEvent) => {
        if (e.key === "open_presenter_display_outputs" || e.key === "open_presenter_displays_settings") {
          void load();
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }

    let unlistenOutputs: (() => void) | undefined;
    let unlistenIdentify: (() => void) | undefined;

    listen<DisplayOutput[]>("displays://changed", (event) => {
      if (Array.isArray(event.payload)) {
        useDisplaysStore.setState((s) => ({
          outputs: event.payload,
          selectedOutputId:
            s.selectedOutputId && event.payload.some((o) => o.id === s.selectedOutputId)
              ? s.selectedOutputId
              : (event.payload[0]?.id ?? null),
        }));
      }
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
