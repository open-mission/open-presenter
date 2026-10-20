import { test } from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "../../core/types/index.ts";
import {
  groupElementsInList,
  ungroupElementsInList,
  renameGroupInList,
  toggleGroupVisibleInList,
  toggleGroupLockedInList,
  moveGroupInList,
  removeGroupInList,
  updateElementsInList,
} from "./groups.ts";

function mockElement(id: string, name?: string, partial?: Partial<ThemeElement>): ThemeElement {
  return {
    id,
    name,
    type: "TEXT",
    x: 0,
    y: 0,
    visible: true,
    locked: false,
    css: {
      left: "0px",
      top: "0px",
      width: "200px",
      height: "100px",
    },
    ...partial,
  };
}

test("groupElementsInList agrupa elementos contiguamente com id e nome", () => {
  const elements = [
    mockElement("el-1", "Título"),
    mockElement("el-2", "Subtítulo"),
    mockElement("el-3", "Rodapé"),
  ];

  const res = groupElementsInList(elements, ["el-1", "el-3"], "Cabeçalho");
  assert.ok(res.groupId.startsWith("group_"));
  assert.equal(res.elements.length, 3);

  // Deve posicionar os agrupados contiguamente no índice do primeiro selecionado (0)
  assert.equal(res.elements[0].id, "el-1");
  assert.equal(res.elements[1].id, "el-3");
  assert.equal(res.elements[2].id, "el-2");

  assert.equal(res.elements[0].groupId, res.groupId);
  assert.equal(res.elements[0].groupName, "Cabeçalho");
  assert.equal(res.elements[1].groupId, res.groupId);
  assert.equal(res.elements[1].groupName, "Cabeçalho");
  assert.equal(res.elements[2].groupId, undefined);
});

test("groupElementsInList não agrupa quando menos de 2 elementos forem informados", () => {
  const elements = [mockElement("el-1")];
  const res = groupElementsInList(elements, ["el-1"]);
  assert.equal(res.groupId, "");
  assert.equal(res.elements, elements);
});

test("renameGroupInList altera o nome de todos os elementos do grupo", () => {
  const elements = [
    mockElement("el-1", "A", { groupId: "g1", groupName: "Antigo" }),
    mockElement("el-2", "B", { groupId: "g1", groupName: "Antigo" }),
    mockElement("el-3", "C"),
  ];

  const updated = renameGroupInList(elements, "g1", "Novo Nome");
  assert.equal(updated[0].groupName, "Novo Nome");
  assert.equal(updated[1].groupName, "Novo Nome");
  assert.equal(updated[2].groupName, undefined);
});

test("ungroupElementsInList remove groupId e groupName dos elementos do grupo", () => {
  const elements = [
    mockElement("el-1", "A", { groupId: "g1", groupName: "Grupo 1" }),
    mockElement("el-2", "B", { groupId: "g1", groupName: "Grupo 1" }),
    mockElement("el-3", "C"),
  ];

  const updated = ungroupElementsInList(elements, "g1");
  assert.equal(updated[0].groupId, undefined);
  assert.equal(updated[0].groupName, undefined);
  assert.equal(updated[1].groupId, undefined);
  assert.equal(updated[1].groupName, undefined);
  assert.equal(updated[2].groupId, undefined);
});

test("toggleGroupVisibleInList alterna visibilidade de todos os elementos do grupo", () => {
  const elements = [
    mockElement("el-1", "A", { groupId: "g1", visible: true }),
    mockElement("el-2", "B", { groupId: "g1", visible: true }),
    mockElement("el-3", "C", { visible: true }),
  ];

  const toggledOff = toggleGroupVisibleInList(elements, "g1");
  assert.equal(toggledOff[0].visible, false);
  assert.equal(toggledOff[1].visible, false);
  assert.equal(toggledOff[2].visible, true);

  const toggledOn = toggleGroupVisibleInList(toggledOff, "g1");
  assert.equal(toggledOn[0].visible, true);
  assert.equal(toggledOn[1].visible, true);
});

test("toggleGroupLockedInList alterna bloqueio de todos os elementos do grupo", () => {
  const elements = [
    mockElement("el-1", "A", { groupId: "g1", locked: false }),
    mockElement("el-2", "B", { groupId: "g1", locked: false }),
    mockElement("el-3", "C", { locked: false }),
  ];

  const locked = toggleGroupLockedInList(elements, "g1");
  assert.equal(locked[0].locked, true);
  assert.equal(locked[1].locked, true);
  assert.equal(locked[2].locked, false);
});

test("moveGroupInList move o bloco do grupo para cima ou para baixo", () => {
  const elements = [
    mockElement("el-0", "Topo"),
    mockElement("el-1", "G1-A", { groupId: "g1" }),
    mockElement("el-2", "G1-B", { groupId: "g1" }),
    mockElement("el-3", "Fundo"),
  ];

  // Mover para cima (-1)
  const movedUp = moveGroupInList(elements, "g1", -1);
  assert.deepEqual(
    movedUp.map((e) => e.id),
    ["el-1", "el-2", "el-0", "el-3"]
  );

  // Mover para baixo (+1) a partir do original
  const movedDown = moveGroupInList(elements, "g1", 1);
  assert.deepEqual(
    movedDown.map((e) => e.id),
    ["el-0", "el-3", "el-1", "el-2"]
  );
});

test("removeGroupInList remove todos os elementos do grupo", () => {
  const elements = [
    mockElement("el-1", "A", { groupId: "g1" }),
    mockElement("el-2", "B", { groupId: "g1" }),
    mockElement("el-3", "C"),
  ];

  const res = removeGroupInList(elements, "g1");
  assert.equal(res.length, 1);
  assert.equal(res[0].id, "el-3");
});

test("updateElementsInList atualiza múltiplos elementos atomicamente", () => {
  const elements = [
    mockElement("el-1", "A", { x: 0, y: 0 }),
    mockElement("el-2", "B", { x: 10, y: 10 }),
  ];

  const updated = updateElementsInList(elements, [
    { id: "el-1", patch: { x: 50, y: 60 } },
    { id: "el-2", patch: { x: 70, y: 80 } },
  ]);

  assert.equal(updated[0].x, 50);
  assert.equal(updated[0].y, 60);
  assert.equal(updated[1].x, 70);
  assert.equal(updated[1].y, 80);
});
