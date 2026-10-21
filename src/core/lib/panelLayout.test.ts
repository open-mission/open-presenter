import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PANEL_LAYOUT,
  parsePanelLayout,
  clampPanelWidth,
  fitPanelLayout,
  SETLIST_WIDTH_MIN,
  SETLIST_WIDTH_MAX,
  SLIDES_WIDTH_MIN,
  SLIDES_WIDTH_MAX,
} from "./panelLayout.ts";

test("clamp respeita os limites", () => {
  assert.equal(clampPanelWidth(100, 240, 480), 240);
  assert.equal(clampPanelWidth(1000, 240, 480), 480);
  assert.equal(clampPanelWidth(320, 240, 480), 320);
});

test("parse usa padrões quando não há dados", () => {
  assert.deepEqual(parsePanelLayout(null), DEFAULT_PANEL_LAYOUT);
  assert.deepEqual(parsePanelLayout({}), DEFAULT_PANEL_LAYOUT);
});

test("parse limita larguras e preserva visibilidade", () => {
  assert.deepEqual(
    parsePanelLayout({
      setlistWidth: 9999,
      slidesWidth: 10,
      monitorsVisible: false,
    }),
    {
      setlistWidth: SETLIST_WIDTH_MAX,
      slidesWidth: SLIDES_WIDTH_MIN,
      monitorsVisible: false,
    },
  );
});

test("parse ignora tipos inválidos", () => {
  assert.deepEqual(
    parsePanelLayout({
      setlistWidth: "320",
      slidesWidth: null,
      monitorsVisible: "false",
    }),
    DEFAULT_PANEL_LAYOUT,
  );
});

test("fitPanelLayout encolhe o centro antes da programação", () => {
  // 600 px para as duas colunas, depois de reservar monitores/divisores.
  assert.deepEqual(fitPanelLayout({ setlistWidth: 320, slidesWidth: 384 }, 852), {
    setlistWidth: 320,
    slidesWidth: 280,
  });
});

test("fitPanelLayout preserva as larguras quando cabem", () => {
  assert.deepEqual(fitPanelLayout({ setlistWidth: 320, slidesWidth: 384 }, 956), {
    setlistWidth: 320,
    slidesWidth: 384,
  });
});