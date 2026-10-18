import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveEffectiveWallpaper } from "./effectiveWallpaper.ts";

test("wallpaper do evento tem prioridade", () => {
  assert.equal(
    resolveEffectiveWallpaper("media://wallpapers/evento.png", "media://wallpapers/global.jpg"),
    "media://wallpapers/evento.png",
  );
});

test("usa o wallpaper padrão quando o evento não tem wallpaper", () => {
  assert.equal(
    resolveEffectiveWallpaper(null, "media://wallpapers/global.jpg"),
    "media://wallpapers/global.jpg",
  );
  assert.equal(
    resolveEffectiveWallpaper("   ", "media://wallpapers/global.jpg"),
    "media://wallpapers/global.jpg",
  );
});

test("retorna null quando não há wallpaper", () => {
  assert.equal(resolveEffectiveWallpaper(null, null), null);
  assert.equal(resolveEffectiveWallpaper(undefined, undefined), null);
});
