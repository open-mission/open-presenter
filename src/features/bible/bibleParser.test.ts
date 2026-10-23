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