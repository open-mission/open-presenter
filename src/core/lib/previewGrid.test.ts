import test from "node:test";
import assert from "node:assert/strict";
import {
  BIBLE_PREVIEW_GRID, SETLIST_PREVIEW_GRID,
  clampPreviewLevel, previewGridMinWidth, previewGridStyle,
} from "./previewGrid.ts";

test("clampPreviewLevel arredonda e limita no intervalo", () => {
  assert.equal(clampPreviewLevel(BIBLE_PREVIEW_GRID, 0), 1);
  assert.equal(clampPreviewLevel(BIBLE_PREVIEW_GRID, 3.6), 3);
  assert.equal(clampPreviewLevel(SETLIST_PREVIEW_GRID, 9), 5);
  assert.equal(clampPreviewLevel(SETLIST_PREVIEW_GRID, 2.4), 2);
});

test("zoom maior => largura mínima menor (mais colunas)", () => {
  assert.ok(previewGridMinWidth(BIBLE_PREVIEW_GRID, 1) > previewGridMinWidth(BIBLE_PREVIEW_GRID, 3));
  assert.equal(BIBLE_PREVIEW_GRID.defaultLevel, 2);
  assert.equal(SETLIST_PREVIEW_GRID.defaultLevel, 4);
});

test("previewGridStyle usa auto-fit com minmax e 1fr (wrap responsivo)", () => {
  const { gridTemplateColumns } = previewGridStyle(SETLIST_PREVIEW_GRID, 4);
  assert.match(gridTemplateColumns, /^repeat\(auto-fit,\s*minmax\(\d+px,\s*1fr\)\)$/);
  assert.ok(gridTemplateColumns.includes(String(previewGridMinWidth(SETLIST_PREVIEW_GRID, 4))));
});
