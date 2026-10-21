import test from "node:test";
import assert from "node:assert/strict";
import { buildFitGeometryKey } from "./fitGeometry.ts";

test("mover na horizontal não muda a chave de fit", () => {
  const before = buildFitGeometryKey(
    { css: { left: "10px", top: "20px", width: "500px", height: "200px" }, x: 5, y: 10 },
    false,
  );
  const after = buildFitGeometryKey(
    { css: { left: "90px", top: "20px", width: "500px", height: "200px" }, x: 40, y: 10 },
    false,
  );
  assert.equal(before, after);
});

test("mover na vertical só muda a chave com altura automática", () => {
  const fixedBefore = buildFitGeometryKey(
    { css: { top: "20px", width: "500px", height: "200px" }, y: 10 },
    false,
  );
  const fixedAfter = buildFitGeometryKey(
    { css: { top: "80px", width: "500px", height: "200px" }, y: 40 },
    false,
  );
  assert.equal(fixedBefore, fixedAfter);

  const autoBefore = buildFitGeometryKey(
    { css: { top: "20px", width: "500px" }, y: 10 },
    true,
  );
  const autoAfter = buildFitGeometryKey(
    { css: { top: "80px", width: "500px" }, y: 40 },
    true,
  );
  assert.notEqual(autoBefore, autoAfter);
});

test("largura, altura e padding mudam a chave", () => {
  const base = buildFitGeometryKey(
    { css: { width: "500px", height: "200px", padding: "10px" } },
    false,
  );
  const width = buildFitGeometryKey(
    { css: { width: "600px", height: "200px", padding: "10px" } },
    false,
  );
  const padding = buildFitGeometryKey(
    { css: { width: "500px", height: "200px", padding: "20px" } },
    false,
  );
  assert.notEqual(base, width);
  assert.notEqual(base, padding);
});