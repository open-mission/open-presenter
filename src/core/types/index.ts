export type SlideKind = "lyric" | "scripture" | "custom" | "blank" | "media";

export type MediaKind = "text" | "image" | "folder" | "video";

export interface MediaItem {
  kind: MediaKind;
  title: string;
  text?: string;
  path?: string;
  files?: string[];
  index?: number;
  fit?: "cover" | "contain" | "scale-down" | "fill";
  themeId?: string;
}

/** Referência estruturada a um versículo bíblico (usado por itens de setlist e slides vivos). */
export interface ScriptureRef {
  versionId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  /** Índice (0-based) da parte dentro do versículo dividido. */
  part: number;
  totalParts: number;
}

export interface SlideContent {
  id: string;
  kind: SlideKind;
  title: string;
  lines: string[];
  notes?: string;
  section?: string;
  media?: MediaItem;
  scripture?: ScriptureRef;
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
  prevUp?: SlideContent;
}

export * from "./bible.ts";

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

export type OutputTarget = "public" | "stage" | "stream";

export type OutputMode = "off" | "native" | "web" | "both";

export interface OutputConfig {
  target: OutputTarget;
  mode: OutputMode;
  monitorId: string | null;
  monitorLabel: string | null;
  url: string | null;
  wallpaper?: string | null;
}

export interface OutputRuntime {
  target: OutputTarget;
  open: boolean;
  monitorId: string | null;
}

export interface NdiStatus {
  available: boolean;
  active: boolean;
  streamName: string;
  runtimePath: string | null;
}

export interface ServerStatus {
  running: boolean;
  port: number;
}

export type ClientKind = "output" | "remote";

export interface ConnectedClient {
  id: string;
  ip: string;
  output: OutputTarget | null;
  userAgent: string | null;
  connectedAt: number;
  kind: ClientKind;
}

export type StageAlertLevel = "info" | "warning" | "urgent";

export interface StageMessage {
  id: string;
  text: string;
  level: StageAlertLevel;
  createdAt: string;
}

export interface StageTimer {
  running: boolean;
  elapsedSecs: number;
  startedAtMillis?: number | null;
  countdownSecs?: number;
}

export function stageTimerElapsed(timer: StageTimer, nowMillis: number): number {
  const base = Math.max(0, Math.floor(timer.elapsedSecs));
  if (!timer.running || timer.startedAtMillis == null) return base;
  return base + Math.max(0, Math.floor((nowMillis - timer.startedAtMillis) / 1000));
}

export function stageTimerRemaining(timer: StageTimer, nowMillis: number): number {
  const elapsed = stageTimerElapsed(timer, nowMillis);
  if (!timer.countdownSecs || timer.countdownSecs <= 0) return elapsed;
  return Math.max(0, timer.countdownSecs - elapsed);
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
  album?: string;
  composer?: string;
  songKey?: string;
  bpm?: number;
  sections: SongSection[];
}

export interface SongSummary {
  id: string;
  title: string;
  artist: string;
  composer?: string;
  album?: string;
  songKey?: string;
  bpm?: number;
}

export type LinesPerSlide = "1" | "2" | "keep";
export type WeekStart = "sunday" | "monday";

export interface SongDefaults {
  linesPerSlide: LinesPerSlide;
}

export interface EventItem {
  id: string;
  songId: string | null;
  nextItemId: string | null;
  song: SongSummary | null;
  media: MediaItem | null;
  scripture?: ScriptureRef | null;
}

export interface EventPart {
  id: string;
  title: string;
  items: EventItem[];
  color?: string | null;
  bgColor?: string | null;
}

export interface ServiceEvent {
  id: string;
  title: string;
  eventDate: string;
  wallpaper?: string | null;
  themeGuid?: string | null;
  parts: EventPart[];
}

export interface EventSummary {
  id: string;
  title: string;
  eventDate: string;
  wallpaper?: string | null;
  themeGuid?: string | null;
  itemCount?: number;
}

export const TEMPORARY_EVENT_ID = "__temporary__";
export type SetlistListMode = "event" | "temporary";

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

export interface ImportedMedia {
  path: string;
  name: string;
}

export interface ImportedFolder {
  path: string;
  name: string;
  files: ImportedMedia[];
}

export interface SongGroupConfig {
  id: string;
  name: string;
  color: string;
  shortcut: string;
  typeKey?: SectionType;
}

export interface RemoteSlide {
  index: number;
  label?: string | null;
  sectionType?: SectionType | null;
  content: SlideContent;
}

export interface RemoteItem {
  id: string;
  kind: "song" | "media" | "scripture";
  title: string;
  subtitle?: string | null;
  nextItemId?: string | null;
  slides: RemoteSlide[];
}

export interface RemotePart {
  id: string;
  title: string;
  items: RemoteItem[];
}

export interface RemoteSetlist {
  eventId: string;
  title: string;
  eventDate: string;
  parts: RemotePart[];
  groups?: SongGroupConfig[];
}

export interface RemoteConfig {
  enabled: boolean;
  token: string;
}

export type ImageNodeKind = "folder" | "image";

export interface ImageTreeNode {
  name: string;
  path: string;
  kind: ImageNodeKind;
  url?: string;
  children?: ImageTreeNode[];
}

export type ThemeElementType = "TEXT" | "IMAGE" | "VIDEO" | "RECTANGLE";

export type ThemeAsset = "music" | "bible" | "text" | "rest";

export type ThemeContext = "music" | "bible" | "text" | "rest";

export interface ThemeElement {
  id: string;
  type: ThemeElementType;
  x: number;
  y: number;
  visible: boolean;
  locked: boolean;
  css: Record<string, string>;
  name?: string;
  text?: string;
  src?: string;
  assetTypeVisibility?: string[];
  fill?: string;
  url?: string;
}

export interface ThemePage {
  id: string;
  context: ThemeContext;
  css: Record<string, string>;
  elements: ThemeElement[];
}

export interface SlideTheme {
  guid: string;
  title: string;
  css: Record<string, string>;
  elements: ThemeElement[];
  pages?: ThemePage[];
  category?: "presentation" | "theme" | string;
  createdAt?: string;
  updatedAt?: string;
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
  stream: SlideTheme | null;
}

export function kindToAsset(kind: SlideKind): ThemeAsset | null {
  switch (kind) {
    case "lyric":
      return "music";
    case "scripture":
      return "bible";
    case "custom":
      return "text";
    case "media":
    case "blank":
      return null;
  }
}
