import test from "node:test";
import assert from "node:assert/strict";
import {
  elementBox,
  parseRotateDeg,
  rectCenter,
  rotatePoint,
  rotatedCorners,
  unionRects,
  visualRect,
  type Rect,
} from "./geometry.ts";
import type { ThemeElement } from "@/core/types";

const el = (over: Partial<ThemeElement> = {}): ThemeElement => ({
  id: "a",
  type: "RECTANGLE",
  x: 0,
  y: 0,
  visible: true,
  locked: false,
  css: {},
  ...over,
});

test("parseRotateDeg lê graus e ignora inválidos", () => {
  assert.equal(parseRotateDeg("12deg"), 12);
  assert.equal(parseRotateDeg(" -7.5deg "), -7.5);
  assert.equal(parseRotateDeg(undefined), 0);
  assert.equal(parseRotateDeg("rotate(10deg)"), 0);
  assert.equal(parseRotateDeg("45"), 0);
});

test("rotatePoint gira 90° em torno do centro", () => {
  const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
  assert.ok(Math.abs(p.x - 0) < 1e-9);
  assert.ok(Math.abs(p.y - 10) < 1e-9);
});

test("visualRect de 100x50 girado 90° fecha o AABB", () => {
  const box: Rect = { left: 0, top: 0, width: 100, height: 50 };
  assert.deepEqual(rectCenter(box), { x: 50, y: 25 });
  assert.equal(rotatedCorners(box, 90).length, 4);
  const aabb = visualRect(box, 90);
  assert.ok(Math.abs(aabb.left - 25) < 1e-9);
  assert.ok(Math.abs(aabb.top + 25) < 1e-9);
  assert.ok(Math.abs(aabb.width - 50) < 1e-9);
  assert.ok(Math.abs(aabb.height - 100) < 1e-9);
});

test("unionRects une caixas e devolve null vazio", () => {
  assert.deepEqual(
    unionRects([
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 50, top: 100, width: 100, height: 50 },
    ]),
    { left: 0, top: 0, width: 150, height: 150 },
  );
  assert.equal(unionRects([]), null);
});

test("elementBox respeita px, medido e fallback", () => {
  assert.deepEqual(
    elementBox(el({ css: { left: "10px", top: "20px", width: "30px", height: "40px" } })),
    { left: 10, top: 20, width: 30, height: 40 },
  );
  assert.deepEqual(
    elementBox(el({ css: { left: "10%", top: "20%", width: "50%", height: "25%" } })),
    { left: 192, top: 216, width: 960, height: 270 },
  );
  assert.deepEqual(
    elementBox(el(), { w: 200, h: 100 }),
    { left: 0, top: 0, width: 200, height: 100 },
  );
});
