import { create } from "zustand";

export type GridMode = "1x2" | "2x2" | "3x3" | "4x4";
export type AdjustmentsTab = "alerts" | "timers";

export interface CellSource {
  id: string; // "preview" | "live" | "stage" | "stream" | "next" | "prev" | "output:<id>" | "empty"
  label: string;
}

interface PreviewLayoutState {
  showPreview: boolean;
  showLive: boolean;
  showStage: boolean;
  hiddenOutputIds: string[];
  zoom: number; // 50 to 150 percent
  gridMode: GridMode;
  cellAssignments: Record<number, string>;
  previewHeight: number;
  adjustmentsTab: AdjustmentsTab;

  togglePreview: () => void;
  toggleLive: () => void;
  toggleStage: () => void;
  toggleOutputVisibility: (id: string) => void;
  isOutputVisible: (id: string) => boolean;
  setShowPreview: (val: boolean) => void;
  setShowLive: (val: boolean) => void;
  setShowStage: (val: boolean) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  showAll: () => void;
  setGridMode: (mode: GridMode) => void;
  setCellAssignment: (index: number, sourceId: string) => void;
  setPreviewHeight: (height: number) => void;
  setAdjustmentsTab: (tab: AdjustmentsTab) => void;
}

const STORAGE_KEY = "open_presenter_preview_layout";

interface StoredLayout {
  showPreview?: boolean;
  showLive?: boolean;
  showStage?: boolean;
  hiddenOutputIds?: string[];
  zoom?: number;
  gridMode?: GridMode;
  cellAssignments?: Record<number, string>;
  previewHeight?: number;
  adjustmentsTab?: AdjustmentsTab;
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
  hiddenOutputIds: string[];
  zoom: number;
  gridMode: GridMode;
  cellAssignments: Record<number, string>;
  previewHeight: number;
  adjustmentsTab: AdjustmentsTab;
}) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showPreview: state.showPreview,
        showLive: state.showLive,
        showStage: state.showStage,
        hiddenOutputIds: state.hiddenOutputIds,
        zoom: state.zoom,
        gridMode: state.gridMode,
        cellAssignments: state.cellAssignments,
        previewHeight: state.previewHeight,
        adjustmentsTab: state.adjustmentsTab,
      }),
    );
  } catch {}
}

const initial = loadInitial();

const DEFAULT_ASSIGNMENTS: Record<number, string> = {
  0: "preview",
  1: "live",
  2: "stage",
  3: "stream",
  4: "next",
  5: "prev",
  6: "empty",
  7: "empty",
  8: "empty",
  9: "empty",
  10: "empty",
  11: "empty",
  12: "empty",
  13: "empty",
  14: "empty",
  15: "empty",
};

export const usePreviewLayoutStore = create<PreviewLayoutState>((set, get) => ({
  showPreview: initial.showPreview ?? true,
  showLive: initial.showLive ?? true,
  showStage: initial.showStage ?? true,
  hiddenOutputIds: initial.hiddenOutputIds ?? [],
  zoom: typeof initial.zoom === "number" ? Math.min(Math.max(initial.zoom, 50), 150) : 100,
  gridMode: initial.gridMode ?? "2x2",
  cellAssignments: initial.cellAssignments ?? DEFAULT_ASSIGNMENTS,
  previewHeight: initial.previewHeight ?? 360,
  adjustmentsTab: initial.adjustmentsTab ?? "alerts",

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

  toggleOutputVisibility: (id: string) => {
    const list = get().hiddenOutputIds;
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    set({ hiddenOutputIds: next });
    persist({ ...get(), hiddenOutputIds: next });
  },

  isOutputVisible: (id: string) => {
    return !get().hiddenOutputIds.includes(id);
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
    set({ showPreview: true, showLive: true, showStage: true, hiddenOutputIds: [] });
    persist({ ...get(), showPreview: true, showLive: true, showStage: true, hiddenOutputIds: [] });
  },

  setGridMode: (gridMode) => {
    set({ gridMode });
    persist({ ...get(), gridMode });
  },

  setCellAssignment: (index, sourceId) => {
    // Cell 0 is strictly preview
    if (index === 0) return;
    const next = { ...get().cellAssignments, [index]: sourceId };
    set({ cellAssignments: next });
    persist({ ...get(), cellAssignments: next });
  },

  setPreviewHeight: (height) => {
    const clamped = Math.max(160, Math.min(750, height));
    set({ previewHeight: clamped });
    persist({ ...get(), previewHeight: clamped });
  },

  setAdjustmentsTab: (adjustmentsTab) => {
    set({ adjustmentsTab });
    persist({ ...get(), adjustmentsTab });
  },
}));
