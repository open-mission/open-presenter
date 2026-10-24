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
  textHidden: false,
  updatedAt: new Date(0).toISOString(),
};

interface PresentationState {
  live: LiveSlide;
  preview: SlideContent | null;
  applyRemote(slide: LiveSlide): void;
  setPreview(slide: SlideContent | null): void;
  setBackground(background: BackgroundLayer): Promise<void>;
  setBlackout(blackout: boolean): void;
  setCleared(cleared: boolean): void;
  publishLive(
    slide: SlideContent,
    nextUp?: SlideContent | null,
    prevUp?: SlideContent | null,
  ): Promise<void>;
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
  setBackground: async (background) => {
    const next: LiveSlide = {
      ...get().live,
      background,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
  },
  setBlackout: (blackout) =>
    set((s) => ({ live: { ...s.live, blackout } })),
  setCleared: (cleared) =>
    set((s) => ({
      live: {
        ...s.live,
        cleared,
        ...(cleared ? { textHidden: false } : {}),
      },
    })),
  publishLive: async (slide, nextUp, prevUp) => {
    const isPresentation = Boolean(slide.media?.themeId);
    const isMedia = slide.kind === "media";
    const shouldResetBg = isPresentation || isMedia;
    const next: LiveSlide = {
      ...get().live,
      ...(shouldResetBg
        ? { background: { id: "bg-default", kind: "color", value: "#000000" } }
        : {}),
      content: slide,
      cleared: false,
      blackout: false,
      textHidden: false,
      nextUp: nextUp ?? undefined,
      prevUp: prevUp ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
  },
  clearLive: async () => {
    const next: LiveSlide = {
      ...get().live,
      cleared: true,
      textHidden: false,
      nextUp: undefined,
      prevUp: undefined,
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
    const wasBlackout = get().live.blackout;
    const next: LiveSlide = {
      ...get().live,
      cleared: false,
      blackout: false,
      textHidden: !get().live.textHidden,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
    if (wasBlackout) {
      await ipcSetBlackout(false);
    }
  },
  showBackground: async () => {
    const wasBlackout = get().live.blackout;
    const isOnlyBg = get().live.cleared && !get().live.blackout;
    const next: LiveSlide = {
      ...get().live,
      cleared: !isOnlyBg,
      blackout: false,
      textHidden: false,
      updatedAt: new Date().toISOString(),
    };
    get().applyRemote(next);
    await publishSlide(next);
    if (wasBlackout) {
      await ipcSetBlackout(false);
    }
  },
}));

export { EMPTY_SLIDE };
