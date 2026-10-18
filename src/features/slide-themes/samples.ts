import type { ThemeAsset } from "@/core/types";

export const SAMPLES: Record<
  ThemeAsset,
  { label: string; props: Record<string, string> }
> = {
  music: {
    label: "Música",
    props: {
      // English (Canonical)
      title: "Santo, Santo, Santo",
      artist: "Hinário",
      lyrics: "Santo, santo, santo\nDeus Todo-Poderoso",
      next_verse: "Digno de louvor",
      next_up: "Digno de louvor",
      next_first_line: "Digno de louvor",
      next_full: "Digno de louvor\nPara sempre amém",
      section: "Refrão",
      current_slide: "1",
      total_slides: "3",
      clock: "10:30",
      time: "10:30",
      stopwatch: "04:15",
      timer: "15:00",
      countdown: "15:00",
      // Legacy aliases (pt-BR)
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
      cronometro: "04:15",
      crono: "04:15",
      regressivo: "15:00",
    },
  },
  bible: {
    label: "Bíblia",
    props: {
      // English (Canonical)
      title: "João 1:1",
      verse: "No princípio era o Verbo, e o Verbo estava com Deus",
      book: "João",
      chapter: "1",
      verse_number: "1",
      version: "ACF",
      next_verse: "",
      clock: "10:30",
      stopwatch: "04:15",
      timer: "15:00",
      // Legacy aliases (pt-BR)
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
    },
  },
  text: {
    label: "Texto / Aviso",
    props: {
      // English (Canonical)
      title: "Aviso",
      text: "Culto de domingo às 19h",
      content: "Culto de domingo às 19h",
      current_slide: "1",
      total_slides: "1",
      clock: "10:30",
      stopwatch: "04:15",
      timer: "15:00",
      // Legacy aliases (pt-BR)
      titulo: "Aviso",
      texto: "Culto de domingo às 19h",
      currentIndex: "0",
      totalCount: "1",
      hora: "10:30",
      "HH:MM": "10:30",
      cronometro: "04:15",
    },
  },
};

export const VARIABLE_KEYS: Record<ThemeAsset, string[]> = {
  music: [
    "title",
    "lyrics",
    "next_verse",
    "next_up",
    "next_first_line",
    "next_full",
    "artist",
    "section",
    "current_slide",
    "total_slides",
    "clock",
    "stopwatch",
    "timer",
    "countdown",
  ],
  bible: [
    "title",
    "verse",
    "book",
    "chapter",
    "verse_number",
    "version",
    "next_verse",
    "clock",
    "stopwatch",
    "timer",
  ],
  text: [
    "title",
    "text",
    "current_slide",
    "total_slides",
    "clock",
    "stopwatch",
    "timer",
  ],
};

export const SAMPLE_ASSETS: ThemeAsset[] = ["music", "bible", "text"];
