import test from "node:test";
import assert from "node:assert/strict";
import {
  BIBLE_PREVIEW_GRID, MEDIA_PREVIEW_GRID, SETLIST_PREVIEW_GRID,
  SONG_PREVIEW_GRID, clampPreviewLevel, previewGridMinWidth,
  previewGridStyle,
} from "./previewGrid.ts";
import { SLIDES_WIDTH_DEFAULT, SLIDES_WIDTH_MIN } from "./panelLayout.ts";

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

test("nível padrão do setlist rende 4 colunas no painel padrão", () => {
  const padding = 12 * 2;
  const gap = 8;
  const available = SLIDES_WIDTH_DEFAULT - padding;
  const minWidth = previewGridMinWidth(
    SETLIST_PREVIEW_GRID,
    SETLIST_PREVIEW_GRID.defaultLevel,
  );
  const columns = Math.floor((available + gap) / (minWidth + gap));
  assert.equal(columns, 4);
});

test("letras e mídias abrem em 2 colunas do painel mínimo ao padrão", () => {
  const gap = 8;
  for (const width of [SLIDES_WIDTH_MIN, SLIDES_WIDTH_DEFAULT]) {
    const available = width - 12 * 2;
    for (const config of [SONG_PREVIEW_GRID, MEDIA_PREVIEW_GRID]) {
      const minWidth = previewGridMinWidth(config, config.defaultLevel);
      const columns = Math.floor((available + gap) / (minWidth + gap));
      assert.equal(columns, 2);
    }
  }
});

test("zoom para fora aumenta as colunas em letras e mídias", () => {
  for (const config of [SONG_PREVIEW_GRID, MEDIA_PREVIEW_GRID]) {
    assert.ok(
      previewGridMinWidth(config, config.minLevel) >
        previewGridMinWidth(config, config.maxLevel),
    );
    assert.ok(config.maxLevel > config.defaultLevel);
  }
});

test("previewGridStyle usa auto-fit com minmax e 1fr (wrap responsivo)", () => {
  const { gridTemplateColumns } = previewGridStyle(SETLIST_PREVIEW_GRID, 4);
  assert.match(gridTemplateColumns, /^repeat\(auto-fit,\s*minmax\(\d+px,\s*1fr\)\)$/);
  assert.ok(gridTemplateColumns.includes(String(previewGridMinWidth(SETLIST_PREVIEW_GRID, 4))));
});
