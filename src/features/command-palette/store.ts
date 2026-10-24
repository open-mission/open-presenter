import { create } from "zustand";

export type PaletteCategory = "all" | "songs" | "bible" | "media" | "commands";

interface CommandPaletteState {
  open: boolean;
  initialQuery: string;
  category: PaletteCategory;
  openPalette: (query?: string, category?: PaletteCategory) => void;
  closePalette: () => void;
  togglePalette: () => void;
  setCategory: (category: PaletteCategory) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  initialQuery: "",
  category: "all",
  openPalette: (query = "", category = "all") =>
    set({ open: true, initialQuery: query, category }),
  closePalette: () => set({ open: false, initialQuery: "" }),
  togglePalette: () =>
    set((state) => ({ open: !state.open, initialQuery: state.open ? "" : state.initialQuery })),
  setCategory: (category) => set({ category }),
}));
