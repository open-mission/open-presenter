export const SETLIST_WIDTH_MIN = 240;
export const SETLIST_WIDTH_MAX = 480;
export const SLIDES_WIDTH_MIN = 280;
export const SLIDES_WIDTH_MAX = 640;
export const SETLIST_WIDTH_DEFAULT = 320;
export const SLIDES_WIDTH_DEFAULT = 384;
export const MONITORS_MIN_WIDTH = 240;
export const RESIZE_HANDLES_WIDTH = 12;

export interface PanelLayout {
  setlistWidth: number;
  slidesWidth: number;
  monitorsVisible: boolean;
}

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
  setlistWidth: SETLIST_WIDTH_DEFAULT,
  slidesWidth: SLIDES_WIDTH_DEFAULT,
  monitorsVisible: true,
};

export function clampPanelWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface PanelWidths {
  setlistWidth: number;
  slidesWidth: number;
}

/**
 * `availableWidth` é a largura do `<main>` já descontado o trilho de temas.
 * Reserva o mínimo dos monitores e dos dois divisores; encolhe o centro
 * primeiro e a programação depois.
 */
export function fitPanelLayout(
  layout: PanelWidths,
  availableWidth: number,
): PanelWidths {
  const maxColumns = Math.max(
    SETLIST_WIDTH_MIN + SLIDES_WIDTH_MIN,
    availableWidth - MONITORS_MIN_WIDTH - RESIZE_HANDLES_WIDTH,
  );
  let setlistWidth = clampPanelWidth(
    layout.setlistWidth,
    SETLIST_WIDTH_MIN,
    SETLIST_WIDTH_MAX,
  );
  let slidesWidth = clampPanelWidth(
    layout.slidesWidth,
    SLIDES_WIDTH_MIN,
    SLIDES_WIDTH_MAX,
  );

  if (setlistWidth + slidesWidth <= maxColumns) {
    return { setlistWidth, slidesWidth };
  }

  slidesWidth = Math.max(SLIDES_WIDTH_MIN, maxColumns - setlistWidth);
  if (setlistWidth + slidesWidth > maxColumns) {
    setlistWidth = Math.max(SETLIST_WIDTH_MIN, maxColumns - slidesWidth);
  }

  return { setlistWidth, slidesWidth };
}

export function parsePanelLayout(input: unknown): PanelLayout {
  if (input === null || typeof input !== "object") return DEFAULT_PANEL_LAYOUT;
  const record = input as Record<string, unknown>;
  return {
    setlistWidth:
      typeof record.setlistWidth === "number"
        ? clampPanelWidth(record.setlistWidth, SETLIST_WIDTH_MIN, SETLIST_WIDTH_MAX)
        : SETLIST_WIDTH_DEFAULT,
    slidesWidth:
      typeof record.slidesWidth === "number"
        ? clampPanelWidth(record.slidesWidth, SLIDES_WIDTH_MIN, SLIDES_WIDTH_MAX)
        : SLIDES_WIDTH_DEFAULT,
    monitorsVisible:
      typeof record.monitorsVisible === "boolean"
        ? record.monitorsVisible
        : true,
  };
}