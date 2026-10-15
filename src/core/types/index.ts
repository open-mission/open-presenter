export type SlideKind = "lyric" | "scripture" | "custom" | "blank";

export interface SlideContent {
  id: string;
  kind: SlideKind;
  title: string;
  lines: string[];
  notes?: string;
}

export type BackgroundKind = "color" | "image" | "video" | "css" | "isf";

export interface BackgroundLayer {
  id: string;
  kind: BackgroundKind;
  value: string;
}

export interface LiveSlide {
  content: SlideContent;
  background: BackgroundLayer;
  blackout: boolean;
  cleared: boolean;
  updatedAt: string;
}

export interface MonitorInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimary: boolean;
  scaleFactor: number;
}

export type OutputTarget = "public" | "stage";

export type OutputMode = "off" | "native" | "web" | "both";

export interface OutputConfig {
  target: OutputTarget;
  mode: OutputMode;
  monitorId: string | null;
  url: string | null;
}

export type StageAlertLevel = "info" | "warning" | "urgent";

export interface StageMessage {
  id: string;
  text: string;
  level: StageAlertLevel;
  createdAt: string;
}

export interface SyncEnvelope<T> {
  channel: string;
  payload: T;
  version: 1;
}
