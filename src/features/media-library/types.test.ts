import test from "node:test";
import assert from "node:assert/strict";
import type { ImageTreeNode } from "@/core/types";
import {
  assetSupportsOutput,
  backgroundFromAsset,
  buildImageAssets,
  buildShaderAssets,
  inferImageCategory,
  type BackgroundAsset,
} from "./types.ts";

const asset = (patch: Partial<BackgroundAsset>): BackgroundAsset => ({
  id: "a",
  name: "Ativo",
  kind: "image",
  source: "x.png",
  category: "public",
  ...patch,
});

test("compatibilidade: any aceita tudo; public só public; lower só lower", () => {
  assert.equal(assetSupportsOutput(asset({ category: "any" }), "public"), true);
  assert.equal(assetSupportsOutput(asset({ category: "any" }), "lower"), true);
  assert.equal(assetSupportsOutput(asset({ category: "public" }), "public"), true);
  assert.equal(assetSupportsOutput(asset({ category: "public" }), "lower"), false);
  assert.equal(assetSupportsOutput(asset({ category: "lower" }), "lower"), true);
  assert.equal(assetSupportsOutput(asset({ category: "lower" }), "stage"), false);
});

test("backgroundFromAsset respeita kind e ISF", () => {
  assert.deepEqual(backgroundFromAsset(asset({ kind: "image", source: "img.png" })), {
    id: "a",
    kind: "image",
    value: "img.png",
  });
  assert.equal(
    backgroundFromAsset(asset({ kind: "shader", source: "isf:plasma" })).kind,
    "isf",
  );
  assert.equal(
    backgroundFromAsset(asset({ kind: "shader", source: "linear-gradient(#000,#fff)" })).kind,
    "css",
  );
});

test("inferImageCategory classifica lower só por indício no caminho/nome", () => {
  assert.equal(inferImageCategory("Lower Thirds/barra.png"), "lower");
  assert.equal(inferImageCategory("fundos/vinheta azul.png"), "lower");
  assert.equal(inferImageCategory("fundos/ceu.png"), "public");
});

test("buildImageAssets achata a árvore e mantém url", () => {
  const tree: ImageTreeNode[] = [
    {
      name: "fundos",
      path: "fundos",
      kind: "folder",
      children: [
        { name: "ceu.png", path: "fundos/ceu.png", kind: "image", url: "media://ceu.png" },
        { name: "sub", path: "fundos/sub", kind: "folder", children: [] },
      ],
    },
    { name: "sem-url.png", path: "sem-url.png", kind: "image" },
  ];
  const assets = buildImageAssets(tree);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].source, "media://ceu.png");
  assert.equal(assets[0].category, "public");
});

test("buildShaderAssets ignora cor e prefixa ISF", () => {
  const assets = buildShaderAssets([
    { id: "bg-black", kind: "color", value: "#000" },
    { id: "bg-night", kind: "css", value: "radial-gradient(#000,#111)" },
    { id: "bg-isf-demo", kind: "isf", value: "plasma" },
  ]);
  assert.equal(assets.length, 2);
  assert.equal(assets[1].source, "isf:plasma");
  assert.equal(assets[1].kind, "shader");
});
