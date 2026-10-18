import { test } from "node:test";
import assert from "node:assert/strict";
import { wallpaperToBackground } from "./wallpaper.ts";

test("classifica cores como camada de cor", () => {
  assert.equal(wallpaperToBackground("#000000").kind, "color");
  assert.equal(wallpaperToBackground("rgb(10, 20, 30)").kind, "color");
  assert.equal(wallpaperToBackground("hsl(200 50% 10%)").kind, "color");
});

test("classifica gradientes como CSS em vez de imagem", () => {
  assert.equal(
    wallpaperToBackground(
      "radial-gradient(circle at 50% 0%, #1e3a8a 0%, #020617 60%, #000000 100%)",
    ).kind,
    "css",
  );
  assert.equal(
    wallpaperToBackground("linear-gradient(180deg, #111 0%, #222 100%)").kind,
    "css",
  );
});

test("remove o sufixo de fit do valor CSS", () => {
  const gradient =
    "radial-gradient(circle at 50% 0%, #1e3a8a 0%, #020617 60%, #000000 100%)";
  const background = wallpaperToBackground(`${gradient}#fit=cover`);
  assert.equal(background.kind, "css");
  assert.equal(background.value, gradient);
});

test("classifica vídeos inclusive com fit", () => {
  assert.equal(
    wallpaperToBackground("media://wallpapers/fundo.mp4#fit=contain").kind,
    "video",
  );
  assert.equal(wallpaperToBackground("data:video/mp4;base64,AAAA").kind, "video");
});

test("classifica imagens e mantém o valor original", () => {
  const value = "media://wallpapers/fundo.png#fit=contain";
  const background = wallpaperToBackground(value);
  assert.equal(background.kind, "image");
  assert.equal(background.value, value);
});
