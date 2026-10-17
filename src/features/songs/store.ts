import { create } from "zustand";
import { toast } from "sonner";
import {
  deleteSong as deleteSongCommand,
  fetchOnlineLyrics,
  getSong,
  importHolyrics,
  listSongs,
  saveSong,
  searchLyricsOnline,
} from "@/core/ipc/commands";
import type {
  ImportReport,
  OnlineLyricHit,
  Song,
  SongSummary,
} from "@/core/types";
import { useSetlistStore } from "@/features/events-setlists/store";
import { pickHolyricsFile } from "./services/files";

interface SongsState {
  songs: SongSummary[];
  query: string;
  loading: boolean;
  error: string | null;
  editorSong: Song | null;
  importReport: ImportReport | null;
  onlineOpen: boolean;
  onlineQuery: string;
  onlineResults: OnlineLyricHit[];
  onlineLoading: boolean;
  onlineError: string | null;
  load(): Promise<void>;
  setQuery(query: string): void;
  startNewSong(): void;
  editSong(id: string): Promise<void>;
  closeEditor(): void;
  saveEditor(song: Song): Promise<boolean>;
  deleteSong(id: string): Promise<boolean>;
  startHolyricsImport(): Promise<void>;
  closeImportReport(): void;
  openOnlineSearch(): void;
  closeOnlineSearch(): void;
  setOnlineQuery(query: string): void;
  searchOnline(): Promise<void>;
  importOnlineHit(hit: OnlineLyricHit): Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useSongsStore = create<SongsState>((set, get) => ({
  songs: [],
  query: "",
  loading: false,
  error: null,
  editorSong: null,
  importReport: null,
  onlineOpen: false,
  onlineQuery: "",
  onlineResults: [],
  onlineLoading: false,
  onlineError: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const songs = await listSongs(get().query);
      set({ songs, loading: false });
    } catch (err) {
      set({ loading: false, error: errorMessage(err) });
    }
  },

  setQuery: (query) => set({ query }),

  startNewSong: () =>
    set({
      editorSong: {
        id: crypto.randomUUID(),
        title: "",
        artist: "",
        sections: [{ sectionType: null, lines: [""] }],
      },
    }),

  editSong: async (id) => {
    try {
      const song = await getSong(id);
      if (song === null) {
        set({ error: "Música não encontrada." });
        return;
      }
      set({ editorSong: song });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  closeEditor: () => set({ editorSong: null }),

  saveEditor: async (song) => {
    try {
      await saveSong(song);
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
    set({ editorSong: null });
    await get().load();
    toast.success(`Música "${song.title}" salva!`);
    useSetlistStore
      .getState()
      .invalidateSong(song.id, {
        id: song.id,
        title: song.title,
        artist: song.artist,
      });
    return true;
  },

  deleteSong: async (id) => {
    try {
      await deleteSongCommand(id);
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
    set((state) => ({
      editorSong: state.editorSong?.id === id ? null : state.editorSong,
    }));
    await get().load();
    toast.info("Música excluída.");
    useSetlistStore.getState().invalidateSong(id, null);
    return true;
  },

  startHolyricsImport: async () => {
    set({ error: null });
    try {
      const path = await pickHolyricsFile();
      if (path === null) return;
      const importReport = await importHolyrics(path);
      set({ importReport });
      await get().load();
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  closeImportReport: () => set({ importReport: null }),

  openOnlineSearch: () =>
    set({ onlineOpen: true, onlineError: null, onlineLoading: false }),

  closeOnlineSearch: () => set({ onlineOpen: false }),

  setOnlineQuery: (onlineQuery) => set({ onlineQuery }),

  searchOnline: async () => {
    const query = get().onlineQuery.trim();
    if (query === "") {
      set({ onlineError: "Digite o nome da música ou do artista." });
      return;
    }
    if (get().onlineLoading) return;
    set({ onlineLoading: true, onlineError: null });
    try {
      const onlineResults = await searchLyricsOnline(query);
      set({
        onlineLoading: false,
        onlineResults,
        onlineError:
          onlineResults.length === 0 ? "Nenhuma letra encontrada." : null,
      });
    } catch (err) {
      set({ onlineLoading: false, onlineError: errorMessage(err) });
    }
  },

  importOnlineHit: async (hit) => {
    set({ onlineError: null });
    try {
      const song = await fetchOnlineLyrics(
        crypto.randomUUID(),
        hit.trackName,
        hit.artistName,
      );
      set({ editorSong: song, onlineOpen: false });
      toast.success(`Letra de "${hit.trackName}" importada!`);
    } catch (err) {
      set({ onlineError: errorMessage(err) });
    }
  },
}));
