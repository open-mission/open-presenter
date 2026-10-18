import { SECTION_LABEL } from "../config/lyrics.ts";
import type { SectionType, SlideContent, Song, SongSection } from "../types";

export interface RunnerSlide {
  index: number;
  label: string | null;
  sectionType: SectionType | null;
  slide: SlideContent;
}

export function computeSectionLabels(sections: SongSection[]): (string | null)[] {
  const totals = sections.reduce<Partial<Record<SectionType, number>>>((acc, section) => {
    const type = section.sectionType;
    if (type) {
      acc[type] = (acc[type] ?? 0) + 1;
    }
    return acc;
  }, {});

  const counters: Partial<Record<SectionType, number>> = {};

  return sections.map((section) => {
    const type = section.sectionType;
    if (!type) {
      return null;
    }
    const label = SECTION_LABEL[type];
    if (type === "chorus" || (totals[type] ?? 0) <= 1) {
      return label;
    }
    counters[type] = (counters[type] ?? 0) + 1;
    return `${label} ${counters[type]}`;
  });
}

const CHORD_TOKEN_REGEX =
  /^(?:[A-G][#b]?(?:m|min|maj|M|dim|aug|sus|add|[0-9\+\-\(\)\^])*)+(?:\/[A-G0-9][#b]?)?$/;

export function isChordToken(token: string): boolean {
  const clean = token.replace(/^[([{\]]+|[)\]},.;]+$/g, "");
  if (!clean) return false;
  if (clean === "%" || clean === "N.C." || clean === "NC") return true;
  return CHORD_TOKEN_REGEX.test(clean);
}

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("##")) {
    return false;
  }
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;
  return tokens.every(isChordToken);
}

export function isCommentLine(line: string): boolean {
  return line.trim().startsWith("//");
}

export function cleanCommentText(line: string): string {
  return line.trim().replace(/^\/\/\s*/, "").trim();
}

export function stripChords(line: string): string {
  return line.replace(/\[[A-Ga-g][#b]?[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Filtra linhas para a projeção pública (telão):
 * - Remove linhas inteiras de cifras (ex: "G   G7   C")
 * - Remove linhas de comentários (ex: "// Introdução")
 * - Remove cifras inline entre colchetes (ex: "[G]")
 */
export function cleanPublicLines(lines: string[]): string[] {
  return lines
    .filter((line) => !isCommentLine(line) && !isChordLine(line))
    .map(stripChords)
    .filter((line) => line.trim().length > 0);
}

export function splitInlineChords(line: string): { chordLine: string; lyricLine: string } | null {
  const bracketRegex = /\[([A-G][#b]?[^\]]*)\]/g;
  if (!bracketRegex.test(line)) return null;
  bracketRegex.lastIndex = 0;

  let chordLine = "";
  let lyricLine = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(line)) !== null) {
    const textChunk = line.slice(lastIndex, match.index);
    lyricLine += textChunk;
    while (chordLine.length < lyricLine.length) {
      chordLine += " ";
    }
    const chord = match[1];
    chordLine += chord;
    lastIndex = bracketRegex.lastIndex;
  }

  lyricLine += line.slice(lastIndex);
  return { chordLine, lyricLine };
}

function escapeHtml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formata os versos para a tela de retorno (stage display):
 * - Comentários ganham badges visuais chamativos (📌 Nota)
 * - Cifras são exibidas em ciano (#38bdf8), fonte monoespaçada e alinhadas acima da letra com white-space: pre
 * - Letra em branco (#ffffff)
 * - Container com display:inline-block e text-align:left para manter estrofe centralizada na tela 16:9
 *   sem nunca desalinhar as cifras dos seus versos!
 */
export function formatStageLyrics(lines: string[]): string {
  if (lines.length === 0) return "";

  const comments: string[] = [];
  const bodyLines: string[] = [];

  for (const raw of lines) {
    if (isCommentLine(raw)) {
      const comment = cleanCommentText(raw);
      if (comment) comments.push(comment);
    } else if (raw.trim().length > 0) {
      bodyLines.push(raw);
    }
  }

  let hasChords = false;
  for (const line of bodyLines) {
    if (isChordLine(line) || /\[[A-G][#b]?[^\]]*\]/.test(line)) {
      hasChords = true;
      break;
    }
  }

  const commentHtml = comments
    .map(
      (c) =>
        `<div style="margin-bottom:12px;display:flex;justify-content:center;"><span style="display:inline-flex;align-items:center;gap:6px;background:rgba(234,179,8,0.22);color:#facc15;border:1px solid rgba(234,179,8,0.45);border-radius:8px;padding:4px 16px;font-size:0.55em;font-weight:700;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0.5px;text-transform:uppercase;">📌 ${escapeHtml(
          c,
        )}</span></div>`,
    )
    .join("");

  if (bodyLines.length === 0) {
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;">${commentHtml}</div>`;
  }

  if (!hasChords) {
    const textLines = bodyLines
      .map(
        (line) =>
          `<div style="font-weight:700;line-height:1.25;margin-bottom:8px;">${escapeHtml(
            line,
          )}</div>`,
      )
      .join("");
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;">${commentHtml}${textLines}</div>`;
  }

  const pairs: { chordLine?: string; lyricLine?: string }[] = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (isChordLine(line)) {
      const nextLine = bodyLines[i + 1];
      if (nextLine && !isChordLine(nextLine)) {
        pairs.push({ chordLine: line, lyricLine: nextLine });
        i += 2;
      } else {
        pairs.push({ chordLine: line });
        i++;
      }
    } else {
      const inline = splitInlineChords(line);
      if (inline) {
        pairs.push({ chordLine: inline.chordLine, lyricLine: inline.lyricLine });
      } else {
        pairs.push({ lyricLine: line });
      }
      i++;
    }
  }

  const pairsHtml = pairs
    .map((pair) => {
      let block = '<div style="display:flex;flex-direction:column;margin-bottom:14px;">';
      if (pair.chordLine !== undefined) {
        block += `<div style="white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#38bdf8;font-weight:700;font-size:0.85em;line-height:1.2;letter-spacing:0px;">${escapeHtml(
          pair.chordLine,
        )}</div>`;
      }
      if (pair.lyricLine !== undefined) {
        block += `<div style="white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#ffffff;font-weight:600;font-size:0.92em;line-height:1.25;letter-spacing:0px;">${escapeHtml(
          pair.lyricLine,
        )}</div>`;
      }
      block += "</div>";
      return block;
    })
    .join("");

  return `<div style="display:flex;flex-direction:column;align-items:center;width:100%;">${commentHtml}<div style="display:inline-block;text-align:left;max-width:100%;">${pairsHtml}</div></div>`;
}

export function buildSongSlides(song: Song): RunnerSlide[] {
  const labels = computeSectionLabels(song.sections);

  return song.sections.map((section, index) => {
    const label = labels[index] ?? null;
    return {
      index,
      label,
      sectionType: section.sectionType,
      slide: {
        id: `${song.id}#${index}`,
        kind: "lyric",
        title: song.title,
        lines: section.lines,
        section: label ?? undefined,
      },
    };
  });
}

export interface SlideGroup {
  startIndex: number;
  indices: number[];
  label: string | null;
  sectionType: SectionType | null;
}

export function computeSlideGroups(slides: RunnerSlide[]): SlideGroup[] {
  const groups: SlideGroup[] = [];

  for (const slide of slides) {
    const current = groups[groups.length - 1];
    if (slide.label !== null || current === undefined) {
      groups.push({
        startIndex: slide.index,
        indices: [slide.index],
        label: slide.label,
        sectionType: slide.sectionType,
      });
      continue;
    }
    current.indices.push(slide.index);
  }

  return groups;
}

export function splitSection(section: SongSection, linesPerSlide: 1 | 2): SongSection[] {
  if (section.lines.length <= linesPerSlide) {
    return [section];
  }

  const fragments: SongSection[] = [];
  for (let i = 0; i < section.lines.length; i += linesPerSlide) {
    fragments.push({
      sectionType: fragments.length === 0 ? section.sectionType : null,
      lines: section.lines.slice(i, i + linesPerSlide),
    });
  }
  return fragments;
}
