import type {
  EventSummary,
  ImportReport,
  LiveSlide,
  MonitorInfo,
  OnlineLyricHit,
  OutputTarget,
  ServiceEvent,
  SlideTheme,
  Song,
  SongSection,
  SongSummary,
} from "../types";
import { invokeCommand, invokeStrict } from "./tauri";

export async function listMonitors(): Promise<MonitorInfo[]> {
  return (await invokeCommand<MonitorInfo[]>("list_monitors")) ?? [];
}

export async function openOutputWindow(
  target: OutputTarget,
  monitorId: string | null,
): Promise<void> {
  await invokeCommand("open_output_window", { target, monitorId });
}

export async function closeOutputWindow(
  target: OutputTarget,
): Promise<void> {
  await invokeCommand("close_output_window", { target });
}

export async function openPreferencesWindow(): Promise<void> {
  await invokeCommand("open_preferences_window");
}

export async function closePreferencesWindow(): Promise<void> {
  await invokeCommand("close_preferences_window");
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

export async function fetchServerHost(): Promise<string> {
  return (await invokeCommand<string>("get_server_host")) ?? "localhost";
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
