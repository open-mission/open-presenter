import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitFontSize,
  lineHeightPx,
  parsePadding,
  resolveFitBounds,
  resolveFitMode,
  resolveLineHeightRatio,
  type FitMeasureFn,
} from "./fitText.ts";

test("resolveFitMode entende fitMode explícito e props legadas", () => {
  assert.equal(resolveFitMode({ fitMode: "fixed" }), "fixed");
  assert.equal(resolveFitMode({ fitMode: "fit" }), "fit");
  assert.equal(resolveFitMode({ autoFit: "true" }), "fit");
  assert.equal(resolveFitMode({ autoShrink: "false" }), "fixed");
  assert.equal(resolveFitMode({ autoShrink: "true" }), "shrink");
  assert.equal(resolveFitMode({}), "shrink");
});

test("resolveFitBounds usa a base como teto no modo shrink", () => {
  const bounds = resolveFitBounds({ fontSize: "64px", minFontSize: "20px" });
  assert.deepEqual(bounds, { mode: "shrink", base: 64, min: 20, max: 64 });
});

test("resolveFitBounds rebaixa um mínimo maior que a base", () => {
  const bounds = resolveFitBounds({ fontSize: "12px", minFontSize: "20px" });
  assert.equal(bounds.min, 12);
  assert.equal(bounds.max, 12);
});

test("resolveFitBounds aplica 2.5x como máximo padrão do auto-fit", () => {
  const bounds = resolveFitBounds({ fontSize: "20px", fitMode: "fit" });
  assert.equal(bounds.mode, "fit");
  assert.equal(bounds.base, 20);
  assert.equal(bounds.max, 50);
});

test("resolveFitBounds respeita maxFontSize explícito", () => {
  const bounds = resolveFitBounds({
    fontSize: "20px",
    fitMode: "fit",
    maxFontSize: "96px",
  });
  assert.equal(bounds.max, 96);
});

test("fitFontSize devolve o maior inteiro que cabe", () => {
  const measure: FitMeasureFn = (size) => ({
    width: size * 10,
    height: size * 1.25,
  });
  const result = fitFontSize(
    measure,
    { width: 450, height: 1000 },
    { mode: "shrink", base: 64, min: 16, max: 64 },
  );
  assert.equal(result.size, 45);
  assert.equal(result.overflow, false);
});

test("fitFontSize nunca ultrapassa o máximo", () => {
  const measure: FitMeasureFn = () => ({ width: 1, height: 1 });
  const result = fitFontSize(
    measure,
    { width: 1000, height: 1000 },
    { mode: "fit", base: 20, min: 20, max: 50 },
  );
  assert.equal(result.size, 50);
});

test("fitFontSize devolve o mínimo com overflow quando nem o mínimo cabe", () => {
  const measure: FitMeasureFn = () => ({ width: 9999, height: 9999 });
  const result = fitFontSize(
    measure,
    { width: 100, height: 100 },
    { mode: "shrink", base: 64, min: 20, max: 64 },
  );
  assert.equal(result.size, 20);
  assert.equal(result.overflow, true);
});

test("fitFontSize no modo fixed ignora a medição", () => {
  let calls = 0;
  const measure: FitMeasureFn = () => {
    calls += 1;
    return { width: 0, height: 0 };
  };
  const result = fitFontSize(
    measure,
    { width: 100, height: 100 },
    { mode: "fixed", base: 48, min: 16, max: 48 },
  );
  assert.equal(result.size, 48);
  assert.equal(result.overflow, false);
  assert.equal(calls, 0);
});

test("fitFontSize com caixa inválida não colapsa para o mínimo", () => {
  const result = fitFontSize(
    () => ({ width: 0, height: 0 }),
    { width: 0, height: 0 },
    { mode: "shrink", base: 48, min: 16, max: 48 },
  );
  assert.equal(result.size, 48);
});

test("resolveLineHeightRatio aceita px, razão e porcentagem", () => {
  assert.equal(resolveLineHeightRatio("1.25", 64), 1.25);
  assert.equal(resolveLineHeightRatio("80px", 64), 1.25);
  assert.equal(resolveLineHeightRatio("125%", 64), 1.25);
  assert.equal(resolveLineHeightRatio(undefined, 64), 1.25);
  assert.equal(resolveLineHeightRatio("abc", 64), 1.25);
});

test("lineHeightPx arredonda e nunca fica abaixo de 1", () => {
  assert.equal(lineHeightPx(45, 1.25), 56);
  assert.equal(lineHeightPx(1, 0), 1);
});

test("parsePadding lê shorthand e lados individuais", () => {
  assert.deepEqual(parsePadding({ padding: "10px 20px" }), {
    top: 10,
    right: 20,
    bottom: 10,
    left: 20,
  });
  assert.deepEqual(parsePadding({ padding: "8px", paddingTop: "16px" }), {
    top: 16,
    right: 8,
    bottom: 8,
    left: 8,
  });
  assert.deepEqual(parsePadding({}), { top: 0, right: 0, bottom: 0, left: 0 });
});
