import test from "node:test";
import assert from "node:assert/strict";
import {
  stageTimerElapsed,
  stageTimerRemaining,
  type StageTimer,
} from "../types/index.ts";

test("stageTimerElapsed calcula tempo decorrido corretamente", () => {
  const stopped: StageTimer = { running: false, elapsedSecs: 45 };
  assert.equal(stageTimerElapsed(stopped, 1000000), 45);

  const running: StageTimer = {
    running: true,
    elapsedSecs: 10,
    startedAtMillis: 1000000,
  };
  assert.equal(stageTimerElapsed(running, 1005000), 15);
});

test("stageTimerRemaining calcula tempo restante em contagem regressiva", () => {
  const countdownTimer: StageTimer = {
    running: false,
    elapsedSecs: 60,
    countdownSecs: 600, // 10 minutos
  };
  assert.equal(stageTimerRemaining(countdownTimer, 0), 540); // 9 minutos restantes

  // Não fica negativo (clamp em 0)
  const expired: StageTimer = {
    running: false,
    elapsedSecs: 700,
    countdownSecs: 600,
  };
  assert.equal(stageTimerRemaining(expired, 0), 0);

  // Sem contagem regressiva, retorna o tempo decorrido
  const stopwatch: StageTimer = {
    running: false,
    elapsedSecs: 42,
    countdownSecs: 0,
  };
  assert.equal(stageTimerRemaining(stopwatch, 0), 42);
});
