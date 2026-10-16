import { create } from "zustand";
import type { StageTimer } from "@/core/types";

interface StageTimerState {
  timer: StageTimer;
  applyRemote(timer: StageTimer): void;
}

export const useStageTimerStore = create<StageTimerState>((set) => ({
  timer: { running: false, elapsedSecs: 0, startedAtMillis: null },
  applyRemote: (timer) => set({ timer }),
}));
