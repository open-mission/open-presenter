import { create } from "zustand";
import type { BackgroundLayer } from "@/core/types";
import { getSetting, setSetting } from "@/core/ipc/commands";
import { ISF_PRESETS, serializeISFBackground } from "./isfEngine";

export interface CustomISFShader {
  id: string;
  name: string;
  desc?: string;
  category?: string;
  code: string;
}

interface MediaShadersState {
  current: BackgroundLayer;
  presets: BackgroundLayer[];
  customShaders: CustomISFShader[];
  loaded: boolean;
  setCurrent(background: BackgroundLayer): void;
  loadCustomShaders(): Promise<void>;
  saveCustomShader(shader: CustomISFShader): Promise<void>;
  deleteCustomShader(id: string): Promise<void>;
}

const BUILTIN_LAYERS: BackgroundLayer[] = [
  { id: "bg-black", kind: "color", value: "#000000" },
  {
    id: "bg-sunset",
    kind: "css",
    value: "radial-gradient(circle at 50% 120%, #7c2d12 0%, #1c0a00 55%, #000000 100%)",
  },
  {
    id: "bg-night",
    kind: "css",
    value: "radial-gradient(circle at 50% 0%, #1e3a8a 0%, #020617 60%, #000000 100%)",
  },
  ...ISF_PRESETS.map((p) => ({
    id: `isf-${p.id}`,
    kind: "isf" as const,
    value: p.id,
  })),
];

const STORAGE_CUSTOM_SHADERS_KEY = "open_presenter_custom_isf_shaders";

function buildPresetsList(customs: CustomISFShader[]): BackgroundLayer[] {
  const customLayers: BackgroundLayer[] = customs.map((c) => ({
    id: `custom-${c.id}`,
    kind: "isf",
    value: serializeISFBackground({
      id: c.id,
      code: c.code,
    }),
  }));
  return [...BUILTIN_LAYERS, ...customLayers];
}

export const useMediaShadersStore = create<MediaShadersState>((set, get) => ({
  current: BUILTIN_LAYERS[0]!,
  presets: BUILTIN_LAYERS,
  customShaders: [],
  loaded: false,

  setCurrent: (current) => set({ current }),

  loadCustomShaders: async () => {
    try {
      let raw: string | null = null;
      try {
        raw = await getSetting("custom_isf_shaders");
      } catch {
        // Rust IPC not available, fallback to localStorage
      }
      if (!raw) {
        raw = localStorage.getItem(STORAGE_CUSTOM_SHADERS_KEY);
      }
      if (raw) {
        const customs = JSON.parse(raw) as CustomISFShader[];
        set({
          customShaders: customs,
          presets: buildPresetsList(customs),
          loaded: true,
        });
        return;
      }
    } catch {
      // ignore
    }
    set({ loaded: true });
  },

  saveCustomShader: async (shader) => {
    const current = get().customShaders;
    const existingIdx = current.findIndex((s) => s.id === shader.id);
    const updated = [...current];
    if (existingIdx >= 0) {
      updated[existingIdx] = shader;
    } else {
      updated.push(shader);
    }
    const json = JSON.stringify(updated);
    try {
      await setSetting("custom_isf_shaders", json);
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(STORAGE_CUSTOM_SHADERS_KEY, json);
    } catch {
      // ignore
    }
    set({
      customShaders: updated,
      presets: buildPresetsList(updated),
    });
  },

  deleteCustomShader: async (id) => {
    const current = get().customShaders;
    const updated = current.filter((s) => s.id !== id);
    const json = JSON.stringify(updated);
    try {
      await setSetting("custom_isf_shaders", json);
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(STORAGE_CUSTOM_SHADERS_KEY, json);
    } catch {
      // ignore
    }
    set({
      customShaders: updated,
      presets: buildPresetsList(updated),
    });
  },
}));

// Carrega os shaders customizados automaticamente
void useMediaShadersStore.getState().loadCustomShaders();
