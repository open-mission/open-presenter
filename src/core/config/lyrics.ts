import type { SectionType } from "../types";

export const SECTION_TYPES: { type: SectionType; label: string; color: string }[] = [
  { type: "verse", label: "Verso", color: "#3b82f6" },
  { type: "pre-chorus", label: "Pré-refrão", color: "#06b6d4" },
  { type: "chorus", label: "Refrão", color: "#ef4444" },
  { type: "bridge", label: "Ponte", color: "#a855f7" },
  { type: "intro", label: "Introdução", color: "#22c55e" },
  { type: "outro", label: "Final", color: "#f97316" },
  { type: "instrumental", label: "Instrumental", color: "#6b7280" },
  { type: "tag", label: "Tag", color: "#ec4899" },
  { type: "ending", label: "Encerramento", color: "#eab308" },
];

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
