import { cleanCommentText, cleanPublicLines, formatStageLyrics, isCommentLine } from "@/core/lib/lyrics";
import type { SlideContent, SlideKind, StageTimer } from "@/core/types";
import { stageTimerElapsed } from "@/core/types";
import { formatElapsed } from "@/core/lib/format";

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

function nextVerseOf(nextUp: SlideContent | null | undefined): string {
  if (!nextUp) return "";
  const lines = cleanPublicLines(nextUp.lines);
  return lines.length > 0 ? lines.join("\n") : nextUp.lines.join("\n");
}

function indexFromId(id: string): string {
  const hash = id.lastIndexOf("#");
  if (hash >= 0) {
    const n = Number(id.slice(hash + 1));
    if (Number.isInteger(n) && n >= 0) return String(n);
  }
  return "0";
}

function parseReference(reference: string): {
  livro: string;
  capitulo: string;
  versiculo: string;
} {
  const m = reference.match(/^(.+?)\s+(\d+)(?::(\d+))?\s*$/);
  if (!m) return { livro: reference, capitulo: "", versiculo: "" };
  return { livro: m[1], capitulo: m[2], versiculo: m[3] ?? "" };
}

export function buildProps(
  kind: SlideKind,
  content: SlideContent,
  nextUp?: SlideContent | null,
): Record<string, string> {
  const nextVerse = nextVerseOf(nextUp);
  const curIdx = indexFromId(content.id);
  switch (kind) {
    case "lyric": {
      const publicLines = cleanPublicLines(content.lines);
      const text = publicLines.join("\n");
      return {
        // English
        title: content.title,
        artist: "",
        lyrics: text,
        text,
        content: text,
        next_verse: nextVerse,
        next_up: nextVerse,
        section: content.section ?? "",
        current_slide: curIdx,
        total_slides: "1",
        // Legacy pt-BR
        titulo: content.title,
        artista: "",
        letra: text,
        texto: text,
        nextVerse,
        secao: content.section ?? "",
        currentIndex: curIdx,
        totalCount: "1",
      };
    }
    case "scripture": {
      const ref = parseReference(content.title);
      const text = content.lines.join("\n");
      return {
        // English
        title: content.title,
        verse: text,
        book: ref.livro,
        chapter: ref.capitulo,
        verse_number: ref.versiculo,
        version: "",
        next_verse: nextVerse,
        // Legacy pt-BR
        titulo: content.title,
        verso: text,
        livro: ref.livro,
        capitulo: ref.capitulo,
        versiculo: ref.versiculo,
        versao: "",
        nextVerse,
      };
    }
    case "custom": {
      const text = content.lines.join("\n");
      return {
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
    }
    case "media": {
      const text = content.media?.title || content.title;
      return {
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
    }
    case "blank":
      return { title: content.title, titulo: content.title };
  }
}

export function buildStageProps(options: {
  content: SlideContent;
  nextUp?: SlideContent | null;
  nowMs: number;
  timer: StageTimer;
  clock24h?: boolean;
  showSeconds?: boolean;
  nextSlideDisplay?: "full" | "first-line";
  countdownMinutes?: number;
  blackout?: boolean;
  cleared?: boolean;
}): Record<string, string> {
  const {
    content,
    nextUp,
    nowMs,
    timer,
    clock24h = true,
    showSeconds = false,
    nextSlideDisplay = "first-line",
    countdownMinutes = 0,
    blackout = false,
    cleared = false,
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

  let timerFormatted = cronometro;
  if (countdownMinutes > 0) {
    const totalSecs = countdownMinutes * 60;
    const remaining = Math.max(0, totalSecs - elapsedSecs);
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

  let letra = formatStageLyrics(content.lines);
  if (blackout) {
    letra = "[BLACKOUT]";
  } else if (cleared) {
    letra = "";
  }

  const title = blackout || cleared ? "" : content.title;
  const section = blackout || cleared ? "" : (content.section ?? "");

  return {
    // English (Canonical)
    title,
    artist: "",
    section,
    lyrics: letra,
    text: letra,
    next_verse: nextVerse,
    next_up: nextVerse,
    next_first_line: nextFirstLine,
    next_full: nextFull,
    next_title: nextTitle,
    clock: hora,
    time: hora,
    stopwatch: cronometro,
    timer: timerFormatted,
    countdown: timerFormatted,
    // Legacy aliases (pt-BR)
    titulo: title,
    artista: "",
    secao: section,
    letra,
    texto: letra,
    verso: letra,
    nextVerse,
    nextFirstLine,
    nextFull,
    nextTitle,
    hora,
    "HH:MM": hhmm,
    horaComSegundos,
    cronometro,
    crono: cronometro,
    regressivo: timerFormatted,
  };
}
