import type { ThemeAsset } from "@/core/types";

export const SAMPLES: Record<
  ThemeAsset,
  { label: string; props: Record<string, string> }
> = {
  music: {
    label: "Música",
    props: {
      titulo: "Santo, Santo, Santo",
      artista: "Hinário",
      letra: "Santo, santo, santo\nDeus Todo-Poderoso",
      nextVerse: "Digno de louvor",
      secao: "Refrão",
      currentIndex: "0",
      totalCount: "3",
      "HH:MM": "10:30",
    },
  },
  bible: {
    label: "Bíblia",
    props: {
      titulo: "João 1:1",
      verso: "No princípio era o Verbo, e o Verbo estava com Deus",
      livro: "João",
      capitulo: "1",
      versiculo: "1",
      versao: "ACF",
      nextVerse: "",
      "HH:MM": "10:30",
    },
  },
  text: {
    label: "Texto",
    props: {
      titulo: "Aviso",
      texto: "Culto de domingo às 19h",
      currentIndex: "0",
      totalCount: "1",
      "HH:MM": "10:30",
    },
  },
};

export const VARIABLE_KEYS: Record<ThemeAsset, string[]> = {
  music: [
    "titulo",
    "artista",
    "letra",
    "nextVerse",
    "secao",
    "currentIndex",
    "totalCount",
    "HH:MM",
  ],
  bible: [
    "titulo",
    "verso",
    "livro",
    "capitulo",
    "versiculo",
    "versao",
    "nextVerse",
    "HH:MM",
  ],
  text: ["titulo", "texto", "currentIndex", "totalCount", "HH:MM"],
};

export const SAMPLE_ASSETS: ThemeAsset[] = ["music", "bible", "text"];
