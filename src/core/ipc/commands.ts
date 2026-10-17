import type {
  ConnectedClient,
  EventSummary,
  ImportReport,
  LiveSlide,
  LiveThemes,
  MonitorInfo,
  OnlineLyricHit,
  OutputConfig,
  OutputRuntime,
  OutputTarget,
  ServerStatus,
  ServiceEvent,
  SlideTheme,
  Song,
  SongSection,
  SongSummary,
  StageTimer,
} from "../types";
import { invokeCommand, invokeStrict } from "./tauri";

export async function listMonitors(): Promise<MonitorInfo[]> {
  return (await invokeCommand<MonitorInfo[]>("list_monitors")) ?? [];
}

export async function openOutputWindow(
  target: OutputTarget,
  monitorId: string | null,
  monitorLabel?: string | null,
): Promise<void> {
  await invokeCommand("open_output_window", {
    target,
    monitorId,
    monitorLabel: monitorLabel ?? null,
  });
}

export async function closeOutputWindow(
  target: OutputTarget,
): Promise<void> {
  await invokeCommand("close_output_window", { target });
}

export async function getOutputConfig(
  target: OutputTarget,
): Promise<OutputConfig | null> {
  return invokeCommand<OutputConfig>("get_output_config", { target });
}

export async function setOutputConfig(config: OutputConfig): Promise<void> {
  await invokeCommand("set_output_config", { config });
}

export async function getOutputsState(): Promise<OutputRuntime[]> {
  return (await invokeCommand<OutputRuntime[]>("get_outputs_state")) ?? [];
}

export async function openPreferencesWindow(): Promise<void> {
  await invokeCommand("open_preferences_window");
}

export async function closePreferencesWindow(): Promise<void> {
  await invokeCommand("close_preferences_window");
}

export async function openShortcutsWindow(): Promise<void> {
  await invokeCommand("open_shortcuts_window");
}

export async function closeShortcutsWindow(): Promise<void> {
  await invokeCommand("close_shortcuts_window");
}

export async function openThemeEditor(guid?: string): Promise<void> {
  await invokeCommand("open_theme_editor", { guid: guid ?? null });
}

export async function publishSlide(slide: LiveSlide): Promise<void> {
  await invokeCommand("go_live", { slide });
}

export async function setBlackout(blackout: boolean): Promise<void> {
  await invokeCommand("set_blackout", { blackout });
}

export async function fetchLiveSlide(): Promise<LiveSlide | null> {
  return invokeCommand<LiveSlide>("get_live_slide");
}

export async function setLiveThemes(themes: LiveThemes): Promise<void> {
  await invokeCommand("set_live_themes", { themes });
}

export async function fetchLiveThemes(): Promise<LiveThemes | null> {
  return invokeCommand<LiveThemes>("get_live_themes");
}

export async function fetchServerHost(): Promise<string> {
  return (await invokeCommand<string>("get_server_host")) ?? "localhost";
}

export async function timerStart(): Promise<StageTimer | null> {
  return invokeCommand<StageTimer>("timer_start");
}

export async function timerPause(): Promise<StageTimer | null> {
  return invokeCommand<StageTimer>("timer_pause");
}

export async function timerReset(): Promise<StageTimer | null> {
  return invokeCommand<StageTimer>("timer_reset");
}

export async function fetchStageTimer(): Promise<StageTimer | null> {
  return invokeCommand<StageTimer>("get_stage_timer");
}

export async function fetchPublicWallpaper(): Promise<string | null> {
  return invokeCommand<string | null>("get_public_wallpaper");
}

export async function getServerStatus(): Promise<ServerStatus | null> {
  return invokeCommand<ServerStatus>("get_server_status");
}

export async function setServerPort(port: number): Promise<ServerStatus> {
  return invokeStrict<ServerStatus>("set_server_port", { port });
}

export async function stopServer(): Promise<ServerStatus> {
  return invokeStrict<ServerStatus>("stop_server");
}

export async function startServer(): Promise<ServerStatus> {
  return invokeStrict<ServerStatus>("start_server");
}

export async function getConnectedClients(): Promise<ConnectedClient[]> {
  return (await invokeCommand<ConnectedClient[]>("get_connected_clients")) ?? [];
}

export async function listSongs(query?: string): Promise<SongSummary[]> {
  return invokeStrict<SongSummary[]>("list_songs", { query: query ?? null });
}

export async function getSong(id: string): Promise<Song | null> {
  return invokeStrict<Song | null>("get_song", { id });
}

export async function saveSong(song: Song): Promise<void> {
  await invokeStrict("save_song", { song });
}

export async function deleteSong(id: string): Promise<void> {
  await invokeStrict("delete_song", { id });
}

export async function importHolyrics(path: string): Promise<ImportReport> {
  return invokeStrict<ImportReport>("import_holyrics", { path });
}

export async function searchLyricsOnline(
  query: string,
): Promise<OnlineLyricHit[]> {
  return invokeStrict<OnlineLyricHit[]>("search_lyrics_online", { query });
}

export async function fetchOnlineLyrics(
  id: string,
  trackName: string,
  artistName: string,
): Promise<Song> {
  return invokeStrict<Song>("fetch_online_lyrics", {
    id,
    trackName,
    artistName,
  });
}

export async function parseLyrics(text: string): Promise<SongSection[]> {
  return invokeStrict<SongSection[]>("parse_lyrics", { text });
}

export async function lyricsToText(sections: SongSection[]): Promise<string> {
  return invokeStrict<string>("lyrics_to_text", { sections });
}

export async function listEvents(): Promise<EventSummary[]> {
  return invokeStrict<EventSummary[]>("list_events");
}

export async function getEvent(id: string): Promise<ServiceEvent | null> {
  return invokeStrict<ServiceEvent | null>("get_event", { id });
}

export async function createEvent(event: ServiceEvent): Promise<void> {
  await invokeStrict("create_event", { event });
}

export async function saveEvent(event: ServiceEvent): Promise<void> {
  await invokeStrict("save_event", { event });
}

export async function deleteEvent(id: string): Promise<void> {
  await invokeStrict("delete_event", { id });
}

export async function listThemes(): Promise<SlideTheme[]> {
  return invokeStrict<SlideTheme[]>("list_themes");
}

export async function getTheme(guid: string): Promise<SlideTheme | null> {
  return invokeStrict<SlideTheme | null>("get_theme", { guid });
}

export async function saveTheme(theme: SlideTheme): Promise<void> {
  await invokeStrict("save_theme", { theme });
}

export async function deleteTheme(guid: string): Promise<void> {
  await invokeStrict("delete_theme", { guid });
}

export async function saveThemeMedia(
  guid: string,
  filename: string,
  contents: number[],
): Promise<string> {
  return invokeStrict<string>("save_theme_media", { guid, filename, contents });
}
