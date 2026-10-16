import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StageFontSize = "normal" | "large" | "xlarge";
export type StageTheme = "classic" | "high-contrast" | "warm";

export interface StageConfig {
  showClock: boolean;
  clock24h: boolean;
  showSeconds: boolean;
  showTimer: boolean;
  showNextUp: boolean;
  fontSize: StageFontSize;
  theme: StageTheme;
}

interface StageConfigState extends StageConfig {
  updateConfig: (patch: Partial<StageConfig>) => void;
  resetConfig: () => void;
}

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  showClock: true,
  clock24h: true,
  showSeconds: false,
  showTimer: true,
  showNextUp: true,
  fontSize: "large",
  theme: "classic",
};

export const useStageConfigStore = create<StageConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_STAGE_CONFIG,
      updateConfig: (patch) => set((state) => ({ ...state, ...patch })),
      resetConfig: () => set(DEFAULT_STAGE_CONFIG),
    }),
    {
      name: "open-presenter-stage-config",
    },
  ),
);
