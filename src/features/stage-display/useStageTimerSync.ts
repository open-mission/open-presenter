import { useEffect } from "react";
import { TAURI_EVENTS } from "@/core/config/app";
import { fetchStageTimer } from "@/core/ipc/commands";
import type { StageTimer } from "@/core/types";
import { syncBus } from "@/core/sync/syncBus";
import { useStageTimerStore } from "./timerStore";

/** Espelha o cronômetro do palco (fonte da verdade no Rust). */
export function useStageTimerSync(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    async function wire(): Promise<void> {
      await syncBus.init();
      if (disposed) return;
      unsubscribe = syncBus.subscribe<StageTimer>(TAURI_EVENTS.timer, (timer) => {
        if (!disposed) useStageTimerStore.getState().applyRemote(timer);
      });
      const initial = await fetchStageTimer();
      if (!disposed && initial) useStageTimerStore.getState().applyRemote(initial);
    }

    void wire();
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
}
