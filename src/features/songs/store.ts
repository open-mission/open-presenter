import { create } from "zustand";

export interface Song {
  id: string;
  title: string;
  artist: string;
  key?: string;
  lyrics: string[];
}

interface SongsState {
  songs: Song[];
  query: string;
  setQuery(query: string): void;
}

const SEED_SONGS: Song[] = [
  {
    id: "song-grandes-coisas",
    title: "Grandes Coisas",
    artist: "Placeholder",
    key: "G",
    lyrics: ["Grandes coisas", "estão por vir", "grandes coisas", "vão acontecer"],
  },
  {
    id: "song-sejam-bem-vindos",
    title: "Sejam Bem-Vindos",
    artist: "Placeholder",
    lyrics: ["Sejam bem-vindos", "à casa do Senhor", "com alegria", "vamos celebrar"],
  },
];

export const useSongsStore = create<SongsState>((set) => ({
  songs: SEED_SONGS,
  query: "",
  setQuery: (query) => set({ query }),
}));

export function searchSongs(songs: Song[], query: string): Song[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.lyrics.some((line) => line.toLowerCase().includes(q)),
  );
}
