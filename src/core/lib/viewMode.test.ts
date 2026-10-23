import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOKS_VIEW_DEFAULT,
  BOOKS_VIEW_MODES,
  parseViewMode,
} from "./viewMode.ts";

test("usa o fallback quando o valor é inválido", () => {
  assert.equal(parseViewMode(null, ["list", "slides"], "list"), "list");
  assert.equal(parseViewMode("cards", ["list", "slides"], "list"), "list");
});

test("aceita um valor permitido", () => {
  assert.equal(parseViewMode("slides", ["list", "slides"], "list"), "slides");
});

test("legado 'cards' migra para 'table' (novo padrão)", () => {
  assert.equal(parseViewMode("cards", BOOKS_VIEW_MODES, BOOKS_VIEW_DEFAULT), "table");
  assert.equal(parseViewMode(null, BOOKS_VIEW_MODES, BOOKS_VIEW_DEFAULT), "table");
  assert.equal(parseViewMode("list", BOOKS_VIEW_MODES, BOOKS_VIEW_DEFAULT), "list");
});
