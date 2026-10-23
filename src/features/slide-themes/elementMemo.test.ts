import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import { areElementRenderPropsEqual } from "./elementMemo.ts";

const element = {
  id: "e1",
  type: "TEXT",
  x: 0,
  y: 0,
  visible: true,
  locked: false,
  css: {},
  text: "Olá",
} as ThemeElement;

test("não re-renderiza com o mesmo elemento e props iguais", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A", lyrics: "B" } },
      { element, props: { title: "A", lyrics: "B" } },
    ),
    true,
  );
});

test("re-renderiza quando o elemento muda de identidade", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A" } },
      { element: { ...element }, props: { title: "A" } },
    ),
    false,
  );
});

test("re-renderiza quando uma prop muda", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A" } },
      { element, props: { title: "B" } },
    ),
    false,
  );
});

test("re-renderiza quando entra ou sai uma prop", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A" } },
      { element, props: { title: "A", lyrics: "B" } },
    ),
    false,
  );
});

test("não re-renderiza quando o objeto de props é o mesmo", () => {
  const props = { title: "A" };
  assert.equal(
    areElementRenderPropsEqual({ element, props }, { element, props }),
    true,
  );
});