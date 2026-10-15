import { create } from "zustand";
import type { BackgroundLayer } from "@/core/types";

interface MediaShadersState {
  current: BackgroundLayer;
  presets: BackgroundLayer[];
  setCurrent(background: BackgroundLayer): void;
}

const PRESETS: BackgroundLayer[] = [
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
  { id: "bg-isf-demo", kind: "isf", value: "plasma" },
];

export const useMediaShadersStore = create<MediaShadersState>((set) => ({
  current: PRESETS[0],
  presets: PRESETS,
  setCurrent: (current) => set({ current }),
}));
