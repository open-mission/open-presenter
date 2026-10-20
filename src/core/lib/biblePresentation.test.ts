import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBiblePresentationPayload,
  buildScriptureSlide,
  buildScriptureSlides,
  scriptureSlideId,
  stepBibleVerse,
} from "./biblePresentation.ts";
import type { BibleVerse } from "../types/index.ts";

function verse(num: number, text: string): BibleVerse {
  return { id: num, bookId: 43, chapter: 3, verse: num, text };
}

const VERSES: BibleVerse[] = [
  verse(16, "Porque Deus amou o mundo de tal maneira. Que deu o seu Filho unigênito."),
  verse(17, "Porque Deus enviou o seu Filho ao mundo. Não para que condenasse o mundo."),
  verse(18, "Quem crê nele não é condenado. Mas quem não crê já está condenado."),
];

test("id do slide inclui a parte apenas quando o versículo é dividido", () => {
  assert.equal(
    scriptureSlideId({ bookId: 43, chapter: 3, verse: 16 }, 0, 1),
    "bible-43-3-16",
  );
  assert.equal(
    scriptureSlideId({ bookId: 43, chapter: 3, verse: 16 }, 1, 2),
    "bible-43-3-16#2",
  );
});

test("divide versículo longo e mantém metadados em cada parte", () => {
  const slides = buildScriptureSlides({
    versionId: "ARA",
    bookId: 43,
    bookName: "João",
    chapter: 3,
    verse: 16,
    text: VERSES[0].text,
    threshold: 40,
  });

  assert.ok(slides.length > 1);
  slides.forEach((slide, index) => {
    assert.equal(slide.scripture?.part, index);
    assert.equal(slide.scripture?.totalParts, slides.length);
    assert.equal(slide.scripture?.verse, 16);
    assert.equal(slide.scripture?.bookName, "João");
    assert.ok(slide.id.includes("#"));
  });
});

test("próximo passo percorre as partes antes de avançar de versículo", () => {
  const first = stepBibleVerse(VERSES, 16, 0, 1, 40);
  assert.equal(first?.verse.verse, 16);
  assert.equal(first?.partIndex, 1);

  const nextVerse = stepBibleVerse(VERSES, 16, first!.parts.length - 1, 1, 40);
  assert.equal(nextVerse?.verse.verse, 17);
  assert.equal(nextVerse?.partIndex, 0);
});

test("anterior volta para a última parte do versículo anterior", () => {
  const previous = stepBibleVerse(VERSES, 17, 0, -1, 40);
  assert.equal(previous?.verse.verse, 16);
  assert.equal(previous?.partIndex, previous!.parts.length - 1);
});

test("não avança além do último versículo do capítulo", () => {
  const last = VERSES[VERSES.length - 1];
  const lastPart = stepBibleVerse(VERSES, last.verse, 0, -1, 40);
  assert.ok(lastPart);
  const parts = stepBibleVerse(VERSES, last.verse, 0, 1, 40);
  assert.ok(parts);
  assert.equal(
    stepBibleVerse(VERSES, last.verse, parts.parts.length - 1, 1, 40),
    null,
  );
});

test("payload de apresentação inclui referência atual e vizinhos", () => {
  const payload = buildBiblePresentationPayload({
    versionId: "ARA",
    bookId: 43,
    bookName: "João",
    chapter: 3,
    verses: VERSES,
    verseNum: 17,
    partIndex: 0,
    threshold: 40,
  });

  assert.ok(payload);
  assert.equal(payload?.verse, 17);
  assert.equal(payload?.part, 0);
  assert.ok((payload?.total_parts ?? 0) > 1);
  assert.equal(payload?.prev_verse, 16);
  assert.ok((payload?.prev_total_parts ?? 0) > 1);
  assert.equal(payload?.next_verse, 17);
  assert.equal(payload?.next_part, 1);
  assert.ok(payload?.next_text);
});

test("slide de Escritura preserva título, seção e referência", () => {
  const slide = buildScriptureSlide({
    versionId: "ARC",
    bookId: 19,
    bookName: "Salmos",
    chapter: 23,
    verse: 1,
    text: "O Senhor é o meu pastor.",
  });

  assert.equal(slide.id, "bible-19-23-1");
  assert.equal(slide.kind, "scripture");
  assert.equal(slide.title, "Salmos 23:1 (ARC)");
  assert.equal(slide.section, "Salmos 23:1");
  assert.equal(slide.scripture?.versionId, "ARC");
});
