import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlideGroups } from "./lyrics.ts";
import { findSongGroup, songGroupColor } from "./songGroups.ts";
import type { SongGroupConfig } from "../types/index.ts";

const GROUPS: SongGroupConfig[] = [
  { id: "verse", name: "Verso", color: "#3b82f6", shortcut: "V", typeKey: "verse" },
  { id: "chorus", name: "Refrão", color: "#ef4444", shortcut: "C", typeKey: "chorus" },
];

test("slide sem rótulo entra no grupo da seção anterior", () => {
  const groups = computeSlideGroups([
    { index: 0, label: "Verso 1", sectionType: "verse" },
    { index: 1, label: null, sectionType: null },
    { index: 2, label: "Refrão", sectionType: "chorus" },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].indices, [0, 1]);
  assert.equal(groups[0].label, "Verso 1");
  assert.equal(groups[0].sectionType, "verse");
  assert.deepEqual(groups[1].indices, [2]);
});

test("slide inicial sem rótulo forma grupo próprio", () => {
  const groups = computeSlideGroups([
    { index: 0, label: null, sectionType: null },
    { index: 1, label: "Refrão", sectionType: "chorus" },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, null);
  assert.equal(groups[0].sectionType, null);
});

test("rótulo ausente é tratado como nulo ao agrupar", () => {
  const groups = computeSlideGroups([
    { index: 0, label: "Verso 1", sectionType: "verse" },
    { index: 1 },
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].indices, [0, 1]);
});

test("grupo é localizado pelo tipo da seção", () => {
  const group = findSongGroup(GROUPS, "chorus", "Refrão");
  assert.equal(group?.id, "chorus");
  assert.equal(group?.shortcut, "C");
});

test("grupo é localizado pelo rótulo quando não há tipo", () => {
  const group = findSongGroup(GROUPS, null, "Refrão");
  assert.equal(group?.id, "chorus");
});

test("seção sem grupo mantém cor neutra", () => {
  assert.equal(songGroupColor(GROUPS, null, null), null);
  assert.equal(songGroupColor(GROUPS, "verse", "Verso 1"), "#3b82f6");
});
