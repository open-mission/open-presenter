import { create } from "zustand";
import { OUTPUT_HTTP_PORT, outputHttpUrl } from "@/core/config/app";
import { setMediaPort } from "@/core/config/mediaPort";
import {
  closeOutputWindow,
  fetchServerHost,
  getOutputConfig,
  getOutputsState,
  getServerStatus,
  listMonitors,
  openOutputWindow,
  setOutputConfig,
  setServerPort,
  startServer,
  stopServer,
} from "@/core/ipc/commands";
import type {
  MonitorInfo,
  OutputConfig,
  OutputMode,
  OutputRuntime,
  OutputTarget,
  ServerStatus,
} from "@/core/types";

import { isOutputActive } from "./outputActive";
import { useWallpaperStore } from "@/features/presentation/wallpaperStore";

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

function normalizeConfig(cfg: OutputConfig | null): OutputConfig | null {
  if (!cfg) return null;
  return {
    ...cfg,
    monitorId: cfg.monitorId ?? null,
    monitorLabel: cfg.monitorLabel ?? null,
    url: cfg.url ?? null,
    wallpaper: cfg.wallpaper ?? null,
  };
}

interface OutputManagerState {
  configs: Record<OutputTarget, OutputConfig>;
  runtime: Record<OutputTarget, OutputRuntime>;
  monitors: MonitorInfo[];
  host: string;
  server: ServerStatus;
  loaded: boolean;
  lastMode: Record<OutputTarget, Exclude<OutputMode, "off">>;
  setMonitors(monitors: MonitorInfo[]): void;
  setHost(host: string): void;
  applyRuntime(runtime: OutputRuntime[]): void;
  applyServer(server: ServerStatus): void;
  load(): Promise<void>;
  refreshRuntime(): Promise<void>;
  refreshConfigsAndServer(): Promise<void>;
  setMode(target: OutputTarget, mode: OutputMode): Promise<void>;
  setMonitor(target: OutputTarget, monitorId: string | null): Promise<void>;
  setWallpaper(target: OutputTarget, wallpaper: string | null): Promise<void>;
  toggle(target: OutputTarget): Promise<void>;
  setPort(port: number): Promise<void>;
  stopLocalServer(): Promise<void>;
  startLocalServer(): Promise<void>;
  restartLocalServer(): Promise<void>;
}

export const useOutputManagerStore = create<OutputManagerState>((set, get) => ({
  configs: { public: offConfig("public"), stage: offConfig("stage") },
  runtime: { public: offRuntime("public"), stage: offRuntime("stage") },
  monitors: [],
  host: "localhost",
  server: { running: true, port: OUTPUT_HTTP_PORT },
  loaded: false,
  lastMode: { public: "native", stage: "native" },
  setMonitors: (monitors) => set({ monitors }),
  setHost: (host) => set({ host }),
  applyServer: (server) => set({ server }),
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
    const [host, monitors, publicConfig, stageConfig, state, server] =
      await Promise.all([
        fetchServerHost(),
        listMonitors(),
        getOutputConfig("public"),
        getOutputConfig("stage"),
        getOutputsState(),
        getServerStatus(),
      ]);
    const webPort =
      server?.port ??
      (typeof window !== "undefined" && window.location.port
        ? Number(window.location.port) || OUTPUT_HTTP_PORT
        : OUTPUT_HTTP_PORT);
    setMediaPort(server?.port ?? null);
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
        public: normalizeConfig(publicConfig) ?? s.configs.public,
        stage: normalizeConfig(stageConfig) ?? s.configs.stage,
      };
      const lastMode = { ...s.lastMode };
      for (const t of ["public", "stage"] as const) {
        if (configs[t].mode !== "off") lastMode[t] = configs[t].mode;
      }
      if (configs.public?.wallpaper !== undefined) {
        useWallpaperStore.getState().applyRemote(configs.public.wallpaper);
      }
      return {
        configs,
        runtime,
        monitors: monitors ?? s.monitors,
        host: host ?? s.host,
        server: server ?? { running: true, port: webPort },
        loaded: true,
        lastMode,
      };
    });
  },
  refreshRuntime: async () => {
    const state = await getOutputsState();
    get().applyRuntime(state);
  },
  refreshConfigsAndServer: async () => {
    const [publicConfig, stageConfig, server] = await Promise.all([
      getOutputConfig("public"),
      getOutputConfig("stage"),
      getServerStatus(),
    ]);
    setMediaPort(server?.port ?? null);
    set((s) => {
      const configs = {
        public: normalizeConfig(publicConfig) ?? s.configs.public,
        stage: normalizeConfig(stageConfig) ?? s.configs.stage,
      };
      const lastMode = { ...s.lastMode };
      for (const t of ["public", "stage"] as const) {
        if (configs[t].mode !== "off") lastMode[t] = configs[t].mode;
      }
      if (configs.public?.wallpaper !== undefined) {
        useWallpaperStore.getState().applyRemote(configs.public.wallpaper);
      }
      return {
        configs,
        lastMode,
        server: server ?? s.server,
      };
    });
  },
  setMode: async (target, mode) => {
    const { configs, host, server } = get();
    const next: OutputConfig = {
      ...configs[target],
      target,
      mode,
      url: mode === "off" ? null : outputHttpUrl(host, server.port, webPathFor(target)),
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
  setWallpaper: async (target, wallpaper) => {
    const { configs } = get();
    const next: OutputConfig = {
      ...configs[target],
      wallpaper,
    };
    await setOutputConfig(next);
    set((s) => ({ configs: { ...s.configs, [target]: next } }));
    if (target === "public") {
      useWallpaperStore.getState().applyRemote(wallpaper);
    }
  },
  toggle: async (target) => {
    const { configs, runtime, server, lastMode } = get();
    const mode = configs[target].mode;
    const active = isOutputActive(
      mode,
      runtime[target]?.open === true,
      server.running,
    );
    if (!active) {
      await get().setMode(target, mode === "off" ? lastMode[target] : mode);
      return;
    }
    await get().setMode(target, "off");
  },
  setPort: async (port) => {
    try {
      const server = await setServerPort(port);
      set({ server });
      setMediaPort(server.port);
    } catch (e) {
      const s = await getServerStatus();
      if (s) {
        set({ server: s });
        setMediaPort(s.port);
      }
      throw e;
    }
  },
  stopLocalServer: async () => {
    set({ server: await stopServer() });
  },
  startLocalServer: async () => {
    const server = await startServer();
    set({ server });
    setMediaPort(server.port);
  },
  restartLocalServer: async () => {
    await get().stopLocalServer();
    await get().startLocalServer();
  },
}));
