import {
  cleanCommentText,
  cleanPublicLines,
  formatStageLyrics,
  isCommentLine,
} from "../../core/lib/lyrics.ts";
import type {
  SlideContent,
  SlideKind,
  StageTimer,
} from "../../core/types/index.ts";
import { stageTimerElapsed } from "../../core/types/index.ts";
import { formatElapsed } from "../../core/lib/format.ts";
import { BIBLE_BOOKS } from "../bible/bibleParser.ts";

export function renderTemplate(
  template: string,
  props: Record<string, string>,
): string {
  let out = template;
  for (const key of Object.keys(props).sort()) {
    if (key.startsWith("__")) continue;
    out = out.split(`{${key}}`).join(props[key]);
  }
  return out.replace(/\{[^}]*\}/g, "");
}

export function cleanBibleVersion(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/\.(sqlite|db)$/i, "")
    .replace(/[()]/g, "")
    .trim()
    .toUpperCase();
}

export function getBookAbbreviation(bookName?: string | null, bookId?: number): string {
  if (bookId) {
    const found = BIBLE_BOOKS.find((b) => b.id === bookId);
    if (found) return found.abbrev;
  }
  if (!bookName) return "";
  const normalized = bookName.trim().toLowerCase();
  const found = BIBLE_BOOKS.find(
    (b) =>
      b.name.toLowerCase() === normalized ||
      b.abbrev.toLowerCase() === normalized ||
      b.aliases.some((a) => a.toLowerCase() === normalized),
  );
  if (found) return found.abbrev;
  return bookName.slice(0, 3);
}

function nextVerseOf(nextUp: SlideContent | null | undefined): string {
  if (!nextUp) return "";
  const lines = cleanPublicLines(nextUp.lines);
  return lines.length > 0 ? lines.join("\n") : nextUp.lines.join("\n");
}

export function nextPreviewOf(
  nextUp: SlideContent | null | undefined,
  maxChars = 75,
): string {
  if (!nextUp) return "";
  const publicLines = cleanPublicLines(nextUp.lines);
  const full = publicLines.length > 0 ? publicLines.join("\n") : nextUp.lines.join("\n");
  const trimmed = full.trim();
  if (!trimmed) return "";

  const firstLine = trimmed.split("\n")[0].trim();
  if (firstLine.length <= maxChars) {
    const clean = firstLine.replace(/[.,;:\s]+$/, "");
    return `${clean}...`;
  }

  const slice = firstLine.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  const clean = cut.replace(/[.,;:\s]+$/, "");
  return `${clean}...`;
}

function nextFirstLineOf(nextUp: SlideContent | null | undefined): string {
  if (!nextUp) return "";
  const publicLines = cleanPublicLines(nextUp.lines);
  const full = publicLines.length > 0 ? publicLines.join("\n") : nextUp.lines.join("\n");
  const trimmed = full.trim();
  if (!trimmed) return "";
  return trimmed.split("\n")[0].trim();
}

function indexFromId(id: string): string {
  const hash = id.lastIndexOf("#");
  if (hash >= 0) {
    const n = Number(id.slice(hash + 1));
    if (Number.isInteger(n) && n >= 0) return String(n);
  }
  return "0";
}

export function parseReference(reference: string): {
  livro: string;
  capitulo: string;
  versiculo: string;
  versao: string;
  sufixo: string;
} {
  const clean = reference.trim();
  let versao = "";
  let sufixo = "";

  const parenMatches = [...clean.matchAll(/\(([^)]+)\)/g)];
  for (const match of parenMatches) {
    const inner = match[1].trim();
    if (/^\d+\/\d+$/.test(inner)) {
      sufixo = ` (${inner})`;
    } else {
      versao = cleanBibleVersion(inner);
    }
  }

  const base = clean.replace(/\s*\([^)]+\)/g, "").trim();
  const m = base.match(/^(.+?)\s+(\d+)(?:[:.](\d+))?$/);
  if (!m) {
    return { livro: base, capitulo: "", versiculo: "", versao, sufixo };
  }
  return {
    livro: m[1].trim(),
    capitulo: m[2],
    versiculo: m[3] ?? "",
    versao,
    sufixo,
  };
}

export function buildProps(
  kind: SlideKind,
  content: SlideContent,
  nextUp?: SlideContent | null,
  options?: { hideText?: boolean },
): Record<string, string> {
  const hidesText = options?.hideText === true;
  const isBlankLyric =
    kind === "lyric" && cleanPublicLines(content.lines).length === 0;
  const nextVerse = isBlankLyric ? "" : nextVerseOf(nextUp);
  const nextPreview = isBlankLyric ? "" : nextPreviewOf(nextUp);
  const nextLine = isBlankLyric ? "" : nextFirstLineOf(nextUp);
  const curIdx = indexFromId(content.id);
  let props: Record<string, string>;
  switch (kind) {
    case "lyric": {
      const publicLines = cleanPublicLines(content.lines);
      const text = publicLines.join("\n");
      props = {
        // English
        title: content.title,
        artist: "",
        lyrics: text,
        text,
        content: text,
        next_verse: nextVerse,
        next_up: nextVerse,
        next_preview: nextPreview,
        next_verse_preview: nextPreview,
        next_snippet: nextPreview,
        next_line: nextLine,
        section: content.section ?? "",
        current_slide: curIdx,
        total_slides: "1",
        // Legacy pt-BR
        titulo: content.title,
        artista: "",
        letra: text,
        texto: text,
        nextVerse,
        proximo_resumo: nextPreview,
        proximo_versiculo_resumo: nextPreview,
        proximo_preview: nextPreview,
        proximo_trecho: nextPreview,
        proxima_linha: nextLine,
        secao: content.section ?? "",
        currentIndex: curIdx,
        totalCount: "1",
      };
      break;
    }
    case "scripture": {
      const sc = content.scripture;
      const ref = parseReference(content.title);
      const rawVersion = sc?.versionId || ref.versao;
      const cleanVer = cleanBibleVersion(rawVersion);
      const bookName = sc?.bookName || ref.livro;
      const bookAbbrev = getBookAbbreviation(bookName, sc?.bookId);
      const chapter = sc ? String(sc.chapter) : ref.capitulo;
      const verse = sc ? String(sc.verse) : ref.versiculo;
      const partSuffix =
        sc && sc.totalParts > 1 ? ` (${sc.part + 1}/${sc.totalParts})` : ref.sufixo || "";

      const chapterAndVerse = chapter && verse ? `${chapter}:${verse}${partSuffix}` : chapter || "";
      const refFull = chapterAndVerse ? `${bookName} ${chapterAndVerse}`.trim() : bookName;
      const refAbbr = chapterAndVerse ? `${bookAbbrev} ${chapterAndVerse}`.trim() : bookAbbrev;
      const text = content.lines.join("\n");
      const titleWithVersion = cleanVer ? `${refFull} (${cleanVer})` : refFull;

      props = {
        // English (Canonical)
        title: titleWithVersion,
        reference: refFull,
        reference_full: refFull,
        reference_abbr: refAbbr,
        reference_short: refAbbr,
        current_reference: refFull,
        book: bookName,
        book_abbr: bookAbbrev,
        chapter,
        verse_number: verse,
        version: cleanVer,
        verse: text,
        text,
        content: text,
        lyrics: text,
        current_verse: text,
        next_verse: nextVerse,
        next_up: nextVerse,
        next_preview: nextPreview,
        next_verse_preview: nextPreview,
        next_snippet: nextPreview,
        next_line: nextLine,
        // Legacy pt-BR
        titulo: titleWithVersion,
        referencia: refFull,
        referencia_completa: refFull,
        referencia_abreviada: refAbbr,
        referencia_curta: refAbbr,
        referencia_atual: refFull,
        livro: bookName,
        livro_abrev: bookAbbrev,
        capitulo: chapter,
        versiculo: verse,
        versao: cleanVer,
        verso: text,
        texto: text,
        letra: text,
        versiculo_corrente: text,
        nextVerse,
        proximo_resumo: nextPreview,
        proximo_versiculo_resumo: nextPreview,
        proximo_preview: nextPreview,
        proximo_trecho: nextPreview,
        proxima_linha: nextLine,
      };
      break;
    }
    case "custom": {
      const text = content.lines.join("\n");
      props = {
        // English
        title: content.title,
        text,
        content: text,
        lyrics: text,
        next_verse: nextVerse,
        next_up: nextVerse,
        section: content.section ?? "",
        current_slide: curIdx,
        total_slides: "1",
        // Legacy pt-BR
        titulo: content.title,
        texto: text,
        letra: text,
        nextVerse,
        secao: content.section ?? "",
        currentIndex: curIdx,
        totalCount: "1",
      };
      break;
    }
    case "media": {
      const text = content.media?.title || content.title;
      props = {
        title: content.title,
        text,
        content: text,
        current_slide: curIdx,
        total_slides: "1",
        titulo: content.title,
        texto: text,
        currentIndex: curIdx,
        totalCount: "1",
      };
      break;
    }
    case "blank":
      props = { title: content.title, titulo: content.title };
      break;
  }

  if (!hidesText) return props;

  return Object.fromEntries(
    Object.keys(props).map((key) => [key, ""]),
  );
}

export function buildStageProps(options: {
  content: SlideContent;
  nextUp?: SlideContent | null;
  prevUp?: SlideContent | null;
  nowMs: number;
  timer: StageTimer;
  clock24h?: boolean;
  showSeconds?: boolean;
  nextSlideDisplay?: "full" | "first-line";
  countdownMinutes?: number;
  blackout?: boolean;
  cleared?: boolean;
  activeMessage?: string | null;
}): Record<string, string> {
  const {
    content,
    nextUp,
    prevUp,
    nowMs,
    timer,
    clock24h = true,
    showSeconds = false,
    nextSlideDisplay = "first-line",
    countdownMinutes = 0,
    blackout = false,
    cleared = false,
    activeMessage = "",
  } = options;

  const date = new Date(nowMs);
  const hora = date.toLocaleTimeString("pt-BR", {
    hour12: !clock24h,
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  });
  const horaComSegundos = date.toLocaleTimeString("pt-BR", {
    hour12: !clock24h,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const hhmm = date.toLocaleTimeString("pt-BR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const elapsedSecs = stageTimerElapsed(timer, nowMs);
  const cronometro = formatElapsed(elapsedSecs);

  const effectiveCountdownSecs =
    typeof timer.countdownSecs === "number" && timer.countdownSecs > 0
      ? timer.countdownSecs
      : countdownMinutes > 0
      ? countdownMinutes * 60
      : 0;

  let timerFormatted = cronometro;
  if (effectiveCountdownSecs > 0) {
    const remaining = Math.max(0, effectiveCountdownSecs - elapsedSecs);
    timerFormatted = formatElapsed(remaining);
  }

  const nextPublicLines = nextUp ? cleanPublicLines(nextUp.lines) : [];
  const nextFull = nextPublicLines.join("\n");
  const nextComments = nextUp ? nextUp.lines.filter(isCommentLine).map(cleanCommentText) : [];
  const commentPrefix = nextComments.length > 0 ? `[📌 ${nextComments[0]}] ` : "";
  const nextFirstLine = nextPublicLines.length > 0
    ? `${commentPrefix}${nextPublicLines[0]}`
    : (nextUp && nextUp.lines.length > 0 ? nextUp.lines[0] : "");
  const nextVerse = nextSlideDisplay === "full" ? nextFull : nextFirstLine;
  const nextTitle = nextUp?.title ?? "";

  const prevPublicLines = prevUp ? cleanPublicLines(prevUp.lines) : [];
  const prevFull = prevPublicLines.join("\n");
  const prevFirstLine = prevPublicLines.length > 0
    ? prevPublicLines[0]
    : (prevUp && prevUp.lines.length > 0 ? prevUp.lines[0] : "");
  const prevVerse = nextSlideDisplay === "full" ? prevFull : prevFirstLine;
  const prevTitle = prevUp?.title ?? "";

  let letra = formatStageLyrics(content.lines);
  if (blackout) {
    letra = "[BLACKOUT]";
  } else if (cleared) {
    letra = "";
  }

  const rawTitle = blackout || cleared ? "" : content.title;
  let cleanTitle = rawTitle;
  let cleanReference = rawTitle;
  let cleanRefFull = rawTitle;
  let cleanRefAbbr = rawTitle;
  let cleanVer = "";

  if (content.kind === "scripture" || content.scripture || /\.(sqlite|db)/i.test(rawTitle)) {
    const sc = content.scripture;
    const ref = parseReference(rawTitle);
    const rawVersion = sc?.versionId || ref.versao;
    cleanVer = cleanBibleVersion(rawVersion);
    const bookName = sc?.bookName || ref.livro;
    const bookAbbrev = getBookAbbreviation(bookName, sc?.bookId);
    const chapter = sc ? String(sc.chapter) : ref.capitulo;
    const verse = sc ? String(sc.verse) : ref.versiculo;
    const partSuffix =
      sc && sc.totalParts > 1 ? ` (${sc.part + 1}/${sc.totalParts})` : ref.sufixo || "";
    const chapterAndVerse = chapter && verse ? `${chapter}:${verse}${partSuffix}` : chapter || "";
    cleanRefFull = chapterAndVerse ? `${bookName} ${chapterAndVerse}`.trim() : bookName;
    cleanRefAbbr = chapterAndVerse ? `${bookAbbrev} ${chapterAndVerse}`.trim() : bookAbbrev;
    cleanReference = cleanRefFull;
    cleanTitle = cleanVer ? `${cleanRefFull} (${cleanVer})` : cleanRefFull;
  }

  const cleanNextTitle = nextTitle
    .replace(/\.(sqlite|db)/gi, "")
    .replace(/\(\s*([A-Za-z0-9_-]+)\s*\)/g, (_, v) => `(${v.toUpperCase()})`);
  const cleanPrevTitle = prevTitle
    .replace(/\.(sqlite|db)/gi, "")
    .replace(/\(\s*([A-Za-z0-9_-]+)\s*\)/g, (_, v) => `(${v.toUpperCase()})`);

  const section = blackout || cleared ? "" : (content.section ?? "");
  const nextPreview = nextPreviewOf(nextUp);

  return {
    // English (Canonical)
    title: cleanTitle,
    reference: cleanReference,
    reference_full: cleanRefFull,
    reference_abbr: cleanRefAbbr,
    reference_short: cleanRefAbbr,
    version: cleanVer,
    artist: "",
    section,
    lyrics: letra,
    text: letra,
    next_verse: nextVerse,
    next_up: nextVerse,
    next_preview: nextPreview,
    next_verse_preview: nextPreview,
    next_snippet: nextPreview,
    next_first_line: nextFirstLine,
    next_full: nextFull,
    next_title: cleanNextTitle,
    prev_verse: prevVerse,
    prev_up: prevVerse,
    prev_first_line: prevFirstLine,
    prev_full: prevFull,
    prev_title: cleanPrevTitle,
    current_verse: letra,
    current_reference: cleanReference,
    next_reference: cleanNextTitle,
    prev_reference: cleanPrevTitle,
    clock: hora,
    time: hora,
    stopwatch: cronometro,
    timer: timerFormatted,
    countdown: timerFormatted,
    stage_message: activeMessage ?? "",
    message: activeMessage ?? "",
    mensagem: activeMessage ?? "",
    aviso: activeMessage ?? "",
    alerta: activeMessage ?? "",
    // Legacy aliases (pt-BR)
    titulo: cleanTitle,
    referencia: cleanReference,
    referencia_completa: cleanRefFull,
    referencia_abreviada: cleanRefAbbr,
    referencia_curta: cleanRefAbbr,
    versao: cleanVer,
    artista: "",
    secao: section,
    letra,
    texto: letra,
    verso: letra,
    versiculo_corrente: letra,
    nextVerse,
    proximo_versiculo: nextVerse,
    proximo_resumo: nextPreview,
    proximo_versiculo_resumo: nextPreview,
    proximo_preview: nextPreview,
    proximo_trecho: nextPreview,
    proxima_linha: nextFirstLine,
    nextFirstLine,
    nextFull,
    nextTitle: cleanNextTitle,
    prevVerse,
    prevUp: prevVerse,
    versiculo_anterior: prevVerse,
    prevTitle: cleanPrevTitle,
    referencia_corrente: cleanReference,
    proxima_referencia: cleanNextTitle,
    referencia_anterior: cleanPrevTitle,
    hora,
    "HH:MM": hhmm,
    horaComSegundos,
    cronometro,
    crono: cronometro,
    regressivo: timerFormatted,
  };
}
