import type {
  BibleBook,
  BibleSearchResult,
  BibleVerse,
  BibleVerseCompare,
  BibleVersion,
  CommunicationAlert,
  ConnectedClient,
  DisplayOutput,
  DisplaysSettings,
  EventSummary,
  ImageTreeNode,
  ImportedFolder,
  ImportedMedia,
  ImportReport,
  LiveOutputPlans,
  LiveSlide,
  MonitorInfo,
  NdiStatus,
  NdiInputStatus,
  OnlineLyricHit,
  OutputConfig,
  OutputRuntime,
  OutputTarget,
  RemoteConfig,
  RemoteSetlist,
  ServerStatus,
  ServiceEvent,
  SlideTheme,
  Song,
  SongDefaults,
  SongSection,
  SongSummary,
  StageTimer,
} from "../types";
import { invokeCommand, invokeStrict, isTauri } from "./tauri";

export async function showMainWindow(): Promise<void> {
  await invokeCommand("show_main_window");
}

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

export async function openCommunicationWindow(): Promise<void> {
  await invokeCommand("open_communication_window");
}

export async function closeCommunicationWindow(): Promise<void> {
  await invokeCommand("close_communication_window");
}

export async function openAgendaWindow(): Promise<void> {
  if (isTauri()) {
    await invokeCommand("open_agenda_window");
  } else {
    window.open("/#/agenda", "_blank", "width=1080,height=720");
  }
}

export async function closeAgendaWindow(): Promise<void> {
  await invokeCommand("close_agenda_window");
}

export async function openThemeEditor(guid?: string): Promise<void> {
  if (isTauri()) {
    await invokeCommand("open_theme_editor", { guid: guid ?? null });
  } else {
    const query = guid ? `?guid=${encodeURIComponent(guid)}` : "";
    window.open(`/#/theme-editor${query}`, "_blank");
  }
}

export async function closeThemeEditor(): Promise<void> {
  await invokeCommand("close_theme_editor");
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

export async function setLiveOutputPlans(plans: LiveOutputPlans): Promise<void> {
  await invokeCommand("set_live_output_plans", { plans });
}

export async function fetchLiveOutputPlans(): Promise<LiveOutputPlans | null> {
  return invokeCommand<LiveOutputPlans>("get_live_output_plans");
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

export async function timerSetCountdown(secs: number): Promise<StageTimer | null> {
  return invokeCommand<StageTimer>("timer_set_countdown", { secs });
}

export async function fetchStageTimer(): Promise<StageTimer | null> {
  return invokeCommand<StageTimer>("get_stage_timer");
}

export async function fetchPublicWallpaper(): Promise<string | null> {
  return invokeCommand<string | null>("get_public_wallpaper");
}

export async function sendStageMessage(
  message: CommunicationAlert,
): Promise<void> {
  if (isTauri()) {
    await invokeCommand("send_stage_message", { message });
  } else {
    try {
      await fetch("/api/v1/stage-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    } catch (e) {
      console.error("[commands] Falha ao enviar mensagem de palco:", e);
    }
  }
}

export async function clearStageMessage(): Promise<void> {
  if (isTauri()) {
    await invokeCommand("clear_stage_message");
  } else {
    try {
      await fetch("/api/v1/stage-message", { method: "DELETE" });
    } catch (e) {
      console.error("[commands] Falha ao limpar mensagem de palco:", e);
    }
  }
}

export async function fetchStageMessage(): Promise<CommunicationAlert | null> {
  if (isTauri()) {
    return invokeCommand<CommunicationAlert | null>("get_stage_message");
  } else {
    try {
      const res = await fetch("/api/v1/stage-message");
      if (!res.ok) return null;
      return (await res.json()) as CommunicationAlert | null;
    } catch {
      return null;
    }
  }
}

export async function setPublicWallpaper(wallpaper: string | null): Promise<void> {
  await invokeCommand("set_public_wallpaper", { wallpaper });
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

export async function getCloseToTray(): Promise<boolean> {
  return (await invokeCommand<boolean>("get_close_to_tray")) ?? false;
}

export async function setCloseToTray(enabled: boolean): Promise<void> {
  await invokeStrict("set_close_to_tray", { enabled });
}

export async function getStartMaximized(): Promise<boolean> {
  return (await invokeCommand<boolean>("get_start_maximized")) ?? true;
}

export async function setStartMaximized(enabled: boolean): Promise<void> {
  await invokeStrict("set_start_maximized", { enabled });
}

export async function getConnectedClients(): Promise<ConnectedClient[]> {
  return (await invokeCommand<ConnectedClient[]>("get_connected_clients")) ?? [];
}

export async function getRemoteClients(): Promise<ConnectedClient[]> {
  return (await invokeCommand<ConnectedClient[]>("get_remote_clients")) ?? [];
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

export async function openSongEditor(songId?: string): Promise<void> {
  await invokeStrict("open_song_editor", { songId: songId ?? null });
}

export async function closeSongEditor(): Promise<void> {
  await invokeStrict("close_song_editor");
}

export async function importHolyrics(paths: string[]): Promise<ImportReport> {
  return invokeStrict<ImportReport>("import_holyrics", { paths });
}

export async function searchLyricsOnline(
  query: string,
  provider?: string | null,
): Promise<OnlineLyricHit[]> {
  if (isTauri()) {
    return invokeStrict<OnlineLyricHit[]>("search_lyrics_online", { query, provider });
  }

  // Web fallback com retry para contornar sobrecarga transitória do LRCLIB (503/429)
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
  let res: Response | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      res = await fetch(url);
      if (res.ok) break;
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        continue;
      }
      break;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  if (!res || !res.ok) {
    if (res?.status === 429) {
      throw new Error("O LRCLIB limitou as consultas — aguarde alguns segundos e tente de novo.");
    }
    if (res && res.status >= 500) {
      throw new Error("O LRCLIB está indisponível no momento — tente de novo em instantes.");
    }
    throw new Error("Falha ao consultar o LRCLIB — verifique a conexão.");
  }

  const items: Array<{
    trackName?: string;
    artistName?: string;
    albumName?: string | null;
    plainLyrics?: string | null;
  }> = await res.json();

  return items
    .filter((item) => Boolean(item.plainLyrics) && Boolean(item.trackName))
    .map((item) => ({
      trackName: item.trackName!,
      artistName: item.artistName ?? "",
      albumName: item.albumName ?? null,
    }));
}

export async function fetchOnlineLyrics(
  id: string,
  trackName: string,
  artistName: string,
  provider?: string | null,
  providerId?: string | null,
): Promise<Song> {
  if (isTauri()) {
    return invokeStrict<Song>("fetch_online_lyrics", {
      id,
      trackName,
      artistName,
      provider,
      providerId,
    });
  }

  const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
  let res: Response | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      res = await fetch(url);
      if (res.ok || res.status === 404) break;
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        continue;
      }
      break;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  if (!res || !res.ok) {
    if (res?.status === 404) {
      throw new Error("Letra não encontrada no LRCLIB.");
    }
    if (res?.status === 429) {
      throw new Error("O LRCLIB limitou as consultas — aguarde alguns segundos.");
    }
    throw new Error("Falha ao baixar letra do LRCLIB.");
  }

  const data = await res.json();
  const plainLyrics: string = data.plainLyrics || "";
  const blocks = plainLyrics
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sections: SongSection[] = blocks.map((b) => ({
    sectionType: null,
    lines: b.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
  }));

  return {
    id,
    title: data.trackName || trackName,
    artist: data.artistName || artistName,
    sections,
  };
}

export async function parseLyrics(text: string): Promise<SongSection[]> {
  return invokeStrict<SongSection[]>("parse_lyrics", { text });
}

export async function lyricsToText(sections: SongSection[]): Promise<string> {
  return invokeStrict<string>("lyrics_to_text", { sections });
}

export async function getSongDefaults(): Promise<SongDefaults> {
  return invokeStrict<SongDefaults>("get_song_defaults");
}

export async function setSongDefaults(
  defaults: SongDefaults,
): Promise<SongDefaults> {
  return invokeStrict<SongDefaults>("set_song_defaults", { defaults });
}

export async function listEvents(): Promise<EventSummary[]> {
  return invokeStrict<EventSummary[]>("list_events");
}

export async function getEvent(id: string): Promise<ServiceEvent | null> {
  return invokeStrict<ServiceEvent | null>("get_event", { id });
}

export async function getTemporaryEvent(): Promise<ServiceEvent> {
  return invokeStrict<ServiceEvent>("get_temporary_event");
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

export async function getActiveEventId(): Promise<string | null> {
  return invokeStrict<string | null>("get_active_event_id");
}

export async function setActiveEventId(id: string | null): Promise<void> {
  await invokeStrict("set_active_event_id", { id });
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

export async function importMediaFile(
  path: string,
  kind: "image" | "video",
): Promise<ImportedMedia> {
  return invokeStrict<ImportedMedia>("import_media_file", { path, kind });
}

export async function importMediaFolder(path: string): Promise<ImportedFolder> {
  return invokeStrict<ImportedFolder>("import_media_folder", { path });
}

export async function openMediaLibrary(): Promise<void> {
  await invokeStrict("open_media_library");
}

export async function listImageLibrary(): Promise<ImageTreeNode[]> {
  return invokeStrict<ImageTreeNode[]>("list_image_library");
}

export async function listBackgroundsLibrary(): Promise<ImageTreeNode[]> {
  return invokeStrict<ImageTreeNode[]>("list_backgrounds_library");
}

export async function listVideoLibrary(): Promise<ImageTreeNode[]> {
  return invokeStrict<ImageTreeNode[]>("list_video_library");
}

export async function listAudioLibrary(): Promise<ImageTreeNode[]> {
  return invokeStrict<ImageTreeNode[]>("list_audio_library");
}

export async function getSetting(key: string): Promise<string | null> {
  return (await invokeCommand<string | null>("get_setting", { key })) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await invokeStrict("set_setting", { key, value });
}

export async function createMediaFolder(
  library: string,
  parentPath: string,
  name: string,
): Promise<string> {
  return invokeStrict<string>("create_media_folder", {
    library,
    parentPath,
    name,
  });
}

export async function importMediaFiles(
  library: string,
  subfolder: string | null,
  files: string[],
): Promise<ImportedMedia[]> {
  return invokeStrict<ImportedMedia[]>("import_media_files", {
    library,
    subfolder,
    files,
  });
}

export async function openLibraryFolder(library: string): Promise<void> {
  await invokeStrict("open_library_folder", { library });
}

export async function importImagesFolder(path: string): Promise<string> {
  return invokeStrict<string>("import_images_folder", { path });
}

export async function openImagesFolder(): Promise<void> {
  await invokeStrict("open_images_folder");
}

export async function getRemoteConfig(): Promise<RemoteConfig> {
  return invokeStrict<RemoteConfig>("get_remote_config");
}

export async function setRemoteToken(token: string): Promise<RemoteConfig> {
  return invokeStrict<RemoteConfig>("set_remote_token", { token });
}

export async function setRemoteEnabled(enabled: boolean): Promise<RemoteConfig> {
  return invokeStrict<RemoteConfig>("set_remote_enabled", { enabled });
}

export async function setRemoteSetlist(
  setlist: RemoteSetlist | null,
): Promise<void> {
  await invokeStrict("set_remote_setlist", { setlist });
}

export async function listBibleVersions(): Promise<BibleVersion[]> {
  return (await invokeStrict<BibleVersion[]>("list_bible_versions")) ?? [];
}

export async function importBible(
  sourcePath: string,
  customName?: string,
): Promise<BibleVersion> {
  return invokeStrict<BibleVersion>("import_bible", {
    sourcePath,
    customName: customName ?? null,
  });
}

export async function getBibleBooks(versionId: string): Promise<BibleBook[]> {
  return (await invokeStrict<BibleBook[]>("get_bible_books", { versionId })) ?? [];
}

export async function getBibleChapter(
  versionId: string,
  bookId: number,
  chapter: number,
): Promise<BibleVerse[]> {
  return (
    (await invokeStrict<BibleVerse[]>("get_bible_chapter", {
      versionId,
      bookId,
      chapter,
    })) ?? []
  );
}

export async function searchBibleVerses(
  versionId: string,
  query: string,
  limit?: number,
): Promise<BibleSearchResult[]> {
  return (
    (await invokeStrict<BibleSearchResult[]>("search_bible_verses", {
      versionId,
      query,
      limit: limit ?? null,
    })) ?? []
  );
}

export async function compareBibleVerse(
  bookId: number,
  chapter: number,
  verse: number,
  versionIds: string[],
): Promise<BibleVerseCompare[]> {
  return (
    (await invokeStrict<BibleVerseCompare[]>("compare_bible_verse", {
      bookId,
      chapter,
      verse,
      versionIds,
    })) ?? []
  );
}

export async function deleteBible(versionId: string): Promise<void> {
  await invokeStrict("delete_bible", { versionId });
}

export async function getNdiStatus(): Promise<NdiStatus | null> {
  return invokeCommand<NdiStatus>("get_ndi_status");
}

export async function setNdiActive(active: boolean): Promise<NdiStatus | null> {
  return invokeCommand<NdiStatus>("set_ndi_active", { active });
}

export async function listNdiSources(): Promise<string[]> {
  return (await invokeStrict<string[]>("list_ndi_sources")) ?? [];
}

export async function getNdiInputStatus(): Promise<NdiInputStatus | null> {
  return invokeCommand<NdiInputStatus>("get_ndi_input_status");
}

export async function startNdiInput(source: string): Promise<NdiInputStatus | null> {
  return invokeCommand<NdiInputStatus>("start_ndi_input", { source });
}

export async function stopNdiInput(): Promise<NdiInputStatus | null> {
  return invokeCommand<NdiInputStatus>("stop_ndi_input");
}

export async function openDisplaysWindow(): Promise<void> {
  await invokeCommand("open_displays_window");
}

export async function closeDisplaysWindow(): Promise<void> {
  await invokeCommand("close_displays_window");
}

export async function getDisplayOutputs(): Promise<DisplayOutput[]> {
  return (await invokeCommand<DisplayOutput[]>("get_display_outputs")) ?? [];
}

export async function saveDisplayOutputs(outputs: DisplayOutput[]): Promise<void> {
  await invokeStrict("save_display_outputs", { outputs });
}

export async function getDisplaysSettings(): Promise<DisplaysSettings | null> {
  return invokeCommand<DisplaysSettings>("get_displays_settings");
}

export async function saveDisplaysSettings(settings: DisplaysSettings): Promise<void> {
  await invokeStrict("save_displays_settings", { settings });
}

export async function identifyDisplays(active: boolean): Promise<void> {
  await invokeCommand("identify_displays", { active });
}

export async function openNativeOutput(
  outputId: string,
  monitorId: string | null,
  monitorLabel: string | null,
  route: string,
  title: string,
): Promise<void> {
  await invokeCommand("open_native_output", {
    outputId,
    monitorId,
    monitorLabel,
    route,
    title,
  });
}

export async function closeNativeOutput(outputId: string): Promise<void> {
  await invokeCommand("close_native_output", { outputId });
}


