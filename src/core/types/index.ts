export type SlideKind = "lyric" | "scripture" | "custom" | "blank";

export interface SlideContent {
  id: string;
  kind: SlideKind;
  title: string;
  lines: string[];
  notes?: string;
  section?: string;
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
  nextUp?: SlideContent;
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

export type SectionType =
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "bridge"
  | "intro"
  | "outro"
  | "instrumental"
  | "tag"
  | "ending";

export interface SongSection {
  sectionType: SectionType | null;
  lines: string[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  sections: SongSection[];
}

export interface SongSummary {
  id: string;
  title: string;
  artist: string;
}

export interface EventItem {
  id: string;
  songId: string;
  nextItemId: string | null;
  song: SongSummary | null;
}

export interface EventPart {
  id: string;
  title: string;
  items: EventItem[];
}

export interface ServiceEvent {
  id: string;
  title: string;
  eventDate: string;
  parts: EventPart[];
}

export interface EventSummary {
  id: string;
  title: string;
  eventDate: string;
}

export interface OnlineLyricHit {
  trackName: string;
  artistName: string;
  albumName: string | null;
}

export interface ImportSkip {
  title: string;
  reason: string;
}

export interface ImportReport {
  imported: string[];
  skipped: ImportSkip[];
  errors: string[];
}

export type ThemeElementType = "TEXT" | "IMAGE" | "VIDEO" | "RECTANGLE";

export type ThemeAsset = "music" | "bible" | "text";

export interface ThemeElement {
  id: string;
  type: ThemeElementType;
  x: number;
  y: number;
  visible: boolean;
  locked: boolean;
  css: Record<string, string>;
  text?: string;
  src?: string;
  assetTypeVisibility?: string[];
  fill?: string;
  url?: string;
}

export interface SlideTheme {
  guid: string;
  title: string;
  css: Record<string, string>;
  elements: ThemeElement[];
}

export interface ThemeBinding {
  target: OutputTarget;
  asset: SlideKind;
  themeGuid: string;
}

/**
 * Temas resolvidos pelo operador e transmitidos a todas as saídas.
 * O admin decide o tema de cada saída; as saídas (janela nativa e web)
 * apenas consomem o resultado, sem depender de localStorage ou IPC.
 */
export interface LiveThemes {
  public: SlideTheme | null;
  stage: SlideTheme | null;
}

export function kindToAsset(kind: SlideKind): ThemeAsset | null {
  switch (kind) {
    case "lyric":
      return "music";
    case "scripture":
      return "bible";
    case "custom":
      return "text";
    case "blank":
      return null;
  }
}
