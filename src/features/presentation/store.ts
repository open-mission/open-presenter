import { create } from "zustand";
import { publishSlide, setBlackout as ipcSetBlackout } from "@/core/ipc/commands";
import type { BackgroundLayer, LiveSlide, SlideContent } from "@/core/types";

const EMPTY_SLIDE: LiveSlide = {
  content: {
    id: "blank",
    kind: "blank",
    title: "Nenhum slide ao vivo",
    lines: ["Aguardando operador…"],
  },
  background: { id: "bg-default", kind: "color", value: "#000000" },
  blackout: false,
  cleared: true,
  updatedAt: new Date(0).toISOString(),
};

interface PresentationState {
  live: LiveSlide;
  preview: SlideContent | null;
  applyRemote(slide: LiveSlide): void;
  setPreview(slide: SlideContent | null): void;
  setBackground(background: BackgroundLayer): void;
  setBlackout(blackout: boolean): void;
  setCleared(cleared: boolean): void;
  publishLive(slide: SlideContent, nextUp: SlideContent | null): Promise<void>;
  clearLive(): Promise<void>;
  toggleBlackout(): Promise<void>;
  toggleClear(): Promise<void>;
  showBackground(): Promise<void>;
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  live: EMPTY_SLIDE,
  preview: null,
  applyRemote: (slide) => set({ live: slide }),
  setPreview: (preview) => set({ preview }),
  setBackground: (background) =>
    set((s) => ({ live: { ...s.live, background } })),
  setBlackout: (blackout) =>
    set((s) => ({ live: { ...s.live, blackout } })),
  setCleared: (cleared) =>
    set((s) => ({ live: { ...s.live, cleared } })),
  publishLive: async (slide, nextUp) => {
    const next: LiveSlide = {
      ...get().live,
      content: slide,
      cleared: false,
      blackout: false,
      nextUp: nextUp ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
  },
  clearLive: async () => {
    const next: LiveSlide = {
      ...get().live,
      cleared: true,
      nextUp: undefined,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
  },
  toggleBlackout: async () => {
    const nextBlackout = !get().live.blackout;
    const next: LiveSlide = {
      ...get().live,
      blackout: nextBlackout,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
    await ipcSetBlackout(nextBlackout);
  },
  toggleClear: async () => {
    const nextCleared = !get().live.cleared;
    const next: LiveSlide = {
      ...get().live,
      cleared: nextCleared,
      blackout: false,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
    if (get().live.blackout) {
      await ipcSetBlackout(false);
    }
  },
  showBackground: async () => {
    const isOnlyBg = get().live.cleared && !get().live.blackout;
    const next: LiveSlide = {
      ...get().live,
      cleared: !isOnlyBg,
      blackout: false,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
    if (get().live.blackout) {
      await ipcSetBlackout(false);
    }
  },
}));

export { EMPTY_SLIDE };
