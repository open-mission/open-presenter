import { create } from "zustand";
import type {
  DisplayOutput,
  DisplaysSettings,
  MonitorInfo,
  OutputCategory,
  OutputType,
} from "@/core/types";
import {
  closeNativeOutput,
  getDisplayOutputs,
  getDisplaysSettings,
  identifyDisplays,
  listMonitors,
  openNativeOutput,
  saveDisplayOutputs,
  saveDisplaysSettings,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";

const STORAGE_KEY_OUTPUTS = "open_presenter_display_outputs";
const STORAGE_KEY_SETTINGS = "open_presenter_displays_settings";

const DEFAULT_SETTINGS: DisplaysSettings = {
  autoActivateOnLaunch: true,
  showPerformanceStats: false,
  ignoreBackgroundColors: false,
  showKeynoteScreens: false,
  timerFontMode: "auto",
  bitDepth: "8bit",
  publicEnabled: true,
  stageEnabled: true,
  lowerEnabled: true,
};

function generateId(): string {
  return `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "output";
}

async function syncNativeWindow(output: DisplayOutput) {
  if (!isTauri()) return;
  if (output.type === "monitor") {
    if (output.enabled) {
      const slug = output.slug || slugify(output.name);
      let route = `/output/${slug}?category=${output.category}&id=${output.id}`;
      if (output.category === "public" && (!output.slug || output.slug === "public" || output.slug === "telao")) {
        route = `/public?id=${output.id}`;
      } else if (output.category === "stage" && (!output.slug || output.slug === "stage" || output.slug === "palco" || output.slug === "retorno")) {
        route = `/stage?id=${output.id}`;
      } else if (output.category === "lower" && (!output.slug || output.slug === "lower" || output.slug === "stream" || output.slug === "transmissao")) {
        route = `/stream?id=${output.id}`;
      }
      try {
        await openNativeOutput(output.id, output.monitorId ?? null, route, output.name);
      } catch (err) {
        console.error(`Falha ao abrir monitor nativo ${output.name}:`, err);
      }
    } else {
      try {
        await closeNativeOutput(output.id);
      } catch (err) {
        console.error(`Falha ao fechar monitor nativo ${output.name}:`, err);
      }
    }
  }
}

function loadLocalStorageOutputs(): DisplayOutput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OUTPUTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalStorageSettings(): DisplaysSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface DisplaysState {
  outputs: DisplayOutput[];
  selectedOutputId: string | null;
  settings: DisplaysSettings;
  monitors: MonitorInfo[];
  identifyActive: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  selectOutput: (id: string | null) => void;
  addOutput: (category: OutputCategory, type: OutputType) => Promise<string>;
  updateOutput: (id: string, patch: Partial<DisplayOutput>) => Promise<void>;
  removeOutput: (id: string) => Promise<void>;
  duplicateOutput: (id: string) => Promise<string>;
  toggleOutput: (id: string) => Promise<void>;
  setCategoryEnabled: (category: OutputCategory, enabled: boolean) => Promise<void>;
  updateSettings: (patch: Partial<DisplaysSettings>) => Promise<void>;
  setIdentifyActive: (active: boolean) => Promise<void>;
  setMonitors: (monitors: MonitorInfo[]) => void;
}

export const useDisplaysStore = create<DisplaysState>((set, get) => ({
  outputs: loadLocalStorageOutputs(),
  selectedOutputId: null,
  settings: loadLocalStorageSettings(),
  monitors: [],
  identifyActive: false,
  loaded: false,

  load: async () => {
    let monitors: MonitorInfo[] = [];
    try {
      monitors = await listMonitors();
    } catch {
      monitors = [];
    }

    if (isTauri()) {
      try {
        const [backendOutputs, backendSettings] = await Promise.all([
          getDisplayOutputs(),
          getDisplaysSettings(),
        ]);
        const outputs = backendOutputs ?? [];
        const settings = backendSettings ?? DEFAULT_SETTINGS;

        // Persist local mirror
        localStorage.setItem(STORAGE_KEY_OUTPUTS, JSON.stringify(outputs));
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));

        set((s) => ({
          outputs,
          settings,
          monitors,
          loaded: true,
          selectedOutputId: s.selectedOutputId && outputs.some((o) => o.id === s.selectedOutputId)
            ? s.selectedOutputId
            : (outputs[0]?.id ?? null),
        }));

        if (settings.autoActivateOnLaunch !== false) {
          for (const out of outputs) {
            if (out.enabled && out.type === "monitor") {
              void syncNativeWindow(out);
            }
          }
        }
        return;
      } catch (err) {
        console.warn("Falha ao carregar saídas do backend:", err);
      }
    }

    const localOutputs = loadLocalStorageOutputs();
    const localSettings = loadLocalStorageSettings();
    set((s) => ({
      outputs: localOutputs,
      settings: localSettings,
      monitors,
      loaded: true,
      selectedOutputId: s.selectedOutputId && localOutputs.some((o) => o.id === s.selectedOutputId)
        ? s.selectedOutputId
        : (localOutputs[0]?.id ?? null),
    }));
  },

  selectOutput: (id: string | null) => {
    set({ selectedOutputId: id });
  },

  addOutput: async (category: OutputCategory, type: OutputType) => {
    const { outputs, monitors } = get();
    const categoryOutputs = outputs.filter((o) => o.category === category);
    const count = categoryOutputs.length + 1;

    let baseName = "Telão";
    let defaultSlug = "public";
    if (category === "stage") {
      baseName = "Retorno de Palco";
      defaultSlug = "stage";
    } else if (category === "lower") {
      baseName = "Lower Third";
      defaultSlug = "lower";
    }

    const name = count === 1 && categoryOutputs.length === 0 ? baseName : `${baseName} ${count}`;
    const slug = count === 1 && categoryOutputs.length === 0 ? defaultSlug : slugify(name);

    // Resolution and monitor assignment defaults
    let width = 1920;
    let height = 1080;
    let aspectRatio = "16:9";
    let monitorId: string | null = null;
    let monitorName: string | null = null;

    if (type === "monitor") {
      // Pick first monitor not used yet, or primary
      const assignedIds = new Set(
        outputs.filter((o) => o.type === "monitor" && o.monitorId).map((o) => o.monitorId),
      );
      const availableMonitor = monitors.find((m) => !assignedIds.has(m.id)) ?? monitors[0];
      if (availableMonitor) {
        width = availableMonitor.width;
        height = availableMonitor.height;
        aspectRatio = `${width}:${height}`;
        monitorId = availableMonitor.id;
        monitorName = availableMonitor.name;
      }
    }

    const newOutput: DisplayOutput = {
      id: generateId(),
      name,
      slug,
      category,
      type,
      enabled: true,
      resolution: { width, height },
      aspectRatio,
      backgroundColor: category === "lower" ? "rgba(0,0,0,0)" : "#000000",
      backgroundColorEnabled: category !== "lower",
      defaultThemeGuid: null,
      monitorId,
      monitorName,
      url: `/#/output/${slug}`,
      ndiStreamName: type === "ndi" ? `OpenPresenter - ${name}` : null,
      frameRate: 60,
      videoDelayFrames: 0,
      alphaKey: category === "lower",
      layoutMode: "single",
      outputDestination: "full",
      cornerPinning: null,
      placeholderEnabled: category !== "lower",
      placeholderType: "logo",
      placeholderUrl: null,
      placeholderFit: "contain",
    };

    const nextOutputs = [...outputs, newOutput];
    set({ outputs: nextOutputs, selectedOutputId: newOutput.id });

    localStorage.setItem(STORAGE_KEY_OUTPUTS, JSON.stringify(nextOutputs));
    if (isTauri()) {
      try {
        await saveDisplayOutputs(nextOutputs);
        void syncNativeWindow(newOutput);
      } catch (err) {
        console.error("Falha ao salvar nova saída no backend:", err);
      }
    }

    return newOutput.id;
  },

  updateOutput: async (id: string, patch: Partial<DisplayOutput>) => {
    const { outputs } = get();
    const nextOutputs = outputs.map((out) => {
      if (out.id !== id) return out;
      const updated = { ...out, ...patch };
      if (patch.name && !patch.slug && (!out.slug || out.slug === slugify(out.name))) {
        updated.slug = slugify(patch.name);
        if (out.type === "html") {
          updated.url = `/#/output/${updated.slug}`;
        }
      }
      return updated;
    });
    set({ outputs: nextOutputs });

    localStorage.setItem(STORAGE_KEY_OUTPUTS, JSON.stringify(nextOutputs));
    const target = nextOutputs.find((o) => o.id === id);
    if (isTauri()) {
      try {
        await saveDisplayOutputs(nextOutputs);
        if (target) void syncNativeWindow(target);
      } catch (err) {
        console.error("Falha ao atualizar saída no backend:", err);
      }
    }
  },

  removeOutput: async (id: string) => {
    const { outputs, selectedOutputId } = get();
    const nextOutputs = outputs.filter((out) => out.id !== id);
    const nextSelected =
      selectedOutputId === id ? (nextOutputs[0]?.id ?? null) : selectedOutputId;

    set({ outputs: nextOutputs, selectedOutputId: nextSelected });

    localStorage.setItem(STORAGE_KEY_OUTPUTS, JSON.stringify(nextOutputs));
    if (isTauri()) {
      try {
        void closeNativeOutput(id);
        await saveDisplayOutputs(nextOutputs);
      } catch (err) {
        console.error("Falha ao remover saída no backend:", err);
      }
    }
  },

  duplicateOutput: async (id: string) => {
    const { outputs } = get();
    const target = outputs.find((o) => o.id === id);
    if (!target) return "";

    const duplicate: DisplayOutput = {
      ...target,
      id: generateId(),
      name: `${target.name} (Cópia)`,
    };

    const nextOutputs = [...outputs, duplicate];
    set({ outputs: nextOutputs, selectedOutputId: duplicate.id });

    localStorage.setItem(STORAGE_KEY_OUTPUTS, JSON.stringify(nextOutputs));
    if (isTauri()) {
      try {
        await saveDisplayOutputs(nextOutputs);
      } catch (err) {
        console.error("Falha ao duplicar saída no backend:", err);
      }
    }
    return duplicate.id;
  },

  toggleOutput: async (id: string) => {
    const { outputs } = get();
    const target = outputs.find((o) => o.id === id);
    if (!target) return;
    await get().updateOutput(id, { enabled: !target.enabled });
  },

  setCategoryEnabled: async (category: OutputCategory, enabled: boolean) => {
    const { outputs, settings } = get();
    const nextOutputs = outputs.map((out) =>
      out.category === category ? { ...out, enabled } : out,
    );
    const settingsKey =
      category === "public"
        ? "publicEnabled"
        : category === "stage"
          ? "stageEnabled"
          : "lowerEnabled";

    const nextSettings = { ...settings, [settingsKey]: enabled };
    set({ outputs: nextOutputs, settings: nextSettings });

    localStorage.setItem(STORAGE_KEY_OUTPUTS, JSON.stringify(nextOutputs));
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(nextSettings));

    if (isTauri()) {
      try {
        await Promise.all([
          saveDisplayOutputs(nextOutputs),
          saveDisplaysSettings(nextSettings),
        ]);
      } catch (err) {
        console.error("Falha ao salvar estado da categoria no backend:", err);
      }
    }
  },

  updateSettings: async (patch: Partial<DisplaysSettings>) => {
    const { settings } = get();
    const nextSettings = { ...settings, ...patch };
    set({ settings: nextSettings });

    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(nextSettings));
    if (isTauri()) {
      try {
        await saveDisplaysSettings(nextSettings);
      } catch (err) {
        console.error("Falha ao atualizar configurações no backend:", err);
      }
    }
  },

  setIdentifyActive: async (active: boolean) => {
    set({ identifyActive: active });
    if (isTauri()) {
      try {
        await identifyDisplays(active);
      } catch (err) {
        console.error("Falha ao ativar identificador de telas:", err);
      }
    }
  },

  setMonitors: (monitors: MonitorInfo[]) => {
    set({ monitors });
  },
}));
