import test from "node:test";
import assert from "node:assert/strict";
import { buildStageProps } from "../slide-themes/themeTemplate.ts";
import { DEFAULT_PRESETS } from "./presets.ts";
import type { CommunicationAlert, SlideContent, StageTimer } from "../../core/types/index.ts";

const dummyContent: SlideContent = {
  id: "test-slide-1",
  kind: "song",
  title: "Santo Espírito",
  lines: ["Santo Espírito, és bem-vindo aqui"],
  section: "Verso",
};

const dummyTimer: StageTimer = {
  running: false,
  elapsedSecs: 0,
};

test("buildStageProps resolve variáveis de mensagem do operador quando fornecida", () => {
  const props = buildStageProps({
    content: dummyContent,
    nowMs: Date.now(),
    timer: dummyTimer,
    activeMessage: "Pastor no altar em 5 minutos",
  });

  assert.equal(props.stage_message, "Pastor no altar em 5 minutos");
  assert.equal(props.message, "Pastor no altar em 5 minutos");
  assert.equal(props.mensagem, "Pastor no altar em 5 minutos");
  assert.equal(props.aviso, "Pastor no altar em 5 minutos");
  assert.equal(props.alerta, "Pastor no altar em 5 minutos");
});

test("buildStageProps resolve variáveis de mensagem para vazio quando ausente", () => {
  const props = buildStageProps({
    content: dummyContent,
    nowMs: Date.now(),
    timer: dummyTimer,
    activeMessage: undefined,
  });

  assert.equal(props.stage_message, "");
  assert.equal(props.message, "");
  assert.equal(props.mensagem, "");
  assert.equal(props.aviso, "");
  assert.equal(props.alerta, "");
});

test("DEFAULT_PRESETS contém atalhos válidos com modos, níveis e saídas de destino", () => {
  assert.ok(DEFAULT_PRESETS.length >= 5);
  for (const preset of DEFAULT_PRESETS) {
    assert.ok(preset.id.length > 0);
    assert.ok(preset.label.length > 0);
    assert.ok(preset.text.length > 0);
    assert.ok(["info", "warning", "urgent"].includes(preset.level));
    assert.ok(
      ["banner_top", "banner_bottom", "overlay", "variable_only"].includes(
        preset.displayMode,
      ),
    );
    assert.ok(Array.isArray(preset.targets));
    assert.ok(preset.targets.length > 0);
    for (const tgt of preset.targets) {
      assert.ok(["stage", "public", "stream"].includes(tgt));
    }
  }
});

test("estrutura de CommunicationAlert é serializável e possui todos os campos incluindo multi-destinos", () => {
  const alert: CommunicationAlert = {
    id: "alert-1",
    text: "Abaixe o volume do retorno",
    displayMode: "banner_bottom",
    scroll: false,
    level: "warning",
    sender: "Operador",
    target: "stage",
    targets: ["stage", "public"],
    autoDismissSeconds: 30,
    createdAt: new Date().toISOString(),
  };

  const json = JSON.stringify(alert);
  const parsed = JSON.parse(json) as CommunicationAlert;
  assert.equal(parsed.id, alert.id);
  assert.equal(parsed.text, alert.text);
  assert.equal(parsed.displayMode, "banner_bottom");
  assert.equal(parsed.scroll, false);
  assert.equal(parsed.level, "warning");
  assert.deepEqual(parsed.targets, ["stage", "public"]);
  assert.equal(parsed.autoDismissSeconds, 30);
});

