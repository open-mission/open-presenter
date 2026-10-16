import type { SlideTheme } from "@/core/types";

export const DEFAULT_MUSIC_THEME_GUID = "a7c799c6-7f78-47ff-b0bb-28ffd657c343";

export const DEFAULT_STAGE_THEME_GUID = "279597e6-9811-497a-8e32-9e5dd189e7d0";

export const DEFAULT_MUSIC_THEME: SlideTheme = {
  guid: DEFAULT_MUSIC_THEME_GUID,
  title: "Louvor Padrão",
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
      },
      text: "{letra}",
    },
  ],
};

export const DEFAULT_STAGE_THEME: SlideTheme = {
  guid: DEFAULT_STAGE_THEME_GUID,
  title: "Retorno Padrão",
  css: {
    background: "#000000",
  },
  elements: [
    {
      id: "titulo",
      type: "TEXT",
      x: 5,
      y: 4,
      visible: true,
      locked: false,
      css: {
        top: "4%",
        left: "5%",
        width: "90%",
        textAlign: "center",
        fontSize: "32px",
        fontWeight: "600",
        color: "#fbbf24",
      },
      text: "{titulo}",
    },
    {
      id: "letra",
      type: "TEXT",
      x: 5,
      y: 25,
      visible: true,
      locked: false,
      css: {
        top: "25%",
        left: "5%",
        width: "90%",
        textAlign: "center",
        fontSize: "48px",
        fontWeight: "700",
        lineHeight: "1.3",
        color: "#ffffff",
      },
      text: "{letra}",
    },
    {
      id: "proximo",
      type: "TEXT",
      x: 5,
      y: 72,
      visible: true,
      locked: false,
      css: {
        top: "72%",
        left: "5%",
        width: "90%",
        textAlign: "center",
        fontSize: "24px",
        color: "#a1a1aa",
      },
      text: "PRÓXIMO {nextVerse}",
    },
    {
      id: "relogio",
      type: "TEXT",
      x: 80,
      y: 88,
      visible: true,
      locked: false,
      css: {
        top: "88%",
        left: "80%",
        width: "15%",
        textAlign: "right",
        fontSize: "28px",
        fontWeight: "700",
        color: "#fbbf24",
      },
      text: "{HH:MM}",
    },
  ],
};
