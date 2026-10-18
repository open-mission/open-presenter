import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendSlideNumberDigit,
  isSlideNumberKey,
  removeLastSlideNumberDigit,
  resolveSlideNumberIndex,
} from "./slideNumbers.ts";

test("acumula dígitos até três", () => {
  assert.equal(appendSlideNumberDigit("", "1"), "1");
  assert.equal(appendSlideNumberDigit("1", "2"), "12");
  assert.equal(appendSlideNumberDigit("12", "3"), "123");
  assert.equal(appendSlideNumberDigit("123", "4"), "123");
});

test("ignora tecla que não é dígito", () => {
  assert.equal(appendSlideNumberDigit("1", "a"), "1");
  assert.equal(appendSlideNumberDigit("", "Enter"), "");
});

test("apaga o último dígito", () => {
  assert.equal(removeLastSlideNumberDigit("12"), "1");
  assert.equal(removeLastSlideNumberDigit("1"), "");
  assert.equal(removeLastSlideNumberDigit(""), "");
});

test("resolve o número digitado para o índice do slide", () => {
  assert.equal(resolveSlideNumberIndex("1", 5), 0);
  assert.equal(resolveSlideNumberIndex("5", 5), 4);
  assert.equal(resolveSlideNumberIndex("10", 10), 9);
  assert.equal(resolveSlideNumberIndex("01", 5), 0);
});

test("número fora do intervalo não navega", () => {
  assert.equal(resolveSlideNumberIndex("0", 5), null);
  assert.equal(resolveSlideNumberIndex("6", 5), null);
  assert.equal(resolveSlideNumberIndex("", 5), null);
});

test("só teclas de um dígito são aceitas", () => {
  assert.equal(isSlideNumberKey("0"), true);
  assert.equal(isSlideNumberKey("9"), true);
  assert.equal(isSlideNumberKey("10"), false);
  assert.equal(isSlideNumberKey("a"), false);
});
