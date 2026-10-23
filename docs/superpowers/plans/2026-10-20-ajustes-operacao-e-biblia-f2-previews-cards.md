# F2 — Previews em slides e livros em cards · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no painel o que o público verá: alternadores Lista/Slides nas letras e nos versículos do setlist, Lista/Slides nos versículos da Bíblia e Lista/Cards nos livros, todos persistidos e usando o tema público resolvido.

**Architecture:** Um hook `usePublicThemeResolver()` centraliza a resolução de tema hoje duplicada em `LivePreview`; `SlideThumbnail` renderiza `ScaledStage` com `buildProps` ou cai no `SlideCanvas`. Um hook genérico de modo de visualização persiste a escolha por painel em `localStorage`. Os painéis continuam usando os mesmos handlers de clique/duplo clique/arrastar; só o conteúdo interno muda.

**Tech Stack:** React 19 + TypeScript + Zustand, Tailwind v4, `ScaledStage`/`buildProps`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-ajustes-operacao-e-biblia-design.md`

**Depende de:** F1 concluída (`sectionIndex`, `isBlank`, grupos vazios e `buildProps` com `hideText`).

## Global Constraints

- Nenhuma dependência nova.
- O modo padrão de todos os painéis é `list`.
- A escolha de modo é por painel, não global.
- Em modo slides, clique seleciona, duplo clique apresenta, arrastar reordena e o menu de contexto continua funcionando.
- Miniaturas usam o tema do evento/vínculo público e atualizam quando o tema muda.
- Miniaturas são `React.memo`, `aspect-video`, `overflow-hidden` e `content-visibility: auto`.
- `StageView`, `PublicView` e `StreamView` não são alterados por esta feature.
- `src/features/*` não importa outro `src/features/*` diretamente; o hook de tema fica em `src/features/slide-themes` e pode ser consumido por componentes de UI via prop ou por features que já dependem de temas.
- Antes de fechar: `npm run typecheck` e `npm test`.

## Review Focus

- O tema resolvido não pode divergir do `LivePreview` (evento → vínculo público → padrão → página por contexto).
- O modo slides não pode quebrar drag-and-drop nem o menu de contexto.
- O versículo dividido em partes deve gerar **uma miniatura por parte**, não uma por versículo.
- Cards de livros não podem esconder os filtros AT/NT e texto.
- A persistência não pode lançar exceção quando `localStorage` estiver indisponível.
- O layout não pode ficar pesado: não criar um hook por card.

## File Map

| Arquivo | Responsabilidade |
| --- | --- |
| `src/features/slide-themes/usePublicThemeResolver.ts` | Resolve tema público por `SlideContent` |
| `src/components/SlideThumbnail.tsx` | Miniatura 16:9 com tema ou fallback |
| `src/core/lib/viewMode.ts` | Tipo e parser puro do modo persistido |
| `src/core/lib/viewMode.test.ts` | Testes do parser |
| `src/core/lib/usePersistentViewMode.ts` | Hook de estado + `localStorage` |
| `src/components/ViewModeToggle.tsx` | Alternador compacto reutilizável |
| `src/features/presentation/LivePreview.tsx` | Passa a usar o hook compartilhado |
| `src/features/events-setlists/SongSlidesColumn.tsx` | Lista/Slides nas letras |
| `src/features/events-setlists/ScriptureSlidesColumn.tsx` | Lista/Slides nos versículos do setlist |
| `src/features/bible/BiblePage.tsx` | Lista/Slides nos versículos e Lista/Cards nos livros |

## Task 1: Hook de tema público + `SlideThumbnail`

**Files:**
- Create: `src/features/slide-themes/usePublicThemeResolver.ts`
- Create: `src/components/SlideThumbnail.tsx`
- Modify: `src/features/presentation/LivePreview.tsx`

- [ ] **Step 1: Criar o hook**

```ts
import { useCallback } from "react";
import type { SlideContent, SlideTheme } from "@/core/types";
import { getPageForContext, materializePage } from "./pages";
import { contextForSlide } from "./themeResolution";
import { useSlideThemesStore } from "./store";

export type PublicThemeResolver = (content: SlideContent | null) => SlideTheme | null;

export function usePublicThemeResolver(): PublicThemeResolver {
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const eventThemeGuid = useSlideThemesStore((s) => s.eventThemeGuid);
  const resolveTheme = useSlideThemesStore((s) => s.resolveTheme);

  return useCallback(
    (content) => {
      if (!content) return null;
      const context = contextForSlide(content.kind, content.media?.kind) ?? "music";
      let base = content.media?.themeId
        ? themes.find((t) => t.guid === content.media?.themeId) ?? null
        : null;
      if (!base) {
        base = resolveTheme(
          "public",
          content.kind,
          content.media?.themeId,
          content.media?.kind,
        );
      }
      if (base?.pages?.length) {
        const page = getPageForContext(base, context) ?? base.pages[0];
        return page ? materializePage(base, page) : base;
      }
      return base;
    },
    // bindings/eventThemeGuid entram nas dependências para o card reagir a
    // mudanças de vínculo mesmo que o resolver leia o store via get().
    [themes, bindings, eventThemeGuid, resolveTheme],
  );
}
```

- [ ] **Step 2: Criar `SlideThumbnail`**

```tsx
import { memo } from "react";
import type { LiveSlide, SlideContent, SlideTheme } from "@/core/types";
import { kindToAsset } from "@/core/types";
import { cn } from "@/core/lib/utils";
import { buildProps } from "@/features/slide-themes/themeTemplate";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";

export const SlideThumbnail = memo(function SlideThumbnail({
  content,
  theme,
  showBackground = true,
  className,
  textHidden = false,
}: {
  content: SlideContent;
  theme: SlideTheme | null;
  showBackground?: boolean;
  className?: string;
  textHidden?: boolean;
}) {
  const asset = kindToAsset(content.kind);
  const synthetic: LiveSlide = {
    content,
    background: { id: "thumb-bg", kind: "color", value: "#000000" },
    blackout: false,
    cleared: false,
    textHidden,
    updatedAt: "",
  };

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border border-border/70 bg-black shadow-inner",
        className,
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "320px 180px" }}
    >
      {theme && asset ? (
        <ScaledStage
          theme={theme}
          asset={asset}
          props={buildProps(content.kind, content, null, { hideText: textHidden })}
          showBackground={showBackground}
        />
      ) : (
        <SlideCanvas
          slide={synthetic}
          showBackground={showBackground}
          showTitle={content.kind === "scripture"}
          hideText={textHidden}
        />
      )}
    </div>
  );
});
```

- [ ] **Step 3: Refatorar `LivePreview`**

Remover de `LivePreview`:

- `themes`, `bindings`, `eventThemeGuid`, `resolveTheme` selecionados individualmente;
- imports de `getPageForContext`, `materializePage`, `contextForSlide`;
- `previewContext`, `liveContext` e os dois `useMemo` de tema.

Adicionar:

```ts
const resolvePublicTheme = usePublicThemeResolver();
const previewTheme = useMemo(
  () => resolvePublicTheme(preview),
  [preview, resolvePublicTheme],
);
const liveTheme = useMemo(
  () => resolvePublicTheme(live.content),
  [live.content, resolvePublicTheme],
);
```

O restante de `LivePreview` (fundo efetivo, wallpaper, monitores) não muda.

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/features/slide-themes/usePublicThemeResolver.ts \
  src/components/SlideThumbnail.tsx src/features/presentation/LivePreview.tsx
git commit -m "refactor(themes): centraliza resolução do tema público"
```

## Task 2: Modo de visualização persistido e alternador

**Files:**
- Create: `src/core/lib/viewMode.ts`
- Create: `src/core/lib/viewMode.test.ts`
- Create: `src/core/lib/usePersistentViewMode.ts`
- Create: `src/components/ViewModeToggle.tsx`

- [ ] **Step 1: Escrever o teste do parser**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseViewMode } from "./viewMode.ts";

test("usa o fallback quando o valor é inválido", () => {
  assert.equal(parseViewMode(null, ["list", "slides"], "list"), "list");
  assert.equal(parseViewMode("cards", ["list", "slides"], "list"), "list");
});

test("aceita um valor permitido", () => {
  assert.equal(parseViewMode("slides", ["list", "slides"], "list"), "slides");
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/core/lib/viewMode.test.ts
```

- [ ] **Step 3: Implementar**

`viewMode.ts`:

```ts
export type ViewMode = "list" | "slides" | "cards";

export function parseViewMode<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value !== null && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}
```

`usePersistentViewMode.ts`:

```ts
import { useCallback, useState } from "react";
import { parseViewMode } from "./viewMode.ts";

export function usePersistentViewMode<T extends string>(
  storageKey: string,
  fallback: T,
  allowed: readonly T[],
): [T, (mode: T) => void] {
  const [mode, setMode] = useState<T>(() => {
    try {
      return parseViewMode(localStorage.getItem(storageKey), allowed, fallback);
    } catch {
      return fallback;
    }
  });

  const update = useCallback(
    (next: T) => {
      setMode(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // localStorage indisponível: mantém só o estado da sessão
      }
    },
    [storageKey],
  );

  return [mode, update];
}
```

`ViewModeToggle`:

- Props `value`, `onChange`, `options: { value: T; label: string; icon: LucideIcon }[]`, `className?`.
- Renderizar um grupo `inline-flex rounded-md border border-border/70 bg-muted/40 p-0.5`.
- Cada botão `size="icon"` `h-6 w-6`, `variant={value === option.value ? "secondary" : "ghost"}`, `title={option.label}`, `aria-pressed`.
- Aceitar `React.ComponentType<{ className?: string }>` em vez de `LucideIcon` para facilitar testes de tipos.

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/core/lib/viewMode.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/core/lib/viewMode.ts src/core/lib/viewMode.test.ts \
  src/core/lib/usePersistentViewMode.ts src/components/ViewModeToggle.tsx
git commit -m "feat(ui): adiciona modo de visualização persistido"
```

## Task 3: Lista/Slides no painel de letras do setlist

**Files:**
- Modify: `src/features/events-setlists/SongSlidesColumn.tsx`

- [ ] **Step 1: Adicionar o modo e o tema**

```ts
const [viewMode, setViewMode] = usePersistentViewMode(
  "open_presenter_setlist_song_view",
  "list",
  ["list", "slides"] as const,
);
const resolveTheme = usePublicThemeResolver();
```

Também estabilizar a lista, para o `React.memo` da miniatura realmente evitar re-render. Importar `useMemo` de `react`:

```ts
const slides = useMemo(
  () => (song ? buildSongSlides(song, { addEmptySlideAtStart }) : []),
  [song, addEmptySlideAtStart],
);
const thumbnailThemes = useMemo(
  () => new Map(slides.map((slide) => [slide.slide.id, resolveTheme(slide.slide)])),
  [slides, resolveTheme],
);
```

No cabeçalho, antes do botão “Apresentar”, inserir:

```tsx
<ViewModeToggle
  value={viewMode}
  onChange={setViewMode}
  options={[
    { value: "list", label: "Lista", icon: List },
    { value: "slides", label: "Slides", icon: LayoutGrid },
  ]}
/>
```

Importar `List`, `LayoutGrid` de `lucide-react`.

- [ ] **Step 2: Renderizar o card**

No corpo do card, onde hoje existe:

```tsx
<div className="space-y-1">
  {block.slide.lines.map(...)}
</div>
```

Trocar por um bloco condicional:

```tsx
{viewMode === "slides" ? (
  <div className="relative">
    <SlideThumbnail
      content={block.slide}
      theme={thumbnailThemes.get(block.slide.id) ?? null}
    />
    <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1">
      <div className="flex items-center gap-1">
        {isPreview && !isLive && <Badge>Prévia</Badge>}
        {isLive && <Badge>Ao Vivo</Badge>}
        {block.isBlank && <Badge variant="outline">Slide vazio</Badge>}
      </div>
      <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">
        #{block.index + 1}
      </span>
    </div>
  </div>
) : (
  <div className="space-y-1">
    {block.slide.lines.length === 0 ? (
      <p className="text-xs italic text-muted-foreground/50">(Slide vazio)</p>
    ) : (
      block.slide.lines.map((line, lIdx) => (
        <p key={lIdx} className="text-xs leading-relaxed">
          {line}
        </p>
      ))
    )}
  </div>
)}
```

Manter as classes de estado (`isLive`, `isPreview`) e os handlers no elemento clicável externo. Não colocar `onClick` na miniatura.

- [ ] **Step 3: Ajustar grupo e ações**

- No cabeçalho do grupo, usar `group.isBlank ? "Slide vazio" : ...`.
- Badges de “Prévia”/“Ao Vivo” devem continuar visíveis no modo slides.
- O número `#` deve continuar usando `block.index + 1`.
- `block.isBlank` desabilita rótulo/dividir/reordenar (já feito em F1).
- O arrastar continua no card externo; a miniatura não deve capturar pointer events.

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
npm test
```

Manual:

1. Alternar Lista/Slides em uma música e recarregar: a escolha persiste.
2. Clicar, duplo clicar, arrastar e abrir o menu de contexto no modo slides.
3. Trocar o tema do evento: as miniaturas atualizam.
4. Slide vazio aparece como card próprio e mostra “Slide vazio”.

- [ ] **Step 5: Commit**

```bash
git add src/features/events-setlists/SongSlidesColumn.tsx
git commit -m "feat(setlist): adiciona miniaturas de slides nas letras"
```

## Task 4: Lista/Slides no painel de versículos do setlist

**Files:**
- Modify: `src/features/events-setlists/ScriptureSlidesColumn.tsx`

- [ ] **Step 1: Adicionar o modo e o tema**

```ts
const [viewMode, setViewMode] = usePersistentViewMode(
  "open_presenter_setlist_scripture_view",
  "list",
  ["list", "slides"] as const,
);
const resolveTheme = usePublicThemeResolver();
```

Depois da declaração de `slides` (o estado já existente), importando `useMemo` de `react`:

```ts
const thumbnailThemes = useMemo(
  () => new Map(slides.map((slide) => [slide.id, resolveTheme(slide)])),
  [slides, resolveTheme],
);
```

No cabeçalho, antes da lixeira, inserir o `ViewModeToggle` com “Lista” e “Slides”.

- [ ] **Step 2: Renderizar a grade**

Trocar o container:

```tsx
<div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-3">
```

por:

```tsx
<div
  className={
    viewMode === "slides"
      ? "grid flex-1 min-h-0 grid-cols-1 gap-2 overflow-y-auto p-3"
      : "flex-1 min-h-0 space-y-2 overflow-y-auto p-3"
  }
>
```

No `slides.map`, quando `viewMode === "slides"`:

```tsx
<SlideThumbnail
  content={slide}
  theme={thumbnailThemes.get(slide.id) ?? null}
  className="rounded-xl"
/>
```

Manter o cabeçalho do card com:

- `Parte X/Y` quando `slide.scripture.totalParts > 1`;
- “AO VIVO” quando `isLive`;
- “Prévia” quando `isPreview`;
- referência `slide.section`.

O card externo continua sendo `<button>` com `onClick`/`onDoubleClick`.

- [ ] **Step 3: Verificar**

```bash
npm run typecheck
npm test
```

Manual:

1. Alternar Lista/Slides em um item de escritura e recarregar.
2. Versículo dividido em 2 partes gera 2 miniaturas.
3. Clicar e duplo clicar funcionam.
4. Tema do evento atualiza as miniaturas.

- [ ] **Step 4: Commit**

```bash
git add src/features/events-setlists/ScriptureSlidesColumn.tsx
git commit -m "feat(setlist): adiciona miniaturas de versículos"
```

## Task 5: Lista/Slides nos versículos da Bíblia

**Files:**
- Modify: `src/features/bible/BiblePage.tsx`

- [ ] **Step 1: Adicionar o modo e o resolvedor**

```ts
const [versesView, setVersesView] = usePersistentViewMode(
  "open_presenter_bible_verses_view",
  "list",
  ["list", "slides"] as const,
);
const resolveTheme = usePublicThemeResolver();
```

No cabeçalho da coluna de versículos, antes de “Dividir versículos longos”, inserir o `ViewModeToggle` com “Lista” e “Slides”.

- [ ] **Step 2: Montar os cards por parte**

Criar um `useMemo` que achata versículos e partes:

```ts
const verseCards = useMemo(() => {
  if (versesView !== "slides" || !activeBook || !activeVersionId) return [];
  return verses.flatMap((verse) => {
    const parts = getVerseParts(verse.text);
    return parts.map((partText, partIndex) => {
      const slide = buildScriptureSlide({
        versionId: activeVersionId,
        bookId: activeBook.id,
        bookName: activeBook.name,
        chapter: activeChapter,
        verse: verse.verse,
        text: partText,
        part: partIndex,
        totalParts: parts.length,
      });
      return {
        verse,
        partIndex,
        totalParts: parts.length,
        slide,
        theme: resolveTheme(slide),
      };
    });
  });
}, [
  versesView,
  verses,
  activeBook,
  activeVersionId,
  activeChapter,
  getVerseParts,
  resolveTheme,
]);
```

Importar `buildScriptureSlide` de `@/core/lib/biblePresentation` e `cn` de `@/core/lib/utils`; adicionar `List` e `LayoutGrid` aos ícones de `lucide-react`.

- [ ] **Step 3: Renderizar**

Manter a lista atual quando `versesView === "list"`.

Quando `versesView === "slides"`:

```tsx
<div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
  {verseCards.map(({ verse, partIndex, totalParts, slide, theme }) => {
    const isLive =
      isCurrentLiveScripture && liveVerseKey === slide.id;
    const isSelected =
      selectedVerseNum === verse.verse && activePartIndex === partIndex;
    return (
      <button
        key={slide.id}
        type="button"
        data-verse={verse.verse}
        onClick={() => selectVerse(verse.verse, partIndex)}
        onDoubleClick={() => void presentVerse(verse, undefined, partIndex)}
        className={cn(
          "group flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-all",
          isLive
            ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/40"
            : isSelected
              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
              : "border-border/80 bg-card/70 hover:border-primary/50",
        )}
      >
        <SlideThumbnail content={slide} theme={theme} />
        <div className="flex items-center justify-between gap-1 px-0.5">
          <span className="truncate text-[10px] font-semibold text-primary">
            {slide.section}
          </span>
          {totalParts > 1 && (
            <Badge variant="outline" className="h-4 px-1 text-[9px]">
              {partIndex + 1}/{totalParts}
            </Badge>
          )}
        </div>
      </button>
    );
  })}
</div>
```

- [ ] **Step 4: Ajustar o scroll**

Trocar o efeito que usa `document.getElementById(`verse-row-${selectedVerseNum}`)` por:

```ts
const el = document.querySelector<HTMLElement>(
  `[data-verse="${selectedVerseNum}"]`,
);
```

Adicionar `data-verse={verse.verse}` também na linha da lista atual, para o scroll funcionar nos dois modos, e incluir `versesView` nas dependências do efeito de scroll.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck
npm test
```

Manual:

1. Alternar Lista/Slides e recarregar.
2. “Dividir versículos longos” ligado: cada parte é um card.
3. Clique seleciona; duplo clique apresenta.
4. Estados selecionado/ao vivo aparecem corretamente.
5. Grade responsiva: 1/2/3 colunas.

- [ ] **Step 6: Commit**

```bash
git add src/features/bible/BiblePage.tsx
git commit -m "feat(bible): adiciona miniaturas de versículos"
```

## Task 6: Lista/Cards nos livros da Bíblia

**Files:**
- Modify: `src/features/bible/BiblePage.tsx`

- [ ] **Step 1: Adicionar o modo**

```ts
const [booksView, setBooksView] = usePersistentViewMode(
  "open_presenter_bible_books_view",
  "list",
  ["list", "cards"] as const,
);
```

- [ ] **Step 2: Ajustar a largura e o cabeçalho**

Na `<section>` dos livros:

```tsx
className={cn(
  "flex shrink-0 flex-col border-r border-border bg-card/25",
  booksView === "cards" ? "w-80 xl:w-96" : "w-64",
)}
```

Adicionar um cabeçalho acima dos filtros:

```tsx
<div className="flex h-9 items-center justify-between border-b border-border/60 px-3">
  <span className="text-xs font-bold text-foreground">Livros</span>
  <ViewModeToggle
    value={booksView}
    onChange={setBooksView}
    options={[
      { value: "list", label: "Lista", icon: List },
      { value: "cards", label: "Cards", icon: LayoutGrid },
    ]}
  />
</div>
```

- [ ] **Step 3: Renderizar cards**

Manter a lista atual quando `booksView === "list"`.

Quando `booksView === "cards"`:

```tsx
<div className="grid grid-cols-2 gap-2 p-2 xl:grid-cols-3">
  {filteredBooks.map((book) => {
    const isActive = book.id === activeBookId;
    const isOld = book.testamentReferenceId === 1;
    return (
      <button
        key={book.id}
        type="button"
        onClick={() => void selectBook(book.id)}
        className={cn(
          "flex min-h-20 flex-col justify-between rounded-lg border p-2.5 text-left transition-all",
          isActive
            ? "border-primary bg-primary text-primary-foreground shadow-xs"
            : isOld
              ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60"
              : "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60",
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-bold leading-tight">{book.name}</span>
          <span className={cn("font-mono text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {book.abbrev}
          </span>
        </div>
        <span className={cn("text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {book.chapterCount} capítulos
        </span>
      </button>
    );
  })}
</div>
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
npm test
```

Manual:

1. Alternar Lista/Cards e recarregar.
2. Filtrar por Todos/AT/NT e por texto nos dois modos.
3. Clicar em um card seleciona o livro e abre o capítulo 1.
4. Cores de testamento não competem com o estado ativo.

- [ ] **Step 5: Commit**

```bash
git add src/features/bible/BiblePage.tsx
git commit -m "feat(bible): adiciona livros em cards"
```

## Verification

```bash
npm run typecheck
npm test
```

Manual:

- Os quatro alternadores persistem após recarregar.
- Temas mudam as miniaturas em tempo real.
- Lista/Slides não quebra clique, duplo clique, arrastar ou menu de contexto.
- Versículos divididos geram um card por parte.
- Livros em cards mantêm filtros e seleção.

## Acceptance Checklist

- [ ] Painel de letras alterna Lista/Slides e lembra a escolha.
- [ ] Painel de versículos do setlist alterna Lista/Slides e lembra a escolha.
- [ ] Miniaturas usam o tema do evento/vínculo público.
- [ ] Clique, duplo clique, arrastar e menu de contexto continuam funcionando.
- [ ] Bíblia alterna versículos Lista/Slides e lembra a escolha.
- [ ] Livros alternam Lista/Cards e lembram a escolha.
- [ ] Filtros AT/NT e texto funcionam nos dois modos.
- [ ] Versículos longos divididos geram um card por parte.
- [ ] Nenhuma dependência nova.
