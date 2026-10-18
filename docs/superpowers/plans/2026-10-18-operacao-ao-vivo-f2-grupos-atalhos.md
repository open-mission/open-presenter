# F2 — Grupos de slides + atalhos numéricos (desktop) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrupar visualmente os slides de música por rótulo (grupo = seção rotulada + as seguintes sem rótulo), fazer a ação manual "Dividir" manter o rótulo só no primeiro fragmento e dar navegação por número (0–9 + Enter, com indicador) às colunas de música, texto e imagem.

**Architecture:** Tudo derivado no front, nada persistido: `computeSlideGroups` e `splitSection` entram em `core/lib/lyrics.ts` (a segunda espelha `lyrics::split_sections` do Rust); `core/lib/slideNumbers.ts` expõe o contrato puro do buffer numérico e `SlideNumberIndicator` mostra os dígitos; `SongSlidesColumn` consome grupos + números; `MediaSlidesColumn` consome números nas três apresentações (texto, grade de pasta, arquivo único).

**Tech Stack:** React 19 + TypeScript + Zustand; testes front com `node --test` (Node 22, type stripping; arquivos `*.test.ts` ficam **fora** do `tsc` — ver `tsconfig.app.json`).

**Spec:** `docs/superpowers/specs/2026-10-18-operacao-ao-vivo-design.md` — este plano cobre a fase **F2** (§6.1 grupos + D13 na ação manual; §6.2 atalhos; G1/G2). F3–F5 terão planos próprios.

**Branch:** `feature/operacao-ao-vivo-f2-grupos-atalhos` a partir de `develop` (Gitflow).

## Global Constraints

- **Fase 100% frontend** — nenhum arquivo Rust muda; os gates são `npm run typecheck` e `npm test`. Nenhum comando `cargo` é necessário nesta fase (o alvo do cargo foi limpo para liberar disco; a primeira reconstrução fica para a fase que mexer no backend).
- Antes de cada commit: `npm run typecheck` verde; quando o task cria/altera teste, rodar também `node --test <arquivo>` (focado) e, no commit final, `npm test`.
- Testes front seguem o padrão existente (`src/features/presentation/effectiveWallpaper.test.ts`): `*.test.ts` ao lado do fonte, `node:test` + `node:assert/strict`, import com extensão explícita (`.ts`). **Atenção:** `tsconfig.app.json` exclui `src/**/*.test.ts` — o typecheck não cobre testes; o gate deles é o `node --test`.
- Strings de UI em pt-BR; sem comentários no código salvo lógica não-óbvia; Conventional Commits curtos e no imperativo.
- Stack pinada — nenhuma dependência nova.
- Decisões fixadas no design: **D6** (grupo = seção com rótulo + seguintes sem rótulo; derivado, não persistido; rótulo sempre abre grupo novo), **D7** (buffer de 1–3 dígitos; Enter navega — projeta se a apresentação estiver ativa, senão prévia + scroll; Backspace apaga; Esc/clique limpa), **D13** (só o primeiro fragmento mantém o `section_type`). `computeSectionLabels` e `buildSongSlides` **não mudam** (numeração continua por seção rotulada).
- Guardas de teclado existentes preservadas nas duas colunas: ignora `INPUT`/`TEXTAREA`/`contentEditable`/`[role="dialog"]`.
- O buffer numérico só é limpo por Enter (commit), Esc e clique — setas e letras não mexem nele (D7). Sem auto-limpeza por tempo nesta fase.
- A lógica de grupos **não** é espelhada no Rust agora: o espelho (`services/slide_builder`) é escopo da **F4**; os casos de teste do Task 1 ficam como referência para a paridade (A2).

## Review Focus

Comportamentos que o design implica mas nenhum código atual exercita — entrada/condição e o que uma pessoa esperaria:

1. **Estrofe quebrada (rotulada + fragmentos sem rótulo)** → um único container na cor do rótulo; chip só no primeiro; "Verso 1"/"Verso 2" continua por rótulo (não por fragmento). (T1/T2)
2. **Mesmo rótulo repetido (Refrão…Refrão)** → cada aparição abre grupo novo; o segundo Refrão não é absorvido pelo primeiro. (T1)
3. **Slides sem rótulo antes do primeiro rótulo** → grupo sem rótulo (frame neutro, sem chip) e alvo de nenhuma letra. (T1/T2)
4. **Chip em slide sem rótulo** → não existe (hoje o pill colorido aparece vazio); só o slide de abertura do grupo tem chip. (T2)
5. **"Dividir" numa estrofe rotulada** → só o primeiro fragmento segue rotulado; os demais absorvidos pelo grupo. (T3)
6. **Número digitado com a apresentação inativa** → Enter faz prévia + scroll sem projetar; com apresentação ativa → projeta. (T5/T6)
7. **Número inválido (`0`, maior que o total)** → Enter não navega e limpa o buffer. (T4/T5/T6)
8. **Esc com buffer ativo** → limpa só o buffer, sem derrubar a apresentação; Esc com buffer vazio mantém o comportamento atual. (T5/T6)
9. **Dígito vs letra** → digitar número não dispara atalho de letra e vice-versa; Backspace com buffer vazio não faz nada. (T5/T6)

---

### Task 1: Derivação de grupos (`computeSlideGroups`) + testes

**Files:**
- Modify: `src/core/lib/lyrics.ts` (nova função + interface, no fim do arquivo)
- Create: `src/core/lib/lyrics.test.ts`

**Interfaces:**
- Produces: `computeSlideGroups(slides: RunnerSlide[]): SlideGroup[]` e `interface SlideGroup { startIndex: number; indices: number[]; label: string | null; sectionType: SectionType | null }` — um grupo por seção rotulada + todas as seguintes sem rótulo; slides sem rótulo antes do primeiro rótulo formam um grupo com `label: null`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/core/lib/lyrics.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlideGroups } from "./lyrics.ts";
import type { RunnerSlide } from "./lyrics.ts";
import type { SectionType } from "../types";

function slide(
  index: number,
  label: string | null,
  sectionType: SectionType | null = null,
): RunnerSlide {
  return {
    index,
    label,
    sectionType,
    slide: {
      id: `song#${index}`,
      kind: "lyric",
      title: "Música",
      lines: [`linha ${index + 1}`],
    },
  };
}

test("estrofe rotulada absorve os slides seguintes sem rótulo", () => {
  const groups = computeSlideGroups([
    slide(0, "Verso 1", "verse"),
    slide(1, null),
    slide(2, null),
    slide(3, "Refrão", "chorus"),
  ]);

  assert.deepEqual(
    groups.map((g) => ({ startIndex: g.startIndex, label: g.label, indices: g.indices })),
    [
      { startIndex: 0, label: "Verso 1", indices: [0, 1, 2] },
      { startIndex: 3, label: "Refrão", indices: [3] },
    ],
  );
});

test("rótulo repetido abre um grupo novo", () => {
  const groups = computeSlideGroups([
    slide(0, "Refrão", "chorus"),
    slide(1, "Refrão", "chorus"),
    slide(2, null),
  ]);

  assert.deepEqual(
    groups.map((g) => g.indices),
    [[0], [1, 2]],
  );
});

test("slides sem rótulo antes do primeiro rótulo formam um grupo sem rótulo", () => {
  const groups = computeSlideGroups([
    slide(0, null),
    slide(1, null),
    slide(2, "Verso 1", "verse"),
  ]);

  assert.deepEqual(
    groups.map((g) => ({ label: g.label, indices: g.indices })),
    [
      { label: null, indices: [0, 1] },
      { label: "Verso 1", indices: [2] },
    ],
  );
});

test("música sem nenhum rótulo vira um único grupo sem rótulo", () => {
  const groups = computeSlideGroups([slide(0, null), slide(1, null)]);
  assert.deepEqual(
    groups.map((g) => g.indices),
    [[0, 1]],
  );
});

test("rótulos consecutivos abrem cada um o próprio grupo", () => {
  const groups = computeSlideGroups([
    slide(0, "Verso 1", "verse"),
    slide(1, "Verso 2", "verse"),
    slide(2, "Refrão", "chorus"),
  ]);

  assert.deepEqual(
    groups.map((g) => g.indices),
    [[0], [1], [2]],
  );
});

test("lista vazia não gera grupos", () => {
  assert.deepEqual(computeSlideGroups([]), []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/core/lib/lyrics.test.ts`
Expected: FAIL — o export `computeSlideGroups` não existe (erro de import).

- [ ] **Step 3: Implementar `computeSlideGroups`**

Em `src/core/lib/lyrics.ts`, após `buildSongSlides`:

```ts
export interface SlideGroup {
  startIndex: number;
  indices: number[];
  label: string | null;
  sectionType: SectionType | null;
}

export function computeSlideGroups(slides: RunnerSlide[]): SlideGroup[] {
  const groups: SlideGroup[] = [];

  for (const slide of slides) {
    const current = groups[groups.length - 1];
    if (slide.label !== null || current === undefined) {
      groups.push({
        startIndex: slide.index,
        indices: [slide.index],
        label: slide.label,
        sectionType: slide.sectionType,
      });
      continue;
    }
    current.indices.push(slide.index);
  }

  return groups;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/core/lib/lyrics.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run typecheck`
Expected: sem erros.

```bash
git add src/core/lib/lyrics.ts src/core/lib/lyrics.test.ts
git commit -m "feat: deriva grupos de slides de música por rótulo"
```

---

### Task 2: Render dos grupos na coluna de música (frame, chip só no primeiro, separador)

**Files:**
- Modify: `src/features/events-setlists/SongSlidesColumn.tsx`

**Interfaces:**
- Consumes: `computeSlideGroups`/`SlideGroup` (Task 1); `groups` do `useSongGroupsStore` (já existente, linhas ~71).
- Produces: um container por grupo na cor do rótulo; chip renderizado apenas quando `block.label !== null`; helper local `resolveSlideBadge(block: RunnerSlide)` (hoisted da lógica inline das linhas ~470–477).

- [ ] **Step 1: Derivar os grupos e hoistar o resolvedor de badge**

No topo do arquivo, ajuste o import do core (linha 25) e adicione o import de tipo (o `verbatimModuleSyntax` exige `import type`):

```ts
import { buildSongSlides, computeSlideGroups } from "@/core/lib/lyrics";
import type { RunnerSlide } from "@/core/lib/lyrics";
```

Depois de `const slides = song === undefined ? [] : buildSongSlides(song);`:

```ts
const slideGroups = computeSlideGroups(slides);
```

Dentro de `SongSlidesContent`, antes de `handleSelectPreview`, mova a resolução de cor para um helper (o conteúdo é o das linhas ~470–477 de hoje):

```ts
function resolveSlideBadge(block: RunnerSlide) {
  const groupConfig = groups.find(
    (g) =>
      (block.sectionType && g.typeKey === block.sectionType) ||
      (block.label && g.name.toLowerCase() === block.label.toLowerCase()) ||
      (block.label && block.label.toLowerCase().includes(g.name.toLowerCase())),
  );
  return {
    groupConfig,
    badgeBg: groupConfig?.color || SECTION_COLOR[block.sectionType ?? "verse"] || "#3b82f6",
  };
}
```

- [ ] **Step 2: Renderizar por grupo**

No ramo final do ternário (`) : (` ~linha 466), troque `slides.map((block) => { … })` por `slideGroups.map((group) => { … })` com esta estrutura (o conteúdo do card — refs, handlers de drag, `onClick`/`onDoubleClick`, classes de `isLive`/`isPreview`, letras e rodapé — permanece **idêntico**; só mudam os pontos indicados):

```tsx
) : (
  slideGroups.map((group) => {
    const { badgeBg: groupColor } = resolveSlideBadge(slides[group.startIndex]);
    const isLabeled = group.label !== null;

    return (
      <div
        key={group.startIndex}
        className={`space-y-1 rounded-2xl border p-1.5 ${
          isLabeled ? "" : "border-border/60 bg-muted/20"
        }`}
        style={
          isLabeled
            ? { borderColor: `${groupColor}66`, backgroundColor: `${groupColor}0d` }
            : undefined
        }
      >
        {group.indices.map((slideIndex, positionInGroup) => {
          const block = slides[slideIndex];
          const { groupConfig, badgeBg } = resolveSlideBadge(block);
          const isLive = runnerIndex === block.index;
          const isPreview = previewIndex === block.index;
          const isBeingDragged =
            (dragSlideRef.current ?? draggedSlideIndex) === block.index;
          const isHoveredOver = dragOverSlide?.index === block.index;

          return (
            <div
              key={block.index}
              className={
                positionInGroup > 0
                  ? "border-t border-dashed border-border/50 pt-1.5"
                  : undefined
              }
            >
              <ContextMenu>
                {/* conteúdo atual do card, sem mudanças, EXCETO o chip abaixo */}
              </ContextMenu>
            </div>
          );
        })}
      </div>
    );
  })
)
```

Ajustes obrigatórios dentro do card:

1. A variável inline `const sectionType = block.sectionType ?? "verse";` e o bloco inline `const groupConfig = groups.find(...)` / `const badgeBg = ...` (linhas ~470–477) **saem** — agora vêm do `resolveSlideBadge` acima (atenção ao `noUnusedLocals`).
2. O chip do rótulo passa a ser condicional (hoje renderiza um pill colorido **vazio** para slides sem rótulo):

```tsx
{block.label !== null && (
  <span
    className="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase shadow-2xs text-white flex items-center gap-1.5"
    style={{ backgroundColor: badgeBg }}
  >
    <span>{block.label}</span>
    {groupConfig?.shortcut && (
      <kbd className="rounded bg-black/25 px-1 py-0.2 font-mono text-[9px] font-bold">
        {groupConfig.shortcut}
      </kbd>
    )}
  </span>
)}
```

- [ ] **Step 3: Verificar e commitar**

Run: `npm run typecheck`
Expected: sem erros.

Manual (desktop, verificação deferida ao humano): música quebrada em 2 linhas → caixa contínua na cor do rótulo com chip só no primeiro slide e separador discreto entre as metades; "V"/"C" saltam para o início dos grupos (código atual já tem esse efeito); arrastar para reordenar continua funcionando; nenhum pill vazio em slides sem rótulo.

```bash
git add src/features/events-setlists/SongSlidesColumn.tsx
git commit -m "feat: agrupa visualmente os slides por rótulo na coluna de música"
```

---

### Task 3: Ação manual "Dividir" segue D13 (`splitSection`)

**Files:**
- Modify: `src/core/lib/lyrics.ts` (nova função)
- Modify: `src/core/lib/lyrics.test.ts` (novos casos)
- Modify: `src/features/events-setlists/SongSlidesColumn.tsx` (`handleSplitSection`)

**Interfaces:**
- Produces: `splitSection(section: SongSection, linesPerSlide: 1 | 2): SongSection[]` — **espelho** de `lyrics::split_sections` (`src-tauri/src/services/lyrics.rs`): seção com `lines.length <= linesPerSlide` volta intacta (`[section]`); senão fragmentos de `linesPerSlide` linhas, o **primeiro** com o `sectionType` original, os demais `null`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao fim de `src/core/lib/lyrics.test.ts` (ajuste o import para incluir `splitSection` e o tipo `SongSection`):

```ts
import type { SectionType, SongSection } from "../types";

test("divide estrofe e só o primeiro fragmento mantém o rótulo", () => {
  assert.deepEqual(
    splitSection({ sectionType: "verse", lines: ["a", "b", "c", "d", "e"] }, 2),
    [
      { sectionType: "verse", lines: ["a", "b"] },
      { sectionType: null, lines: ["c", "d"] },
      { sectionType: null, lines: ["e"] },
    ],
  );
});

test("seção curta fica intacta", () => {
  const section: SongSection = { sectionType: "chorus", lines: ["a", "b"] };
  assert.deepEqual(splitSection(section, 2), [section]);
});

test("uma linha por slide quebra cada linha", () => {
  assert.deepEqual(
    splitSection({ sectionType: null, lines: ["a", "b", "c"] }, 1),
    [
      { sectionType: null, lines: ["a"] },
      { sectionType: null, lines: ["b"] },
      { sectionType: null, lines: ["c"] },
    ],
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/core/lib/lyrics.test.ts`
Expected: FAIL — `splitSection` não existe.

- [ ] **Step 3: Implementar `splitSection`**

Em `src/core/lib/lyrics.ts` (o arquivo já importa `SongSection` de `../types`):

```ts
export function splitSection(section: SongSection, linesPerSlide: 1 | 2): SongSection[] {
  if (section.lines.length <= linesPerSlide) {
    return [section];
  }

  const fragments: SongSection[] = [];
  for (let i = 0; i < section.lines.length; i += linesPerSlide) {
    fragments.push({
      sectionType: fragments.length === 0 ? section.sectionType : null,
      lines: section.lines.slice(i, i + linesPerSlide),
    });
  }
  return fragments;
}
```

- [ ] **Step 4: Usar no botão "Dividir"**

Em `SongSlidesColumn.tsx`, no `handleSplitSection`, trocar o laço que monta `newSections` por:

```ts
const newSections = splitSection(target, linesPerSlide);
```

(acrescente `splitSection` ao import de `@/core/lib/lyrics`; guarda `if (!target || target.lines.length <= linesPerSlide) return;` permanece — o item do menu continua desabilitado para seções curtas.)

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test src/core/lib/lyrics.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 6: Verificar e commitar**

Run: `npm run typecheck`
Expected: sem erros.

Manual (desktop, deferido): dividir uma estrofe rotulada de 5 linhas em "2 Linhas" → primeiro slide com chip "Verso", demais sem chip, todos na mesma caixa.

```bash
git add src/core/lib/lyrics.ts src/core/lib/lyrics.test.ts src/features/events-setlists/SongSlidesColumn.tsx
git commit -m "fix: dividir estrofe mantém rótulo só no primeiro fragmento"
```

---

### Task 4: Utilitários do número + indicador (`slideNumbers`, `SlideNumberIndicator`)

**Files:**
- Create: `src/core/lib/slideNumbers.ts`
- Create: `src/core/lib/slideNumbers.test.ts`
- Create: `src/features/events-setlists/SlideNumberIndicator.tsx`

**Interfaces:**
- Produces:
  - `export const MAX_SLIDE_NUMBER_DIGITS = 3;`
  - `isSlideNumberKey(key: string): boolean` — `true` só para uma tecla de um dígito (`"0"`–`"9"`).
  - `appendSlideNumberDigit(buffer: string, key: string): string` — acrescenta o dígito; ignora não-dígito; trava em 3 dígitos.
  - `removeLastSlideNumberDigit(buffer: string): string` — Backspace (`""` fica `""`).
  - `resolveSlideNumberIndex(buffer: string, total: number): number | null` — número digitado é 1-based; devolve índice 0-based se `1 <= n <= total`, senão `null`.
  - `SlideNumberIndicator({ buffer }: { buffer: string })` — pill flutuante "→ 12" (design §6.2); `null` com buffer vazio; posiciona-se `absolute` — cada coluna ganha `relative` nos T5/T6.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/core/lib/slideNumbers.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendSlideNumberDigit,
  isSlideNumberKey,
  removeLastSlideNumberDigit,
  resolveSlideNumberIndex,
} from "./slideNumbers.ts";

test("acumula dígitos até três", () => {
  assert.equal(appendSlideNumberDigit("", "1"), "1");
  assert.equal(appendSlideNumberDigit("1", "2"), "12");
  assert.equal(appendSlideNumberDigit("12", "3"), "123");
  assert.equal(appendSlideNumberDigit("123", "4"), "123");
});

test("ignora tecla que não é dígito", () => {
  assert.equal(appendSlideNumberDigit("1", "a"), "1");
  assert.equal(appendSlideNumberDigit("", "Enter"), "");
});

test("apaga o último dígito", () => {
  assert.equal(removeLastSlideNumberDigit("12"), "1");
  assert.equal(removeLastSlideNumberDigit("1"), "");
  assert.equal(removeLastSlideNumberDigit(""), "");
});

test("resolve o número digitado para o índice do slide", () => {
  assert.equal(resolveSlideNumberIndex("1", 5), 0);
  assert.equal(resolveSlideNumberIndex("5", 5), 4);
  assert.equal(resolveSlideNumberIndex("10", 10), 9);
  assert.equal(resolveSlideNumberIndex("01", 5), 0);
});

test("número fora do intervalo não navega", () => {
  assert.equal(resolveSlideNumberIndex("0", 5), null);
  assert.equal(resolveSlideNumberIndex("6", 5), null);
  assert.equal(resolveSlideNumberIndex("", 5), null);
});

test("só teclas de um dígito são aceitas", () => {
  assert.equal(isSlideNumberKey("0"), true);
  assert.equal(isSlideNumberKey("9"), true);
  assert.equal(isSlideNumberKey("10"), false);
  assert.equal(isSlideNumberKey("a"), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/core/lib/slideNumbers.test.ts`
Expected: FAIL — o módulo não existe.

- [ ] **Step 3: Implementar `src/core/lib/slideNumbers.ts`**

```ts
const DIGIT_KEY_REGEX = /^[0-9]$/;

export const MAX_SLIDE_NUMBER_DIGITS = 3;

export function isSlideNumberKey(key: string): boolean {
  return DIGIT_KEY_REGEX.test(key);
}

export function appendSlideNumberDigit(buffer: string, key: string): string {
  if (!isSlideNumberKey(key) || buffer.length >= MAX_SLIDE_NUMBER_DIGITS) {
    return buffer;
  }
  return buffer + key;
}

export function removeLastSlideNumberDigit(buffer: string): string {
  return buffer.slice(0, -1);
}

export function resolveSlideNumberIndex(buffer: string, total: number): number | null {
  if (!/^[0-9]+$/.test(buffer)) return null;
  const value = Number.parseInt(buffer, 10);
  if (value < 1 || value > total) return null;
  return value - 1;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/core/lib/slideNumbers.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Criar o indicador**

Criar `src/features/events-setlists/SlideNumberIndicator.tsx`:

```tsx
export function SlideNumberIndicator({ buffer }: { buffer: string }) {
  if (buffer.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-3 py-1.5 shadow-lg">
      <span className="text-xs text-muted-foreground">→</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {buffer}
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Verificar e commitar**

Run: `npm run typecheck`
Expected: sem erros.

```bash
git add src/core/lib/slideNumbers.ts src/core/lib/slideNumbers.test.ts src/features/events-setlists/SlideNumberIndicator.tsx
git commit -m "feat: utilitários de navegação numérica e indicador de dígitos"
```

---

### Task 5: Atalhos numéricos na coluna de música

**Files:**
- Modify: `src/features/events-setlists/SongSlidesColumn.tsx`

**Interfaces:**
- Consumes: `appendSlideNumberDigit`, `isSlideNumberKey`, `removeLastSlideNumberDigit`, `resolveSlideNumberIndex` (Task 4); `SlideNumberIndicator` (Task 4); `projectSection`/`setPreview`/`previewIndex`/`slideRefs` já existentes.
- Produces: buffer numérico local (`numberBuffer`) com indicador; Enter com buffer navega (projeta se `isPresentationActive`, senão prévia + scroll), Enter sem buffer mantém o comportamento atual (projeta a prévia); Backspace apaga; Esc/clique limpam.

- [ ] **Step 1: Imports, estado, clique e indicador**

Imports novos no topo:

```ts
import {
  appendSlideNumberDigit,
  isSlideNumberKey,
  removeLastSlideNumberDigit,
  resolveSlideNumberIndex,
} from "@/core/lib/slideNumbers";
import { SlideNumberIndicator } from "./SlideNumberIndicator";
```

Estado, junto de `previewIndex`:

```ts
const [numberBuffer, setNumberBuffer] = useState("");
```

No elemento `<section>` do retorno: adicione `onClick={() => setNumberBuffer("")}` e `relative` na className (mantendo o `onContextMenu` existente):

```tsx
<section
  onContextMenu={(e) => {
    e.preventDefault();
  }}
  onClick={() => setNumberBuffer("")}
  className="relative flex h-full w-80 min-h-0 flex-col border-r border-border bg-background sm:w-96 shrink-0 select-none overflow-hidden"
>
```

Antes do `</section>` que fecha o componente (depois do bloco "Next song transition indicator"):

```tsx
<SlideNumberIndicator buffer={numberBuffer} />
```

- [ ] **Step 2: Estender o handler de teclado**

No `handleKeyDown`, logo depois do bloco que calcula `isPresentationActive` e **antes** do `if (e.key === "Escape")`, insira:

```ts
if (e.key === "Backspace" && numberBuffer.length > 0) {
  e.preventDefault();
  setNumberBuffer(removeLastSlideNumberDigit(numberBuffer));
  return;
}
```

Substitua o ramo do `Escape` por (buffer primeiro, para um Esc não derrubar a apresentação por engano):

```ts
if (e.key === "Escape") {
  if (numberBuffer.length > 0) {
    e.preventDefault();
    setNumberBuffer("");
    return;
  }
  if (isPresentationActive || currentRunnerIdx !== null || !live.cleared) {
    e.preventDefault();
    void usePresentationStore.getState().clearLive();
    useSetlistStore.setState({ runnerIndex: null });
  }
  return;
}
```

Logo após o ramo do `Escape`, insira o ramo dos dígitos (antes do ramo de letras existente):

```ts
if (isSlideNumberKey(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
  e.preventDefault();
  setNumberBuffer(appendSlideNumberDigit(numberBuffer, e.key));
  return;
}
```

Substitua o ramo do `Enter` por:

```ts
if (e.key === "Enter") {
  e.preventDefault();
  if (numberBuffer.length > 0) {
    const targetIdx = resolveSlideNumberIndex(numberBuffer, slides.length);
    setNumberBuffer("");
    if (targetIdx !== null) {
      setPreviewIndex(targetIdx);
      usePresentationStore.getState().setPreview(slides[targetIdx]?.slide ?? null);
      if (isPresentationActive) {
        void projectSection(item.id, targetIdx);
      }
      slideRefs.current[targetIdx]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
    return;
  }
  if (previewIndex !== null) {
    void projectSection(item.id, previewIndex);
    slideRefs.current[previewIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }
  return;
}
```

Atualize a lista de dependências do efeito:

```ts
}, [slides, item, previewIndex, projectSection, numberBuffer]);
```

- [ ] **Step 3: Verificar e commitar**

Run: `npm run typecheck && npm test`
Expected: sem erros; suíte front verde (incluindo os testes novos dos T1/T3/T4).

Manual (desktop, deferido): com música selecionada — digitar `12` → indicador "→ 12"; Enter com apresentação inativa → prévia + rolagem, sem projetar; com apresentação ativa → projeta; Backspace apaga dígito; Esc com buffer limpa só o buffer; clique em qualquer ponto limpa; digitar `1` não dispara o atalho de letra "I".

```bash
git add src/features/events-setlists/SongSlidesColumn.tsx
git commit -m "feat: atalhos numéricos na coluna de música"
```

---

### Task 6: Atalhos numéricos na coluna de mídia (texto e imagem)

**Files:**
- Modify: `src/features/events-setlists/MediaSlidesColumn.tsx`

**Interfaces:**
- Consumes: utilitários e indicador do Task 4; `setPreview`/`projectSection`/`previewIndex` existentes.
- Produces: mesmo buffer/indicador da T5 nas três apresentações (texto, grade de pasta e arquivo único imagem/vídeo); refs de rolagem (`slideRefs`) para o Enter com buffer.

- [ ] **Step 1: Imports, estado, refs, clique e indicador**

Ajuste o import do React (entra `useRef`) e adicione:

```ts
import {
  appendSlideNumberDigit,
  isSlideNumberKey,
  removeLastSlideNumberDigit,
  resolveSlideNumberIndex,
} from "@/core/lib/slideNumbers";
import { SlideNumberIndicator } from "./SlideNumberIndicator";
```

Estado e refs, junto de `previewIndex`:

```ts
const [numberBuffer, setNumberBuffer] = useState("");
const slideRefs = useRef<(HTMLElement | null)[]>([]);
```

No `<section>` do retorno, adicione `relative` e `onClick={() => setNumberBuffer("")}`:

```tsx
<section className="relative flex h-full w-80 min-h-0 flex-col border-r border-border bg-background sm:w-96 shrink-0 select-none overflow-hidden" onClick={() => setNumberBuffer("")}>
```

Antes do `</section>` final (depois dos blocos `{editOpen && …}` / `{textEditOpen && …}`):

```tsx
<SlideNumberIndicator buffer={numberBuffer} />
```

- [ ] **Step 2: Guardar as refs dos slides**

Atribua `ref` nos três pontos de render (o índice da vez é o `entry.index` do slide):

- Botão da grade de pasta (~linha 232) e botão de texto (~linha 271):

```tsx
ref={(el) => {
  slideRefs.current[entry.index] = el;
}}
```

- Container único de imagem/vídeo (~linha 342):

```tsx
ref={(el) => {
  slideRefs.current[0] = el;
}}
```

- [ ] **Step 3: Estender o handler de teclado**

No `handleKeyDown`, depois do bloco que calcula `isLive`, insira (espelho da T5, com `isLive` no lugar de `isPresentationActive`):

```ts
if (e.key === "Backspace" && numberBuffer.length > 0) {
  e.preventDefault();
  setNumberBuffer(removeLastSlideNumberDigit(numberBuffer));
  return;
}

if (e.key === "Escape") {
  if (numberBuffer.length > 0) {
    e.preventDefault();
    setNumberBuffer("");
    return;
  }
  e.preventDefault();
  void usePresentationStore.getState().clearLive();
  useSetlistStore.setState({ runnerIndex: null });
  return;
}

if (isSlideNumberKey(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
  e.preventDefault();
  setNumberBuffer(appendSlideNumberDigit(numberBuffer, e.key));
  return;
}
```

(remova o ramo `Escape` antigo — o novo acima o substitui.)

Substitua o ramo do `Enter` por:

```ts
if (e.key === "Enter") {
  e.preventDefault();
  if (numberBuffer.length > 0) {
    const targetIdx = resolveSlideNumberIndex(numberBuffer, slides.length);
    setNumberBuffer("");
    if (targetIdx !== null) {
      setPreviewIndex(targetIdx);
      usePresentationStore.getState().setPreview(slides[targetIdx]?.slide ?? null);
      if (isLive) void projectSection(item.id, targetIdx);
      slideRefs.current[targetIdx]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
    return;
  }
  void projectSection(item.id, previewIndex);
  return;
}
```

Atualize a lista de dependências do efeito:

```ts
}, [item.id, previewIndex, projectSection, runnerIndex, slides, numberBuffer]);
```

- [ ] **Step 4: Verificar e commitar**

Run: `npm run typecheck && npm test`
Expected: sem erros; suíte verde.

Manual (desktop, deferido): com um texto selecionado, digitar `3` + Enter → prévia + rolagem até o texto 3 (projeta se estiver ao vivo); com pasta de imagens, `3` + Enter rola até a terceira miniatura; com imagem única, `1` + Enter seleciona; Enter sem buffer continua projetando; Backspace/Esc/clique como na coluna de música.

```bash
git add src/features/events-setlists/MediaSlidesColumn.tsx
git commit -m "feat: atalhos numéricos na coluna de mídia"
```

---

### Task 7: Documentar atalhos no `ShortcutsView`

**Files:**
- Modify: `src/views/ShortcutsView.tsx`

**Interfaces:**
- Consumes: comportamento entregue nos T1–T6 (nenhum código novo).
- Produces: itens novos em `SHORTCUT_CATEGORIES` (§6.1 "documentar no ShortcutsView" + §6.2).

- [ ] **Step 1: Adicionar os itens**

Na categoria **"Navegação de Slides"**, acrescentar ao fim dos `items`:

```ts
{
  keys: ["0–9", "Enter"],
  description:
    "Digite o número do slide (música, texto ou imagem) e Enter para ir até ele; projeta se a apresentação estiver ativa, senão faz prévia e rolagem",
},
{
  keys: ["Backspace"],
  description: "Apaga o último dígito do número digitado",
},
```

Na categoria **"Músicas & Repertório"**, acrescentar ao fim dos `items`:

```ts
{
  keys: ["V", "C", "B", "…"],
  description:
    "Pula para o início do próximo grupo do rótulo (Verso, Refrão…); letras configuráveis em Preferências → Músicas",
},
```

- [ ] **Step 2: Verificar e commitar**

Run: `npm run typecheck`
Expected: sem erros.

```bash
git add src/views/ShortcutsView.tsx
git commit -m "docs: documenta atalhos numéricos e navegação por grupo"
```

---

## Self-Review Notes

- **Cobertura da spec (F2):** D6/G1 (grupos derivados + container + chip só no primeiro + separador) → T1/T2; D13 aplicado à ação manual → T3; D7/G2 (buffer 1–3 dígitos, indicador, Enter/Backspace/Esc/clique, música + texto + imagem) → T4/T5/T6; §6.1 "letra pula ao início do grupo; documentar no ShortcutsView" → T7 (o código das letras já produz esse efeito e não é alterado); "setas continuam slide a slide" → preservado (nenhum task mexe nas setas).
- **Fora deste plano:** espelho Rust da montagem de slides/grupos (`services/slide_builder`) → F4, usando os casos do T1 como referência de paridade (A2); Temporário → F3; remote → F4/F5.
- **Mudança visível a comunicar:** slide sem rótulo deixa de renderizar o chip vazio (hoje aparece um pill colorido sem texto) — passa a não ter chip, como o design pede. Músicas existentes não são alteradas (agrupamento é só exibição).
- **Deferidos conscientes:** auto-limpeza do buffer por tempo (D7 lista Enter/Esc/clique; timeout pode entrar depois se a operação pedir); atalhos numéricos valem no painel desktop, não na janela pública/stage; dígitos com ⌘/Ctrl/Alt deliberadamente não são capturados.
- **Verificação manual (deferida ao humano):** (1) música quebrada em 2 linhas → caixa contínua, chip no primeiro, separador; (2) música toda sem rótulo → frames neutros, sem pill vazio; (3) "V"/"C" saltando grupos e setas slide a slide; (4) `12` + Enter nos dois estados de apresentação, Backspace, Esc com buffer, clique; (5) coluna de texto e grade de pasta com o mesmo comportamento; (6) teclas seguem ignoradas em inputs/diálogos; (7) "Dividir" numa estrofe rotulada.
