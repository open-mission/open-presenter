import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import {
  EMPTY_SELECTION,
  alignmentTargetFor,
  duplicateSelectionInList,
  groupMemberIds,
  groupSelectionInList,
  pruneSelection,
  removeSelectionInList,
  resolveClickSelection,
  selectableIds,
  selectionVisualBox,
  toggleInSelection,
  ungroupSelectionInList,
} from "./selection.ts";

const el = (
  id: string,
  left: number,
  top: number,
  w: number,
  h: number,
  groupId?: string,
  extra: Partial<ThemeElement> = {},
): ThemeElement => ({
  id,
  type: "RECTANGLE",
  x: left,
  y: top,
  visible: true,
  locked: false,
  css: { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` },
  ...(groupId ? { groupId, groupName: "G" } : {}),
  ...extra,
});

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test("clique em membro fora do grupo seleciona o grupo", () => {
  const list = [
    el("a", 0, 0, 100, 50, "g1"),
    el("b", 100, 0, 100, 50, "g1"),
    el("c", 0, 100, 10, 10),
  ];
  assert.deepEqual(resolveClickSelection(list, "a", null), {
    ids: ["a", "b"],
    anchorId: "a",
    enteredGroupId: null,
  });
  assert.deepEqual(resolveClickSelection(list, "a", "g1"), {
    ids: ["a"],
    anchorId: "a",
    enteredGroupId: "g1",
  });
  assert.deepEqual(resolveClickSelection(list, "c", null), {
    ids: ["c"],
    anchorId: "c",
    enteredGroupId: null,
  });
  assert.deepEqual(resolveClickSelection(list, "c", "g1"), {
    ids: ["c"],
    anchorId: "c",
    enteredGroupId: null,
  });
});

test("groupMemberIds devolve os membros na ordem da lista", () => {
  const list = [el("a", 0, 0, 10, 10, "g1"), el("b", 0, 0, 10, 10), el("c", 0, 0, 10, 10, "g1")];
  assert.deepEqual(groupMemberIds(list, "g1"), ["a", "c"]);
  assert.deepEqual(groupMemberIds(list, "nope"), []);
});

test("shift adiciona, remove e atualiza o âncora", () => {
  const list = [
    el("a", 0, 0, 10, 10, "g1"),
    el("b", 10, 0, 10, 10, "g1"),
    el("c", 0, 20, 10, 10),
  ];
  const added = toggleInSelection(
    list,
    { ids: ["c"], anchorId: "c", enteredGroupId: null },
    "a",
  );
  assert.deepEqual(added, { ids: ["c", "a"], anchorId: "c", enteredGroupId: null });

  const removed = toggleInSelection(
    list,
    { ids: ["c", "a"], anchorId: "c", enteredGroupId: null },
    "c",
  );
  assert.deepEqual(removed, { ids: ["a"], anchorId: "a", enteredGroupId: null });

  const leaving = toggleInSelection(
    list,
    { ids: ["a", "b"], anchorId: "a", enteredGroupId: "g1" },
    "a",
  );
  assert.deepEqual(leaving, { ids: ["b"], anchorId: "b", enteredGroupId: null });

  assert.deepEqual(
    toggleInSelection(list, { ids: ["a"], anchorId: "a", enteredGroupId: null }, "a"),
    EMPTY_SELECTION,
  );
});

test("selectableIds exclui oculto e travado", () => {
  const list = [
    el("a", 0, 0, 10, 10),
    el("b", 0, 0, 10, 10, undefined, { visible: false }),
    el("c", 0, 0, 10, 10, undefined, { locked: true }),
    el("d", 0, 0, 10, 10),
  ];
  assert.deepEqual(selectableIds(list), ["a", "d"]);
});

test("pruneSelection limpa ids e âncora inexistentes", () => {
  const list = [el("a", 0, 0, 10, 10, "g1"), el("b", 0, 0, 10, 10, "g1")];
  assert.deepEqual(
    pruneSelection(list, { ids: ["a", "missing"], anchorId: "missing", enteredGroupId: "gX" }),
    { ids: ["a"], anchorId: "a", enteredGroupId: null },
  );
  assert.deepEqual(
    pruneSelection(list, { ids: ["a"], anchorId: "a", enteredGroupId: "g1" }),
    { ids: ["a"], anchorId: "a", enteredGroupId: "g1" },
  );
  assert.deepEqual(pruneSelection(list, { ids: [], anchorId: null, enteredGroupId: null }), EMPTY_SELECTION);
});

test("selectionVisualBox usa o AABB visual e devolve null vazio", () => {
  const rotated: ThemeElement = {
    ...el("r", 0, 0, 100, 50),
    css: { left: "0px", top: "0px", width: "100px", height: "50px", rotate: "90deg" },
  };
  const box = selectionVisualBox([rotated], ["r"]);
  assert.ok(box);
  assert.ok(near(box.left, 25));
  assert.ok(near(box.top, -25));
  assert.ok(near(box.width, 50));
  assert.ok(near(box.height, 100));

  const union = selectionVisualBox([el("a", 0, 0, 100, 50), el("b", 300, 0, 50, 100)], ["a", "b"]);
  assert.deepEqual(union, { left: 0, top: 0, width: 350, height: 100 });
  assert.equal(selectionVisualBox([rotated], []), null);
});

test("alinhamento de item entrado usa a caixa do grupo", () => {
  const list = [el("a", 0, 0, 100, 50, "g1"), el("b", 300, 0, 100, 50, "g1")];
  const target = alignmentTargetFor(list, { ids: ["a"], anchorId: "a", enteredGroupId: "g1" });
  assert.deepEqual(target, { left: 0, top: 0, width: 400, height: 50 });

  assert.deepEqual(
    alignmentTargetFor(list, { ids: ["a", "b"], anchorId: "a", enteredGroupId: null }),
    { left: 0, top: 0, width: 400, height: 50 },
  );

  assert.deepEqual(
    alignmentTargetFor([el("c", 0, 0, 10, 10)], { ids: ["c"], anchorId: "c", enteredGroupId: null }),
    { left: 0, top: 0, width: 1920, height: 1080 },
  );
});

test("duplicar seleção retorna os novos ids selecionados", () => {
  let n = 0;
  const list = [
    el("a", 0, 0, 10, 10, "g1"),
    el("b", 10, 0, 10, 10, "g1"),
    el("c", 0, 20, 10, 10),
  ];
  const out = duplicateSelectionInList(
    list,
    { ids: ["a", "b"], anchorId: "a", enteredGroupId: null },
    { makeId: () => `new-${++n}`, makeGroupId: () => "group-new" },
  );
  assert.equal(out.elements.length, 5);
  assert.deepEqual(out.selection, {
    ids: ["new-1", "new-2"],
    anchorId: "new-1",
    enteredGroupId: null,
  });
});

test("apagar metade do grupo dissolve o grupo", () => {
  const list = [el("a", 0, 0, 10, 10, "g1"), el("b", 10, 0, 10, 10, "g1")];
  const out = removeSelectionInList(list, { ids: ["a"], anchorId: "a", enteredGroupId: "g1" });
  assert.equal(out.elements[0].groupId, undefined);
  assert.deepEqual(out.selection, EMPTY_SELECTION);
});

test("apagar bloqueado por minKeep mantém a seleção", () => {
  const list = [el("a", 0, 0, 10, 10)];
  const out = removeSelectionInList(
    list,
    { ids: ["a"], anchorId: "a", enteredGroupId: null },
    { minKeep: 1 },
  );
  assert.deepEqual(out.elements, list);
  assert.deepEqual(out.selection, { ids: ["a"], anchorId: "a", enteredGroupId: null });
});

test("agrupar membros de grupos diferentes dissolve os grupos antigos órfãos", () => {
  const list = [
    el("a", 0, 0, 10, 10, "g1"),
    el("b", 10, 0, 10, 10, "g1"),
    el("c", 0, 20, 10, 10, "g2"),
    el("d", 10, 20, 10, 10, "g2"),
  ];
  const out = groupSelectionInList(list, { ids: ["a", "c"], anchorId: "a", enteredGroupId: null });
  assert.equal(out.elements.find((e) => e.id === "b")?.groupId, undefined);
  assert.equal(out.elements.find((e) => e.id === "d")?.groupId, undefined);
  assert.equal(out.elements.find((e) => e.id === "a")?.groupId, out.groupId);
  assert.equal(out.elements.find((e) => e.id === "c")?.groupId, out.groupId);
  assert.deepEqual(out.selection.ids, ["a", "c"]);
  assert.equal(out.selection.enteredGroupId, null);
});

test("agrupar exige 2+ ids", () => {
  const list = [el("a", 0, 0, 10, 10)];
  const selection = { ids: ["a"], anchorId: "a", enteredGroupId: null };
  const out = groupSelectionInList(list, selection);
  assert.equal(out.groupId, "");
  assert.deepEqual(out.elements, list);
  assert.deepEqual(out.selection, selection);
});

test("desagrupar remove o grupo dos selecionados", () => {
  const list = [
    el("a", 0, 0, 10, 10, "g1"),
    el("b", 10, 0, 10, 10, "g1"),
    el("c", 0, 20, 10, 10),
  ];
  const out = ungroupSelectionInList(list, {
    ids: ["a", "b"],
    anchorId: "a",
    enteredGroupId: "g1",
  });
  assert.ok(out.elements.every((e) => e.groupId === undefined));
  assert.deepEqual(out.selection, { ids: ["a", "b"], anchorId: "a", enteredGroupId: null });
});
