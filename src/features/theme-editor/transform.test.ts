import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import {
  alignElementsInList,
  distributeElementsInList,
  elementRotation,
  normalizeDeg,
  rotateElementsInList,
  scaleElementsInList,
  setElementRotation,
  translateElementsInList,
} from "./transform.ts";

const el = (
  id: string,
  left: number,
  top: number,
  w: number,
  h: number,
  css: Record<string, string> = {},
): ThemeElement => ({
  id,
  type: "RECTANGLE",
  x: left,
  y: top,
  visible: true,
  locked: false,
  css: { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, ...css },
});

test("normalizeDeg e setElementRotation", () => {
  assert.equal(normalizeDeg(370), 10);
  assert.equal(normalizeDeg(-190), 170);
  assert.equal(normalizeDeg(180), 180);
  assert.equal(normalizeDeg(-180), 180);
  assert.equal(elementRotation(el("a", 0, 0, 10, 10, { rotate: "12deg" })), 12);
  assert.equal(
    "rotate" in setElementRotation(el("a", 0, 0, 10, 10, { rotate: "12deg" }), 360).css,
    false,
  );
  assert.equal(setElementRotation(el("a", 0, 0, 10, 10), -45).css.rotate, "-45deg");
});

test("scaleElementsInList escala posição e tamanho", () => {
  const list = [el("a", 0, 0, 100, 50), el("b", 100, 50, 100, 50)];
  const out = scaleElementsInList(
    list,
    { left: 0, top: 0, width: 200, height: 100 },
    { left: 0, top: 0, width: 400, height: 100 },
  );
  assert.equal(out[0].css.width, "200px");
  assert.equal(out[0].css.height, "50px");
  assert.equal(out[1].css.left, "200px");
  assert.equal(out[1].css.top, "50px");
  assert.equal(out[1].css.width, "200px");
});

test("scaleElementsInList ancora a borda oposta ao resize oeste", () => {
  const out = scaleElementsInList(
    [el("a", 100, 0, 100, 50)],
    { left: 100, top: 0, width: 100, height: 50 },
    { left: 50, top: 0, width: 150, height: 50 },
  );
  assert.equal(out[0].css.left, "50px");
  assert.equal(out[0].css.width, "150px");
});

test("scaleElementsInList clampa no mínimo e não gera NaN", () => {
  const out = scaleElementsInList(
    [el("a", 0, 0, 100, 50)],
    { left: 0, top: 0, width: 100, height: 50 },
    { left: 0, top: 0, width: 2, height: 2 },
  );
  assert.equal(out[0].css.width, "20px");
  assert.equal(out[0].css.height, "20px");
  assert.ok(!Number.isNaN(Number.parseFloat(out[0].css.left)));

  const zero = [el("a", 0, 0, 100, 50)];
  assert.deepEqual(
    scaleElementsInList(
      zero,
      { left: 0, top: 0, width: 0, height: 0 },
      { left: 0, top: 0, width: 100, height: 100 },
    ),
    zero,
  );
});

test("scaleElementsInList escala fontSize de TEXT pelo fator médio", () => {
  const text = { ...el("t", 0, 0, 100, 100, { fontSize: "40px" }), type: "TEXT" as const };
  const out = scaleElementsInList(
    [text],
    { left: 0, top: 0, width: 100, height: 100 },
    { left: 0, top: 0, width: 200, height: 100 },
  );
  assert.equal(out[0].css.fontSize, "60px");
});

test("rotateElementsInList gira centro e soma rotate", () => {
  const out = rotateElementsInList([el("a", 0, 0, 100, 50)], { x: 100, y: 100 }, 90);
  assert.ok(Math.abs(Number.parseFloat(out[0].css.left ?? "0") - 125) < 0.02);
  assert.ok(Math.abs(Number.parseFloat(out[0].css.top ?? "0") - 25) < 0.02);
  assert.equal(out[0].css.rotate, "90deg");
});

test("translateElementsInList move e respeita locked", () => {
  const out = translateElementsInList(
    [el("a", 10, 10, 10, 10), { ...el("b", 10, 10, 10, 10), locked: true }],
    ["a", "b"],
    5,
    -20,
  );
  assert.equal(out[0].css.left, "15px");
  assert.equal(out[0].css.top, "0px");
  assert.equal(out[1].css.left, "10px");
});

test("alignElementsInList alinha pela borda visual", () => {
  const list = [el("a", 30, 40, 100, 50), el("b", 300, 100, 100, 50)];
  const out = alignElementsInList(list, ["a"], "left", {
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
  });
  assert.equal(out[0].css.left, "0px");
  const right = alignElementsInList(list, ["b"], "right", {
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
  });
  assert.equal(right[1].css.left, "1820px");
});

test("distributeElementsInList iguala lacunas", () => {
  const list = [el("a", 0, 0, 100, 10), el("b", 150, 0, 100, 10), el("c", 400, 0, 100, 10)];
  const out = distributeElementsInList(list, ["a", "b", "c"], "x");
  assert.equal(out[1].css.left, "200px");
});
