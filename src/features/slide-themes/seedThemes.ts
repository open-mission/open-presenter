import type { SlideTheme } from "@/core/types";

export const DEFAULT_MUSIC_THEME_GUID = "a7c799c6-7f78-47ff-b0bb-28ffd657c343";

export const DEFAULT_STAGE_THEME_GUID = "279597e6-9811-497a-8e32-9e5dd189e7d0";

export const DEFAULT_PUBLIC_THEME_GUID = "5f0c3a2e-9d4b-4e8a-8c1f-2a7b6d9e4c10";

export const DEFAULT_TEXT_THEME_GUID = "c8d198e7-8b89-48ff-b1cc-39eed768d454";

export const DEFAULT_SCRIPTURE_THEME_GUID = "b9e299f7-8b89-49ff-a1cc-49eed768d777";

export const DEFAULT_SCRIPTURE_THEME: SlideTheme = {
  guid: DEFAULT_SCRIPTURE_THEME_GUID,
  title: "Bíblia Padrão",
  category: "theme",
  css: {
    background:
      "radial-gradient(circle at 50% 120%, #1e1b4b 0%, #09090b 60%, #000000 100%)",
  },
  elements: [
    {
      id: "titulo",
      type: "TEXT",
      x: 10,
      y: 6,
      visible: true,
      locked: false,
      css: {
        top: "6%",
        left: "10%",
        width: "80%",
        height: "8%",
        textAlign: "center",
        fontSize: "28px",
        fontWeight: "700",
        letterSpacing: "3px",
        textTransform: "uppercase",
        color: "#38bdf8",
        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
      },
      text: "{title}",
    },
    {
      id: "versiculo",
      type: "TEXT",
      x: 8,
      y: 16,
      visible: true,
      locked: false,
      css: {
        top: "16%",
        left: "8%",
        width: "84%",
        height: "76%",
        textAlign: "center",
        fontSize: "52px",
        fontWeight: "600",
        lineHeight: "1.35",
        color: "#ffffff",
        textShadow: "0 2px 14px rgba(0,0,0,0.9)",
        whiteSpace: "pre-wrap",
        autoShrink: "true",
      },
      text: "{verse}",
    },
  ],
};

export const DEFAULT_TEXT_THEME: SlideTheme = {
  guid: DEFAULT_TEXT_THEME_GUID,
  title: "Texto Padrão",
  category: "theme",
  css: {
    background: "#000000",
  },
  elements: [
    {
      id: "titulo",
      type: "TEXT",
      x: 10,
      y: 8,
      visible: true,
      locked: false,
      css: {
        top: "8%",
        left: "10%",
        width: "80%",
        textAlign: "center",
        fontSize: "28px",
        fontWeight: "600",
        letterSpacing: "3px",
        textTransform: "uppercase",
        color: "#a1a1aa",
      },
      text: "{titulo}",
    },
    {
      id: "texto",
      type: "TEXT",
      x: 10,
      y: 26,
      visible: true,
      locked: false,
      css: {
        top: "26%",
        left: "10%",
        width: "80%",
        textAlign: "center",
        fontSize: "52px",
        fontWeight: "600",
        lineHeight: "1.35",
        color: "#ffffff",
        textShadow: "0 2px 10px rgba(0,0,0,0.8)",
        whiteSpace: "pre-wrap",
        autoShrink: "true",
      },
      text: "{texto}",
    },
  ],
};

export const DEFAULT_MUSIC_THEME: SlideTheme = {
  guid: DEFAULT_MUSIC_THEME_GUID,
  title: "Louvor Padrão",
  category: "theme",
  css: {
    background:
      "radial-gradient(circle at 50% 120%, #7c2d12 0%, #1c0a00 55%, #000000 100%)",
  },
  elements: [
    {
      id: "titulo",
      type: "TEXT",
      x: 10,
      y: 6,
      visible: true,
      locked: false,
      css: {
        top: "6%",
        left: "10%",
        width: "80%",
        textAlign: "center",
        fontSize: "28px",
        fontWeight: "600",
        letterSpacing: "4px",
        textTransform: "uppercase",
        color: "#d6d3d1",
      },
      text: "{titulo}",
    },
    {
      id: "letra",
      type: "TEXT",
      x: 10,
      y: 30,
      visible: true,
      locked: false,
      css: {
        top: "30%",
        left: "10%",
        width: "80%",
        textAlign: "center",
        fontSize: "56px",
        fontWeight: "700",
        lineHeight: "1.25",
        color: "#ffffff",
        textShadow: "0 2px 12px rgba(0,0,0,0.8)",
        whiteSpace: "pre-wrap",
        autoShrink: "true",
      },
      text: "{letra}",
    },
  ],
};

function themePage(
  id: string,
  context: "music" | "bible" | "text",
  source: SlideTheme,
) {
  return {
    id,
    context,
    css: { ...source.css },
    elements: structuredClone(source.elements),
  };
}

export const DEFAULT_PUBLIC_THEME: SlideTheme = {
  guid: DEFAULT_PUBLIC_THEME_GUID,
  title: "Tema Padrão",
  category: "theme",
  css: {},
  elements: [],
  pages: [
    themePage("default-music", "music", DEFAULT_MUSIC_THEME),
    themePage("default-bible", "bible", DEFAULT_SCRIPTURE_THEME),
    themePage("default-text", "text", DEFAULT_TEXT_THEME),
  ],
};

export const DEFAULT_STAGE_THEME: SlideTheme = {
  guid: DEFAULT_STAGE_THEME_GUID,
  title: "Retorno Padrão",
  category: "stage",
  css: {
    background: "#000000",
  },
  elements: [
    {
      id: "relogio",
      type: "TEXT",
      x: 60,
      y: 30,
      visible: true,
      locked: false,
      css: {
        top: "30px",
        left: "60px",
        width: "400px",
        height: "70px",
        textAlign: "left",
        fontSize: "42px",
        fontWeight: "700",
        color: "#fbbf24",
      },
      text: "{hora}",
    },
    {
      id: "cronometro",
      type: "TEXT",
      x: 1460,
      y: 30,
      visible: true,
      locked: false,
      css: {
        top: "30px",
        left: "1460px",
        width: "400px",
        height: "70px",
        textAlign: "right",
        fontSize: "42px",
        fontWeight: "700",
        color: "#38bdf8",
      },
      text: "{cronometro}",
    },
    {
      id: "titulo",
      type: "TEXT",
      x: 160,
      y: 110,
      visible: true,
      locked: false,
      css: {
        top: "110px",
        left: "160px",
        width: "1600px",
        height: "40px",
        textAlign: "center",
        fontSize: "24px",
        fontWeight: "600",
        letterSpacing: "3px",
        textTransform: "uppercase",
        color: "#a1a1aa",
      },
      text: "{titulo}",
    },
    {
      id: "letra",
      type: "TEXT",
      x: 120,
      y: 180,
      visible: true,
      locked: false,
      css: {
        top: "180px",
        left: "120px",
        width: "1680px",
        height: "620px",
        textAlign: "center",
        fontSize: "64px",
        fontWeight: "700",
        lineHeight: "1.25",
        color: "#ffffff",
        autoShrink: "true",
      },
      text: "{letra}",
    },
    {
      id: "proximo",
      type: "TEXT",
      x: 120,
      y: 830,
      visible: true,
      locked: false,
      css: {
        top: "830px",
        left: "120px",
        width: "1680px",
        height: "210px",
        textAlign: "center",
        fontSize: "32px",
        fontWeight: "500",
        lineHeight: "1.3",
        color: "#94a3b8",
        borderTopWidth: "1px",
        borderTopColor: "rgba(255,255,255,0.15)",
        borderTopStyle: "solid",
        paddingTop: "16px",
        autoShrink: "true",
      },
      text: "PRÓXIMO: {nextVerse}",
    },
  ],
};

export const DEFAULT_STAGE_REST_THEME_GUID = "38e928f7-9912-40ee-b0cc-49ffc779d8e1";

export const DEFAULT_STAGE_REST_THEME: SlideTheme = {
  guid: DEFAULT_STAGE_REST_THEME_GUID,
  title: "Retorno - Descanso / Relógio",
  category: "stage",
  css: {
    background: "#080808",
  },
  elements: [
    {
      id: "relogio-descanso",
      type: "TEXT",
      x: 10,
      y: 24,
      visible: true,
      locked: false,
      css: {
        top: "24%",
        left: "10%",
        width: "80%",
        height: "32%",
        textAlign: "center",
        fontSize: "130px",
        fontWeight: "800",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        color: "#ffffff",
        textShadow: "0 4px 24px rgba(0,0,0,0.9)",
        autoShrink: "true",
      },
      text: "{hora}",
    },
    {
      id: "cronometro-descanso",
      type: "TEXT",
      x: 15,
      y: 58,
      visible: true,
      locked: false,
      css: {
        top: "58%",
        left: "15%",
        width: "70%",
        height: "18%",
        textAlign: "center",
        fontSize: "56px",
        fontWeight: "700",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        color: "#38bdf8",
        textShadow: "0 2px 14px rgba(0,0,0,0.8)",
        autoShrink: "true",
      },
      text: "{cronometro}",
    },
    {
      id: "status-descanso",
      type: "TEXT",
      x: 20,
      y: 84,
      visible: true,
      locked: false,
      css: {
        top: "84%",
        left: "20%",
        width: "60%",
        height: "8%",
        textAlign: "center",
        fontSize: "22px",
        fontWeight: "600",
        color: "#71717a",
        textTransform: "uppercase",
        letterSpacing: "4px",
        autoShrink: "true",
      },
      text: "Open Presenter · Palco em Espera",
    },
  ],
};

export function createEmptyStudioTheme(
  title = "Nova Apresentação",
  bgGradient?: string,
): SlideTheme {
  const now = new Date().toISOString();
  return {
    guid: crypto.randomUUID(),
    title,
    category: "presentation",
    createdAt: now,
    updatedAt: now,
    css: {
      background:
        bgGradient ||
        "linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
    },
    elements: [
      {
        id: "titulo",
        type: "TEXT",
        x: 10,
        y: 20,
        visible: true,
        locked: false,
        css: {
          top: "20%",
          left: "10%",
          width: "80%",
          height: "22%",
          textAlign: "center",
          fontSize: "64px",
          fontWeight: "800",
          letterSpacing: "2px",
          color: "#ffffff",
          textShadow: "0 4px 16px rgba(0,0,0,0.8)",
          autoShrink: "true",
        },
        text: title,
      },
      {
        id: "subtitulo",
        type: "TEXT",
        x: 15,
        y: 48,
        visible: true,
        locked: false,
        css: {
          top: "48%",
          left: "15%",
          width: "70%",
          height: "26%",
          textAlign: "center",
          fontSize: "36px",
          fontWeight: "500",
          lineHeight: "1.4",
          color: "#cbd5e1",
          textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          whiteSpace: "pre-wrap",
          autoShrink: "true",
        },
        text: "Digite aqui a mensagem, comunicado ou versículo deste slide.",
      },
    ],
  };
}
