import type { BibleVerse, ScriptureRef, SlideContent } from "@/core/types";
import { splitVerseText } from "./verseSplitter.ts";

export const DEFAULT_BIBLE_SPLIT_THRESHOLD = 220;

export function bibleSplitThreshold(): number | null {
  try {
    if (localStorage.getItem("open_presenter_bible_split_verses") === "false") {
      return null;
    }
    const stored = Number(localStorage.getItem("open_presenter_bible_split_threshold"));
    return Number.isFinite(stored) && stored > 0
      ? stored
      : DEFAULT_BIBLE_SPLIT_THRESHOLD;
  } catch {
    return DEFAULT_BIBLE_SPLIT_THRESHOLD;
  }
}

export function splitBibleText(text: string, threshold: number | null): string[] {
  if (threshold === null) return [text.trim()];
  return splitVerseText(text, threshold);
}

export function scriptureSlideId(
  ref: Pick<ScriptureRef, "bookId" | "chapter" | "verse">,
  part = 0,
  totalParts = 1,
): string {
  const base = `bible-${ref.bookId}-${ref.chapter}-${ref.verse}`;
  return totalParts > 1 ? `${base}#${part + 1}` : base;
}

export function scripturePartSuffix(part: number, totalParts: number): string {
  return totalParts > 1 ? ` (${part + 1}/${totalParts})` : "";
}

export function buildScriptureRef(params: {
  versionId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  part?: number;
  totalParts?: number;
}): ScriptureRef {
  const totalParts = Math.max(1, params.totalParts ?? 1);
  const part = Math.min(Math.max(0, params.part ?? 0), totalParts - 1);
  return {
    versionId: params.versionId,
    bookId: params.bookId,
    bookName: params.bookName,
    chapter: params.chapter,
    verse: params.verse,
    part,
    totalParts,
  };
}

export function cleanBibleVersionName(raw: string): string {
  return raw
    .replace(/\.(sqlite|db)$/i, "")
    .replace(/[()]/g, "")
    .trim()
    .toUpperCase();
}

export function buildScriptureSlide(params: {
  versionId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  part?: number;
  totalParts?: number;
}): SlideContent {
  const totalParts = Math.max(1, params.totalParts ?? 1);
  const part = Math.min(Math.max(0, params.part ?? 0), totalParts - 1);
  const suffix = scripturePartSuffix(part, totalParts);
  const cleanVersion = cleanBibleVersionName(params.versionId);
  return {
    id: scriptureSlideId(params, part, totalParts),
    kind: "scripture",
    title: `${params.bookName} ${params.chapter}:${params.verse}${suffix}${cleanVersion ? ` (${cleanVersion})` : ""}`,
    lines: [params.text],
    section: `${params.bookName} ${params.chapter}:${params.verse}${suffix}`,
    scripture: buildScriptureRef({ ...params, part, totalParts }),
  };
}

export function buildScriptureSlides(params: {
  versionId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  threshold?: number | null;
}): SlideContent[] {
  const threshold =
    params.threshold === undefined ? bibleSplitThreshold() : params.threshold;
  const parts = splitBibleText(params.text, threshold);
  return parts.map((text, part) =>
    buildScriptureSlide({ ...params, text, part, totalParts: parts.length }),
  );
}

export interface BibleStep {
  verse: BibleVerse;
  partIndex: number;
  parts: string[];
}

export function stepBibleVerse(
  verses: BibleVerse[],
  verseNum: number,
  partIndex: number,
  direction: 1 | -1,
  threshold: number | null = DEFAULT_BIBLE_SPLIT_THRESHOLD,
): BibleStep | null {
  const current = verses.find((verse) => verse.verse === verseNum);
  if (!current) return null;

  const parts = splitBibleText(current.text, threshold);
  const safePart = Math.min(Math.max(0, partIndex), parts.length - 1);
  const nextPart = safePart + direction;

  if (nextPart >= 0 && nextPart < parts.length) {
    return { verse: current, partIndex: nextPart, parts };
  }

  const adjacent = verses.find((verse) => verse.verse === verseNum + direction);
  if (!adjacent) return null;

  const adjacentParts = splitBibleText(adjacent.text, threshold);
  return {
    verse: adjacent,
    partIndex: direction > 0 ? 0 : adjacentParts.length - 1,
    parts: adjacentParts,
  };
}

export interface BiblePresentationPayload {
  version_id: string;
  book_id: number;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
  part_suffix: string;
  part: number;
  total_parts: number;
  prev_text?: string;
  prev_verse?: number;
  prev_part?: number;
  prev_total_parts?: number;
  next_text?: string;
  next_verse?: number;
  next_part?: number;
  next_total_parts?: number;
}

export function buildBiblePresentationPayload(params: {
  versionId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verses: BibleVerse[];
  verseNum: number;
  partIndex: number;
  threshold?: number | null;
}): BiblePresentationPayload | null {
  const threshold =
    params.threshold === undefined ? DEFAULT_BIBLE_SPLIT_THRESHOLD : params.threshold;
  const current = params.verses.find((verse) => verse.verse === params.verseNum);
  if (!current) return null;

  const parts = splitBibleText(current.text, threshold);
  const part = Math.min(Math.max(0, params.partIndex), parts.length - 1);
  const prev = stepBibleVerse(
    params.verses,
    params.verseNum,
    part,
    -1,
    threshold,
  );
  const next = stepBibleVerse(
    params.verses,
    params.verseNum,
    part,
    1,
    threshold,
  );

  return {
    version_id: params.versionId,
    book_id: params.bookId,
    book_name: params.bookName,
    chapter: params.chapter,
    verse: params.verseNum,
    text: parts[part],
    part_suffix: scripturePartSuffix(part, parts.length),
    part,
    total_parts: parts.length,
    ...(prev
      ? {
          prev_text: prev.parts[prev.partIndex],
          prev_verse: prev.verse.verse,
          prev_part: prev.partIndex,
          prev_total_parts: prev.parts.length,
        }
      : {}),
    ...(next
      ? {
          next_text: next.parts[next.partIndex],
          next_verse: next.verse.verse,
          next_part: next.partIndex,
          next_total_parts: next.parts.length,
        }
      : {}),
  };
}
