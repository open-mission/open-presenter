import test from "node:test";
import assert from "node:assert/strict";
import { parseBibleReference } from "./bibleParser.ts";

test("Jo 3 abre o capítulo 3 no versículo 1", () => {
  const parsed = parseBibleReference("Jo 3");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, undefined);
});

test("Jo 3.16 seleciona o versículo 16", () => {
  const parsed = parseBibleReference("Jo 3.16");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, 16);
});

test("João 3 16 seleciona o versículo 16", () => {
  const parsed = parseBibleReference("João 3 16");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, 16);
});

test("1 Jo 1:9 seleciona 1 João", () => {
  const parsed = parseBibleReference("1 Jo 1:9");
  assert.equal(parsed?.bookId, 62);
  assert.equal(parsed?.chapter, 1);
  assert.equal(parsed?.verse, 9);
});

test("referência inválida retorna null", () => {
  assert.equal(parseBibleReference("livro inexistente"), null);
  assert.equal(parseBibleReference(""), null);
});

test("reconhece versão no final da referência (ex: Joao 3.16 Ara)", () => {
  const parsed = parseBibleReference("Joao 3.16 Ara");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, 16);
  assert.equal(parsed?.versionQuery, "Ara");
});

test("reconhece versão com apenas livro e capítulo (ex: Sl 23 NVI, 1co 13 ara)", () => {
  const sl = parseBibleReference("Sl 23 NVI");
  assert.equal(sl?.bookId, 19);
  assert.equal(sl?.chapter, 23);
  assert.equal(sl?.verse, undefined);
  assert.equal(sl?.versionQuery, "NVI");

  const co = parseBibleReference("1co 13 ara");
  assert.equal(co?.bookId, 46);
  assert.equal(co?.chapter, 13);
  assert.equal(co?.verse, undefined);
  assert.equal(co?.versionQuery, "ara");
});

test("reconhece intervalo com versão (ex: João 3:16-18 ARC)", () => {
  const parsed = parseBibleReference("João 3:16-18 ARC");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, 16);
  assert.equal(parsed?.verseEnd, 18);
  assert.equal(parsed?.versionQuery, "ARC");
});
