import { useEffect, useState } from "react";
import { TAURI_EVENTS } from "../config/app";
import { fetchLiveSlide } from "../ipc/commands";
import type { LiveSlide, StageMessage } from "../types";
import { syncBus } from "./syncBus";
import { usePresentationStore } from "../../features/presentation/store";
import { useStageDisplayStore } from "../../features/stage-display/store";

export function usePresentationSync(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];

    async function wire(): Promise<void> {
      await syncBus.init();
      if (disposed) return;

      cleanups.push(
        syncBus.subscribe<LiveSlide>(TAURI_EVENTS.slide, (slide) => {
          usePresentationStore.getState().applyRemote(slide);
        }),
        syncBus.subscribe<StageMessage>(TAURI_EVENTS.stageMessage, (message) => {
          useStageDisplayStore.getState().pushMessage(message);
        }),
      );

      const initial = await fetchLiveSlide();
      if (!disposed && initial) {
        usePresentationStore.getState().applyRemote(initial);
      }
      if (!disposed) setReady(true);
    }

    void wire();
    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return ready;
}
