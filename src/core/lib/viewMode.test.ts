import test from "node:test";
import assert from "node:assert/strict";
import { parseViewMode } from "./viewMode.ts";

test("usa o fallback quando o valor é inválido", () => {
  assert.equal(parseViewMode(null, ["list", "slides"], "list"), "list");
  assert.equal(parseViewMode("cards", ["list", "slides"], "list"), "list");
});

test("aceita um valor permitido", () => {
  assert.equal(parseViewMode("slides", ["list", "slides"], "list"), "slides");
});
