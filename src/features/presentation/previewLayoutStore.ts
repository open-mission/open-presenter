import { create } from "zustand";

interface PreviewLayoutState {
  showPreview: boolean;
  showLive: boolean;
  showStage: boolean;
  zoom: number; // 50 to 150 percent
  togglePreview: () => void;
  toggleLive: () => void;
  toggleStage: () => void;
  setShowPreview: (val: boolean) => void;
  setShowLive: (val: boolean) => void;
  setShowStage: (val: boolean) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  showAll: () => void;
}

const STORAGE_KEY = "open_presenter_preview_layout";

interface StoredLayout {
  showPreview?: boolean;
  showLive?: boolean;
  showStage?: boolean;
  zoom?: number;
}

function loadInitial(): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredLayout;
  } catch {
    return {};
  }
}

function persist(state: {
  showPreview: boolean;
  showLive: boolean;
  showStage: boolean;
  zoom: number;
}) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showPreview: state.showPreview,
        showLive: state.showLive,
        showStage: state.showStage,
        zoom: state.zoom,
      }),
    );
  } catch {}
}

const initial = loadInitial();

export const usePreviewLayoutStore = create<PreviewLayoutState>((set, get) => ({
  showPreview: initial.showPreview ?? true,
  showLive: initial.showLive ?? true,
  showStage: initial.showStage ?? true,
  zoom: typeof initial.zoom === "number" ? Math.min(Math.max(initial.zoom, 50), 150) : 100,

  togglePreview: () => {
    const next = !get().showPreview;
    set({ showPreview: next });
    persist({ ...get(), showPreview: next });
  },

  toggleLive: () => {
    const next = !get().showLive;
    set({ showLive: next });
    persist({ ...get(), showLive: next });
  },

  toggleStage: () => {
    const next = !get().showStage;
    set({ showStage: next });
    persist({ ...get(), showStage: next });
  },

  setShowPreview: (val) => {
    set({ showPreview: val });
    persist({ ...get(), showPreview: val });
  },

  setShowLive: (val) => {
    set({ showLive: val });
    persist({ ...get(), showLive: val });
  },

  setShowStage: (val) => {
    set({ showStage: val });
    persist({ ...get(), showStage: val });
  },

  setZoom: (zoom) => {
    const clamped = Math.min(Math.max(zoom, 50), 150);
    set({ zoom: clamped });
    persist({ ...get(), zoom: clamped });
  },

  zoomIn: () => {
    const next = Math.min(get().zoom + 15, 150);
    set({ zoom: next });
    persist({ ...get(), zoom: next });
  },

  zoomOut: () => {
    const next = Math.max(get().zoom - 15, 50);
    set({ zoom: next });
    persist({ ...get(), zoom: next });
  },

  resetZoom: () => {
    set({ zoom: 100 });
    persist({ ...get(), zoom: 100 });
  },

  showAll: () => {
    set({ showPreview: true, showLive: true, showStage: true });
    persist({ ...get(), showPreview: true, showLive: true, showStage: true });
  },
}));
