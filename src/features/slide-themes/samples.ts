import type { ThemeAsset } from "@/core/types";

export const SAMPLES: Record<
  ThemeAsset,
  { label: string; props: Record<string, string> }
> = {
  music: {
    label: "Música / Palco",
    props: {
      titulo: "Santo, Santo, Santo",
      artista: "Hinário",
      letra: "Santo, santo, santo\nDeus Todo-Poderoso",
      nextVerse: "Digno de louvor",
      nextFirstLine: "Digno de louvor",
      nextFull: "Digno de louvor\nPara sempre amém",
      secao: "Refrão",
      currentIndex: "0",
      totalCount: "3",
      hora: "10:30",
      "HH:MM": "10:30",
      clock: "10:30",
      cronometro: "04:15",
      crono: "04:15",
      timer: "15:00",
      regressivo: "15:00",
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
      hora: "10:30",
      "HH:MM": "10:30",
      cronometro: "04:15",
      timer: "15:00",
    },
  },
  text: {
    label: "Texto",
    props: {
      titulo: "Aviso",
      texto: "Culto de domingo às 19h",
      currentIndex: "0",
      totalCount: "1",
      hora: "10:30",
      "HH:MM": "10:30",
      cronometro: "04:15",
      timer: "15:00",
    },
  },
};

export const VARIABLE_KEYS: Record<ThemeAsset, string[]> = {
  music: [
    "titulo",
    "artista",
    "letra",
    "nextVerse",
    "nextFirstLine",
    "nextFull",
    "secao",
    "currentIndex",
    "totalCount",
    "hora",
    "HH:MM",
    "cronometro",
    "timer",
  ],
  bible: [
    "titulo",
    "verso",
    "livro",
    "capitulo",
    "versiculo",
    "versao",
    "nextVerse",
    "hora",
    "HH:MM",
    "cronometro",
    "timer",
  ],
  text: [
    "titulo",
    "texto",
    "currentIndex",
    "totalCount",
    "hora",
    "HH:MM",
    "cronometro",
    "timer",
  ],
};

export const SAMPLE_ASSETS: ThemeAsset[] = ["music", "bible", "text"];
