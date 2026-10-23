import { SECTION_LABEL } from "../../core/config/lyrics.ts";
import type { SectionType } from "../../core/types";

export const MUSICAL_KEYS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
  "Cm",
  "C#m",
  "Dm",
  "D#m",
  "Ebm",
  "Em",
  "Fm",
  "F#m",
  "Gm",
  "G#m",
  "Am",
  "Bbm",
  "Bm",
] as const;

export const SECTION_OPTIONS: { type: SectionType; label: string }[] = [
  { type: "verse", label: "Verso" },
  { type: "chorus", label: "Refrão" },
  { type: "pre-chorus", label: "Pré-refrão" },
  { type: "bridge", label: "Ponte" },
  { type: "intro", label: "Introdução" },
  { type: "instrumental", label: "Instrumental" },
  { type: "outro", label: "Final" },
  { type: "tag", label: "Tag" },
  { type: "ending", label: "Encerramento" },
];

export interface SyntaxToken {
  type: "text" | "chord";
  value: string;
}

export function tokenizeLyricsLine(line: string): SyntaxToken[] {
  const chordRegex = /\[([A-Ga-g][#b]?[^\]]*)\]/g;
  const tokens: SyntaxToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = chordRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: line.slice(lastIndex, match.index),
      });
    }
    tokens.push({
      type: "chord",
      value: match[0],
    });
    lastIndex = chordRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({
      type: "text",
      value: line.slice(lastIndex),
    });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: line }];
}

interface RawSongSection {
  lines: string[];
  hasContent: boolean;
  headerLineIdx: number;
  isEmpty: boolean;
}

function flushRawSection(
  sections: RawSongSection[],
  lines: string[],
): void {
  if (lines.length === 0) return;
  sections.push({
    lines,
    hasContent: lines.some(
      (line) =>
        line.trim() !== "" &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("##"),
    ),
    headerLineIdx: lines.findIndex((line) => line.trim().startsWith("##")),
    isEmpty: false,
  });
}

function parseRawSongSections(rawText: string): RawSongSection[] {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const input = normalized.split("\n");
  const sections: RawSongSection[] = [];
  let lines: string[] = [];
  let blankRun = 0;
  let canBlank = false;

  for (const rawLine of input) {
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      if (lines.length === 0) {
        if (canBlank) blankRun++;
        continue;
      }
      if (lines.every((line) => line.trim().startsWith("//"))) {
        blankRun = 0;
        canBlank = false;
        continue;
      }
      flushRawSection(sections, lines);
      lines = [];
      blankRun = 1;
      canBlank = true;
      continue;
    }

    if (trimmed.startsWith("##")) {
      lines = lines.filter((line) => !line.trim().startsWith("//"));
      flushRawSection(sections, lines);
      if (blankRun >= 2 && canBlank) {
        sections.push({
          lines: [],
          hasContent: false,
          headerLineIdx: -1,
          isEmpty: true,
        });
      }
      lines = [rawLine];
      blankRun = 0;
      canBlank = false;
      continue;
    }

    if (!trimmed.startsWith("//") && blankRun >= 2 && canBlank) {
      sections.push({
        lines: [],
        hasContent: false,
        headerLineIdx: -1,
        isEmpty: true,
      });
    }

    lines.push(rawLine);
    blankRun = 0;
    canBlank = false;
  }

  flushRawSection(sections, lines);
  return sections;
}

function serializeRawSongSections(sections: RawSongSection[]): string {
  const blocks: string[] = [];
  let pendingEmpty = false;
  let wroteBlock = false;

  for (const section of sections) {
    if (section.isEmpty) {
      if (wroteBlock) pendingEmpty = true;
      continue;
    }
    const lines = section.lines.filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    if (wroteBlock) {
      blocks.push(pendingEmpty ? "\n\n\n" : "\n\n");
    }
    blocks.push(lines.join("\n"));
    wroteBlock = true;
    pendingEmpty = false;
  }

  return blocks.join("");
}

/**
 * Atribui ou atualiza o rótulo de uma seção no texto da música pelo índice do slide gerado.
 */
export function assignSectionLabel(
  rawText: string,
  targetSlideIndex: number,
  newType: SectionType | null,
): string {
  const sections = parseRawSongSections(rawText);
  const slideSections = sections.filter(
    (section) => section.hasContent || section.isEmpty,
  );
  if (targetSlideIndex < 0 || targetSlideIndex >= slideSections.length) {
    return rawText;
  }

  const targetSec = slideSections[targetSlideIndex];
  if (targetSec.isEmpty) return rawText;

  const newHeader = newType ? `## ${SECTION_LABEL[newType]}` : null;

  if (targetSec.headerLineIdx !== -1) {
    if (newHeader) {
      targetSec.lines[targetSec.headerLineIdx] = newHeader;
    } else {
      targetSec.lines.splice(targetSec.headerLineIdx, 1);
      targetSec.headerLineIdx = -1;
    }
  } else if (newHeader) {
    targetSec.lines.unshift(newHeader);
    targetSec.headerLineIdx = 0;
  }

  return serializeRawSongSections(sections);
}
