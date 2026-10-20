import test from "node:test";
import assert from "node:assert/strict";
import {
  contrastColor,
  hexToRgb,
  mixHex,
  normalizeHex,
  relativeLuminance,
  rgbToHex,
} from "./color.ts";

test("normaliza hex de 3 e 6 dígitos", () => {
  assert.equal(normalizeHex("#abc"), "#aabbcc");
  assert.equal(normalizeHex("#A1B2C3"), "#a1b2c3");
  assert.equal(normalizeHex("#fff"), "#ffffff");
});

test("rejeita valores que não são hex", () => {
  assert.equal(normalizeHex("red"), null);
  assert.equal(normalizeHex("#12"), null);
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(normalizeHex("oklch(0.5 0.2 30)"), null);
});

test("converte hex para rgb e volta", () => {
  assert.deepEqual(hexToRgb("#ff8000"), { r: 255, g: 128, b: 0 });
  assert.equal(rgbToHex(255, 128, 0), "#ff8000");
  assert.equal(rgbToHex(300, -5, 12.6), "#ff000d");
});

test("mistura cores com peso", () => {
  assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
  assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mixHex("#2563eb", "#ffffff", 0.92), "#eef3fd");
});

test("calcula luminância relativa", () => {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.ok(Math.abs(relativeLuminance("#ffffff") - 1) < 0.0001);
  assert.ok(relativeLuminance("#808080") > 0.2);
  assert.ok(relativeLuminance("#808080") < 0.3);
});

test("escolhe contraste adequado para texto sobre a cor", () => {
  assert.equal(contrastColor("#ffffff"), "#111318");
  assert.equal(contrastColor("#f5f5f5"), "#111318");
  assert.equal(contrastColor("#000000"), "#ffffff");
  assert.equal(contrastColor("#111318"), "#ffffff");
  assert.equal(contrastColor("#2563eb"), "#ffffff");
  assert.equal(contrastColor("#fbbf24"), "#111318");
});
