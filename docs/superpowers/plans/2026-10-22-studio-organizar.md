# Studio/Editor de Apresentação: Organizar, guias, grupos e rotação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** entregar no editor de temas (`theme-editor`) duplicar/apagar em seleção, caixa de grupo/seleção com redimensionar e girar, rotação de itens, guias arrastáveis por página, aba "Organizar" (substitui "Forma"), seções fechadas por padrão e janela sem chrome de navegador.

**Architecture:** toda a matemática nova (AABB de retângulo girado, escala/rotação de listas, seleção, guias) vive em módulos puros testados com `node --test`. O `Canvas` passa a operar sobre uma **caixa base** (item, grupo ou seleção) em vez de duplicar o motor de arrasto; o store Zustand só orquestra helpers puros e histórico. Guias são persistidas em `ThemePage.guides`/`SlideTheme.guides` (TS e Rust espelhados) e nunca entram no `ThemeRenderer`/`exportImage`.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind v4, Tauri v2 (Rust), `node --test`. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-10-22-studio-organizar-design.md` (aprovada em 2026-10-22).

## Global Constraints

- Não adicionar dependências (nada de fabric/Konva/tldraw/react-rnd).
- Não alterar versões pinadas de `package.json`/`Cargo.toml`.
- `npm run typecheck` e `npm test` passam antes de cada commit; se mexer no Rust, `cargo check -p open-presenter`.
- Commits em Conventional Commits, curtos, pt-BR ou en, no imperativo.
- Sem comentários no código salvo lógica não auto-evidente.
- UI em pt-BR. Rótulos: "Organizar", "Aparência", "Rotação (°)", "Duplicar", "Limpar guias", "Entrar no grupo".
- Rotação é `css.rotate = "<graus>deg"`; **não** criar campo em `ThemeElement`.
- Guias são invisíveis fora do editor; não tocar em `ThemeRenderer` para guias.
- Sem grupos aninhados, sem marquee, sem nudge por seta, sem Cmd+A entre páginas.
- Trabalhar em `feature/studio-organizar` (criar a partir de `develop`). Nunca commitar na `main`.
- O editor é a janela `theme-editor`; a rota continua `HashRouter` (`#/theme-editor?guid=…`).

## Review Focus

1. **Apagar a última coisa**: tema de layout único não pode ficar sem elementos; apagar o penúltimo membro de um grupo não pode deixar grupo órfão.
2. **Escala perto de zero**: redimensionar grupo/seleção até quase 0 não pode gerar `NaN`, largura 0 ou membros sobrepostos; mínimo 20 px por membro; base de largura/altura 0 é no-op.
3. **Rotação na fronteira**: ±180°/359° normaliza sem pulo; `Shift` trava em 15°; item girado redimensiona no referencial local sem deformar.
4. **Clique vazio com texto em edição**: clicar na área vazia durante edição inline não pode descartar o texto silenciosamente. Enquanto `editingId` estiver ativo, o primeiro clique fora apenas tira o foco (o `TextEditor` faz o commit no blur); a seleção só é limpa no clique seguinte.
5. **Guias**: salvar/reabrir mantém as guias (round-trip Rust), exportar PNG/JPG não as mostra, e o arrasto continua correto com zoom ≠ 100%.

Cada um desses pontos tem teste puro ou passo manual explícito nas tasks indicadas.

---

## File Structure

**Create**

- `src/features/theme-editor/geometry.test.ts` — testes das primitivas de retângulo/rotação.
- `src/features/theme-editor/transform.ts` + `transform.test.ts` — escala, rotação, translação, alinhar, distribuir.
- `src/features/theme-editor/elements.ts` + `elements.test.ts` — duplicar/apagar/órfãos/ordem.
- `src/features/theme-editor/selection.ts` + `selection.test.ts` — modelo de seleção e operações.
- `src/features/theme-editor/guides.ts` + `guides.test.ts` — modelo, persistência e snap de guias.
- `src/features/theme-editor/SelectionOverlay.tsx` — caixa/alças de item, grupo e seleção.
- `src/features/theme-editor/Rulers.tsx` — réguas interativas (extraídas do `Canvas`).
- `src/core/lib/closeWindow.ts` — fechar a janela atual (Tauri) com fallback de navegador.

**Modify**

- `src/features/theme-editor/geometry.ts` — `Rect`, `Point`, `FALLBACK_SIZE`, `elementBox`, rotação/AABB.
- `src/features/theme-editor/store.ts` — seleção efêmera, comandos e guias.
- `src/features/theme-editor/Canvas.tsx` — cliques, overlay, gestos de seleção, guias.
- `src/features/theme-editor/LayersPanel.tsx` — seleção do store, duplicar, agrupar.
- `src/features/theme-editor/PropertiesPanel.tsx` — "Organizar"/"Aparência", escopo, rotação, ordem, seções fechadas.
- `src/views/ThemeEditorView.tsx` — atalhos, remover "Voltar", bloquear menu de contexto, limpar guias.
- `src/features/theme-editor/exportImage.ts` + `exportImage.test.ts` — rotação no export.
- `src/features/slide-themes/pages.ts` — guias em `materializePage`/`createPage`.
- `src/features/slide-themes/themePackage.ts` + `themePackage.test.ts` — guias no JSON exportado/importado.
- `src/core/types/index.ts` — `ThemeGuide` + campos `guides`.
- `src-tauri/src/state/types.rs` — `ThemeGuide` + campos `guides`.
- `src-tauri/src/lib.rs` — só se o teste manual de Cmd+A exigir remover `.select_all()`.
- `src-tauri/capabilities/main-capability.json` — `core:window:allow-close`.
- `docs-site/content/docs/operacao/temas-e-estilos.mdx`, `docs-site/content/docs/operacao/atalhos-teclado.mdx`.

**No new dependencies. No new IPC commands (exceto nenhum; guias viajam no `saveTheme` existente).**

---

### Task 0: Preparação da branch

- [ ] Criar `feature/studio-organizar` a partir de `develop`:

```bash
git checkout develop
git checkout -b feature/studio-organizar
```

- [ ] Commitar o spec e este plano (documentos):

```bash
git add docs/superpowers/specs/2026-10-22-studio-organizar-design.md docs/superpowers/plans/2026-10-22-studio-organizar.md
git commit -m "docs(theme-editor): add Studio organize design and implementation plan"
```

- [ ] Baseline verde antes de tocar em código:

```bash
npm test
npm run typecheck
```

---

### Task 1: Primitivas de geometria (AABB girado, união de caixas)

**Files**

- Modify: `src/features/theme-editor/geometry.ts`
- Test: `src/features/theme-editor/geometry.test.ts` (create)

**Interfaces**

- Produces:
  - `interface Rect { left: number; top: number; width: number; height: number }`
  - `interface Point { x: number; y: number }`
  - `const FALLBACK_SIZE: Record<ThemeElement["type"], { w: number; h: number }>`
  - `function elementBox(el: ThemeElement, measured?: { w: number; h: number }): Rect`
  - `function parseRotateDeg(value: string | undefined): number`
  - `function parseCssLength(value: string | undefined, base: number): number | null`
  - `function rectCenter(rect: Rect): Point`
  - `function rotatePoint(point: Point, center: Point, deg: number): Point`
  - `function rotatedCorners(rect: Rect, deg: number): [Point, Point, Point, Point]`
  - `function visualRect(rect: Rect, deg: number): Rect`
  - `function unionRects(rects: readonly Rect[]): Rect | null`

**Semantics**

- `parseRotateDeg` aceita só `"<número>deg"` com trim (`"12deg"`, `"-7.5deg"`); qualquer outra coisa → `0`. A propriedade CSS usada é `rotate`, não `transform: rotate(...)`.
- `parseCssLength`: `px` → número; `%` → `(n/100) * base`; número puro (ex.: `"0"`, `"100"`) → número (mesma tolerância do exportador); qualquer outro formato → `null`.
- **Estender `elementRect` para usar `parseCssLength`** em `left/top` (base `W`/`H`) e `width/height`: hoje valores `%` caem no fallback `x/y`, o que já desalinha overlays de temas seed (que usam `%`). Isso corrige também `alignToScreen`. Sem mudar a assinatura.
- `visualRect` é o AABB dos 4 cantos girados em torno do centro; sem arredondar.
- `unionRects([])` → `null`.
- `elementBox` usa `elementRect` e cai para `measured` e depois `FALLBACK_SIZE[el.type]`.

- [ ] **Step 1: escrever os testes que falham**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  elementBox,
  parseRotateDeg,
  rectCenter,
  rotatePoint,
  rotatedCorners,
  unionRects,
  visualRect,
  type Rect,
} from "./geometry.ts";
import type { ThemeElement } from "@/core/types";

const el = (over: Partial<ThemeElement> = {}): ThemeElement => ({
  id: "a",
  type: "RECTANGLE",
  x: 0,
  y: 0,
  visible: true,
  locked: false,
  css: {},
  ...over,
});

test("parseRotateDeg lê graus e ignora inválidos", () => {
  assert.equal(parseRotateDeg("12deg"), 12);
  assert.equal(parseRotateDeg(" -7.5deg "), -7.5);
  assert.equal(parseRotateDeg(undefined), 0);
  assert.equal(parseRotateDeg("rotate(10deg)"), 0);
  assert.equal(parseRotateDeg("45"), 0);
});

test("rotatePoint gira 90° em torno do centro", () => {
  const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
  assert.ok(Math.abs(p.x - 0) < 1e-9);
  assert.ok(Math.abs(p.y - 10) < 1e-9);
});

test("visualRect de 100x50 girado 90° fecha o AABB", () => {
  const box: Rect = { left: 0, top: 0, width: 100, height: 50 };
  assert.deepEqual(rectCenter(box), { x: 50, y: 25 });
  assert.equal(rotatedCorners(box, 90).length, 4);
  const aabb = visualRect(box, 90);
  assert.ok(Math.abs(aabb.left - 25) < 1e-9);
  assert.ok(Math.abs(aabb.top + 25) < 1e-9);
  assert.ok(Math.abs(aabb.width - 50) < 1e-9);
  assert.ok(Math.abs(aabb.height - 100) < 1e-9);
});

test("unionRects une caixas e devolve null vazio", () => {
  assert.deepEqual(
    unionRects([
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 50, top: 100, width: 100, height: 50 },
    ]),
    { left: 0, top: 0, width: 150, height: 150 },
  );
  assert.equal(unionRects([]), null);
});

test("elementBox respeita px, medido e fallback", () => {
  assert.deepEqual(
    elementBox(el({ css: { left: "10px", top: "20px", width: "30px", height: "40px" } })),
    { left: 10, top: 20, width: 30, height: 40 },
  );
  assert.deepEqual(
    elementBox(el({ css: { left: "10%", top: "20%", width: "50%", height: "25%" } })),
    { left: 192, top: 216, width: 960, height: 270 },
  );
  assert.deepEqual(
    elementBox(el(), { w: 200, h: 100 }),
    { left: 0, top: 0, width: 200, height: 100 },
  );
});
```

- [ ] **Step 2: rodar e ver falhar**

```bash
node --test src/features/theme-editor/geometry.test.ts
```

Expected: FAIL por exports ausentes.

- [ ] **Step 3: implementar em `geometry.ts`**

Adicionar os tipos/funções acima e estender `elementRect` com `parseCssLength` (sem mudar `alignToScreen`, `toPx`/`toPct`). Mover para cá `FALLBACK_SIZE` (o `Canvas` passa a importar; remover a cópia local na Task 7).

- [ ] **Step 4: rodar**

```bash
node --test src/features/theme-editor/geometry.test.ts
```

Expected: PASS (5 testes).

- [ ] **Step 5: commit**

```bash
git add src/features/theme-editor/geometry.ts src/features/theme-editor/geometry.test.ts
git commit -m "feat(theme-editor): add rotated-rect geometry helpers"
```

---

### Task 2: Transformações de listas (escala, rotação, alinhar, distribuir)

**Files**

- Create: `src/features/theme-editor/transform.ts`
- Test: `src/features/theme-editor/transform.test.ts`

**Interfaces**

- Consumes: `Rect`, `Point`, `AlignEdge`, `elementBox`, `elementRect`, `parseRotateDeg`, `rectCenter`, `rotatePoint`, `visualRect` de `./geometry.ts`.
- Produces:
  - `function normalizeDeg(deg: number): number` — faixa `(-180, 180]`.
  - `function elementRotation(el: ThemeElement): number`
  - `function setElementRotation(el: ThemeElement, deg: number): ThemeElement` — remove `rotate` quando normaliza para 0.
  - `function translateElementsInList(list, ids, dx, dy): ThemeElement[]` — pula `locked`.
  - `function scaleElementsInList(list, base: Rect, target: Rect, minSize?: number): ThemeElement[]`
  - `function rotateElementsInList(list, center: Point, deltaDeg: number): ThemeElement[]`
  - `function alignElementsInList(list, ids, edge: AlignEdge, target: Rect): ThemeElement[]`
  - `function distributeElementsInList(list, ids, axis: "x" | "y"): ThemeElement[]`

**Semantics**

- `scaleElementsInList`: mapeia a caixa `base` para a caixa `target` (o alvo pode ter `left/top` diferentes — resize pela aresta oeste/norte ancora o canto oposto): `fx = target.width / base.width`, `fy = target.height / base.height`; `newCx = target.left + (oldCx - base.left) * fx` (idem Y); largura/altura por eixo; membros `locked` ficam intactos; `base` ou `target` com largura/altura `<= 0` → lista inalterada; cada dimensão final `>= minSize` (default 20). `TEXT` com `css.fontSize` em px escala pelo fator médio `(fx + fy) / 2` (arredondado). Escreve `css.left/top/width/height` em px e `x`/`y` correspondentes.
- `rotateElementsInList`: pula `locked`; rotaciona o centro do retângulo de layout em torno de `center` e soma `deltaDeg` em `css.rotate`; posições com 2 casas decimais.
- `alignElementsInList`: usa o AABB visual de cada item e move o layout pelo delta do eixo (assim item girado alinha pela borda visual); pula `locked`.
- `distributeElementsInList`: exige 3+ ids válidos e destravados; ordena por borda visual no eixo, mantém primeiro/último e distribui lacunas iguais; aplica o delta no layout; pula `locked`.
- `translateElementsInList`: dx/dy em px, arredonda, nunca deixa `left/top` negativo.

- [ ] **Step 1: escrever os testes**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import {
  alignElementsInList,
  distributeElementsInList,
  elementRotation,
  normalizeDeg,
  rotateElementsInList,
  scaleElementsInList,
  setElementRotation,
  translateElementsInList,
} from "./transform.ts";

const el = (id: string, left: number, top: number, w: number, h: number, css: Record<string, string> = {}): ThemeElement => ({
  id,
  type: "RECTANGLE",
  x: left,
  y: top,
  visible: true,
  locked: false,
  css: { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, ...css },
});

test("normalizeDeg e setElementRotation", () => {
  assert.equal(normalizeDeg(370), 10);
  assert.equal(normalizeDeg(-190), 170);
  assert.equal(normalizeDeg(180), 180);
  assert.equal(normalizeDeg(-180), 180);
  assert.equal(elementRotation(el("a", 0, 0, 10, 10, { rotate: "12deg" })), 12);
  assert.equal("rotate" in setElementRotation(el("a", 0, 0, 10, 10, { rotate: "12deg" }), 360).css, false);
  assert.equal(setElementRotation(el("a", 0, 0, 10, 10), -45).css.rotate, "-45deg");
});

test("scaleElementsInList escala posição e tamanho", () => {
  const list = [el("a", 0, 0, 100, 50), el("b", 100, 50, 100, 50)];
  const out = scaleElementsInList(
    list,
    { left: 0, top: 0, width: 200, height: 100 },
    { left: 0, top: 0, width: 400, height: 100 },
  );
  assert.equal(out[0].css.width, "200px");
  assert.equal(out[0].css.height, "50px");
  assert.equal(out[1].css.left, "200px");
  assert.equal(out[1].css.top, "50px");
  assert.equal(out[1].css.width, "200px");
});

test("scaleElementsInList ancora a borda oposta ao resize oeste", () => {
  const out = scaleElementsInList(
    [el("a", 100, 0, 100, 50)],
    { left: 100, top: 0, width: 100, height: 50 },
    { left: 50, top: 0, width: 150, height: 50 },
  );
  assert.equal(out[0].css.left, "50px");
  assert.equal(out[0].css.width, "150px");
});

test("scaleElementsInList clampa no mínimo e não gera NaN", () => {
  const out = scaleElementsInList(
    [el("a", 0, 0, 100, 50)],
    { left: 0, top: 0, width: 100, height: 50 },
    { left: 0, top: 0, width: 2, height: 2 },
  );
  assert.equal(out[0].css.width, "20px");
  assert.equal(out[0].css.height, "20px");
  assert.ok(!Number.isNaN(Number.parseFloat(out[0].css.left)));

  const zero = [el("a", 0, 0, 100, 50)];
  assert.deepEqual(
    scaleElementsInList(zero, { left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 100, height: 100 }),
    zero,
  );
});

test("scaleElementsInList escala fontSize de TEXT pelo fator médio", () => {
  const text = { ...el("t", 0, 0, 100, 100, { fontSize: "40px" }), type: "TEXT" as const };
  const out = scaleElementsInList(
    [text],
    { left: 0, top: 0, width: 100, height: 100 },
    { left: 0, top: 0, width: 200, height: 100 },
  );
  assert.equal(out[0].css.fontSize, "60px");
});

test("rotateElementsInList gira centro e soma rotate", () => {
  const out = rotateElementsInList([el("a", 0, 0, 100, 50)], { x: 100, y: 100 }, 90);
  assert.ok(Math.abs(Number.parseFloat(out[0].css.left ?? "0") - 125) < 0.02);
  assert.ok(Math.abs(Number.parseFloat(out[0].css.top ?? "0") - 25) < 0.02);
  assert.equal(out[0].css.rotate, "90deg");
});

test("translateElementsInList move e respeita locked", () => {
  const out = translateElementsInList([el("a", 10, 10, 10, 10), { ...el("b", 10, 10, 10, 10), locked: true }], ["a", "b"], 5, -20);
  assert.equal(out[0].css.left, "15px");
  assert.equal(out[0].css.top, "0px");
  assert.equal(out[1].css.left, "10px");
});

test("alignElementsInList alinha pela borda visual", () => {
  const list = [el("a", 30, 40, 100, 50), el("b", 300, 100, 100, 50)];
  const out = alignElementsInList(list, ["a"], "left", { left: 0, top: 0, width: 1920, height: 1080 });
  assert.equal(out[0].css.left, "0px");
  const right = alignElementsInList(list, ["b"], "right", { left: 0, top: 0, width: 1920, height: 1080 });
  assert.equal(right[1].css.left, "1820px");
});

test("distributeElementsInList iguala lacunas", () => {
  const list = [el("a", 0, 0, 100, 10), el("b", 150, 0, 100, 10), el("c", 400, 0, 100, 10)];
  const out = distributeElementsInList(list, ["a", "b", "c"], "x");
  assert.equal(out[1].css.left, "200px");
});
```

- [ ] **Step 2: rodar e ver falhar**

```bash
node --test src/features/theme-editor/transform.test.ts
```

- [ ] **Step 3: implementar `transform.ts`**

Regras de escrita: `css` novo a cada item; preservar chaves existentes; `x`/`y` em px; `setElementRotation` remove `css.rotate` quando o valor normalizado é 0.

- [ ] **Step 4: rodar**

```bash
node --test src/features/theme-editor/transform.test.ts
```

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add src/features/theme-editor/transform.ts src/features/theme-editor/transform.test.ts
git commit -m "feat(theme-editor): add element scale, rotate and align transforms"
```

---

### Task 3: Operações de lista (duplicar, apagar, órfãos, ordem Z)

**Files**

- Create: `src/features/theme-editor/elements.ts`
- Test: `src/features/theme-editor/elements.test.ts`

**Interfaces**

- Produces:
  - `type ReorderDirection = "front" | "back" | "forward" | "backward"`
  - `function duplicateElementsInList(list, ids, options?): { elements: ThemeElement[]; newIds: string[] }` com `options = { offset?: number; makeId?: () => string; makeGroupId?: () => string }`.
  - `function removeElementsInList(list, ids, options?: { minKeep?: number }): ThemeElement[]`
  - `function dropOrphanGroups(list: readonly ThemeElement[]): ThemeElement[]`
  - `function reorderElementsInList(list, ids, direction): ThemeElement[]`

**Semantics**

- Duplicar: cópia deslocada `+20/+20` (default), inserida imediatamente depois do **último** selecionado, preservando a ordem relativa. Se a seleção cobre **todos** os membros de um grupo, as cópias recebem um **novo** `groupId`, mantendo `groupName`. Cópia de um membro avulso de grupo vira item sem `groupId`.
- Remover: `minKeep` default 0; se remover deixaria menos que `minKeep`, retorna a lista intacta. Sempre aplica `dropOrphanGroups`.
- `dropOrphanGroups`: grupo com 1 membro restante perde `groupId` e `groupName` (mas mantém `name`).
- Ordem: tratar a seleção como bloco (ordem relativa preservada). `front` = fim da lista (topo), `back` = início, `forward`/`backward` = uma posição por vez.

- [ ] **Step 1: escrever os testes**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import {
  dropOrphanGroups,
  duplicateElementsInList,
  removeElementsInList,
  reorderElementsInList,
} from "./elements.ts";

let n = 0;
const makeId = () => `new-${++n}`;
const makeGroupId = () => `group-new`;

const el = (id: string, groupId?: string): ThemeElement => ({
  id,
  type: "RECTANGLE",
  x: 0,
  y: 0,
  visible: true,
  locked: false,
  css: { left: "0px", top: "0px", width: "10px", height: "10px" },
  ...(groupId ? { groupId, groupName: "G" } : {}),
});

test("duplica grupo com novo groupId e offset", () => {
  n = 0;
  const list = [el("a", "g1"), el("b", "g1"), el("c")];
  const { elements, newIds } = duplicateElementsInList(list, ["a", "b"], { makeId, makeGroupId });
  assert.equal(elements.length, 5);
  assert.deepEqual(newIds, ["new-1", "new-2"]);
  const copies = elements.filter((e) => newIds.includes(e.id));
  assert.ok(copies.every((e) => e.groupId === "group-new"));
  assert.ok(copies.every((e) => e.css.left === "20px" && e.css.top === "20px"));
  assert.equal(elements[2].id, "new-1");
});

test("duplicar um membro de grupo gera item avulso", () => {
  n = 0;
  const { elements } = duplicateElementsInList([el("a", "g1"), el("b", "g1")], ["a"], { makeId, makeGroupId });
  const copy = elements.find((e) => e.id === "new-1");
  assert.equal(copy?.groupId, undefined);
});

test("remover respeita minKeep e dissolve grupo órfão", () => {
  const list = [el("a", "g1"), el("b", "g1"), el("c")];
  assert.deepEqual(removeElementsInList(list, ["a", "b", "c"], { minKeep: 1 }), list);
  const out = removeElementsInList(list, ["a"], {});
  assert.equal(out.find((e) => e.id === "b")?.groupId, undefined);
});

test("reordena bloco", () => {
  const list = [el("a"), el("b"), el("c")];
  assert.deepEqual(reorderElementsInList(list, ["b"], "forward").map((e) => e.id), ["a", "c", "b"]);
  assert.deepEqual(reorderElementsInList(list, ["b"], "backward").map((e) => e.id), ["b", "a", "c"]);
  assert.deepEqual(reorderElementsInList(list, ["b"], "front").map((e) => e.id), ["a", "c", "b"]);
  assert.deepEqual(reorderElementsInList(list, ["b"], "back").map((e) => e.id), ["b", "a", "c"]);
});
```

- [ ] **Step 2: rodar e ver falhar**
- [ ] **Step 3: implementar**
- [ ] **Step 4: rodar**

```bash
node --test src/features/theme-editor/elements.test.ts
```

- [ ] **Step 5: commit**

```bash
git add src/features/theme-editor/elements.ts src/features/theme-editor/elements.test.ts
git commit -m "feat(theme-editor): add element duplicate, remove and reorder helpers"
```

---

### Task 4: Modelo de seleção e operações de seleção

**Files**

- Create: `src/features/theme-editor/selection.ts`
- Test: `src/features/theme-editor/selection.test.ts`

**Interfaces**

- Produces:

```ts
export interface EditorSelection {
  ids: string[];
  anchorId: string | null;
  enteredGroupId: string | null;
}
export const EMPTY_SELECTION: EditorSelection;

export function groupMemberIds(elements: readonly ThemeElement[], groupId: string): string[];
export function resolveClickSelection(elements, id, enteredGroupId): EditorSelection;
export function toggleInSelection(elements, selection, id): EditorSelection;
export function selectableIds(elements: readonly ThemeElement[]): string[];
export function pruneSelection(elements, selection): EditorSelection;
export function selectionVisualBox(elements, ids): Rect | null;
export function alignmentTargetFor(elements, selection, W?, H?): Rect;
export function duplicateSelectionInList(list, selection, options?): { elements; selection };
export function removeSelectionInList(list, selection, options?): { elements; selection };
export function groupSelectionInList(list, selection, name?): { elements; selection; groupId };
export function ungroupSelectionInList(list, selection): { elements; selection };
```

- Consumes: helpers das Tasks 1–3 (`elementBox`, `visualRect`, `parseRotateDeg`, `unionRects`, `LOGICAL_W/H`; `duplicateElementsInList`, `removeElementsInList`, `dropOrphanGroups`; `groupElementsInList`, `ungroupElementsInList`).

**Semantics**

- Clique em item sem grupo → `{ ids:[id], anchorId:id, enteredGroupId:null }`.
- Clique em membro de grupo **fora** do modo entrado → todos os membros; `anchorId` = id clicado.
- Clique em membro do **mesmo** `enteredGroupId` → só ele, mantendo o modo.
- `Shift+clique` (`toggleInSelection`): adiciona/remove; sair do modo entrado; ao remover o âncora, o novo âncora é o último restante.
- `selectableIds`: `visible && !locked`.
- `pruneSelection`: remove ids inexistentes; se o âncora sumiu, usa o primeiro restante; se o grupo entrado sumiu, limpa o modo.
- `selectionVisualBox`: união dos AABBs visuais dos ids; `null` se vazio.
- `alignmentTargetFor`: 2+ ids → caixa da seleção; 1 id com grupo → caixa visual de **todos** os membros do grupo; senão `{0,0,W,H}`.
- `duplicateSelectionInList`: usa `duplicateElementsInList`; seleção final = novas ids (`anchorId` = primeira, modo limpo).
- `removeSelectionInList`: apaga ids; aplica órfãos; seleção final vazia. Se a guarda `minKeep` bloquear a remoção (lista intacta), devolve a **seleção original** (não deseleciona).
- `groupSelectionInList`: ≥2 ids; seleção final = membros agrupados; `groupId` retornado; aplica `dropOrphanGroups` (se tirou membros de grupos antigos, grupos que sobraram com 1 membro são dissolvidos).
- `ungroupSelectionInList`: desagrupa todos os grupos presentes na seleção; mantém os ids selecionados.

- [ ] **Step 1: escrever os testes**

Cobrir: clique simples/grupo/entrado; shift add/remove; selectAll exclui oculto/travado; prune; caixa visual com item girado; alvo de alinhamento (grupo); duplicar/apagar/agrupar/desagrupar seleção. Use `node:test` e `assert/strict`, e um factory local de `ThemeElement` com `css.left/top/width/height`.

Exemplos obrigatórios:

```ts
test("clique em membro fora do grupo seleciona o grupo", () => {
  const list = [el("a", 0, 0, 100, 50, "g1"), el("b", 100, 0, 100, 50, "g1"), el("c", 0, 100, 10, 10)];
  assert.deepEqual(resolveClickSelection(list, "a", null), {
    ids: ["a", "b"], anchorId: "a", enteredGroupId: null,
  });
  assert.deepEqual(resolveClickSelection(list, "a", "g1"), {
    ids: ["a"], anchorId: "a", enteredGroupId: "g1",
  });
});

test("alinhamento de item entrado usa a caixa do grupo", () => {
  const list = [el("a", 0, 0, 100, 50, "g1"), el("b", 300, 0, 100, 50, "g1")];
  const target = alignmentTargetFor(list, { ids: ["a"], anchorId: "a", enteredGroupId: "g1" });
  assert.deepEqual(target, { left: 0, top: 0, width: 400, height: 50 });
});

test("apagar metade do grupo dissolve o grupo", () => {
  const list = [el("a", 0, 0, 10, 10, "g1"), el("b", 10, 0, 10, 10, "g1")];
  const out = removeSelectionInList(list, { ids: ["a"], anchorId: "a", enteredGroupId: "g1" });
  assert.equal(out.elements[0].groupId, undefined);
  assert.deepEqual(out.selection, EMPTY_SELECTION);
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
});
```

- [ ] **Step 2: rodar e ver falhar**
- [ ] **Step 3: implementar**
- [ ] **Step 4: rodar**

```bash
node --test src/features/theme-editor/selection.test.ts
```

- [ ] **Step 5: commit**

```bash
git add src/features/theme-editor/selection.ts src/features/theme-editor/selection.test.ts
git commit -m "feat(theme-editor): add selection model and selection commands"
```

---

### Task 5: Modelo de guias + persistência TS/Rust

**Files**

- Modify: `src/core/types/index.ts` (adicionar `ThemeGuide`; `ThemePage.guides?`; `SlideTheme.guides?`)
- Modify: `src-tauri/src/state/types.rs` (idem, antes de `ThemePage`)
- Modify: `src/features/slide-themes/pages.ts` (`materializePage` e `createPage`)
- Modify: `src/features/slide-themes/themePackage.ts` + `themePackage.test.ts` (guias no JSON de tema)
- Create: `src/features/theme-editor/guides.ts`
- Test: `src/features/theme-editor/guides.test.ts`

**Interfaces**

```ts
export type GuideAxis = "x" | "y";

export function clampGuidePos(axis: GuideAxis, pos: number, width?: number, height?: number): number;
export function guidesOfTheme(theme: SlideTheme, pageId: string | null): ThemeGuide[];
export function updateGuidesInTheme(
  theme: SlideTheme,
  pageId: string | null,
  updater: (guides: ThemeGuide[]) => ThemeGuide[],
): SlideTheme;
export function addGuideToTheme(theme: SlideTheme, pageId: string | null, guide: ThemeGuide): SlideTheme;
export function moveGuideInTheme(theme: SlideTheme, pageId: string | null, id: string, pos: number): SlideTheme;
export function removeGuideFromTheme(theme: SlideTheme, pageId: string | null, id: string): SlideTheme;
export function clearGuidesInTheme(theme: SlideTheme, pageId: string | null): SlideTheme;
export function snapGuidePosition(
  pos: number,
  targets: readonly number[],
  threshold?: number,
): number | null;
```

**TS types**

```ts
export interface ThemeGuide {
  id: string;
  axis: "x" | "y";
  pos: number;
}

export interface ThemePage {
  /* ...existente... */
  guides?: ThemeGuide[];
}

export interface SlideTheme {
  /* ...existente... */
  guides?: ThemeGuide[];
}
```

**Rust**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeGuide {
    pub id: String,
    pub axis: String,
    pub pos: f64,
}
```

Em `ThemePage` e `SlideTheme`:

```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub guides: Option<Vec<ThemeGuide>>,
```

**pages.ts**

- `materializePage`: `return { ...theme, css: page.css, elements: page.elements, guides: page.guides };`
- `createPage` modo `"duplicate"`: incluir `guides: sourcePage?.guides ? structuredClone(sourcePage.guides) : undefined`; modo `"blank"`: sem guias.

**themePackage.ts**

- `buildThemePayload`: copiar `guides` da página (e `theme.guides` no layout único) **somente quando houver itens**, para não adicionar `guides: undefined` aos pacotes existentes.
- `parseThemeFromJson`/`parsePage`: `parseGuides(value)` local valida `{ id: string, axis: "x"|"y", pos: finite }`; ignora entradas inválidas; retorna `undefined` se vazio. Não importar `theme-editor/guides.ts` (fronteira entre features).
- Teste de round-trip: tema com guias em página → `buildThemePackage` + `parseThemeFromJson` preserva as guias.

**Semantics**

- `guidesOfTheme`: com `pageId` válido → `page.guides ?? []`; senão `theme.guides ?? []`.
- `updateGuidesInTheme`: retorna novo tema sem mutar; se `pageId` foi passado e não existe, retorna o tema intacto; atualiza só a página ativa (ou o topo em layout único).
- `addGuideToTheme`: clampa `pos` pelo eixo (largura/altura lógicas), remove id duplicado antes de anexar.
- `moveGuideInTheme`: clampa e atualiza a guia pelo id; id inexistente → tema inalterado.
- `removeGuideFromTheme`: filtra por id; `clearGuidesInTheme`: define a lista como `[]`.
- `snapGuidePosition`: alvo mais próximo dentro de `threshold` (default 6) → posição do alvo; senão `null`.

- [ ] **Step 1: escrever os testes**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { SlideTheme } from "@/core/types";
import {
  addGuideToTheme,
  clampGuidePos,
  clearGuidesInTheme,
  guidesOfTheme,
  moveGuideInTheme,
  removeGuideFromTheme,
  snapGuidePosition,
  updateGuidesInTheme,
} from "./guides.ts";
import { materializePage } from "../slide-themes/pages.ts";

const theme = (): SlideTheme => ({
  guid: "t",
  title: "T",
  css: {},
  elements: [],
  pages: [
    { id: "p1", context: "text", css: {}, elements: [], guides: [{ id: "g1", axis: "x", pos: 100 }] },
    { id: "p2", context: "music", css: {}, elements: [] },
  ],
});

test("lê e atualiza guias da página ativa", () => {
  assert.equal(guidesOfTheme(theme(), "p1")[0].pos, 100);
  const next = updateGuidesInTheme(theme(), "p1", (g) => [...g, { id: "g2", axis: "y", pos: 50 }]);
  assert.equal(guidesOfTheme(next, "p1").length, 2);
  assert.equal(guidesOfTheme(next, "p2").length, 0);
});

test("atualiza guias do layout único", () => {
  const single: SlideTheme = { guid: "s", title: "S", css: {}, elements: [], guides: [] };
  const next = updateGuidesInTheme(single, null, () => [{ id: "g", axis: "x", pos: 10 }]);
  assert.equal(next.guides?.length, 1);
  assert.equal(single.guides?.length, 0);
});

test("clamp e snap", () => {
  assert.equal(clampGuidePos("x", -10), 0);
  assert.equal(clampGuidePos("x", 5000), 1920);
  assert.equal(clampGuidePos("y", 2000), 1080);
  assert.equal(snapGuidePosition(104, [100, 300], 6), 100);
  assert.equal(snapGuidePosition(110, [100, 300], 6), null);
});

test("adiciona, move e remove guias da lista", () => {
  const t = theme();
  const added = addGuideToTheme(t, "p1", { id: "g2", axis: "y", pos: 5000 });
  assert.equal(guidesOfTheme(added, "p1").length, 2);
  assert.equal(guidesOfTheme(added, "p1")[1].pos, 1080);

  const moved = moveGuideInTheme(added, "p1", "g2", 20);
  assert.equal(guidesOfTheme(moved, "p1")[1].pos, 20);

  const removed = removeGuideFromTheme(moved, "p1", "g1");
  assert.deepEqual(
    guidesOfTheme(removed, "p1").map((g) => g.id),
    ["g2"],
  );
  assert.equal(guidesOfTheme(clearGuidesInTheme(removed, "p1"), "p1").length, 0);
  assert.equal(guidesOfTheme(t, "p1").length, 1);
});

test("materializePage carrega as guias da página", () => {
  const t = theme();
  const view = materializePage(t, t.pages![0]);
  assert.deepEqual(view.guides, t.pages![0].guides);
});
```

- [ ] **Step 2: rodar e ver falhar**
- [ ] **Step 3: implementar TS, Rust, pages e themePackage**
- [ ] **Step 4: rodar testes + cargo check**

```bash
node --test src/features/theme-editor/guides.test.ts
node --test src/features/slide-themes/themePackage.test.ts
cargo check -p open-presenter
```

- [ ] **Step 5: commit**

```bash
git add src/core/types/index.ts src-tauri/src/state/types.rs src/features/slide-themes/pages.ts src/features/slide-themes/themePackage.ts src/features/slide-themes/themePackage.test.ts src/features/theme-editor/guides.ts src/features/theme-editor/guides.test.ts
git commit -m "feat(theme-editor): persist per-page guides across TS and Rust"
```

---

### Task 6: Store — seleção, comandos, transformações e guias

**Files**

- Modify: `src/features/theme-editor/store.ts`

**Interfaces (adições ao `ThemeEditorState`)**

```ts
selection: EditorSelection;
select(ids: string | string[], options?: { anchorId?: string; enteredGroupId?: string | null }): void;
toggleSelect(id: string): void;
clearSelection(): void;
enterGroup(groupId: string, itemId: string): void;
selectAll(): void;
duplicateSelection(): void;
removeSelection(): void;
groupSelection(name?: string): string;
ungroupSelection(): void;
translateSelection(dx: number, dy: number): void;
scaleSelection(factorX: number, factorY: number): void;
rotateSelectionBy(deltaDeg: number): void;
setSelectionRotation(deg: number): void;
alignSelection(edge: AlignEdge): void;
distributeSelection(axis: "x" | "y"): void;
reorderSelection(direction: ReorderDirection): void;
addGuide(axis: GuideAxis, pos: number): string;
moveGuide(id: string, pos: number): void;
removeGuide(id: string): void;
clearGuides(): void;
```

**Store semantics**

- Estado inicial: `selection: EMPTY_SELECTION`.
- Helper local `activeElements(draft, activePageId)`.
- `select`: normaliza ids contra a lista ativa, `anchorId` default primeiro, `enteredGroupId` default `null`; ids vazios → `EMPTY_SELECTION`.
- `toggleSelect`: `toggleInSelection` + lista ativa.
- `enterGroup`: `select([itemId], { anchorId: itemId, enteredGroupId: groupId })`.
- `selectAll`: `selectableIds` + `select(ids, { anchorId: ids[0] })`.
- `duplicateSelection`: `duplicateSelectionInList` + `mutate`; aplica a seleção retornada.
- `removeSelection`: `removeSelectionInList` com `minKeep: page ? 0 : 1`; aplica resultado.
- `groupSelection`: usa `groupSelectionInList` (seleção < 2 → `""`).
- `ungroupSelection`: grupo = `selection.enteredGroupId` ?? primeiro `groupId` da seleção.
- `translate/scale/rotate`: usam `selectionVisualBox` da lista ativa; `scaleSelection(fx, fy)` monta `target = { ...box, width: box.width * fx, height: box.height * fy }` e chama `scaleElementsInList(list, box, target)`; `setSelectionRotation` só com 1 id; `rotateSelectionBy` gira o conjunto em torno do centro da caixa.
- `alignSelection`: `alignmentTargetFor` + `alignElementsInList`.
- `distributeSelection`: ids da seleção.
- `reorderSelection`: `reorderElementsInList` com ids da seleção.
- Guias: `addGuide` gera `id = crypto.randomUUID()` e posição `Math.round` clampada, e chama `addGuideToTheme`; `moveGuide`/`removeGuide`/`clearGuides` usam `moveGuideInTheme`/`removeGuideFromTheme`/`clearGuidesInTheme`; todas via `mutate`. `clearGuides` com lista vazia → no-op (não empilha histórico).
- `load`, `undo`, `redo`: `selection: EMPTY_SELECTION`. Ações de troca de página (`selectPage`, `addPage`, `removePage`, `duplicatePage`, `movePage`, `upgradeToV2`) também limpam a seleção.
- `upgradeToV2`: copiar `draft.guides` para a página criada.
- `save()`: para apresentações, o espelho de topo continua igual; guias canônicas ficam em `pages[i].guides`.

**Nota:** o store importa IPC e não é testável em `node --test` (padrão do repo). A lógica é 100% delegada aos helpers puros das Tasks 1–5; a verificação do store é `npm run typecheck` + checklist manual no final.

- [ ] **Step 1: implementar as adições**
- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: commit**

```bash
git add src/features/theme-editor/store.ts
git commit -m "feat(theme-editor): add multi-selection, transforms and guide actions to store"
```

---

### Task 7: Canvas — seleção por clique, caixa de grupo e arrasto da seleção

**Files**

- Create: `src/features/theme-editor/SelectionOverlay.tsx` (versão inicial: caixa tracejada, sem alças)
- Modify: `src/features/theme-editor/Canvas.tsx`
- Modify: `src/views/ThemeEditorView.tsx` (parar de passar `selectedId`/`onSelect` ao Canvas; derivar `selectedId` da seleção do store; trocar `setSelectedId` por `select`)

**Canvas props**

Remover `selectedId` e `onSelect`. Manter `onChange` (usado pelo editor inline e pelo resize single até a Task 8).

**Canvas reads**

```ts
const selection = useThemeEditorStore((s) => s.selection);
const select = useThemeEditorStore((s) => s.select);
const toggleSelect = useThemeEditorStore((s) => s.toggleSelect);
const enterGroup = useThemeEditorStore((s) => s.enterGroup);
const clearSelection = useThemeEditorStore((s) => s.clearSelection);
```

**Interactions**

- Elemento:
  - `button !== 0` → nada.
  - `Shift` → `toggleSelect(el.id)` e retorna (sem arrasto).
  - `Cmd/Ctrl` + `groupId` → `enterGroup(groupId, el.id)` e inicia arrasto só do item.
  - Já no modo entrado do mesmo grupo → seleciona o item e arrasta só ele.
  - Item de grupo fora do modo → `select(memberIds, { anchorId: el.id })` e arrasta o grupo.
  - Item avulso já numa seleção múltipla → mantém a seleção e arrasta o conjunto; senão seleciona só ele.
  - Travado: pode selecionar, não inicia gesto.
- Duplo-clique: texto (não travado) abre o editor inline e, se em grupo, entra no grupo; não-texto em grupo entra no grupo.
- Área vazia: `onPointerDown` no container `absolute inset-0` dos elementos (além do wrapper/stage já existentes) chama `clearSelection()`; não interceptar quando `editingId` (o editor inline para o evento).
- `Escape` fica no `ThemeEditorView` (Task 10).

**Arrasto da seleção**

Helpers locais (o `Canvas` já tem `resolveBox`/`withPatch`):

```ts
function resolveVisualBox(el: ThemeElement): Rect {
  return visualRect(resolveBox(el), elementRotation(withPatch(el)));
}
function selectionBoxFor(ids: readonly string[]): Rect | null {
  return unionRects(theme.elements.filter((el) => ids.includes(el.id)).map(resolveVisualBox));
}
```

Substituir o `Gesture` de move/`groupOrigs` por:

```ts
interface Gesture {
  id?: string; // resize single (temporário até a Task 8)
  mode: "move" | "resize";
  baseIds: string[];
  ids: string[];
  startLX: number;
  startLY: number;
  origBox: Rect;
  last: Rect;
  memberOrigs: Record<string, Rect>;
  snapBoxes: Map<string, ElementBox>;
  dir?: ResizeDir;
  orig?: Rect; // resize single (temporário até a Task 8)
}
```

Manter o branch de resize single existente em `commitGesture`/`beginResize` (usa `g.id`/`g.orig`/`onChange`); só o move é migrado nesta task. A Task 8 substitui o branch antigo.

- `beginMove(e, ids)`:
  - `origBox` = `selectionBoxFor(ids)` (união dos AABBs visuais com medida real).
  - `memberOrigs` = caixa de layout de cada id destravado.
  - `snapBoxes` = `buildSnapBoxes(visibleElements, new Set(ids), resolveVisualBox)`.
  - Se nenhum membro destravado → não inicia.
- `updateGesture` move: `calculateSnap(origBox.left, origBox.top, dx, dy, origBox.width, origBox.height, snapBoxes)`; preview de cada membro com `orig + delta`; `setActiveGuides`.
- `commitGesture` move: `updateElements` com `left/top` clampados em 0 (não alterar width/height/rotate); limpar preview.
- Listeners de gesto: trocar `setPointerCapture`/handlers por `window.addEventListener("pointermove")` + `pointerup`/`pointercancel` com `{ once: true }`, alimentando o `frameCoalescer` existente. Remover `onPointerMove`/`onPointerUp` dos elementos.

**Overlay**

- `SelectionOverlay` inicial:

```tsx
export function SelectionOverlay({ box }: { box: Rect }) {
  return (
    <div
      className="pointer-events-none absolute z-30 border-2 border-dashed border-fuchsia-400"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  );
}
```

- `resolveBox`: usar `elementRect(current, logicalW, logicalH)` (a resolução do canvas pode não ser 1920×1080); largura/altura medidas como hoje.
- Renderizar quando `selection.ids.length >= 2`, usando `unionRects` dos `resolveVisualBox` dos ids (medida real do DOM; o `selectionVisualBox` do módulo puro usa `FALLBACK_SIZE` e fica para o painel).
- Manter borda/alças atuais no item selecionado (single) até a Task 8; para grupo/seleção, a caixa tracejada é só visual nesta task.

- [ ] **Step 1: implementar overlay e leitura da seleção**
- [ ] **Step 2: implementar semântica de clique e arrasto**
- [ ] **Step 3: ajustar `ThemeEditorView` (sem props de seleção no Canvas; `select` nos pontos que usavam `setSelectedId`; `clearSelection()` no efeito de troca de página e no evento `theme-editor://open`)**
- [ ] **Step 4: typecheck e teste manual**

```bash
npm run typecheck
```

Manual (Tauri): clicar seleciona; clicar em membro de grupo seleciona o grupo; Cmd/Ctrl+clique e duplo-clique entram; Shift+clique alterna; clique vazio limpa; arrastar um membro move o grupo inteiro; membro travado não move; texto continua editável com duplo-clique.

- [ ] **Step 5: commit**

```bash
git add src/features/theme-editor/SelectionOverlay.tsx src/features/theme-editor/Canvas.tsx src/views/ThemeEditorView.tsx
git commit -m "feat(theme-editor): add group selection box and selection dragging"
```

---

### Task 8: Canvas — redimensionar e girar item, grupo e seleção

**Files**

- Modify: `src/features/theme-editor/SelectionOverlay.tsx` (alças completas + alça de rotação)
- Modify: `src/features/theme-editor/Canvas.tsx`

**SelectionOverlay final**

```ts
export type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface Props {
  box: Rect;
  rotation?: number;
  variant: "item" | "group";
  showHandles?: boolean;
  showRotateHandle?: boolean;
  onMoveStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart?: (dir: ResizeDir, e: React.PointerEvent<HTMLDivElement>) => void;
  onRotateStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}
```

- Raiz `absolute z-30`, `pointer-events-none`; `left/top/width/height` da caixa; `transform: rotate(${rotation}deg)` quando `rotation`.
- Borda: item `border-2 border-primary`; grupo `border-2 border-dashed border-fuchsia-400`.
- Interior `absolute inset-0 pointer-events-auto cursor-move` **só** quando `onMoveStart` (grupo/seleção); chama `onMoveStart` e `onDoubleClick`.
- 8 alças 18×18 (`HANDLE_OFFSETS`/`HANDLE_CURSORS` movidos do Canvas para cá e exportados), `pointer-events-auto`, `stopPropagation`, `onPointerDown` → `onResizeStart(dir, e)`.
- Alça de rotação: círculo 20×20 acima do topo-centro (`left: 50%`, `top: -30`), `cursor: grab`, `pointer-events-auto`, `onPointerDown` → `onRotateStart`.

**Canvas final**

- Seleção simples: `<SelectionOverlay variant="item" box={resolveBox(el)} rotation={elementRotation(withPatch(el))} showHandles={!el.locked} showRotateHandle={!el.locked} onResizeStart={...} onRotateStart={...} />`, renderizado depois do mapa de elementos. Remover borda/alças de dentro do wrapper do elemento; manter hover.
- Grupo/seleção: `<SelectionOverlay variant="group" box={selectionBox} showHandles showRotateHandle onMoveStart={...} onResizeStart={...} onRotateStart={...} onDoubleClick={...} />`. Se **nenhum** membro estiver destravado, passar `showHandles={false}` e `showRotateHandle={false}` (a caixa continua visível).
- Pointerdown no interior do grupo: `Shift` → hit-test e `toggleSelect(member.id)`; `Cmd/Ctrl` → hit-test e `enterGroup(groupId, member.id)`; sem modificador → `beginMove(e, selection.ids)`. Sem membro sob o ponteiro, Shift/Cmd não fazem nada.
- Duplo-clique na caixa do grupo: hit-test nos membros (AABB visual contém o ponto); se achou, `enterGroup(groupId, member.id)` e, quando o membro for `TEXT` destravado, `setEditingId(member.id)`; senão no-op.
- `Gesture` final:

```ts
interface Gesture {
  mode: "move" | "resize" | "rotate";
  baseIds: string[];
  ids: string[];
  startLX: number;
  startLY: number;
  origBox: Rect;
  last: Rect;
  memberOrigs: Record<string, Rect>;
  rotations: Record<string, number>;
  snapBoxes: Map<string, ElementBox>;
  dir?: ResizeDir;
  center: Point;
  startAngle: number;
  rotationDelta: number;
  localRotation: number;
  uniform: boolean;
}
```

**Resize de grupo/seleção (caixa não girada)**

- Roteamento: 1 item com `elementRotation === 0` usa este caminho genérico (funciona para N=1); 1 item girado usa o caminho local abaixo; 2+ sempre este caminho.
- `origBox = selectionBoxFor(ids)` (união dos AABBs visuais com a medida real do DOM; o painel usa `selectionVisualBox` com fallback). Se não houver caixa ou `width/height <= 0`, não inicia o resize.
- `calculateResizeSnap(origBox, dir, dx, dy)` → `last`.
- `fx = last.width / origBox.width`, `fy = last.height / origBox.height`.
- `Shift` em canto (`nw/ne/se/sw`): `f = Math.max(fx, fy)`; `last = { left: origBox.left, top: origBox.top, width: origBox.width * f, height: origBox.height * f }`; ancorar o canto oposto:
  - `dir` contém `w` → `last.left = origBox.left + origBox.width - last.width`
  - `dir` contém `n` → `last.top = origBox.top + origBox.height - last.height`
- Preview: `scaleElementsInList(members, origBox, last)` restrito aos ids; para cada resultado, patch `{x, y, css}` (inclui `fontSize`). Recalcular **sempre a partir de `theme.elements`** (não do preview) usando o `last` acumulado.
- Commit: usar o `last` final (já ajustado pelo Shift) e `updateElements`; membros travados ficam de fora (`scaleElementsInList` já pula), mas contam na caixa original.
- `Shift` em arestas (`n/s/e/w`) é ignorado.

**Resize de item girado (referencial local, sem snap)**

- `angle = elementRotation(el)`; converter o delta do ponteiro para local:
  `lx = dx*cos(-a) - dy*sin(-a)`, `ly = dx*sin(-a) + dy*cos(-a)`.
- Arestas locais `l=0,t=0,r=w,b=h`; somar `lx`/`ly` conforme `dir`; `nw = max(20, r-l)`, `nh = max(20, b-t)`.
- `Shift` em canto: `f = max(nw/w, nh/h)`, `nw = w*f`, `nh = h*f` (aproximação estável).
- Deslocamento do centro local `(cx,cy) = ((l+r)/2 - w/2, (t+b)/2 - h/2)`; rotacionar por `+angle`; novo centro = centro antigo + offset; `left = newCx - nw/2`, `top = newCy - nh/2`.
- Preview/commit com `left/top/width/height` + `x/y`; rotação preservada.

**Rotação**

- `beginRotate`: centro = centro da caixa; `startAngle = atan2(pos.y - cy, pos.x - cx) * 180/PI`.
- `update`: `delta = normalizeDeg(angle - startAngle)`; `Shift`:
  - 1 item: `delta = Math.round(normalizeDeg(rot + delta) / 15) * 15 - rot`.
  - grupo: `delta = Math.round(delta / 15) * 15`.
- Preview (sempre a partir de `theme.elements` original, com o delta acumulado):
  - 1 item: `setElementRotation` (só `css.rotate`).
  - grupo: `rotateElementsInList(members, center, delta)` (posições + `rotate`).
- Commit idem via `updateElements`; limpar preview/guias.
- Durante a rotação, a caixa é recalculada do AABB visual dos membros (cresce/encolhe como no Figma).

**Outros**

- Remover o caminho antigo de resize single (`beginResize` no wrapper) e o `onChange` de commit de gesto; `onChange` fica só para texto.
- O wrapper de hit-test de cada elemento recebe o mesmo `transform: rotate(${elementRotation(withPatch(el))}deg)` (para o clique acompanhar o visual girado); o hover/borda giram junto.
- `TextEditor` recebe `rotation` e aplica `transform: rotate(...)` no wrapper para editar texto girado no lugar certo.

- [ ] **Step 1: implementar overlay completo**
- [ ] **Step 2: resize grupo/seleção**
- [ ] **Step 3: resize local de item girado**
- [ ] **Step 4: rotação item/grupo**
- [ ] **Step 5: typecheck + manual**

Manual: 8 alças no grupo; Shift mantém proporção; girar grupo e itens; Shift 15°; item girado move/resize; item travado no grupo não se move; texto girado editável; soltar recalcula a caixa.

- [ ] **Step 6: commit**

```bash
git add src/features/theme-editor/SelectionOverlay.tsx src/features/theme-editor/Canvas.tsx
git commit -m "feat(theme-editor): resize and rotate items, groups and selections"
```

---

### Task 9: Réguas interativas, guias arrastáveis e snap

**Files**

- Create: `src/features/theme-editor/Rulers.tsx`
- Modify: `src/features/theme-editor/Canvas.tsx`
- Modify: `src/views/ThemeEditorView.tsx` (botão "Limpar guias")

**Rulers.tsx**

- Extrair `RulerTop`/`RulerLeft` do Canvas; props:

```ts
interface RulersProps {
  width: number;
  height: number;
  onStartGuide: (axis: GuideAxis, e: React.PointerEvent<HTMLDivElement>) => void;
}
```

- Bandas com `pointer-events-auto cursor-crosshair select-none z-40`; `onPointerDown` no topo chama `onStartGuide("x", e)`, na esquerda `onStartGuide("y", e)`. Ticks iguais aos atuais. `stopPropagation()` no pointerdown para não limpar a seleção.
- As linhas de guia também fazem `stopPropagation()` no pointerdown (para não iniciar gesto de canvas).

**Canvas**

- `const guides = theme.guides ?? []` (o `theme` recebido já é `materializePage`).
- `guideDrag` local:

```ts
interface GuideDrag {
  id: string;
  axis: GuideAxis;
  pos: number;
  isNew: boolean;
  armed: boolean;
  remove: boolean;
}
```

- `startGuideDrag(e, { id?, axis, pos, isNew })`: cria id se novo; `armed = !isNew` (guia nova só "arma" a remoção depois que o ponteiro sai da faixa da régua); listeners de janela; no move calcular `pos` lógico pelo eixo; quando o ponteiro sai da régua, `armed = true`; snap quando `snap`; remover se `armed` e ponteiro sobre a régua oposta (guia vertical: `y <= 20`; horizontal: `x <= 20`) ou fora dos limites; no up: novo → `addGuide(axis, pos)` (ou nada se remover), existente → `moveGuide`/`removeGuide`.
- Renderizar guias do store + guia em drag (sem duplicar), com hit area de 8 px, linha 1.5 px, `cursor: grab`, hover com opacidade; duplo-clique remove; rótulo `px` durante o drag.
- Snap: `calculateSnap(..., boxes, userGuides)` e `calculateResizeSnap(orig, dir, dx, dy, userGuides)` ganham o parâmetro `userGuides: readonly ThemeGuide[]` (default `[]`) — nome diferente do array local `guides: SmartGuide[]` para não sombrear. Inserir checagem de guias **depois** de centro/margens e **antes** dos elementos, só quando ainda não houve snap (`guides.length === 0`); usar `snapGuidePosition` nos candidatos (esquerda/centro/direita ou topo/meio/base). `SmartGuide` ganha `kind?: "screen" | "user"`; guia de usuário ativa renderiza em ciano (`#22d3ee`), as fixas continuam rosa. No arrasto de uma guia, os alvos do snap são: 0/centro/borda da tela, bordas/centros visuais dos elementos e as outras guias (ignorar a própria guia).
- Guias visíveis independentemente do toggle "Guias" (que controla só centro/margens).
- Não renderizar guias no `ThemeRenderer` nem no export.

**ThemeEditorView**

- Botão "Limpar guias" na toolbar, visível quando `(viewTheme.guides?.length ?? 0) > 0`, ícone `Trash2`, chama `clearGuides()`.

- [ ] **Step 1: extrair Rulers e criar guias do zero**
- [ ] **Step 2: arrastar/remover guias existentes**
- [ ] **Step 3: snap e render ativo**
- [ ] **Step 4: botão limpar**
- [ ] **Step 5: typecheck + manual**

Manual: criar guia nas duas réguas; arrastar; snap a guia/elementos; arrastar de volta para a régua remove; duplo-clique remove; "Limpar guias"; zoom 50% e 200%; salvar, fechar e reabrir mantém; export PNG não mostra guias; projeção não mostra.

- [ ] **Step 6: commit**

```bash
git add src/features/theme-editor/Rulers.tsx src/features/theme-editor/Canvas.tsx src/views/ThemeEditorView.tsx
git commit -m "feat(theme-editor): add draggable ruler guides with snapping"
```

---

### Task 10: Atalhos e painel de camadas

**Files**

- Modify: `src/views/ThemeEditorView.tsx`
- Modify: `src/features/theme-editor/LayersPanel.tsx`

**ThemeEditorView shortcuts** (no handler existente, guarda `isInput`):

- `Delete`/`Backspace` → `removeSelection()`.
- `Escape` → `clearSelection()`.
- `Cmd/Ctrl+D` → `preventDefault` + `duplicateSelection()`.
- `Cmd/Ctrl+G` → `groupSelection()`; `Cmd/Ctrl+Shift+G` → `ungroupSelection()`.
- `Cmd/Ctrl+A` → `preventDefault` + `selectAll()`.
- Ignorar `e.repeat` nos comandos com modificador.
- Remover o estado local `selectedId`/`setSelectedId` restante; usar `selection.anchorId` onde precisar (ex.: inserir símbolo em texto selecionado) e `select([id], { anchorId: id })` após inserir elemento. **Manter um `selectedId` derivado (`selection.anchorId`) para o `PropertiesPanel` até a Task 11**, que ainda recebe essa prop.
- Atualizar o uso para `<LayersPanel />` (sem props).
- Atualizar o array de dependências do `useEffect` de teclado com as novas ações do store.

**LayersPanel**

- Remover props e `onSelect`; ler `selection`, `select`, `toggleSelect`, `enterGroup`, `duplicateSelection`, `groupSelection`, `ungroupSelection`.
- Remover `selectedIds` local; `selectedIds = new Set(selection.ids)`.
- Clique em grupo: `select(groupIds, { anchorId: first })`; Shift → alterna o grupo inteiro.
- Clique em filho: sem modificador → `enterGroup(groupId, id)` (ou `select([id])` se avulso); Shift → `toggleSelect(id)`.
- `canGroup = selection.ids.length >= 2`; "Agrupar (n)" chama `groupSelection()`.
- `canUngroup`: grupo na seleção/`enteredGroupId`; chama `ungroupSelection()`.
- Botão **Duplicar** (`Copy` do lucide) no header do grupo e em cada linha: selecionar o alvo e chamar `duplicateSelection()`; `stopPropagation`.
- Destacar grupo quando todos os membros estão em `selection.ids`; destacar filho quando em `ids`.
- Nos handlers de apagar (`removeElement`/`removeGroup`), se o alvo estava na seleção, chamar `clearSelection()` depois de apagar (evita ids órfãos).

- [ ] **Step 1: atalhos**
- [ ] **Step 2: LayersPanel**
- [ ] **Step 3: typecheck + manual**

Manual: Cmd+D duplica item/grupo e seleciona a cópia; Delete apaga a seleção; Cmd+G/Shift+G; Cmd+A seleciona visíveis/destravados; Shift+clique na camada; duplicar pelo botão; atalhos não disparam digitando.

- [ ] **Step 4: commit**

```bash
git add src/views/ThemeEditorView.tsx src/features/theme-editor/LayersPanel.tsx
git commit -m "feat(theme-editor): add selection shortcuts and layer duplicate actions"
```

---

### Task 11: PropertiesPanel — "Organizar", "Aparência", escopo e seções fechadas

**Files**

- Modify: `src/features/theme-editor/PropertiesPanel.tsx`

**Regras gerais**

- `Section` default `defaultOpen = false`; remover todos os `defaultOpen={true}`.
- Remover a prop `selectedId`; ler `selection` do store. `viewTheme.elements` define `selected = anchor` e `members = ids`. Atualizar o uso para `<PropertiesPanel />` e remover o `selectedId` derivado do `ThemeEditorView` se ele não for mais usado.
- `scope = members.length > 1 ? "selection" : "item"`.
- Sem seleção → abas atuais (`Fundo do Slide`/`Slide & Tela`) inalteradas.
- **Seleção múltipla/grupo** → renderizar **somente** os blocos de "Organizar" (sem `Tabs`), pois tipos podem ser mistos:
  1. `GEOMETRIA DA SELEÇÃO`
  2. `ALINHAR & DISTRIBUIR`
  3. `ORDEM`
  4. `AGRUPAR`
- **Item único** → abas por tipo:
  - texto: `Texto` | `Organizar` | `Aparência` | `Animação` | `CSS` (`grid-cols-5`, `text-[10px]`).
  - mídia: `Mídia` | `Organizar` | `Aparência` | `Animação` | `CSS`.
  - forma: `Organizar` | `Aparência` | `Animação` | `CSS` (`grid-cols-4`).
  - `defaultValue={isText ? "text" : isMedia ? "media" : "organize"}` (mantém a aba principal do tipo; "Organizar" é a primeira aba para formas).
  - A aba Organizar do item único renderiza `GeometrySection` + `AlignDistributeSection` + `OrderSection` + `GroupSection` + `ElementSection`.
- Ícones: `Move` para Organizar, `Palette` para Aparência, `Type`/`ImageIcon` para Texto/Mídia.
- Adicionar `key={`${selected.type}-${scope}`}` ao `<Tabs>`: o Radix só aplica `defaultValue` no mount, e trocar de tipo/escopo precisa reabrir numa aba válida.

**Blocos**

1. `GeometrySection` (substitui `PositionSection`):
   - Item: X/Y/W/H lidos de `elementBox(el)` (resolve `%` e fallbacks; não usar `pxOf(css.left)`), Rotação (°) `-180..180`, `step={1}`, com `setSelectionRotation`, escala % e padding atuais. Ao gravar X/Y, escrever `css.left/top` em px e `x/y` em porcentagem (`toPct`); W/H só `css.width/height` em px.
   - Seleção: X/Y/W/H da caixa visual; X/Y aplicam `translateSelection(delta)`; W/H aplicam `scaleSelection(fx, 1)` / `scaleSelection(1, fy)`; Rotação é um campo delta com estado local: `onBlur`/Enter aplica `rotateSelectionBy` e zera o campo; placeholder "0". Sem escala/padding.
2. `AlignDistributeSection`:
   - 6 botões de alinhar chamam `alignSelection(edge)`.
   - Distribuir H/V habilitado com 3+ ids; `distributeSelection("x"|"y")`.
   - Textos: "Alinhar à esquerda", "Centralizar", "Alinhar à direita", "Alinhar ao topo", "Alinhar ao meio", "Alinhar à base", "Distribuir horizontalmente", "Distribuir verticalmente".
3. `OrderSection`: 4 botões `reorderSelection("front"|"forward"|"backward"|"back")` com títulos "Trazer para frente", "Avançar", "Recuar", "Enviar para trás".
4. `GroupSection`: "Agrupar" (`groupSelection()`, desabilitado < 2), "Desagrupar" (`ungroupSelection()`, desabilitado sem grupo), campo "Nome do grupo" quando há grupo (Enter/blur → `renameGroup`).
5. `ElementSection`: mover `GeneralSection` para o fim da aba Organizar, só no escopo item.
- `Aparência`: `TextBoxBackgroundSection` (texto) ou `RectangleSection` (formas) + `AppearanceSection`; mídia só `AppearanceSection`.
- `Organizar` também existe para texto/mídia; o antigo conteúdo de "Forma" é dividido entre Organizar (geometria/elemento) e Aparência (fundo/estilo).
- Reaproveitar `updateElement` para campos de item; para seleção usar ações do store.

- [ ] **Step 1: seções fechadas e abas**
- [ ] **Step 2: GeometrySection com escopo**
- [ ] **Step 3: alinhar/distribuir/ordem/agrupar**
- [ ] **Step 4: mover aparência/elemento**
- [ ] **Step 5: typecheck + manual**

Manual: todas as seções abrem fechadas; item → campos absolutos; grupo → X/Y move tudo, W/H escala, rotação gira; alinhar item entrado usa a caixa do grupo; distribuir com 3; ordem; agrupar/desagrupar/renomear; abas corretas por tipo; Aparência edita só estilo.

- [ ] **Step 6: commit**

```bash
git add src/features/theme-editor/PropertiesPanel.tsx
git commit -m "feat(theme-editor): reorganize properties into Organizar and Aparência"
```

---

### Task 12: Janela do editor — fechar, sem "Voltar", sem menu de contexto, Cmd+A nativo

**Files**

- Create: `src/core/lib/closeWindow.ts`
- Modify: `src/views/ThemeEditorView.tsx`
- Modify: `src-tauri/capabilities/main-capability.json`
- Modify (condicional): `src-tauri/src/lib.rs` (`.select_all()`)

**closeWindow.ts**

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/core/ipc/tauri";

export async function closeCurrentWindow(fallback: () => void): Promise<void> {
  if (isTauri()) {
    const closed = await getCurrentWindow()
      .close()
      .then(() => true)
      .catch(() => false);
    if (closed) return;
  }
  window.close();
  fallback();
}
```

- `main-capability.json`: adicionar `"core:window:allow-close"` em `permissions` (a janela `theme-editor` já está em `windows`).

**ThemeEditorView**

- Remover o botão `ArrowLeft` do header e o item "Voltar" do menu móvel; `handleBack` some.
- Estado de erro: botão **"Fechar"** com ícone `X` → `closeEditor()`.
- `closeEditor`:

```ts
const closeEditor = () => {
  void closeCurrentWindow(() => navigate("/preferences"));
};
```

- Menu móvel: item "Fechar janela" com `closeEditor`.
- Bloquear o menu de contexto no contêiner raiz do editor e no estado de erro:

```tsx
onContextMenu={(e) => {
  const t = e.target as HTMLElement;
  if (t.isContentEditable || t.closest("input, textarea, select, [contenteditable='true']")) return;
  e.preventDefault();
}}
```

- Manter o `preventDefault` de Backspace/Cmd+setas.

**Cmd+A manual gate**

1. Rodar `npm run tauri:dev`.
2. No editor, foco no canvas, `Cmd+A`: todos os itens visíveis/destravados da página ativa selecionados.
3. Em um input do editor e em um input da janela principal, `Cmd+A`: seleciona o texto.
4. **Se o menu nativo engolir o atalho**: remover `.select_all()` de `edit_menu` em `src-tauri/src/lib.rs`, rodar `cargo check -p open-presenter`, repetir os passos 2–3. Registrar no PR qual caminho foi usado.

- [ ] **Step 1: helper + capability**
- [ ] **Step 2: remover Voltar / fechar**
- [ ] **Step 3: bloquear menu de contexto**
- [ ] **Step 4: teste manual de Cmd+A e fallback se necessário**
- [ ] **Step 5: typecheck/cargo check + commit**

```bash
npm run typecheck
cargo check -p open-presenter
git add src/core/lib/closeWindow.ts src/views/ThemeEditorView.tsx src-tauri/capabilities/main-capability.json
git commit -m "feat(theme-editor): close native window and remove webview chrome"
```

(Se o fallback for necessário, incluir `src-tauri/src/lib.rs` no commit e citar no corpo.)

---

### Task 13: Rotação no exportador Canvas 2D

**Files**

- Modify: `src/features/theme-editor/exportImage.ts`
- Modify: `src/features/theme-editor/exportImage.test.ts`

**Interfaces**

```ts
export function exportElementBox(
  el: ThemeElement,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number };
export function textElementBox(
  el: ThemeElement,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number };
```

- `exportElementBox`: mesma matemática dos blocos de retângulo/imagem atuais (`parseDimension`, fallbacks `0.8`/`0.3`). Importar `parseRotateDeg` de `./geometry.ts`.
- `textElementBox`: mesma matemática do `drawTextElement` atual, inclusive o fallback de altura `Math.max(0, h - top - h * 0.05)` (diferente de `0.3`). Refatorar `drawTextElement` para usar o helper (uma única fonte de verdade).
- No loop de `exportThemeAsImage`, para cada elemento visível:
  - `box = el.type === "TEXT" ? textElementBox(...) : exportElementBox(...)`; `angle = parseRotateDeg(el.css.rotate)`.
  - Se `angle !== 0`: `ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle * Math.PI / 180); ctx.translate(-cx, -cy);` antes dos blocos de retângulo/imagem/texto; `ctx.restore()` depois.
  - Substituir os cálculos duplicados de box nos blocos de retângulo e imagem por `exportElementBox`.
- Texto: a rotação envolve a chamada inteira de `drawTextElement`, centrada em `textElementBox`.
- Não tocar em `exportElementAsImage` (não usado).

**Tests**

Adicionar a `exportImage.test.ts`:

```ts
test("exportElementBox respeita px e porcentagem", () => {
  const el = {
    id: "a", type: "RECTANGLE" as const, x: 0, y: 0, visible: true, locked: false,
    css: { left: "100px", top: "10%", width: "50%", height: "200px" },
  };
  assert.deepEqual(exportElementBox(el, 1000, 500), {
    left: 100, top: 50, width: 500, height: 200,
  });
});

test("textElementBox usa o fallback de altura do texto", () => {
  const el = {
    id: "t", type: "TEXT" as const, x: 0, y: 0, visible: true, locked: false,
    text: "oi", css: { left: "100px", top: "10%" },
  };
  assert.deepEqual(textElementBox(el, 1000, 500), {
    left: 100, top: 50, width: 800, height: 425,
  });
});
```

- [ ] **Step 1: teste que falha**
- [ ] **Step 2: implementar helper e transform**
- [ ] **Step 3: `node --test src/features/theme-editor/exportImage.test.ts`**
- [ ] **Step 4: manual** — girar texto, imagem e forma em 30°, exportar PNG 1920×1080 e comparar com o editor; conferir que guias não aparecem.
- [ ] **Step 5: commit**

```bash
git add src/features/theme-editor/exportImage.ts src/features/theme-editor/exportImage.test.ts
git commit -m "feat(theme-editor): apply rotation when exporting theme images"
```

---

### Task 14: Documentação e verificação final

**Files**

- Modify: `docs-site/content/docs/operacao/temas-e-estilos.mdx`
- Modify: `docs-site/content/docs/operacao/atalhos-teclado.mdx`

**Docs**

- `temas-e-estilos.mdx`: nova seção "Organizar elementos no editor" com:
  - clique seleciona grupo; duplo-clique/Cmd+clique entra no item;
  - Shift+clique adiciona/remove;
  - caixa do grupo: redimensionar (Shift = proporção) e girar (Shift = 15°);
  - guias: arraste das réguas, duplo-clique remove, "Limpar guias", visíveis só no editor;
  - duplicar (Cmd+D/botão), apagar, agrupar/desagrupar, Cmd+A;
  - rotação pelo campo da aba Organizar;
  - seções fechadas por padrão.
- `atalhos-teclado.mdx`: acrescentar linhas para Cmd/Ctrl+D, Cmd/Ctrl+G, Cmd/Ctrl+Shift+G, Cmd/Ctrl+A, Shift+clique, Cmd/Ctrl+clique, Shift durante gesto.

**Verificação final**

```bash
npm test
npm run typecheck
cargo check -p open-presenter
git status --short
```

Checklist manual completo (Tauri, `npm run tauri:dev`):

1. Duplicar item e grupo (atalho e botão), seleção na cópia.
2. Delete apaga seleção; último elemento de layout único protegido; grupo órfão dissolvido.
3. Clique em grupo seleciona o grupo; Cmd/Ctrl+clique e duplo-clique entram; clique vazio sai; Shift+clique alterna.
4. Mover grupo/seleção; membro travado não se move mas conta na caixa.
5. Resize grupo com Shift; membros escalam mantendo posições relativas; texto acompanha.
6. Girar item e grupo pelas alças e pelo campo; Shift 15°; ±180 sem pulo.
7. Item girado move/resize sem deformar.
8. Guias: criar, arrastar, snap, remover, limpar; salvar/reabrir; export/projeção sem guias.
9. Aba Organizar/Aparência por tipo; alinhar (tela/grupo/seleção), distribuir (3+), ordem, agrupar/renomear.
10. Seções fechadas por padrão.
11. Janela: sem botão Voltar; X fecha; botão direito não mostra Voltar/Recarregar/Inspecionar em área não editável; input mantém menu nativo.
12. Cmd+A conforme Task 12.
13. Export PNG/JPG com rotação.

- [ ] **Step 1: escrever docs**
- [ ] **Step 2: rodar verificação**
- [ ] **Step 3: corrigir o que falhar**
- [ ] **Step 4: commit**

```bash
git add docs-site/content/docs/operacao/temas-e-estilos.mdx docs-site/content/docs/operacao/atalhos-teclado.mdx
git commit -m "docs(operacao): document Studio organize tools, guides and shortcuts"
```

---

## Decisões de implementação (desvios conscientes do spec)

- **Painel com seleção múltipla** mostra somente os blocos de "Organizar" (sem abas por tipo), porque a seleção pode misturar texto/forma/mídia. Abas por tipo continuam no escopo item.
- **Campo de rotação em seleção múltipla** é um delta (aplica e zera), já que o grupo não tem uma rotação única persistida; a alça mostra o ângulo ao vivo.
- **W/H no painel de seleção** escalam só o eixo editado (o Shift proporcional é gesto, não campo).
- **Resize de item girado** não usa snap (evita saltos no referencial local); o resize de caixa não girada continua com snap. `Shift` uniforme em item girado é aproximado.
- **Seleção é efêmera e é limpa** em `load`, `undo`, `redo` e troca de página; não entra no histórico.
- **Grupo órfão** (1 membro) é dissolvido automaticamente após remoção.
- **`exportElementAsImage`** não é usado e fica fora do escopo da rotação.
- **Medidas de elementos sem `css.width/height`**: o canvas usa a medida real do DOM (`ResizeObserver`); o painel usa `FALLBACK_SIZE` via `elementBox`, porque a medida não é compartilhada. Temas criados pelo editor sempre têm `css.width/height`, então o caso só afeta temas importados/legados com dimensões automáticas. Não há sincronização de medidas nesta entrega.

## Self-Review (cobertura do spec)

| Requisito do spec | Task |
| --- | --- |
| Duplicar item/grupo (Cmd+D + botão) | 3, 4, 6, 10 |
| Delete/Backspace na seleção + guardas | 3, 4, 6, 10 |
| Janela sem chrome/Voltar, menu de contexto | 12 |
| Guias arrastáveis por página + snap + persistência | 5, 6, 9 |
| Agrupar/desagrupar por atalho | 10 |
| Clique vazio deseleciona | 7 |
| Clique seleciona grupo; duplo/Cmd entra | 4, 7 |
| Alinhamento relativo ao grupo | 2, 4, 11 |
| Caixa do grupo com resize/Shift e rotação | 8, 11 |
| Rotação de item por alças e campo | 8, 11 |
| Aba "Organizar" + "Aparência" | 11 |
| Seções fechadas por padrão | 11 |
| Cmd+A na página ativa | 6, 10, 12 |
| Rotação no exportador | 1, 13 |
| Round-trip Rust das guias | 5 |
| Docs | 14 |

**Testes puros previstos:** AABB/rotação, escala (eixo/uniforme/clamp), normalize, seleção (clique/toggle/grupo/órfão), duplicar/remover/reordenar, guias (CRUD/snap/materializePage), exportElementBox. **Sem teste automatizado (padrão do repo):** componentes, gestos e integração com Tauri — cobertos pelo checklist manual.
