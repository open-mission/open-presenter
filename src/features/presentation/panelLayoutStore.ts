import { create } from "zustand";
import {
  clampPanelWidth,
  parsePanelLayout,
  SETLIST_WIDTH_DEFAULT,
  SETLIST_WIDTH_MAX,
  SETLIST_WIDTH_MIN,
  SLIDES_WIDTH_DEFAULT,
  SLIDES_WIDTH_MAX,
  SLIDES_WIDTH_MIN,
  type PanelLayout,
} from "@/core/lib/panelLayout";

const STORAGE_KEY = "open_presenter_panel_layout";

function loadInitial(): PanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parsePanelLayout(raw ? JSON.parse(raw) : null);
  } catch {
    return parsePanelLayout(null);
  }
}

function persist(layout: PanelLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // localStorage indisponível: mantém só a sessão
  }
}

interface PanelLayoutState extends PanelLayout {
  setSetlistWidth(width: number): void;
  setSlidesWidth(width: number): void;
  reset(): void;
  setMonitorsVisible(visible: boolean): void;
  toggleMonitors(): void;
}

export const usePanelLayoutStore = create<PanelLayoutState>((set, get) => {
  const initial = loadInitial();
  const update = (patch: Partial<PanelLayout>) => {
    const next = { ...get(), ...patch };
    const layout: PanelLayout = {
      setlistWidth: clampPanelWidth(
        next.setlistWidth,
        SETLIST_WIDTH_MIN,
        SETLIST_WIDTH_MAX,
      ),
      slidesWidth: clampPanelWidth(
        next.slidesWidth,
        SLIDES_WIDTH_MIN,
        SLIDES_WIDTH_MAX,
      ),
      monitorsVisible: next.monitorsVisible,
    };
    persist(layout);
    set(layout);
  };

  return {
    ...initial,
    setSetlistWidth: (width) => update({ setlistWidth: width }),
    setSlidesWidth: (width) => update({ slidesWidth: width }),
    reset: () =>
      update({
        setlistWidth: SETLIST_WIDTH_DEFAULT,
        slidesWidth: SLIDES_WIDTH_DEFAULT,
        monitorsVisible: true,
      }),
    setMonitorsVisible: (monitorsVisible) => update({ monitorsVisible }),
    toggleMonitors: () =>
      update({ monitorsVisible: !get().monitorsVisible }),
  };
});