# F4 — Painéis redimensionáveis e monitores ocultáveis · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir redimensionar programação e letra/versículos, restaurar larguras com duplo clique e ocultar completamente o painel de monitores, com estado persistido e botão na barra superior.

**Architecture:** Um store `usePanelLayoutStore` persiste larguras e visibilidade em `localStorage`, com clamp e `fitPanelLayout` em `core/lib/panelLayout.ts`. `ResizeHandle` é um divisor acessível com pointer capture, teclado e duplo clique. `AdminView` mede o `<main>` com `ResizeObserver`, reserva o mínimo dos monitores em janelas menores e controla o layout; os filhos deixam de ter largura fixa e passam a ocupar a largura do wrapper. `AppTopBar` ganha o botão “Monitores”, visível apenas na aba Apresentação.

**Tech Stack:** React 19 + TypeScript + Zustand, Tailwind v4, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-ajustes-operacao-e-biblia-design.md`

**Depende de:** F1–F3 concluídas.

## Global Constraints

- Nenhuma dependência nova.
- Programação: padrão 320 px, faixa 240–480 px.
- Letra/versículos: padrão 384 px, faixa 280–640 px.
- Monitores: `flex-1`, sem largura fixa.
- Trilho de temas: largura fixa, como hoje.
- O divisor tem área de acerto de 6 px, cursor `col-resize`, `setPointerCapture`, setas de 16 px e duplo clique para resetar.
- Quando a programação está recolhida, o divisor dela não aparece e a coluna usa o trilho de 40 px.
- Quando os monitores estão ocultos, o divisor correspondente não aparece, a coluna de letra/versículos vira `flex-1` e o `LivePreview` fica `hidden` sem desmontar.
- Visibilidade e larguras persistem em `localStorage`; valores inválidos caem no padrão.
- Os estados internos de Prévia/Ao Vivo/Retorno e o zoom do `LivePreview` não são alterados.
- Antes de fechar: `npm run typecheck`, `npm test`, `cargo check -p open-presenter` (sem mudanças Rust, mas confirmar).

## Review Focus

- O divisor não pode “pular” ao arrastar nem perder o pointer capture.
- O clamp deve valer ao carregar, ao arrastar e no teclado.
- Esconder monitores não pode desmontar o `LivePreview`: use `hidden` na `<section>` para preservar Prévia/Ao Vivo/Retorno e zoom; ao voltar, os controles continuam no mesmo estado.
- A coluna central não pode manter `w-80`/`w-96` fixos nos filhos.
- O botão “Monitores” não aparece em outras abas.
- O layout não pode esmagar os monitores em janelas menores; documentar a mitigação (ocultar monitores) e manter `min-w-0`.

## File Map

| Arquivo | Responsabilidade |
| --- | --- |
| `src/core/lib/panelLayout.ts` | Constantes, clamp e parser puro |
| `src/core/lib/panelLayout.test.ts` | Testes de clamp/parse |
| `src/features/presentation/panelLayoutStore.ts` | Store persistido |
| `src/components/ResizeHandle.tsx` | Divisor acessível |
| `src/views/AdminView.tsx` | Composição do layout |
| `src/components/AppTopBar.tsx` | Botão “Monitores” |
| `src/features/events-setlists/SetlistSidebar.tsx` | Largura controlada |
| `src/features/events-setlists/SongSlidesColumn.tsx` | `w-full` |
| `src/features/events-setlists/ScriptureSlidesColumn.tsx` | `w-full` |
| `src/features/events-setlists/MediaSlidesColumn.tsx` | `w-full` |

## Task 1: Clamp e parser puro do layout

**Files:**
- Create: `src/core/lib/panelLayout.ts`
- Create: `src/core/lib/panelLayout.test.ts`

- [ ] **Step 1: Escrever os testes**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PANEL_LAYOUT,
  parsePanelLayout,
  clampPanelWidth,
  fitPanelLayout,
  SETLIST_WIDTH_MIN,
  SETLIST_WIDTH_MAX,
  SLIDES_WIDTH_MIN,
  SLIDES_WIDTH_MAX,
} from "./panelLayout.ts";

test("clamp respeita os limites", () => {
  assert.equal(clampPanelWidth(100, 240, 480), 240);
  assert.equal(clampPanelWidth(1000, 240, 480), 480);
  assert.equal(clampPanelWidth(320, 240, 480), 320);
});

test("parse usa padrões quando não há dados", () => {
  assert.deepEqual(parsePanelLayout(null), DEFAULT_PANEL_LAYOUT);
  assert.deepEqual(parsePanelLayout({}), DEFAULT_PANEL_LAYOUT);
});

test("parse limita larguras e preserva visibilidade", () => {
  assert.deepEqual(
    parsePanelLayout({
      setlistWidth: 9999,
      slidesWidth: 10,
      monitorsVisible: false,
    }),
    {
      setlistWidth: SETLIST_WIDTH_MAX,
      slidesWidth: SLIDES_WIDTH_MIN,
      monitorsVisible: false,
    },
  );
});

test("parse ignora tipos inválidos", () => {
  assert.deepEqual(
    parsePanelLayout({
      setlistWidth: "320",
      slidesWidth: null,
      monitorsVisible: "false",
    }),
    DEFAULT_PANEL_LAYOUT,
  );
});

test("fitPanelLayout encolhe o centro antes da programação", () => {
  // 600 px para as duas colunas, depois de reservar monitores/divisores.
  assert.deepEqual(fitPanelLayout({ setlistWidth: 320, slidesWidth: 384 }, 852), {
    setlistWidth: 320,
    slidesWidth: 280,
  });
});

test("fitPanelLayout preserva as larguras quando cabem", () => {
  assert.deepEqual(fitPanelLayout({ setlistWidth: 320, slidesWidth: 384 }, 956), {
    setlistWidth: 320,
    slidesWidth: 384,
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/core/lib/panelLayout.test.ts
```

- [ ] **Step 3: Implementar**

```ts
export const SETLIST_WIDTH_MIN = 240;
export const SETLIST_WIDTH_MAX = 480;
export const SLIDES_WIDTH_MIN = 280;
export const SLIDES_WIDTH_MAX = 640;
export const SETLIST_WIDTH_DEFAULT = 320;
export const SLIDES_WIDTH_DEFAULT = 384;
export const MONITORS_MIN_WIDTH = 240;
export const RESIZE_HANDLES_WIDTH = 12;

export interface PanelLayout {
  setlistWidth: number;
  slidesWidth: number;
  monitorsVisible: boolean;
}

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
  setlistWidth: SETLIST_WIDTH_DEFAULT,
  slidesWidth: SLIDES_WIDTH_DEFAULT,
  monitorsVisible: true,
};

export function clampPanelWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface PanelWidths {
  setlistWidth: number;
  slidesWidth: number;
}

/**
 * `availableWidth` é a largura do `<main>` já descontado o trilho de temas.
 * Reserva o mínimo dos monitores e dos dois divisores; encolhe o centro
 * primeiro e a programação depois.
 */
export function fitPanelLayout(
  layout: PanelWidths,
  availableWidth: number,
): PanelWidths {
  const maxColumns = Math.max(
    SETLIST_WIDTH_MIN + SLIDES_WIDTH_MIN,
    availableWidth - MONITORS_MIN_WIDTH - RESIZE_HANDLES_WIDTH,
  );
  let setlistWidth = clampPanelWidth(
    layout.setlistWidth,
    SETLIST_WIDTH_MIN,
    SETLIST_WIDTH_MAX,
  );
  let slidesWidth = clampPanelWidth(
    layout.slidesWidth,
    SLIDES_WIDTH_MIN,
    SLIDES_WIDTH_MAX,
  );

  if (setlistWidth + slidesWidth <= maxColumns) {
    return { setlistWidth, slidesWidth };
  }

  slidesWidth = Math.max(SLIDES_WIDTH_MIN, maxColumns - setlistWidth);
  if (setlistWidth + slidesWidth > maxColumns) {
    setlistWidth = Math.max(SETLIST_WIDTH_MIN, maxColumns - slidesWidth);
  }

  return { setlistWidth, slidesWidth };
}

export function parsePanelLayout(input: unknown): PanelLayout {
  if (input === null || typeof input !== "object") return DEFAULT_PANEL_LAYOUT;
  const record = input as Record<string, unknown>;
  return {
    setlistWidth:
      typeof record.setlistWidth === "number"
        ? clampPanelWidth(record.setlistWidth, SETLIST_WIDTH_MIN, SETLIST_WIDTH_MAX)
        : SETLIST_WIDTH_DEFAULT,
    slidesWidth:
      typeof record.slidesWidth === "number"
        ? clampPanelWidth(record.slidesWidth, SLIDES_WIDTH_MIN, SLIDES_WIDTH_MAX)
        : SLIDES_WIDTH_DEFAULT,
    monitorsVisible:
      typeof record.monitorsVisible === "boolean"
        ? record.monitorsVisible
        : true,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/core/lib/panelLayout.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/core/lib/panelLayout.ts src/core/lib/panelLayout.test.ts
git commit -m "feat(layout): adiciona limites de largura dos painéis"
```

## Task 2: Store persistido do layout

**Files:**
- Create: `src/features/presentation/panelLayoutStore.ts`

- [ ] **Step 1: Implementar**

```ts
import { create } from "zustand";
import {
  clampPanelWidth,
  parsePanelLayout,
  SETLIST_WIDTH_DEFAULT,
  SETLIST_WIDTH_MAX,
  SETLIST_WIDTH_MIN,
  SLIDES_WIDTH_DEFAULT,
  SLIDES_WIDTH_MAX,
  SLIDES_WIDTH_MIN,
  type PanelLayout,
} from "@/core/lib/panelLayout";

const STORAGE_KEY = "open_presenter_panel_layout";

function loadInitial(): PanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parsePanelLayout(raw ? JSON.parse(raw) : null);
  } catch {
    return parsePanelLayout(null);
  }
}

function persist(layout: PanelLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // localStorage indisponível: mantém só a sessão
  }
}

interface PanelLayoutState extends PanelLayout {
  setSetlistWidth(width: number): void;
  setSlidesWidth(width: number): void;
  reset(): void;
  setMonitorsVisible(visible: boolean): void;
  toggleMonitors(): void;
}

export const usePanelLayoutStore = create<PanelLayoutState>((set, get) => {
  const initial = loadInitial();
  const update = (patch: Partial<PanelLayout>) => {
    const next = { ...get(), ...patch };
    const layout: PanelLayout = {
      setlistWidth: clampPanelWidth(
        next.setlistWidth,
        SETLIST_WIDTH_MIN,
        SETLIST_WIDTH_MAX,
      ),
      slidesWidth: clampPanelWidth(
        next.slidesWidth,
        SLIDES_WIDTH_MIN,
        SLIDES_WIDTH_MAX,
      ),
      monitorsVisible: next.monitorsVisible,
    };
    persist(layout);
    set(layout);
  };

  return {
    ...initial,
    setSetlistWidth: (width) => update({ setlistWidth: width }),
    setSlidesWidth: (width) => update({ slidesWidth: width }),
    reset: () =>
      update({
        setlistWidth: SETLIST_WIDTH_DEFAULT,
        slidesWidth: SLIDES_WIDTH_DEFAULT,
        monitorsVisible: true,
      }),
    setMonitorsVisible: (monitorsVisible) => update({ monitorsVisible }),
    toggleMonitors: () =>
      update({ monitorsVisible: !get().monitorsVisible }),
  };
});
```

`update` não deve persistir campos extras do store; só `PanelLayout`.

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/features/presentation/panelLayoutStore.ts
git commit -m "feat(layout): persiste larguras e monitores"
```

## Task 3: `ResizeHandle`

**Files:**
- Create: `src/components/ResizeHandle.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { clampPanelWidth } from "@/core/lib/panelLayout";
import { cn } from "@/core/lib/utils";

export function ResizeHandle({
  value,
  min,
  max,
  defaultValue,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (width: number) => void;
  label: string;
}) {
  const start = useRef({ x: 0, value });
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, value };
    setDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const delta = e.clientX - start.current.x;
    onChange(clampPanelWidth(start.current.value + delta, min, max));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(clampPanelWidth(value - 16, min, max));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(clampPanelWidth(value + 16, min, max));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none",
        "bg-transparent hover:bg-primary/20 focus-visible:bg-primary/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        dragging && "bg-primary/30",
      )}
      title="Arraste para redimensionar · duplo clique para restaurar"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/60" />
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ResizeHandle.tsx
git commit -m "feat(layout): adiciona divisor acessível"
```

## Task 4: Larguras controladas e filhos sem largura fixa

**Files:**
- Modify: `src/features/events-setlists/SetlistSidebar.tsx`
- Modify: `src/features/events-setlists/SongSlidesColumn.tsx`
- Modify: `src/features/events-setlists/ScriptureSlidesColumn.tsx`
- Modify: `src/features/events-setlists/MediaSlidesColumn.tsx`

- [ ] **Step 1: `SetlistSidebar`**

Adicionar `width` às props:

```ts
export function SetlistSidebar({
  collapsed = false,
  width,
  onToggleSidebar,
}: {
  collapsed?: boolean;
  width: number;
  onToggleSidebar?: () => void;
}) {
```

No `aside` expandido:

```tsx
<aside
  className="flex h-full min-h-0 flex-col border-r border-border bg-muted/20 shrink-0 select-none overflow-hidden"
  style={{ width }}
>
```

Remover `w-72`, `sm:w-80` e `w-80` das classes. O `aside` recolhido continua `w-10`.

- [ ] **Step 2: Filhos do centro**

Em `SongSlidesColumn`, `ScriptureSlidesColumn` e `MediaSlidesColumn`, trocar:

```text
relative flex h-full w-80 min-h-0 flex-col ... sm:w-96 shrink-0 ...
```

por:

```text
relative flex h-full w-full min-w-0 flex-col ...
```

Manter `border-r`, `bg-background`, `select-none` e `overflow-hidden`.

- [ ] **Step 3: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/features/events-setlists/SetlistSidebar.tsx \
  src/features/events-setlists/SongSlidesColumn.tsx \
  src/features/events-setlists/ScriptureSlidesColumn.tsx \
  src/features/events-setlists/MediaSlidesColumn.tsx
git commit -m "refactor(layout): remove larguras fixas das colunas"
```

## Task 5: Composição no `AdminView`

**Files:**
- Modify: `src/views/AdminView.tsx`

- [ ] **Step 1: Implementar**

Imports:

```ts
import { useEffect, useRef, useState } from "react";
import { ResizeHandle } from "@/components/ResizeHandle";
import {
  fitPanelLayout,
  SETLIST_WIDTH_DEFAULT,
  SETLIST_WIDTH_MAX,
  SETLIST_WIDTH_MIN,
  SLIDES_WIDTH_DEFAULT,
  SLIDES_WIDTH_MAX,
  SLIDES_WIDTH_MIN,
} from "@/core/lib/panelLayout";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
import { cn } from "@/core/lib/utils";
```

No componente:

```ts
const setlistWidth = usePanelLayoutStore((s) => s.setlistWidth);
const slidesWidth = usePanelLayoutStore((s) => s.slidesWidth);
const monitorsVisible = usePanelLayoutStore((s) => s.monitorsVisible);
const setSetlistWidth = usePanelLayoutStore((s) => s.setSetlistWidth);
const setSlidesWidth = usePanelLayoutStore((s) => s.setSlidesWidth);
const mainRef = useRef<HTMLElement>(null);
const [mainWidth, setMainWidth] = useState(0);

useEffect(() => {
  const element = mainRef.current;
  if (!element) return;
  const observer = new ResizeObserver(() => setMainWidth(element.clientWidth));
  observer.observe(element);
  setMainWidth(element.clientWidth);
  return () => observer.disconnect();
}, [activeTab]);

const fitted =
  monitorsVisible && mainWidth > 0
    ? fitPanelLayout({ setlistWidth, slidesWidth }, mainWidth - 192)
    : { setlistWidth, slidesWidth };
```

Substituir o bloco da aba Apresentação por:

```tsx
{activeTab === "presentation" && (
  <main ref={mainRef} className="flex flex-1 overflow-hidden">
    <SetlistSidebar
      collapsed={!sidebarOpen}
      width={fitted.setlistWidth}
      onToggleSidebar={() => setSidebarOpen((v) => !v)}
    />

    {sidebarOpen && (
      <ResizeHandle
        label="Redimensionar programação"
        value={fitted.setlistWidth}
        min={SETLIST_WIDTH_MIN}
        max={SETLIST_WIDTH_MAX}
        defaultValue={SETLIST_WIDTH_DEFAULT}
        onChange={setSetlistWidth}
      />
    )}

    <div
      className={cn(
        "flex min-h-0",
        monitorsVisible ? "shrink-0" : "flex-1",
      )}
      style={monitorsVisible ? { width: fitted.slidesWidth } : undefined}
    >
      <SongSlidesColumn />
    </div>

    {monitorsVisible && (
      <ResizeHandle
        label="Redimensionar letra e versículos"
        value={fitted.slidesWidth}
        min={SLIDES_WIDTH_MIN}
        max={SLIDES_WIDTH_MAX}
        defaultValue={SLIDES_WIDTH_DEFAULT}
        onChange={setSlidesWidth}
      />
    )}

    <section
      className={cn(
        "flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border/60 bg-muted/10",
        !monitorsVisible && "hidden",
      )}
    >
      <LivePreview />
    </section>

    <ThemeRail />
  </main>
)}
```

O duplo clique usa `defaultValue`; `onChange` só persiste a largura arrastada ou ajustada pelo teclado.

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/views/AdminView.tsx
git commit -m "feat(layout): integra painéis redimensionáveis"
```

## Task 6: Botão “Monitores” na barra superior

**Files:**
- Modify: `src/components/AppTopBar.tsx`

- [ ] **Step 1: Implementar**

Imports:

```ts
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useNavigationStore } from "@/features/navigation/store";
import { usePanelLayoutStore } from "@/features/presentation/panelLayoutStore";
```

No componente:

```ts
const activeTab = useNavigationStore((s) => s.activeTab);
const monitorsVisible = usePanelLayoutStore((s) => s.monitorsVisible);
const toggleMonitors = usePanelLayoutStore((s) => s.toggleMonitors);
```

Antes do botão “Mostrar Plano de Fundo”:

```tsx
{activeTab === "presentation" && (
  <Button
    type="button"
    size="sm"
    variant={monitorsVisible ? "secondary" : "outline"}
    className={cn(
      "h-8 gap-1.5 px-2.5 text-xs font-medium transition-all",
      monitorsVisible
        ? "bg-primary/15 text-primary border-primary/30 font-semibold"
        : "text-muted-foreground hover:text-foreground",
    )}
    onClick={toggleMonitors}
    title={
      monitorsVisible
        ? "Ocultar painel de monitores"
        : "Mostrar painel de monitores"
    }
  >
    {monitorsVisible ? (
      <PanelRightClose className="size-3.5" />
    ) : (
      <PanelRightOpen className="size-3.5" />
    )}
    <span className="hidden lg:inline">Monitores</span>
  </Button>
)}
```

Importar `cn` se ainda não estiver no arquivo.

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
npm test
```

Manual:

1. Na aba Apresentação, o botão “Monitores” aparece; em Músicas/Bíblia/Agenda, não.
2. Ocultar remove o painel e o divisor; a coluna de letras ocupa o espaço.
3. Reabrir restaura Prévia/Ao Vivo/Retorno e o zoom anteriores.
4. Recarregar mantém oculto.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppTopBar.tsx
git commit -m "feat(layout): adiciona botão de monitores"
```

## Task 7: Verificação manual do layout

**Files:** nenhum.

- [ ] **Step 1: Arrastar**

- Arrastar o divisor da programação para a esquerda/direita; a largura acompanha o ponteiro.
- Arrastar o divisor da letra/versículos; idem.
- Soltar fora do divisor não deixa o drag preso.
- Duplo clique restaura 320/384.
- Foco no divisor + setas ajustam 16 px.
- `Home`/`End` vão aos limites.

- [ ] **Step 2: Persistência**

- Recarregar o app e confirmar larguras.
- Recolher a programação: divisor some, trilho de 40 px.
- Ocultar monitores, recarregar, confirmar oculto.
- Reexibir monitores, confirmar controles internos.

- [ ] **Step 3: Janela menor**

- Reduzir a janela e confirmar que os monitores não somem por overflow sem intenção; se necessário, ocultar monitores.
- Confirmar que a coluna central pode encolher até 280 px.

- [ ] **Step 4: Verificação final**

```bash
npm run typecheck
npm test
cargo check -p open-presenter
```

## Verification

```bash
npm run typecheck
npm test
cargo check -p open-presenter
```

Manual:

- Arrastar, soltar, duplo clique e teclado nos dois divisores.
- Persistência de larguras e visibilidade.
- Recolher programação.
- Ocultar/reexibir monitores.
- Abas diferentes.

## Acceptance Checklist

- [ ] Arrastar os divisores redimensiona programação e letra/versículos.
- [ ] Duplo clique restaura 320/384.
- [ ] Setas ajustam 16 px; `Home`/`End` vão aos limites.
- [ ] Larguras sobrevivem a recarregar.
- [ ] Botão “Monitores” oculta o painel por completo.
- [ ] Ao ocultar, a coluna de letras ocupa o espaço.
- [ ] Estado oculto sobrevive a recarregar.
- [ ] Controles internos de monitor continuam funcionando ao reabrir.
- [ ] Programação recolhida não mostra divisor.
- [ ] Botão “Monitores” só aparece na aba Apresentação.
