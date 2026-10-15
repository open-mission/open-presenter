import { create } from "zustand";

export interface Verse {
  id: string;
  reference: string;
  text: string;
}

interface ScripturesState {
  verses: Verse[];
  query: string;
  setQuery(query: string): void;
}

const SEED_VERSES: Verse[] = [
  {
    id: "verse-jo-3-16",
    reference: "João 3:16",
    text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.",
  },
  {
    id: "verse-sl-23-1",
    reference: "Salmos 23:1",
    text: "O Senhor é o meu pastor; nada me faltará.",
  },
  {
    id: "verse-fp-4-13",
    reference: "Filipenses 4:13",
    text: "Posso todas as coisas naquele que me fortalece.",
  },
];

export const useScripturesStore = create<ScripturesState>((set) => ({
  verses: SEED_VERSES,
  query: "",
  setQuery: (query) => set({ query }),
}));

export function searchVerses(verses: Verse[], query: string): Verse[] {
  const q = query.trim().toLowerCase();
  if (!q) return verses;
  return verses.filter(
    (v) =>
      v.reference.toLowerCase().includes(q) ||
      v.text.toLowerCase().includes(q),
  );
}
