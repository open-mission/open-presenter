export interface PreviewGridConfig {
  minLevel: number;
  maxLevel: number;
  defaultLevel: number;
  minWidths: Record<number, number>;
}

export const BIBLE_PREVIEW_GRID: PreviewGridConfig = {
  minLevel: 1,
  maxLevel: 3,
  defaultLevel: 2,
  minWidths: { 1: 520, 2: 340, 3: 230 },
};

export const SETLIST_PREVIEW_GRID: PreviewGridConfig = {
  minLevel: 1,
  maxLevel: 5,
  defaultLevel: 4,
  minWidths: { 1: 260, 2: 170, 3: 114, 4: 84, 5: 62 },
};

export const SONG_PREVIEW_GRID: PreviewGridConfig = {
  minLevel: 1,
  maxLevel: 3,
  defaultLevel: 2,
  minWidths: { 1: 200, 2: 120, 3: 88 },
};

export const MEDIA_PREVIEW_GRID: PreviewGridConfig = {
  minLevel: 1,
  maxLevel: 4,
  defaultLevel: 2,
  minWidths: { 1: 200, 2: 120, 3: 88, 4: 66 },
};

export function clampPreviewLevel(config: PreviewGridConfig, level: number): number {
  return Math.min(config.maxLevel, Math.max(config.minLevel, Math.round(level)));
}

export function previewGridMinWidth(config: PreviewGridConfig, level: number): number {
  return config.minWidths[clampPreviewLevel(config, level)];
}

export function previewGridStyle(config: PreviewGridConfig, level: number): { gridTemplateColumns: string } {
  return {
    gridTemplateColumns: `repeat(auto-fit, minmax(${previewGridMinWidth(config, level)}px, 1fr))`,
  };
}
