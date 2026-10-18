import { create } from "zustand";

interface WallpaperState {
  wallpaper: string | null;
  applyRemote(wallpaper: string | null): void;
}

export const useWallpaperStore = create<WallpaperState>((set) => ({
  wallpaper: null,
  applyRemote: (wallpaper) => set({ wallpaper }),
}));
