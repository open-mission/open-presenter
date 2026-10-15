import { create } from "zustand";
import type { MonitorInfo, OutputConfig } from "@/core/types";

interface OutputManagerState {
  monitors: MonitorInfo[];
  host: string;
  outputs: Record<OutputConfig["target"], OutputConfig>;
  setMonitors(monitors: MonitorInfo[]): void;
  setHost(host: string): void;
  setOutput(output: OutputConfig): void;
}

const OFF: OutputConfig = { target: "public", mode: "off", monitorId: null, url: null };

export const useOutputManagerStore = create<OutputManagerState>((set) => ({
  monitors: [],
  host: "localhost",
  outputs: {
    public: { ...OFF, target: "public" },
    stage: { ...OFF, target: "stage" },
  },
  setMonitors: (monitors) => set({ monitors }),
  setHost: (host) => set({ host }),
  setOutput: (output) =>
    set((s) => ({ outputs: { ...s.outputs, [output.target]: output } })),
}));
