import test from "node:test";
import assert from "node:assert/strict";
import { transferItemBetweenEvents } from "./temporaryUtils.ts";
import type { ServiceEvent, EventItem } from "@/core/types";

test("transfere item de um evento para o outro criando parte Avulsas se o destino for vazio", () => {
  const item: EventItem = { id: "item-1", songId: "s1", nextItemId: null, song: null, media: null };
  const source: ServiceEvent = {
    id: "e1",
    title: "Culto",
    eventDate: "2026-10-18",
    parts: [{ id: "p1", title: "Louvor", items: [item] }],
  };
  const target: ServiceEvent = {
    id: "__temporary__",
    title: "Temporário",
    eventDate: "",
    parts: [],
  };

  const result = transferItemBetweenEvents(source, target, "item-1");
  assert.ok(result);
  assert.equal(result.updatedSource.parts[0].items.length, 0);
  assert.equal(result.updatedTarget.parts.length, 1);
  assert.equal(result.updatedTarget.parts[0].title, "Avulsas");
  assert.equal(result.updatedTarget.parts[0].items.length, 1);
  assert.equal(result.updatedTarget.parts[0].items[0].id, "item-1");
});

test("transfere item anexando na última parte existente do destino e limpa ponteiros órfãos", () => {
  const item1: EventItem = { id: "item-1", songId: "s1", nextItemId: "item-2", song: null, media: null };
  const item2: EventItem = { id: "item-2", songId: "s2", nextItemId: null, song: null, media: null };
  const source: ServiceEvent = {
    id: "e1",
    title: "Culto",
    eventDate: "2026-10-18",
    parts: [{ id: "p-src", title: "Louvor", items: [item1, item2] }],
  };
  const target: ServiceEvent = {
    id: "__temporary__",
    title: "Temporário",
    eventDate: "",
    parts: [
      { id: "p1", title: "Abertura", items: [] },
      { id: "p2", title: "Geral", items: [] },
    ],
  };

  const result = transferItemBetweenEvents(source, target, "item-2");
  assert.ok(result);
  assert.equal(result.updatedSource.parts[0].items.length, 1);
  assert.equal(result.updatedSource.parts[0].items[0].nextItemId, null); // ponteiro limpo!
  assert.equal(result.updatedTarget.parts[1].items.length, 1);
  assert.equal(result.updatedTarget.parts[1].items[0].id, "item-2");
});

test("retorna null se o item não for encontrado na origem", () => {
  const source: ServiceEvent = {
    id: "e1",
    title: "Culto",
    eventDate: "2026-10-18",
    parts: [],
  };
  const target: ServiceEvent = {
    id: "__temporary__",
    title: "Temporário",
    eventDate: "",
    parts: [],
  };

  const result = transferItemBetweenEvents(source, target, "item-inexistente");
  assert.equal(result, null);
});
