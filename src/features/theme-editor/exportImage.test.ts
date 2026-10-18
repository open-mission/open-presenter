import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCssLinearGradient } from "./exportImage.ts";

test("parseCssLinearGradient com ângulo explícito e porcentagens", () => {
  const gradient = parseCssLinearGradient(
    "linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
  );
  assert.ok(gradient !== null);
  assert.equal(gradient.angleDeg, 135);
  assert.equal(gradient.stops.length, 3);
  assert.equal(gradient.stops[0].color, "#1e1b4b");
  assert.equal(gradient.stops[0].offset, 0);
  assert.equal(gradient.stops[1].color, "#0f172a");
  assert.equal(gradient.stops[1].offset, 0.5);
  assert.equal(gradient.stops[2].color, "#020617");
  assert.equal(gradient.stops[2].offset, 1);
});

test("parseCssLinearGradient com 'to bottom right'", () => {
  const gradient = parseCssLinearGradient(
    "linear-gradient(to bottom right, #451a03, #78350f 50%, #1c1917)",
  );
  assert.ok(gradient !== null);
  assert.equal(gradient.angleDeg, 135);
  assert.equal(gradient.stops.length, 3);
  assert.equal(gradient.stops[0].offset, 0);
  assert.equal(gradient.stops[1].offset, 0.5);
  assert.equal(gradient.stops[2].offset, 1);
});

test("parseCssLinearGradient com 'to right' e sem porcentagens", () => {
  const gradient = parseCssLinearGradient("linear-gradient(to right, red, blue)");
  assert.ok(gradient !== null);
  assert.equal(gradient.angleDeg, 90);
  assert.equal(gradient.stops.length, 2);
  assert.equal(gradient.stops[0].offset, 0);
  assert.equal(gradient.stops[1].offset, 1);
});

test("parseCssLinearGradient com valor não-gradiente retorna null", () => {
  assert.equal(parseCssLinearGradient("#09090b"), null);
  assert.equal(parseCssLinearGradient("url('/wallpaper.jpg')"), null);
  assert.equal(parseCssLinearGradient(""), null);
});
