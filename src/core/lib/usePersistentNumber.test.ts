import test from "node:test";
import assert from "node:assert/strict";
import { parsePersistentNumber } from "./usePersistentNumber.ts";

test("parsePersistentNumber usa fallback para ausente/NaN", () => {
  assert.equal(parsePersistentNumber(null, 2, 1, 3), 2);
  assert.equal(parsePersistentNumber("abc", 2, 1, 3), 2);
  assert.equal(parsePersistentNumber("NaN", 2, 1, 3), 2);
});

test("parsePersistentNumber limita no intervalo", () => {
  assert.equal(parsePersistentNumber("99", 2, 1, 3), 3);
  assert.equal(parsePersistentNumber("0.4", 2, 1, 3), 1);
  assert.equal(parsePersistentNumber("2", 2, 1, 3), 2);
});
