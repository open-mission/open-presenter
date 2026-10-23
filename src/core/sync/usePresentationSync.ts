import { useEffect, useState } from "react";
import { TAURI_EVENTS } from "../config/app";
import { fetchLiveSlide, fetchLiveThemes, fetchLiveOutputPlans } from "../ipc/commands";
import type { LiveOutputPlans, LiveSlide, LiveThemes, StageMessage } from "../types";
import { syncBus, type SyncOutput } from "./syncBus";
import { usePresentationStore } from "../../features/presentation/store";
import { useStageDisplayStore } from "../../features/stage-display/store";
import { useLiveThemesStore } from "../../features/slide-themes/liveThemesStore";
import { useOutputPlansStore } from "../../features/slide-themes/outputPlansStore";

export function usePresentationSync(output?: SyncOutput): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];

    async function wire(): Promise<void> {
      await syncBus.init(output);
      if (disposed) return;

      cleanups.push(
        syncBus.subscribe<LiveSlide>(TAURI_EVENTS.slide, (slide) => {
          usePresentationStore.getState().applyRemote(slide);
        }),
        syncBus.subscribe<LiveThemes>(TAURI_EVENTS.themes, (themes) => {
          useLiveThemesStore.getState().applyRemote(themes);
        }),
        syncBus.subscribe<LiveOutputPlans>(TAURI_EVENTS.outputPlans, (plans) => {
          useOutputPlansStore.getState().applyRemote(plans);
        }),
        syncBus.subscribe<StageMessage>(TAURI_EVENTS.stageMessage, (message) => {
          useStageDisplayStore.getState().pushMessage(message);
        }),
      );

      const [initial, initialThemes, initialPlans] = await Promise.all([
        fetchLiveSlide(),
        fetchLiveThemes(),
        fetchLiveOutputPlans(),
      ]);
      if (!disposed && initial) {
        usePresentationStore.getState().applyRemote(initial);
      }
      if (!disposed && initialThemes) {
        useLiveThemesStore.getState().applyRemote(initialThemes);
      }
      if (!disposed && initialPlans) {
        useOutputPlansStore.getState().applyRemote(initialPlans);
      }
      if (!disposed) setReady(true);
    }

    void wire();
    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [output]);

  return ready;
}
