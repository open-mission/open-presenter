import test from "node:test";
import assert from "node:assert/strict";
import {
  generateNoiseDataUrl,
  generateSvgNoiseDataUrl,
  applyNoiseToBackground,
  removeNoiseFromBackground,
  hasNoiseLayer,
  NOISE_PRESETS,
} from "./noiseGenerator.ts";

test("generateSvgNoiseDataUrl gera data url SVG válida com feTurbulence", () => {
  const url = generateSvgNoiseDataUrl({ opacity: 0.2, grainSize: 2 });
  assert.ok(url.startsWith('url("data:image/svg+xml,'));
  assert.ok(decodeURIComponent(url).includes("feTurbulence"));
  assert.ok(decodeURIComponent(url).includes("opacity='0.2'"));
});

test("generateNoiseDataUrl em ambiente Node gera SVG Data URL sem erro", () => {
  const url = generateNoiseDataUrl({ opacity: 0.15 });
  assert.ok(url.startsWith('url("data:image/'));
});

test("applyNoiseToBackground concatena ruído como primeira camada do fundo", () => {
  const noise = 'url("data:image/svg+xml,test")';
  const baseGradient = "linear-gradient(135deg, #1e3a8a 0%, #000000 100%)";
  const combined = applyNoiseToBackground(baseGradient, noise);

  assert.equal(combined, `${noise}, ${baseGradient}`);
  assert.ok(hasNoiseLayer(combined));
});

test("applyNoiseToBackground substitui ruído anterior sem duplicar", () => {
  const noise1 = 'url("data:image/svg+xml,noise1")';
  const noise2 = 'url("data:image/svg+xml,noise2")';
  const base = "#0f172a";

  const first = applyNoiseToBackground(base, noise1);
  const second = applyNoiseToBackground(first, noise2);

  assert.equal(second, `${noise2}, ${base}`);
});

test("removeNoiseFromBackground remove a camada de ruído preservando o gradiente", () => {
  const noise = 'url("data:image/svg+xml,abc")';
  const base = "radial-gradient(circle, #ff0000 0%, #000000 100%)";
  const combined = `${noise}, ${base}`;

  assert.equal(removeNoiseFromBackground(combined), base);
  assert.equal(removeNoiseFromBackground(base), base);
  assert.equal(removeNoiseFromBackground(""), "");
});

test("presets de ruído estão definidos e possuem opções válidas", () => {
  assert.ok(NOISE_PRESETS.length >= 4);
  for (const preset of NOISE_PRESETS) {
    assert.ok(preset.name.length > 0);
    assert.ok(preset.options.opacity !== undefined && preset.options.opacity > 0);
  }
});
