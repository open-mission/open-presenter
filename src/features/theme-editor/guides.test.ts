import test from "node:test";
import assert from "node:assert/strict";
import type { SlideTheme } from "@/core/types";
import {
  addGuideToTheme,
  clampGuidePos,
  clearGuidesInTheme,
  guidesOfTheme,
  moveGuideInTheme,
  removeGuideFromTheme,
  snapGuidePosition,
  updateGuidesInTheme,
} from "./guides.ts";
import { materializePage } from "../slide-themes/pages.ts";

const theme = (): SlideTheme => ({
  guid: "t",
  title: "T",
  css: {},
  elements: [],
  pages: [
    {
      id: "p1",
      context: "text",
      css: {},
      elements: [],
      guides: [{ id: "g1", axis: "x", pos: 100 }],
    },
    { id: "p2", context: "music", css: {}, elements: [] },
  ],
});

test("lê e atualiza guias da página ativa", () => {
  assert.equal(guidesOfTheme(theme(), "p1")[0].pos, 100);
  const next = updateGuidesInTheme(theme(), "p1", (g) => [
    ...g,
    { id: "g2", axis: "y", pos: 50 },
  ]);
  assert.equal(guidesOfTheme(next, "p1").length, 2);
  assert.equal(guidesOfTheme(next, "p2").length, 0);
});

test("atualiza guias do layout único", () => {
  const single: SlideTheme = { guid: "s", title: "S", css: {}, elements: [], guides: [] };
  const next = updateGuidesInTheme(single, null, () => [{ id: "g", axis: "x", pos: 10 }]);
  assert.equal(next.guides?.length, 1);
  assert.equal(single.guides?.length, 0);
});

test("clamp e snap", () => {
  assert.equal(clampGuidePos("x", -10), 0);
  assert.equal(clampGuidePos("x", 5000), 1920);
  assert.equal(clampGuidePos("y", 2000), 1080);
  assert.equal(snapGuidePosition(104, [100, 300], 6), 100);
  assert.equal(snapGuidePosition(110, [100, 300], 6), null);
});

test("adiciona, move e remove guias da lista", () => {
  const t = theme();
  const added = addGuideToTheme(t, "p1", { id: "g2", axis: "y", pos: 5000 });
  assert.equal(guidesOfTheme(added, "p1").length, 2);
  assert.equal(guidesOfTheme(added, "p1")[1].pos, 1080);

  const moved = moveGuideInTheme(added, "p1", "g2", 20);
  assert.equal(guidesOfTheme(moved, "p1")[1].pos, 20);

  const removed = removeGuideFromTheme(moved, "p1", "g1");
  assert.deepEqual(
    guidesOfTheme(removed, "p1").map((g) => g.id),
    ["g2"],
  );
  assert.equal(guidesOfTheme(clearGuidesInTheme(removed, "p1"), "p1").length, 0);
  assert.equal(guidesOfTheme(t, "p1").length, 1);
});

test("materializePage carrega as guias da página", () => {
  const t = theme();
  const view = materializePage(t, t.pages![0]);
  assert.deepEqual(view.guides, t.pages![0].guides);
});
