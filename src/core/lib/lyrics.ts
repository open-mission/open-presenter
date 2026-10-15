import { SECTION_LABEL } from "../config/lyrics";
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
