import { create } from "zustand";
import { outputHttpUrl } from "@/core/config/app";
import {
  closeOutputWindow,
  fetchServerHost,
  getOutputConfig,
  getOutputsState,
  listMonitors,
  openOutputWindow,
  setOutputConfig,
} from "@/core/ipc/commands";
import type {
  MonitorInfo,
  OutputConfig,
  OutputMode,
  OutputRuntime,
  OutputTarget,
} from "@/core/types";

function webPathFor(target: OutputTarget): "/public" | "/stage" {
  return target === "public" ? "/public" : "/stage";
}

function offConfig(target: OutputTarget): OutputConfig {
  return {
    target,
    mode: "off",
    monitorId: null,
    monitorLabel: null,
    url: null,
  };
}

function offRuntime(target: OutputTarget): OutputRuntime {
  return { target, open: false, monitorId: null };
}

interface OutputManagerState {
  configs: Record<OutputTarget, OutputConfig>;
  runtime: Record<OutputTarget, OutputRuntime>;
  monitors: MonitorInfo[];
  host: string;
  loaded: boolean;
  lastMode: Record<OutputTarget, Exclude<OutputMode, "off">>;
  setMonitors(monitors: MonitorInfo[]): void;
  setHost(host: string): void;
  applyRuntime(runtime: OutputRuntime[]): void;
  load(): Promise<void>;
  setMode(target: OutputTarget, mode: OutputMode): Promise<void>;
  setMonitor(target: OutputTarget, monitorId: string | null): Promise<void>;
  toggle(target: OutputTarget): Promise<void>;
}

export const useOutputManagerStore = create<OutputManagerState>((set, get) => ({
  configs: { public: offConfig("public"), stage: offConfig("stage") },
  runtime: { public: offRuntime("public"), stage: offRuntime("stage") },
  monitors: [],
  host: "localhost",
  loaded: false,
  lastMode: { public: "native", stage: "native" },
  setMonitors: (monitors) => set({ monitors }),
  setHost: (host) => set({ host }),
  applyRuntime: (list) =>
    set((s) => {
      const runtime = { ...s.runtime };
      for (const item of list) {
        runtime[item.target] = {
          target: item.target,
          open: item.open,
          monitorId: item.monitorId ?? null,
        };
      }
      return { runtime };
    }),
  load: async () => {
    const [host, monitors, publicConfig, stageConfig, state] =
      await Promise.all([
        fetchServerHost(),
        listMonitors(),
        getOutputConfig("public"),
        getOutputConfig("stage"),
        getOutputsState(),
      ]);
    set((s) => {
      const runtime = { ...s.runtime };
      for (const item of state) {
        runtime[item.target] = {
          target: item.target,
          open: item.open,
          monitorId: item.monitorId ?? null,
        };
      }
      const configs = {
        public: publicConfig ?? s.configs.public,
        stage: stageConfig ?? s.configs.stage,
      };
      const lastMode = { ...s.lastMode };
      for (const t of ["public", "stage"] as const) {
        if (configs[t].mode !== "off") lastMode[t] = configs[t].mode;
      }
      return {
        configs,
        runtime,
        monitors: monitors ?? s.monitors,
        host: host ?? s.host,
        loaded: true,
        lastMode,
      };
    });
  },
  setMode: async (target, mode) => {
    const { configs, host } = get();
    const next: OutputConfig = {
      ...configs[target],
      target,
      mode,
      url: mode === "off" ? null : outputHttpUrl(host, webPathFor(target)),
    };
    await setOutputConfig(next);
    set((s) => ({
      configs: { ...s.configs, [target]: next },
      lastMode:
        mode === "off" ? s.lastMode : { ...s.lastMode, [target]: mode },
    }));
    if (mode === "native" || mode === "both") {
      await openOutputWindow(target, next.monitorId, next.monitorLabel);
    } else {
      await closeOutputWindow(target);
    }
  },
  setMonitor: async (target, monitorId) => {
    const { configs, monitors, runtime } = get();
    if (configs[target].monitorId === monitorId) return;
    const next: OutputConfig = {
      ...configs[target],
      monitorId,
      monitorLabel: monitors.find((m) => m.id === monitorId)?.name ?? null,
    };
    await setOutputConfig(next);
    set((s) => ({ configs: { ...s.configs, [target]: next } }));
    if (runtime[target]?.open) {
      await closeOutputWindow(target);
      await openOutputWindow(target, monitorId, next.monitorLabel);
    }
  },
  toggle: async (target) => {
    const { configs, runtime, lastMode } = get();
    const mode = configs[target].mode;
    const active =
      mode !== "off" && (mode === "web" || runtime[target]?.open === true);
    if (!active) {
      await get().setMode(target, mode === "off" ? lastMode[target] : mode);
      return;
    }
    await get().setMode(target, "off");
  },
}));
