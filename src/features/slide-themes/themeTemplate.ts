import type { SlideContent, SlideKind } from "@/core/types";

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
