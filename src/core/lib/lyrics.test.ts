import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSongSlides, computeSlideGroups, splitSection } from "./lyrics.ts";
import type { RunnerSlide } from "./lyrics.ts";
import type { SectionType, Song, SongSection } from "../types";

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-1",
    title: "Música",
    artist: "Artista",
    sections: [],
    ...overrides,
  };
}

function slide(
  index: number,
  label: string | null,
  sectionType: SectionType | null = null,
  isBlank = false,
): RunnerSlide {
  return {
    index,
    sectionIndex: index,
    isBlank,
    label,
    sectionType,
    slide: {
      id: `song#${index}`,
      kind: "lyric",
      title: "Música",
      lines: [`linha ${index + 1}`],
    },
  };
}

test("marca sectionIndex e isBlank em todas as seções", () => {
  const song = makeSong({
    sections: [
      { sectionType: "verse", lines: ["A"] },
      { sectionType: null, lines: [] },
      { sectionType: "chorus", lines: ["B"] },
    ],
  });
  const slides = buildSongSlides(song);
  assert.deepEqual(
    slides.map((s) => s.sectionIndex),
    [0, 1, 2],
  );
  assert.deepEqual(
    slides.map((s) => s.isBlank),
    [false, true, false],
  );
  assert.deepEqual(
    slides.map((s) => s.index),
    [0, 1, 2],
  );
});

test("prefixa slide sintético quando addEmptySlideAtStart é true", () => {
  const song = makeSong({
    sections: [{ sectionType: "verse", lines: ["A"] }],
  });
  const slides = buildSongSlides(song, { addEmptySlideAtStart: true });
  assert.equal(slides.length, 2);
  assert.equal(slides[0].index, 0);
  assert.equal(slides[0].sectionIndex, null);
  assert.equal(slides[0].isBlank, true);
  assert.equal(slides[0].label, null);
  assert.deepEqual(slides[0].slide, {
    id: `${song.id}#empty-start`,
    kind: "lyric",
    title: "",
    lines: [],
  });
  assert.equal(slides[1].index, 1);
  assert.equal(slides[1].sectionIndex, 0);
  assert.equal(slides[1].isBlank, false);
});

test("slide vazio abre um grupo próprio", () => {
  const groups = computeSlideGroups([
    { index: 0, label: "Verso", sectionType: "verse" },
    { index: 1, label: null, sectionType: null, isBlank: true },
    { index: 2, label: null, sectionType: null },
  ]);
  assert.deepEqual(
    groups.map((g) => g.indices),
    [[0], [1], [2]],
  );
  assert.equal(groups[1].isBlank, true);
});

test("estrofe rotulada absorve os slides seguintes sem rótulo", () => {
  const groups = computeSlideGroups([
    slide(0, "Verso 1", "verse"),
    slide(1, null),
    slide(2, null),
    slide(3, "Refrão", "chorus"),
  ]);

  assert.deepEqual(
    groups.map((g) => ({ startIndex: g.startIndex, label: g.label, indices: g.indices })),
    [
      { startIndex: 0, label: "Verso 1", indices: [0, 1, 2] },
      { startIndex: 3, label: "Refrão", indices: [3] },
    ],
  );
});

test("rótulo repetido abre um grupo novo", () => {
  const groups = computeSlideGroups([
    slide(0, "Refrão", "chorus"),
    slide(1, "Refrão", "chorus"),
    slide(2, null),
  ]);

  assert.deepEqual(
    groups.map((g) => g.indices),
    [[0], [1, 2]],
  );
});

test("slides sem rótulo antes do primeiro rótulo formam um grupo sem rótulo", () => {
  const groups = computeSlideGroups([
    slide(0, null),
    slide(1, null),
    slide(2, "Verso 1", "verse"),
  ]);

  assert.deepEqual(
    groups.map((g) => ({ label: g.label, indices: g.indices })),
    [
      { label: null, indices: [0, 1] },
      { label: "Verso 1", indices: [2] },
    ],
  );
});

test("música sem nenhum rótulo vira um único grupo sem rótulo", () => {
  const groups = computeSlideGroups([slide(0, null), slide(1, null)]);
  assert.deepEqual(
    groups.map((g) => g.indices),
    [[0, 1]],
  );
});

test("rótulos consecutivos abrem cada um o próprio grupo", () => {
  const groups = computeSlideGroups([
    slide(0, "Verso 1", "verse"),
    slide(1, "Verso 2", "verse"),
    slide(2, "Refrão", "chorus"),
  ]);

  assert.deepEqual(
    groups.map((g) => g.indices),
    [[0], [1], [2]],
  );
});

test("lista vazia não gera grupos", () => {
  assert.deepEqual(computeSlideGroups([]), []);
});

test("divide estrofe e só o primeiro fragmento mantém o rótulo", () => {
  assert.deepEqual(
    splitSection({ sectionType: "verse", lines: ["a", "b", "c", "d", "e"] }, 2),
    [
      { sectionType: "verse", lines: ["a", "b"] },
      { sectionType: null, lines: ["c", "d"] },
      { sectionType: null, lines: ["e"] },
    ],
  );
});

test("seção curta fica intacta", () => {
  const section: SongSection = { sectionType: "chorus", lines: ["a", "b"] };
  assert.deepEqual(splitSection(section, 2), [section]);
});

test("uma linha por slide quebra cada linha", () => {
  assert.deepEqual(
    splitSection({ sectionType: null, lines: ["a", "b", "c"] }, 1),
    [
      { sectionType: null, lines: ["a"] },
      { sectionType: null, lines: ["b"] },
      { sectionType: null, lines: ["c"] },
    ],
  );
});
