import type { MediaItem, MediaKind, SlideContent } from "../types";
import type { RunnerSlide } from "./lyrics";

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  text: "Texto",
  image: "Imagem",
  folder: "Pasta de imagens",
  video: "Vídeo",
};

export function mediaKindLabel(kind: MediaKind): string {
  return MEDIA_KIND_LABEL[kind];
}

/**
 * Cada bloco separado por uma linha em branco vira um slide de texto,
 * funcionando como uma sequência de textos independente de uma música.
 */
function splitTextBlocks(text: string | undefined): string[][] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((block) => block.split("\n").map((line) => line.trimEnd()))
    .map((lines) => {
      while (lines.length > 0 && lines[0].trim() === "") lines.shift();
      while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
      }
      return lines;
    })
    .filter((lines) => lines.length > 0);
}

export function countTextSlides(text: string | undefined): number {
  return splitTextBlocks(text).length;
}

function slideForText(
  itemId: string,
  media: MediaItem,
  lines: string[],
  index: number,
  total: number,
): SlideContent {
  return {
    id: `${itemId}#${index}`,
    kind: "custom",
    title: media.title,
    lines,
    section: total > 1 ? `${index + 1}/${total}` : undefined,
    media,
  };
}

function slideForMedia(
  itemId: string,
  media: MediaItem,
  index: number,
  section?: string,
): SlideContent {
  return {
    id: `${itemId}#${index}`,
    kind: "media",
    title: media.title,
    lines: [],
    section,
    media: { ...media, index },
  };
}

export function buildMediaSlides(itemId: string, media: MediaItem): RunnerSlide[] {
  switch (media.kind) {
    case "text": {
      const blocks = splitTextBlocks(media.text);
      if (blocks.length === 0 && media.themeId) {
        return [
          {
            index: 0,
            sectionIndex: null,
            isBlank: false,
            label: "Apresentação",
            sectionType: null,
            slide: slideForText(itemId, media, [], 0, 1),
          },
        ];
      }
      return blocks.map((lines, index) => ({
        index,
        sectionIndex: null,
        isBlank: false,
        label:
          blocks.length > 1
            ? `Texto ${index + 1}`
            : media.themeId
            ? "Apresentação"
            : MEDIA_KIND_LABEL.text,
        sectionType: null,
        slide: slideForText(itemId, media, lines, index, blocks.length),
      }));
    }
    case "image":
    case "video":
      return [
        {
          index: 0,
          sectionIndex: null,
          isBlank: false,
          label: MEDIA_KIND_LABEL[media.kind],
          sectionType: null,
          slide: slideForMedia(itemId, media, 0),
        },
      ];
    case "folder": {
      const files = media.files ?? [];
      if (files.length === 0) {
        return [];
      }
      return files.map((path, index) => ({
        index,
        sectionIndex: null,
        isBlank: false,
        label: `Imagem ${index + 1}`,
        sectionType: null,
        slide: slideForMedia(
          itemId,
          { ...media, path, files },
          index,
          `${index + 1}/${files.length}`,
        ),
      }));
    }
  }
}
