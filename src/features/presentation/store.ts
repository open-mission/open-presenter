import { create } from "zustand";
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
  nextUp: SlideContent | null;
  applyRemote(slide: LiveSlide): void;
  setPreview(slide: SlideContent | null): void;
  setNextUp(slide: SlideContent | null): void;
  setBackground(background: BackgroundLayer): void;
  setBlackout(blackout: boolean): void;
  setCleared(cleared: boolean): void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  live: EMPTY_SLIDE,
  preview: null,
  nextUp: null,
  applyRemote: (slide) => set({ live: slide }),
  setPreview: (preview) => set({ preview }),
  setNextUp: (nextUp) => set({ nextUp }),
  setBackground: (background) =>
    set((s) => ({ live: { ...s.live, background } })),
  setBlackout: (blackout) =>
    set((s) => ({ live: { ...s.live, blackout } })),
  setCleared: (cleared) =>
    set((s) => ({ live: { ...s.live, cleared } })),
}));

export { EMPTY_SLIDE };
