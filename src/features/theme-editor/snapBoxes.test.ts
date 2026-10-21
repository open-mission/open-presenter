import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import { buildSnapBoxes, type ElementBox } from "./snapBoxes.ts";

function element(id: string): ThemeElement {
  return {
    id,
    type: "RECTANGLE",
    x: 0,
    y: 0,
    visible: true,
    locked: false,
    css: {},
  };
}

test("exclui os elementos excluídos do snap", () => {
  const boxes = buildSnapBoxes(
    [element("a"), element("b"), element("c")],
    new Set(["a"]),
    () => ({
      left: 0,
      top: 0,
      width: 10,
      height: 10,
    }),
  );
  assert.equal(boxes.has("a"), false);
  assert.equal(boxes.has("b"), true);
  assert.equal(boxes.has("c"), true);
});

test("exclui o grupo inteiro do arrastado", () => {
  const dragged = { ...element("a"), groupId: "g1" };
  const member = { ...element("b"), groupId: "g1" };
  const alone = element("c");
  const boxes = buildSnapBoxes(
    [dragged, member, alone],
    new Set(["a", "b"]),
    () => ({
      left: 0,
      top: 0,
      width: 10,
      height: 10,
    }),
  );
  assert.deepEqual([...boxes.keys()], ["c"]);
});

test("usa o resolvedor de caixa para cada elemento", () => {
  const boxes = buildSnapBoxes([element("a"), element("b")], new Set(["a"]), (el) => ({
    left: el.id === "b" ? 100 : 0,
    top: 20,
    width: 30,
    height: 40,
  }));
  assert.deepEqual(boxes.get("b"), {
    left: 100,
    top: 20,
    width: 30,
    height: 40,
  });
});

test("chama o resolvedor uma vez por elemento", () => {
  let calls = 0;
  buildSnapBoxes([element("a"), element("b"), element("c")], new Set(["b"]), () => {
    calls += 1;
    return { left: 0, top: 0, width: 1, height: 1 } satisfies ElementBox;
  });
  assert.equal(calls, 2);
});

test("lista vazia gera mapa vazio", () => {
  const boxes = buildSnapBoxes([], new Set(["a"]), () => ({
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  }));
  assert.equal(boxes.size, 0);
});