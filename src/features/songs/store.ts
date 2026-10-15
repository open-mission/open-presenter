import { create } from "zustand";
import {
  deleteSong as deleteSongCommand,
  getSong,
  listSongs,
  saveSong,
} from "@/core/ipc/commands";
import type { Song, SongSummary } from "@/core/types";

interface SongsState {
  songs: SongSummary[];
  query: string;
  loading: boolean;
  error: string | null;
  editorSong: Song | null;
  load(): Promise<void>;
  setQuery(query: string): void;
  startNewSong(): void;
  editSong(id: string): Promise<void>;
  closeEditor(): void;
  saveEditor(song: Song): Promise<boolean>;
  deleteSong(id: string): Promise<void>;
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
    return true;
  },

  deleteSong: async (id) => {
    try {
      await deleteSongCommand(id);
    } catch (err) {
      set({ error: errorMessage(err) });
      return;
    }
    set((state) => ({
      editorSong: state.editorSong?.id === id ? null : state.editorSong,
    }));
    await get().load();
  },
}));
