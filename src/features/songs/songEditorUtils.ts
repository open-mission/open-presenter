import { SECTION_LABEL } from "@/core/config/lyrics";
import type { SectionType } from "@/core/types";

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

/**
 * Atribui ou atualiza o rótulo de uma seção no texto da música pelo índice do slide gerado.
 */
export function assignSectionLabel(
  rawText: string,
  targetSlideIndex: number,
  newType: SectionType | null,
): string {
  const lines = rawText.split("\n");

  const sections: {
    lines: string[];
    hasContent: boolean;
    headerLineIdx: number;
  }[] = [];

  let currentSectionLines: string[] = [];
  let currentHeaderIdx = -1;
  let currentHasContent = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("##")) {
      if (
        currentSectionLines.length > 0 &&
        (currentHasContent || currentHeaderIdx !== -1)
      ) {
        sections.push({
          lines: currentSectionLines,
          hasContent: currentHasContent,
          headerLineIdx: currentHeaderIdx,
        });
        currentSectionLines = [];
        currentHeaderIdx = -1;
        currentHasContent = false;
      }
      currentHeaderIdx = currentSectionLines.length;
      currentSectionLines.push(rawLine);
      continue;
    }

    if (trimmed === "") {
      if (currentHasContent) {
        sections.push({
          lines: currentSectionLines,
          hasContent: currentHasContent,
          headerLineIdx: currentHeaderIdx,
        });
        currentSectionLines = [];
        currentHeaderIdx = -1;
        currentHasContent = false;
      } else {
        currentSectionLines.push(rawLine);
      }
      continue;
    }

    if (trimmed.startsWith("//")) {
      currentSectionLines.push(rawLine);
      continue;
    }

    currentHasContent = true;
    currentSectionLines.push(rawLine);
  }

  if (currentSectionLines.length > 0) {
    sections.push({
      lines: currentSectionLines,
      hasContent: currentHasContent,
      headerLineIdx: currentHeaderIdx,
    });
  }

  const slideSections = sections.filter((s) => s.hasContent);
  if (targetSlideIndex < 0 || targetSlideIndex >= slideSections.length) {
    return rawText;
  }

  const targetSec = slideSections[targetSlideIndex];
  const newHeader = newType ? `## ${SECTION_LABEL[newType]}` : null;

  if (targetSec.headerLineIdx !== -1) {
    if (newHeader) {
      targetSec.lines[targetSec.headerLineIdx] = newHeader;
    } else {
      targetSec.lines.splice(targetSec.headerLineIdx, 1);
    }
  } else if (newHeader) {
    let insertAt = 0;
    while (
      insertAt < targetSec.lines.length &&
      targetSec.lines[insertAt].trim() === ""
    ) {
      insertAt++;
    }
    targetSec.lines.splice(insertAt, 0, newHeader);
  }

  return sections
    .map((s) => s.lines.join("\n").trim())
    .filter((s) => s.length > 0)
    .join("\n\n");
}
