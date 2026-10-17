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
  return nextUp ? nextUp.lines.join("\n") : "";
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
  switch (kind) {
    case "lyric":
      return {
        titulo: content.title,
        artista: "",
        letra: content.lines.join("\n"),
        nextVerse,
        secao: content.section ?? "",
        currentIndex: indexFromId(content.id),
        totalCount: "1",
      };
    case "scripture": {
      const ref = parseReference(content.title);
      return {
        titulo: content.title,
        verso: content.lines.join("\n"),
        livro: ref.livro,
        capitulo: ref.capitulo,
        versiculo: ref.versiculo,
        versao: "",
        nextVerse,
      };
    }
    case "custom":
      return {
        titulo: content.title,
        texto: content.lines.join("\n"),
        currentIndex: indexFromId(content.id),
        totalCount: "1",
      };
    case "blank":
      return { titulo: content.title };
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

  const nextFull = nextUp ? nextUp.lines.join("\n") : "";
  const nextFirstLine =
    nextUp && nextUp.lines.length > 0 ? (nextUp.lines[0] ?? "") : "";
  const nextVerse = nextSlideDisplay === "full" ? nextFull : nextFirstLine;
  const nextTitle = nextUp?.title ?? "";

  let letra = content.lines.join("\n");
  if (blackout) {
    letra = "[BLACKOUT]";
  } else if (cleared) {
    letra = "";
  }

  return {
    titulo: blackout || cleared ? "" : content.title,
    artista: "",
    secao: blackout || cleared ? "" : (content.section ?? ""),
    letra,
    texto: letra,
    verso: letra,
    nextVerse,
    nextFirstLine,
    nextFull,
    nextTitle,
    hora,
    "HH:MM": hhmm,
    clock: hora,
    horaComSegundos,
    cronometro,
    crono: cronometro,
    stopwatch: cronometro,
    timer: timerFormatted,
    regressivo: timerFormatted,
    countdown: timerFormatted,
  };
}
