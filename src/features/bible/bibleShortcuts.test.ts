import test from "node:test";
import assert from "node:assert/strict";
import { shouldOpenPaletteOnKey } from "./bibleShortcuts.ts";

const key = (value: string) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
});

test("sem apresentação, B/C/F abrem a paleta", () => {
  for (const value of ["b", "c", "f", "J", "3"]) {
    assert.equal(shouldOpenPaletteOnKey(key(value), false), true);
  }
});

test("com apresentação, B/C/F não abrem a paleta", () => {
  for (const value of ["b", "B", "c", "C", "f", "F"]) {
    assert.equal(shouldOpenPaletteOnKey(key(value), true), false);
  }
});

test("com apresentação, outras teclas ainda abrem a paleta", () => {
  assert.equal(shouldOpenPaletteOnKey(key("j"), true), true);
  assert.equal(shouldOpenPaletteOnKey(key("3"), true), true);
});

test("não captura modificadores, Enter ou espaço", () => {
  assert.equal(
    shouldOpenPaletteOnKey({ key: "j", metaKey: true, ctrlKey: false, altKey: false }, false),
    false,
  );
  assert.equal(
    shouldOpenPaletteOnKey({ key: "j", metaKey: false, ctrlKey: true, altKey: false }, false),
    false,
  );
  assert.equal(shouldOpenPaletteOnKey(key("Enter"), false), false);
  assert.equal(shouldOpenPaletteOnKey(key(" "), false), false);
});