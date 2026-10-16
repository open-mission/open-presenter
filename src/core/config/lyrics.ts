import type { SectionType } from "../types";

export const SECTION_LABEL: Record<SectionType, string> = {
  verse: "Verso",
  "pre-chorus": "Pré-refrão",
  chorus: "Refrão",
  bridge: "Ponte",
  intro: "Introdução",
  outro: "Final",
  instrumental: "Instrumental",
  tag: "Tag",
  ending: "Encerramento",
};

export const SECTION_COLOR: Record<SectionType, string> = {
  verse: "#3b82f6",
  "pre-chorus": "#06b6d4",
  chorus: "#ef4444",
  bridge: "#a855f7",
  intro: "#22c55e",
  outro: "#f97316",
  instrumental: "#6b7280",
  tag: "#ec4899",
  ending: "#eab308",
};
