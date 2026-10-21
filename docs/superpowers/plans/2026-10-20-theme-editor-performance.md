# Performance do ThemeEditor e Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reduzir o trabalho por frame ao arrastar elementos no ThemeEditor e evitar que o Studio monte previews fora da viewport, sem mudar o modelo de dados nem o visual dos temas.

**Architecture:** extrair funções puras pequenas (coalescência de frame, chave de fit, comparador de memo, coleta de caixas de snap), testá-las com `node --test` e ligá-las ao `Canvas`, `ThemeRenderer` e `StudioPage`. O renderer e os tipos existentes permanecem; nenhuma migração de tema é necessária.

**Tech Stack:** React 19, TypeScript, Zustand, `node --test`, Tailwind v4. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-10-20-propresenter-theme-editor-design.md`

## Global Constraints

- Não adicionar dependências de canvas/editor (fabric, Konva, tldraw, react-rnd, dnd-kit, Three.js).
- Não alterar versões pinadas de `package.json`/`Cargo.toml`.
- Temas v1/v2 precisam continuar abrindo sem mudança visual.
- `npm run typecheck` e `npm test` passam antes de cada commit.
- Sem comentários no código, exceto quando a lógica não for auto-evidente.
- Commits em Conventional Commits, em pt-BR ou en, curtos e no imperativo.
- Disco: ~2 GiB livres. Não rodar `npm install` nem build Tauri completo dentro do worktree.
- `node_modules` já está compartilhado por symlink com o checkout principal.

## Review Focus

- Texto com altura automática e largura fixa: mover na horizontal não pode re-medir; mover na vertical pode.
- Tema com 10+ elementos: arrastar um elemento não pode re-renderizar/re-medir os demais.
- Studio com 50+ temas: previews fora da viewport não podem montar canvas/ResizeObserver.
- Pointerup antes do próximo frame: a última posição do arrasto não pode ser perdida.
- Tema v1/v2: nenhum elemento pode mudar de posição, ordem ou fundo.

---

## File Structure

**Create:**

- `src/core/lib/frameCoalescer.ts` — agenda no máximo um callback por frame, guardando o último valor.
- `src/core/lib/frameCoalescer.test.ts` — testes com scheduler falso.
- `src/features/slide-themes/fitGeometry.ts` — chave de geometria usada pelo auto-fit.
- `src/features/slide-themes/fitGeometry.test.ts` — testes da chave.
- `src/features/slide-themes/elementMemo.ts` — comparador de props do elemento.
- `src/features/slide-themes/elementMemo.test.ts` — testes do comparador.
- `src/features/theme-editor/snapBoxes.ts` — coleta de caixas de snap de um gesto.
- `src/features/theme-editor/snapBoxes.test.ts` — testes da coleta.
- `src/features/studio/ThemePreview.tsx` — preview preguiçoso e memoizado.

**Modify:**

- `src/features/theme-editor/Canvas.tsx` — coalescer, snap boxes por gesto, flush no pointerup.
- `src/features/slide-themes/ThemeRenderer.tsx` — chave de fit e memo do elemento.
- `src/features/studio/StudioPage.tsx` — usar `ThemePreview` no grid e na lista.

**No Rust changes.**

---

### Task 1: Coalescer pointermove por frame

**Files:**

- Create: `src/core/lib/frameCoalescer.ts`
- Test: `src/core/lib/frameCoalescer.test.ts`
- Modify: `src/features/theme-editor/Canvas.tsx:598-689,912-930,978-995`

**Interfaces:**

- Consumes: nada.
- Produces:
  - `interface FrameScheduler { request(callback: FrameRequestCallback): number; cancel(handle: number): void }`
  - `interface FrameCoalescer<T> { push(value: T): void; flush(): void; cancel(): void }`
  - `function createFrameCoalescer<T>(apply: (value: T) => void, scheduler?: FrameScheduler): FrameCoalescer<T>`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  createFrameCoalescer,
  type FrameCoalescer,
  type FrameScheduler,
} from "./frameCoalescer.ts";

function fakeScheduler() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const scheduler: FrameScheduler = {
    request(callback) {
      nextId += 1;
      callbacks.set(nextId, callback);
      return nextId;
    },
    cancel(handle) {
      callbacks.delete(handle);
    },
  };
  return {
    scheduler,
    tick() {
      const batch = [...callbacks.values()];
      callbacks.clear();
      for (const callback of batch) callback(0);
    },
    pending() {
      return callbacks.size;
    },
  };
}

test("aplica apenas o último valor por frame", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  const coalescer = createFrameCoalescer<number>((value) => seen.push(value), fake.scheduler);

  coalescer.push(1);
  coalescer.push(2);
  coalescer.push(3);

  assert.deepEqual(seen, []);
  assert.equal(fake.pending(), 1);
  fake.tick();
  assert.deepEqual(seen, [3]);
});

test("um push durante o apply agenda o próximo frame", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  let coalescer: FrameCoalescer<number>;
  coalescer = createFrameCoalescer<number>((value) => {
    seen.push(value);
    if (value === 1) coalescer.push(2);
  }, fake.scheduler);

  coalescer.push(1);
  fake.tick();
  assert.deepEqual(seen, [1]);
  assert.equal(fake.pending(), 1);

  fake.tick();
  assert.deepEqual(seen, [1, 2]);
});

test("cancel descarta o valor pendente", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  const coalescer = createFrameCoalescer<number>((value) => seen.push(value), fake.scheduler);

  coalescer.push(1);
  coalescer.cancel();
  fake.tick();

  assert.deepEqual(seen, []);
  assert.equal(fake.pending(), 0);
});

test("flush aplica imediatamente e cancela o frame", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  const coalescer = createFrameCoalescer<number>((value) => seen.push(value), fake.scheduler);

  coalescer.push(7);
  coalescer.flush();
  fake.tick();

  assert.deepEqual(seen, [7]);
  assert.equal(fake.pending(), 0);
});

test("flush sem valor não chama apply", () => {
  const fake = fakeScheduler();
  let calls = 0;
  const coalescer = createFrameCoalescer<number>(() => {
    calls += 1;
  }, fake.scheduler);

  coalescer.flush();
  assert.equal(calls, 0);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
node --test src/core/lib/frameCoalescer.test.ts
```

Expected: FAIL with `Cannot find module './frameCoalescer.ts'`.

- [ ] **Step 3: Implement `src/core/lib/frameCoalescer.ts`**

```ts
export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface FrameCoalescer<T> {
  push(value: T): void;
  flush(): void;
  cancel(): void;
}

const defaultScheduler: FrameScheduler = {
  request(callback) {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  },
  cancel(handle) {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  },
};

export function createFrameCoalescer<T>(
  apply: (value: T) => void,
  scheduler: FrameScheduler = defaultScheduler,
): FrameCoalescer<T> {
  let handle: number | null = null;
  let pending: T | undefined;
  let hasPending = false;

  function run(): void {
    handle = null;
    if (!hasPending) return;
    const value = pending as T;
    pending = undefined;
    hasPending = false;
    apply(value);
  }

  return {
    push(value) {
      pending = value;
      hasPending = true;
      if (handle === null) handle = scheduler.request(run);
    },
    flush() {
      if (handle !== null) {
        scheduler.cancel(handle);
        handle = null;
      }
      run();
    },
    cancel() {
      if (handle !== null) {
        scheduler.cancel(handle);
        handle = null;
      }
      pending = undefined;
      hasPending = false;
    },
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run:

```bash
node --test src/core/lib/frameCoalescer.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 5: Integrate with `Canvas.tsx`**

Add imports:

```ts
import { createFrameCoalescer, type FrameCoalescer } from "@/core/lib/frameCoalescer";
```

Add a pointer type near `Gesture`:

```ts
type PointerPos = { clientX: number; clientY: number };
```

Inside `Canvas`, after the existing refs:

```ts
const updateGestureRef = useRef<(pos: PointerPos) => void>(() => {});
const gestureFrameRef = useRef<FrameCoalescer<PointerPos> | null>(null);

updateGestureRef.current = updateGesture;

if (gestureFrameRef.current === null) {
  gestureFrameRef.current = createFrameCoalescer<PointerPos>((pos) => {
    updateGestureRef.current(pos);
  });
}

useEffect(() => {
  return () => gestureFrameRef.current?.cancel();
}, []);
```

`useEffect` must be imported from `react`.

In `beginMove` and `beginResize`, before creating the gesture:

```ts
gestureFrameRef.current?.cancel();
```

In both `onPointerMove` handlers, replace `updateGesture(e)` with:

```ts
gestureFrameRef.current?.push({ clientX: e.clientX, clientY: e.clientY });
```

In both `onPointerUp` handlers, before `endGesture()`:

```ts
gestureFrameRef.current?.flush();
```

In `onPointerCancel`, call `gestureFrameRef.current?.cancel()` before clearing.

In `endGesture`, after flushing/committing:

```ts
gestureFrameRef.current?.cancel();
```

- [ ] **Step 6: Typecheck and run the full suite**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck clean, 138 tests passing (133 + 5).

- [ ] **Step 7: Manual verification**

Run `npm run dev`, open the ThemeEditor, and drag an element. Confirm:

- the element follows the pointer smoothly;
- pressing and releasing quickly still commits the final position;
- pressing Escape/cancel during a drag does not commit.

- [ ] **Step 8: Commit**

```bash
git add src/core/lib/frameCoalescer.ts src/core/lib/frameCoalescer.test.ts src/features/theme-editor/Canvas.tsx
git commit -m "perf: coalesce theme canvas pointer moves by frame"
```

---

### Task 2: Auto-fit sem posição horizontal

**Files:**

- Create: `src/features/slide-themes/fitGeometry.ts`
- Test: `src/features/slide-themes/fitGeometry.test.ts`
- Modify: `src/features/slide-themes/ThemeRenderer.tsx:236-259`

**Interfaces:**

- Consumes: nada.
- Produces:
  - `interface FitGeometrySource { css: Record<string, string | undefined>; x?: number; y?: number }`
  - `function buildFitGeometryKey(source: FitGeometrySource, autoHeight: boolean): string`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildFitGeometryKey } from "./fitGeometry.ts";

test("mover na horizontal não muda a chave de fit", () => {
  const before = buildFitGeometryKey(
    { css: { left: "10px", top: "20px", width: "500px", height: "200px" }, x: 5, y: 10 },
    false,
  );
  const after = buildFitGeometryKey(
    { css: { left: "90px", top: "20px", width: "500px", height: "200px" }, x: 40, y: 10 },
    false,
  );
  assert.equal(before, after);
});

test("mover na vertical só muda a chave com altura automática", () => {
  const fixedBefore = buildFitGeometryKey(
    { css: { top: "20px", width: "500px", height: "200px" }, y: 10 },
    false,
  );
  const fixedAfter = buildFitGeometryKey(
    { css: { top: "80px", width: "500px", height: "200px" }, y: 40 },
    false,
  );
  assert.equal(fixedBefore, fixedAfter);

  const autoBefore = buildFitGeometryKey(
    { css: { top: "20px", width: "500px" }, y: 10 },
    true,
  );
  const autoAfter = buildFitGeometryKey(
    { css: { top: "80px", width: "500px" }, y: 40 },
    true,
  );
  assert.notEqual(autoBefore, autoAfter);
});

test("largura, altura e padding mudam a chave", () => {
  const base = buildFitGeometryKey(
    { css: { width: "500px", height: "200px", padding: "10px" } },
    false,
  );
  const width = buildFitGeometryKey(
    { css: { width: "600px", height: "200px", padding: "10px" } },
    false,
  );
  const padding = buildFitGeometryKey(
    { css: { width: "500px", height: "200px", padding: "20px" } },
    false,
  );
  assert.notEqual(base, width);
  assert.notEqual(base, padding);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
node --test src/features/slide-themes/fitGeometry.test.ts
```

Expected: FAIL with `Cannot find module './fitGeometry.ts'`.

- [ ] **Step 3: Implement `src/features/slide-themes/fitGeometry.ts`**

```ts
export interface FitGeometrySource {
  css: Record<string, string | undefined>;
  x?: number;
  y?: number;
}

export function buildFitGeometryKey(
  source: FitGeometrySource,
  autoHeight: boolean,
): string {
  const css = source.css;
  const parts = [
    css.width,
    css.height,
    css.maxHeight,
    css.padding,
    css.paddingTop,
    css.paddingRight,
    css.paddingBottom,
    css.paddingLeft,
  ];
  if (autoHeight) {
    parts.push(css.top, css.marginTop, source.y === undefined ? "" : String(source.y));
  }
  return parts.map((part) => part ?? "").join("|");
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run:

```bash
node --test src/features/slide-themes/fitGeometry.test.ts
```

Expected: 3 tests passing.

- [ ] **Step 5: Use the helper in `ThemeRenderer.tsx`**

Add:

```ts
import { buildFitGeometryKey } from "./fitGeometry.ts";
```

Replace the inline `geometryKey` array with:

```ts
const geometryKey = buildFitGeometryKey(element, autoHeight);
```

Keep `autoHeight` computed before the key.

- [ ] **Step 6: Typecheck and run the full suite**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck clean, 141 tests passing.

- [ ] **Step 7: Manual verification**

No ThemeEditor, arraste um texto horizontalmente e depois verticalmente:

- horizontal: o tamanho da fonte não deve oscilar;
- vertical com altura automática: o fit pode recalcular;
- vertical com altura fixa: o tamanho da fonte não deve mudar.

- [ ] **Step 8: Commit**

```bash
git add src/features/slide-themes/fitGeometry.ts src/features/slide-themes/fitGeometry.test.ts src/features/slide-themes/ThemeRenderer.tsx
git commit -m "perf: keep text fit independent of element position"
```

---

### Task 3: Memoizar renderização dos elementos

**Files:**

- Create: `src/features/slide-themes/elementMemo.ts`
- Test: `src/features/slide-themes/elementMemo.test.ts`
- Modify: `src/features/slide-themes/ThemeRenderer.tsx:401-469,510-517`

**Interfaces:**

- Consumes: `ThemeElement` de `@/core/types`.
- Produces:
  - `interface ElementRenderProps { element: ThemeElement; props: Record<string, string> }`
  - `function areElementRenderPropsEqual(prev: ElementRenderProps, next: ElementRenderProps): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import { areElementRenderPropsEqual } from "./elementMemo.ts";

const element = {
  id: "e1",
  type: "TEXT",
  x: 0,
  y: 0,
  visible: true,
  locked: false,
  css: {},
  text: "Olá",
} as ThemeElement;

test("não re-renderiza com o mesmo elemento e props iguais", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A", lyrics: "B" } },
      { element, props: { title: "A", lyrics: "B" } },
    ),
    true,
  );
});

test("re-renderiza quando o elemento muda de identidade", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A" } },
      { element: { ...element }, props: { title: "A" } },
    ),
    false,
  );
});

test("re-renderiza quando uma prop muda", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A" } },
      { element, props: { title: "B" } },
    ),
    false,
  );
});

test("re-renderiza quando entra ou sai uma prop", () => {
  assert.equal(
    areElementRenderPropsEqual(
      { element, props: { title: "A" } },
      { element, props: { title: "A", lyrics: "B" } },
    ),
    false,
  );
});

test("não re-renderiza quando o objeto de props é o mesmo", () => {
  const props = { title: "A" };
  assert.equal(
    areElementRenderPropsEqual({ element, props }, { element, props }),
    true,
  );
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
node --test src/features/slide-themes/elementMemo.test.ts
```

Expected: FAIL with `Cannot find module './elementMemo.ts'`.

- [ ] **Step 3: Implement `src/features/slide-themes/elementMemo.ts`**

```ts
import type { ThemeElement } from "@/core/types";

export interface ElementRenderProps {
  element: ThemeElement;
  props: Record<string, string>;
}

export function areElementRenderPropsEqual(
  previous: ElementRenderProps,
  next: ElementRenderProps,
): boolean {
  if (previous.element !== next.element) return false;
  if (previous.props === next.props) return true;

  const previousKeys = Object.keys(previous.props);
  const nextKeys = Object.keys(next.props);
  if (previousKeys.length !== nextKeys.length) return false;

  for (const key of previousKeys) {
    if (previous.props[key] !== next.props[key]) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run:

```bash
node --test src/features/slide-themes/elementMemo.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 5: Wrap `ThemeElementView` in `memo`**

In `ThemeRenderer.tsx`, import `memo` from `react` and the comparator:

```ts
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { areElementRenderPropsEqual } from "./elementMemo.ts";
```

Rename the function declaration to an implementation and export the memoized version:

```tsx
const ThemeElementView = memo(function ThemeElementViewImpl({
  element,
  props,
}: {
  element: ThemeElement;
  props: Record<string, string>;
}) {
  // corpo atual, sem mudanças
}, areElementRenderPropsEqual);
```

Keep the JSX call `<ThemeElementView key={element.id} element={element} props={props} />`.

- [ ] **Step 6: Typecheck and run the full suite**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck clean, 146 tests passing.

- [ ] **Step 7: Manual verification**

Abra um tema com pelo menos 3 textos. Arraste um retângulo e confirme, no React DevTools com “Highlight updates”, que os textos não piscam. Arraste um texto e confirme que só ele atualiza.

- [ ] **Step 8: Commit**

```bash
git add src/features/slide-themes/elementMemo.ts src/features/slide-themes/elementMemo.test.ts src/features/slide-themes/ThemeRenderer.tsx
git commit -m "perf: memoize theme element rendering"
```

---

### Task 4: Caixas de snap por gesto

**Files:**

- Create: `src/features/theme-editor/snapBoxes.ts`
- Test: `src/features/theme-editor/snapBoxes.test.ts`
- Modify: `src/features/theme-editor/Canvas.tsx:52-61,273-419,598-620,691-735`

**Interfaces:**

- Consumes: `ThemeElement` de `@/core/types`.
- Produces:
  - `interface ElementBox { left: number; top: number; width: number; height: number }`
  - `function buildSnapBoxes(elements: readonly ThemeElement[], excludeId: string, boxOf: (element: ThemeElement) => ElementBox): Map<string, ElementBox>`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { ThemeElement } from "@/core/types";
import { buildSnapBoxes, type ElementBox } from "./snapBoxes.ts";

function element(id: string): ThemeElement {
  return {
    id,
    type: "RECTANGLE",
    x: 0,
    y: 0,
    visible: true,
    locked: false,
    css: {},
  };
}

test("exclui o elemento arrastado", () => {
  const boxes = buildSnapBoxes([element("a"), element("b")], "a", () => ({
    left: 0,
    top: 0,
    width: 10,
    height: 10,
  }));
  assert.equal(boxes.has("a"), false);
  assert.equal(boxes.has("b"), true);
});

test("usa o resolvedor de caixa para cada elemento", () => {
  const boxes = buildSnapBoxes([element("a"), element("b")], "a", (el) => ({
    left: el.id === "b" ? 100 : 0,
    top: 20,
    width: 30,
    height: 40,
  }));
  assert.deepEqual(boxes.get("b"), {
    left: 100,
    top: 20,
    width: 30,
    height: 40,
  });
});

test("chama o resolvedor uma vez por elemento", () => {
  let calls = 0;
  buildSnapBoxes([element("a"), element("b"), element("c")], "b", () => {
    calls += 1;
    return { left: 0, top: 0, width: 1, height: 1 } satisfies ElementBox;
  });
  assert.equal(calls, 2);
});

test("lista vazia gera mapa vazio", () => {
  const boxes = buildSnapBoxes([], "a", () => ({
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  }));
  assert.equal(boxes.size, 0);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
node --test src/features/theme-editor/snapBoxes.test.ts
```

Expected: FAIL with `Cannot find module './snapBoxes.ts'`.

- [ ] **Step 3: Implement `src/features/theme-editor/snapBoxes.ts`**

```ts
import type { ThemeElement } from "@/core/types";

export interface ElementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function buildSnapBoxes(
  elements: readonly ThemeElement[],
  excludeId: string,
  boxOf: (element: ThemeElement) => ElementBox,
): Map<string, ElementBox> {
  const boxes = new Map<string, ElementBox>();
  for (const element of elements) {
    if (element.id === excludeId) continue;
    boxes.set(element.id, boxOf(element));
  }
  return boxes;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run:

```bash
node --test src/features/theme-editor/snapBoxes.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Store the boxes in the gesture**

In `Canvas.tsx`, import:

```ts
import { buildSnapBoxes, type ElementBox } from "./snapBoxes";
```

Add to `Gesture`:

```ts
snapBoxes?: Map<string, ElementBox>;
```

Add a module constant:

```ts
const EMPTY_SNAP_BOXES: ReadonlyMap<string, ElementBox> = new Map();
```

In `beginMove`, after computing `box`:

```ts
const snapBoxes = buildSnapBoxes(visibleElements, el.id, resolveBox);
```

Include `snapBoxes` in the `gestureRef.current` object.

- [ ] **Step 6: Use the precomputed boxes in `calculateSnap`**

Change the signature to accept boxes:

```ts
function calculateSnap(
  origLeft: number,
  origTop: number,
  dx: number,
  dy: number,
  width: number,
  height: number,
  boxes: ReadonlyMap<string, ElementBox>,
): { left: number; top: number; guides: SmartGuide[] } {
```

Remove `excludeId` and `otherElements`.

In the X loop, replace the element iteration with:

```ts
for (const [otherId, box] of boxes) {
  const otherRight = box.left + box.width;
  const otherCenterX = box.left + box.width / 2;

  if (Math.abs(left - box.left) <= SNAP_DIST) {
    left = box.left;
    guides.push({ type: "vertical", pos: box.left, label: otherId });
    snappedX = true;
    break;
  }
  if (Math.abs(right - otherRight) <= SNAP_DIST) {
    left = otherRight - width;
    guides.push({ type: "vertical", pos: otherRight, label: otherId });
    snappedX = true;
    break;
  }
  if (Math.abs(centerX - otherCenterX) <= SNAP_DIST) {
    left = Math.round(otherCenterX - width / 2);
    guides.push({ type: "vertical", pos: otherCenterX, label: otherId });
    snappedX = true;
    break;
  }
}
```

Do the same for the Y loop, using `box.top`, `box.top + box.height`, `box.top + box.height / 2`, and `otherId` in the label.

- [ ] **Step 7: Update the caller**

In `updateGesture`:

```ts
const snapped = calculateSnap(
  g.orig.left,
  g.orig.top,
  dx,
  dy,
  g.orig.width,
  g.orig.height,
  g.snapBoxes ?? EMPTY_SNAP_BOXES,
);
```

- [ ] **Step 8: Typecheck and run the full suite**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck clean, 150 tests passing.

- [ ] **Step 9: Manual verification**

Arraste um elemento perto de outro e confirme que as guias continuam aparecendo com o nome do elemento. Mova um grupo e confirme que o deslocamento e as guias continuam corretos.

- [ ] **Step 10: Commit**

```bash
git add src/features/theme-editor/snapBoxes.ts src/features/theme-editor/snapBoxes.test.ts src/features/theme-editor/Canvas.tsx
git commit -m "perf: cache snap boxes per gesture"
```

---

### Task 5: Previews preguiçosos no Studio

**Files:**

- Create: `src/features/studio/ThemePreview.tsx`
- Modify: `src/features/studio/StudioPage.tsx` (grid e lista)

**Interfaces:**

- Consumes: `SlideTheme`, `ThemeAsset`, `ScaledStage`, `previewTheme`.
- Produces:
  - `function ThemePreview(props: { theme: SlideTheme; asset: ThemeAsset; title: string; className?: string }): JSX.Element`

- [ ] **Step 1: Implement `src/features/studio/ThemePreview.tsx`**

```tsx
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { SlideTheme, ThemeAsset } from "@/core/types";
import { previewTheme } from "@/features/slide-themes/pages";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";

interface ThemePreviewProps {
  theme: SlideTheme;
  asset: ThemeAsset;
  title: string;
  className?: string;
}

export const ThemePreview = memo(function ThemePreview({
  theme,
  asset,
  title,
  className = "absolute inset-0",
}: ThemePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const preview = useMemo(() => previewTheme(theme, asset), [theme, asset]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "200px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const props = useMemo(
    () => ({
      title,
      titulo: title,
      lyrics: title,
      letra: title,
      text: title,
      texto: title,
    }),
    [title],
  );

  return (
    <div ref={hostRef} className={className}>
      {visible ? (
        <ScaledStage theme={preview.theme} asset={preview.asset} props={props} />
      ) : (
        <div className="size-full bg-black" />
      )}
    </div>
  );
});
```

- [ ] **Step 2: Use it in the grid**

In `StudioPage.tsx`, add:

```ts
import { ThemePreview } from "./ThemePreview";
```

Remove `const preview = previewTheme(theme, "text");` from the grid map and replace `<ScaledStage ... />` with:

```tsx
<ThemePreview theme={theme} asset="text" title={theme.title} />
```

- [ ] **Step 3: Use it in the list**

Remove `const preview = previewTheme(theme, "text");` from the list map and replace the small `<ScaledStage ... />` with:

```tsx
<ThemePreview theme={theme} asset="text" title={theme.title} />
```

Keep the parent `relative h-12 w-20` intact.

- [ ] **Step 4: Typecheck and run the full suite**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck clean, 150 tests passing (Task 5 has no unit test).

- [ ] **Step 5: Manual verification**

Run `npm run dev`. No Studio, duplique temas até passar de 20 e role a grade:

- os cards visíveis mostram preview;
- cards fora da viewport mostram o placeholder preto;
- ao rolar de volta, o preview monta;
- abrir um tema e voltar mantém o comportamento.

Se quiser confirmar no React DevTools, procure `ScaledStage` na árvore: deve existir apenas para cards próximos da viewport.

- [ ] **Step 6: Commit**

```bash
git add src/features/studio/ThemePreview.tsx src/features/studio/StudioPage.tsx
git commit -m "perf: lazy-load studio theme previews"
```

---

## Self-Review

- **Spec coverage:** A1–A5 do roadmap estão cobertos. A6 (seletores no PropertiesPanel) e A7 (resumo leve no Rust) ficam para um plano seguinte, porque exigem mudanças estruturais e/ou migração de banco.
- **Step scan:** cada task tem teste falhando, implementação, teste passando, integração, typecheck, verificação manual e commit. A Task 5 não tem teste unitário porque o comportamento é de viewport; a verificação manual está explícita.
- **Type consistency:** `PointerPos`, `FrameCoalescer`, `FitGeometrySource`, `ElementRenderProps`, `ElementBox` e `ThemePreviewProps` são definidos uma vez e reutilizados.
- **Review Focus:** coberto por testes nas Tasks 2–4 e verificação manual nas Tasks 1 e 5.
- **Proportion:** o plano descreve funções pequenas e wiring; não transcreve os componentes grandes.

## Execution Handoff

Plano salvo em `docs/superpowers/plans/2026-10-20-theme-editor-performance.md`. Revise o plano e escolha o método de execução:

- **Subagent-driven** — um subagente implementa cada task e um revisor independente confere antes da próxima; mais rigoroso, mais caro.
- **Native** — eu implemento as tasks nesta sessão e um revisor confere o branch no final; mais rápido e barato.

Recomendo **Native** para este plano: são cinco tasks pequenas, com interfaces bem definidas e baixo risco de conflito.
