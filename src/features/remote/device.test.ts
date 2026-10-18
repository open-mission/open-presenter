import { test } from "node:test";
import assert from "node:assert/strict";
import { deviceLabel } from "./device.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPAD_CHROME =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

test("identifica iPhone com Safari", () => {
  assert.equal(deviceLabel(IPHONE_SAFARI), "iPhone · Safari");
});

test("identifica Android com Chrome", () => {
  assert.equal(deviceLabel(ANDROID_CHROME), "Android · Chrome");
});

test("identifica iPad com Chrome e Edge", () => {
  assert.equal(deviceLabel(IPAD_CHROME), "iPad · Chrome");
  assert.equal(deviceLabel(WINDOWS_EDGE), "Windows · Edge");
});

test("sem user agent retorna dispositivo desconhecido", () => {
  assert.equal(deviceLabel(null), "Dispositivo desconhecido");
  assert.equal(deviceLabel(""), "Dispositivo desconhecido");
});
