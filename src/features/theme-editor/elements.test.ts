import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import {
  dropOrphanGroups,
  duplicateElementsInList,
  removeElementsInList,
  reorderElementsInList,
} from "./elements.ts";

let n = 0;
const makeId = () => `new-${++n}`;
const makeGroupId = () => `group-new`;

const el = (id: string, groupId?: string): ThemeElement => ({
  id,
  type: "RECTANGLE",
  x: 0,
  y: 0,
  visible: true,
  locked: false,
  css: { left: "0px", top: "0px", width: "10px", height: "10px" },
  ...(groupId ? { groupId, groupName: "G" } : {}),
});

test("duplica grupo com novo groupId e offset", () => {
  n = 0;
  const list = [el("a", "g1"), el("b", "g1"), el("c")];
  const { elements, newIds } = duplicateElementsInList(list, ["a", "b"], {
    makeId,
    makeGroupId,
  });
  assert.equal(elements.length, 5);
  assert.deepEqual(newIds, ["new-1", "new-2"]);
  const copies = elements.filter((e) => newIds.includes(e.id));
  assert.ok(copies.every((e) => e.groupId === "group-new"));
  assert.ok(copies.every((e) => e.css.left === "20px" && e.css.top === "20px"));
  assert.equal(elements[2].id, "new-1");
});

test("duplicar um membro de grupo gera item avulso", () => {
  n = 0;
  const { elements } = duplicateElementsInList([el("a", "g1"), el("b", "g1")], ["a"], {
    makeId,
    makeGroupId,
  });
  const copy = elements.find((e) => e.id === "new-1");
  assert.equal(copy?.groupId, undefined);
});

test("remover respeita minKeep e dissolve grupo órfão", () => {
  const list = [el("a", "g1"), el("b", "g1"), el("c")];
  assert.deepEqual(removeElementsInList(list, ["a", "b", "c"], { minKeep: 1 }), list);
  const out = removeElementsInList(list, ["a"], {});
  assert.equal(out.find((e) => e.id === "b")?.groupId, undefined);
});

test("reordena bloco", () => {
  const list = [el("a"), el("b"), el("c")];
  assert.deepEqual(
    reorderElementsInList(list, ["b"], "forward").map((e) => e.id),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    reorderElementsInList(list, ["b"], "backward").map((e) => e.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    reorderElementsInList(list, ["b"], "front").map((e) => e.id),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    reorderElementsInList(list, ["b"], "back").map((e) => e.id),
    ["b", "a", "c"],
  );
});

test("dropOrphanGroups mantém grupos com 2+ membros", () => {
  const list = [el("a", "g1"), el("b", "g1"), el("c", "g2")];
  const out = dropOrphanGroups(list);
  assert.equal(out[0].groupId, "g1");
  assert.equal(out[1].groupId, "g1");
  assert.equal(out[2].groupId, undefined);
});
