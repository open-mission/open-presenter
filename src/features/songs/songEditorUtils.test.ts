import assert from "node:assert/strict";
import test from "node:test";
import { assignSectionLabel } from "./songEditorUtils.ts";

test("rotula o bloco depois de um slide vazio sem destruí-lo", () => {
  assert.equal(
    assignSectionLabel("A\n\n\nB", 2, "chorus"),
    "A\n\n\n## Refrão\nB",
  );
});

test("rotula o primeiro bloco mantendo o vazio", () => {
  assert.equal(
    assignSectionLabel("A\n\n\nB", 0, "verse"),
    "## Verso\nA\n\n\nB",
  );
});

test("não altera o texto quando o alvo é um slide vazio", () => {
  assert.equal(assignSectionLabel("A\n\n\nB", 1, "chorus"), "A\n\n\nB");
});

test("remove rótulo preservando o slide vazio", () => {
  assert.equal(
    assignSectionLabel("A\n\n\n## Refrão\nB", 2, null),
    "A\n\n\nB",
  );
});
