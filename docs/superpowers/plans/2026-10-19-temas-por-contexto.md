# Temas por Contexto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o tema público em um contêiner com páginas independentes de Música, Bíblia e Texto, vinculá-lo ao evento e manter fallback para os vínculos das configurações.

**Architecture:** O tema público v2 guarda `pages[]`; cada página tem seu próprio `css`/`elements`. A resolução ao vivo é pura (`themeResolution.ts`) e devolve um `SlideTheme` efêmero materializado com a página do contexto. O editor passa a operar na página ativa; o evento carrega apenas um `themeGuid`. Rust valida e persiste o novo schema sem migração de banco.

**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, Zustand, Tailwind v4, Node `node --test`.

## Global Constraints

- Stack e versões pinadas: não adicionar dependências nem atualizar `package.json`/`Cargo.toml`.
- `HashRouter` continua obrigatório em todas as rotas.
- Tipos compartilhados Rust↔TS devem ficar sincronizados em `src/core/types/index.ts` e `src-tauri/src/state/types.rs`.
- Comandos IPC não acessam SQLite/janelas diretamente; siga `commands/` → `services/` → `state/`.
- Antes de cada commit: `npm run typecheck`; se mexer no Rust, também `cargo check -p open-presenter`.
- Testes de lógica pura usam `node --test` e imports relativos com extensão `.ts`. Não importe módulos que usam o alias `@/` em tempo de execução dentro de arquivos testados pelo Node; use `import type` para tipos.
- Sem comentários no código salvo quando a lógica não for auto-evidente.
- Commits em Conventional Commits, curtos e no imperativo.
- Branch atual: `develop`. Não commitar na `main`.
- Não remover nem sobrescrever temas existentes do usuário; o novo seed apenas adiciona o tema padrão multi-contexto quando ele não existir.
- O admin é sempre a janela Tauri; o modo web não sincroniza o tema do evento (limitação documentada, não implementar publisher web).

---

## File Structure

**Create**
- `src/features/slide-themes/pages.ts` — utilitários puros de páginas, versão, cobertura e clonagem.
- `src/features/slide-themes/pages.test.ts`
- `src/features/slide-themes/themeResolution.ts` — resolução pura evento → vínculo → padrão.
- `src/features/slide-themes/themeResolution.test.ts`
- `src/features/slide-themes/themePackage.ts` — export/import v2 puro.
- `src/features/slide-themes/themePackage.test.ts`
- `src/features/theme-editor/PagesBar.tsx` — barra de páginas do editor.
- `src/features/events-setlists/EventThemeSelect.tsx` — seletor de tema do evento.
- `.agents/skills/open-presenter-theme-creator/examples/tema-paginas.openpresenter-theme.json`

**Modify**
- `src/core/types/index.ts`
- `src-tauri/src/state/types.rs`
- `src-tauri/src/services/themes.rs`
- `src-tauri/src/services/setlists.rs`
- `src-tauri/src/state/presentation.rs`
- `src/features/slide-themes/seedThemes.ts`
- `src/features/slide-themes/store.ts`
- `src/features/slide-themes/useThemeSync.ts`
- `src/features/slide-themes/themeIo.ts`
- `src/features/slide-themes/ThemeRail.tsx`
- `src/features/songs/SongSlidesPreview.tsx`
- `src/features/songs/SongsPage.tsx`
- `src/features/studio/StudioPage.tsx`
- `src/features/events-setlists/StudioPickerDialog.tsx`
- `src/features/events-setlists/store.ts`
- `src/features/events-setlists/CreateEventDialog.tsx`
- `src/features/events-setlists/EditEventDialog.tsx`
- `src/features/events-setlists/EventDetailsDialog.tsx`
- `src/features/events-setlists/SetlistPanel.tsx`
- `src/features/theme-editor/store.ts`
- `src/features/theme-editor/LayersPanel.tsx`
- `src/features/theme-editor/PropertiesPanel.tsx`
- `src/views/ThemeEditorView.tsx`
- `src/features/preferences/tabs/ThemesTab.tsx`
- `src/features/preferences/tabs/StageTab.tsx`
- `.agents/skills/open-presenter-theme-creator/SKILL.md`
- `.agents/skills/open-presenter-theme-creator/references/theme-schema.json`
- `.agents/skills/open-presenter-theme-creator/references/prompt-for-other-ais.md`
- `.agents/skills/open-presenter-theme-creator/scripts/validate-theme.mjs`
- `docs/superpowers/specs/2026-10-19-temas-por-contexto-design.md` (status/v1 universal — já editado; commitar junto do plano)

---

### Task 1: Schema de páginas no Rust e validação

**Files:**
- Modify: `src-tauri/src/state/types.rs:462-497`
- Modify: `src-tauri/src/services/themes.rs:35-64, 70-130`
- Modify: `src-tauri/src/state/presentation.rs:109-118` (apenas se o compilador exigir)
- Test: testes inline em `src-tauri/src/services/themes.rs`

**Interfaces:**
- Produces: `ThemePage { id: String, context: String, css: HashMap<String,String>, elements: Vec<ThemeElement> }`; `SlideTheme.pages: Option<Vec<ThemePage>>`; `ThemeElement.name: Option<String>`; `save_theme` aceita páginas em branco e valida contextos.

- [ ] **Step 1: Escrever os testes que falham**

Adicione em `src-tauri/src/services/themes.rs` (módulo `tests`):

```rust
fn pagina(context: &str) -> ThemePage {
    ThemePage {
        id: format!("page-{context}"),
        context: context.into(),
        css: HashMap::new(),
        elements: vec![elemento("e1")],
    }
}

#[test]
fn salva_tema_com_paginas() {
    let conn = open_in_memory();
    let mut tema = tema("g-pages", "Com páginas");
    tema.pages = Some(vec![pagina("music"), pagina("bible")]);
    tema.elements = vec![];
    save_theme(&conn, &tema).unwrap();
    let salvo = get_theme(&conn, "g-pages").unwrap().unwrap();
    assert_eq!(salvo.pages.unwrap().len(), 2);
}

#[test]
fn rejeita_contexto_repetido() {
    let conn = open_in_memory();
    let mut tema = tema("g-dup", "Duplicado");
    tema.pages = Some(vec![pagina("music"), pagina("music")]);
    tema.elements = vec![];
    assert!(save_theme(&conn, &tema).is_err());
}

#[test]
fn rejeita_contexto_invalido() {
    let conn = open_in_memory();
    let mut tema = tema("g-inv", "Inválido");
    tema.pages = Some(vec![pagina("agenda")]);
    tema.elements = vec![];
    assert!(save_theme(&conn, &tema).is_err());
}

#[test]
fn aceita_pagina_em_branco() {
    let conn = open_in_memory();
    let mut tema = tema("g-blank", "Em branco");
    let mut page = pagina("text");
    page.elements = vec![];
    tema.pages = Some(vec![page]);
    tema.elements = vec![];
    assert!(save_theme(&conn, &tema).is_ok());
}
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `cargo test -p open-presenter themes::tests`
Expected: FAIL de compilação porque `ThemePage` e `pages` ainda não existem.

- [ ] **Step 3: Implementar os tipos e a validação**

Em `src-tauri/src/state/types.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemePage {
    pub id: String,
    pub context: String,
    pub css: HashMap<String, String>,
    pub elements: Vec<ThemeElement>,
}
```

Adicione em `ThemeElement`:

```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub name: Option<String>,
```

Adicione em `SlideTheme`:

```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub pages: Option<Vec<ThemePage>>,
```

Em `src-tauri/src/services/themes.rs`, substitua a validação de `save_theme` por:

```rust
pub fn save_theme(conn: &Connection, theme: &SlideTheme) -> Result<(), AppError> {
    if let Some(pages) = &theme.pages {
        if pages.is_empty() {
            return Err(AppError::Storage("tema deve ter ao menos uma página".into()));
        }
        let mut contextos = std::collections::HashSet::new();
        for page in pages {
            if !["music", "bible", "text"].contains(&page.context.as_str()) {
                return Err(AppError::Storage(format!(
                    "contexto de página inválido: {}",
                    page.context
                )));
            }
            if !contextos.insert(page.context.as_str()) {
                return Err(AppError::Storage(format!(
                    "contexto de página duplicado: {}",
                    page.context
                )));
            }
        }
    } else if theme.elements.is_empty() {
        return Err(AppError::Storage("tema deve ter ao menos um elemento".into()));
    }
    // resto igual ao atual
}
```

Atualize `elemento` e `tema` nos testes com `name: None` e `pages: None`. Se `state/presentation.rs` construir `SlideTheme` por struct literal, adicione `pages: None` e `name: None` no `ThemeElement`.

- [ ] **Step 4: Rodar e confirmar**

Run: `cargo test -p open-presenter themes::tests && cargo check -p open-presenter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/state/types.rs src-tauri/src/state/presentation.rs src-tauri/src/services/themes.rs
git commit -m "feat: adiciona paginas e nome de camada aos temas"
```

---

### Task 2: Tema vinculado ao evento (Rust + tipos TS)

**Files:**
- Modify: `src/core/types/index.ts:178-192`
- Modify: `src-tauri/src/state/types.rs:314-331`
- Modify: `src-tauri/src/services/setlists.rs:30-160, 184-200, 213-340`
- Test: testes inline em `src-tauri/src/services/setlists.rs`

**Interfaces:**
- Produces: `ServiceEvent.themeGuid?: string | null` e `EventSummary.themeGuid?: string | null`; persistência em `$.themeGuid` no JSON do setlist.

- [ ] **Step 1: Escrever o teste que falha**

Adicione em `src-tauri/src/services/setlists.rs`:

```rust
#[test]
fn salva_e_restaura_tema_do_evento() {
    let conn = open_in_memory();
    let mut event = ServiceEvent {
        id: "e-tema".into(),
        title: "Culto".into(),
        event_date: "2026-10-19".into(),
        wallpaper: None,
        theme_guid: None,
        parts: vec![],
    };
    create(&conn, &event).unwrap();
    event.theme_guid = Some("tema-1".into());
    save(&conn, &event).unwrap();

    let loaded = get(&conn, "e-tema").unwrap().unwrap();
    assert_eq!(loaded.theme_guid.as_deref(), Some("tema-1"));
    let summary = list(&conn).unwrap();
    assert_eq!(summary[0].theme_guid.as_deref(), Some("tema-1"));
}
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `cargo test -p open-presenter setlists::tests::salva_e_restaura_tema_do_evento`
Expected: FAIL porque `theme_guid` não existe.

- [ ] **Step 3: Implementar**

Tipos TS:

```ts
export interface ServiceEvent {
  id: string;
  title: string;
  eventDate: string;
  wallpaper?: string | null;
  themeGuid?: string | null;
  parts: EventPart[];
}

export interface EventSummary {
  id: string;
  title: string;
  eventDate: string;
  wallpaper?: string | null;
  themeGuid?: string | null;
}
```

Em Rust, adicione em `ServiceEvent` e `EventSummary`:

```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub theme_guid: Option<String>,
```

Em `StoredEvent`:

```rust
#[serde(rename = "themeGuid", default, skip_serializing_if = "Option::is_none")]
theme_guid: Option<String>,
```

Atualize `serialize_setlist` (`theme_guid: event.theme_guid.clone()`), `get` (`theme_guid: stored.theme_guid`), `get_temporary` (`theme_guid: None`) e a query de `list` para incluir `json_extract(setlist_json, '$.themeGuid')` como quinta coluna. Adicione `theme_guid: row.get::<_, Option<String>>(4).unwrap_or(None)` no `EventSummary`.

Atualize todos os literais `ServiceEvent { ... }` dos testes com `theme_guid: None`.

- [ ] **Step 4: Rodar e confirmar**

Run: `cargo test -p open-presenter setlists::tests && cargo check -p open-presenter && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/types/index.ts src-tauri/src/state/types.rs src-tauri/src/services/setlists.rs
git commit -m "feat: vincula tema ao evento"
```

---

### Task 3: Utilitários puros de páginas

**Files:**
- Create: `src/features/slide-themes/pages.ts`
- Test: `src/features/slide-themes/pages.test.ts`

**Interfaces:**
- Produces: `PAGE_CONTEXTS`, `contextToAsset`, `assetToContext`, `getPageForContext`, `getActivePage`, `materializePage`, `previewTheme`, `themeVersion`, `isPublicTheme`, `isSingleLayout`, `themeCoverage`, `themeCoverageLabel`, `themeElements`, `createPage`, `cloneTheme`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `pages.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  cloneTheme,
  createPage,
  getActivePage,
  getPageForContext,
  materializePage,
  previewTheme,
  themeCoverageLabel,
  themeVersion,
} from "./pages.ts";
import type { SlideTheme, ThemeElement } from "@/core/types";

function element(id: string): ThemeElement {
  return { id, type: "TEXT", x: 0, y: 0, visible: true, locked: false, css: {}, text: id };
}

function base(overrides: Partial<SlideTheme> = {}): SlideTheme {
  return {
    guid: "t",
    title: "Tema",
    category: "theme",
    css: { background: "#000" },
    elements: [element("a")],
    ...overrides,
  };
}

test("materializa a página mantendo o restante do tema", () => {
  const page = { id: "p", context: "text" as const, css: { background: "#fff" }, elements: [element("x")] };
  const theme = base({ pages: [page] });
  const view = materializePage(theme, page);
  assert.deepEqual(view.css, page.css);
  assert.equal(view.elements[0].id, "x");
  assert.equal(view.pages?.length, 1);
});

test("página ativa cai na primeira quando o id não existe", () => {
  const page = { id: "p1", context: "music" as const, css: {}, elements: [] };
  const theme = base({ pages: [page] });
  assert.equal(getActivePage(theme, "nao-existe")?.id, "p1");
  assert.equal(getPageForContext(theme, "text"), null);
});

test("preview usa a página do asset e cai na primeira", () => {
  const music = { id: "m", context: "music" as const, css: {}, elements: [] };
  const text = { id: "t", context: "text" as const, css: {}, elements: [] };
  const theme = base({ pages: [text, music] });
  assert.equal(previewTheme(theme, "music").theme.elements.length, 0);
  assert.equal(previewTheme(theme, "bible").asset, "text");
});

test("classifica versão e cobertura", () => {
  assert.equal(themeVersion(base()), "v1");
  assert.equal(themeVersion(base({ pages: [] })), "v1");
  assert.equal(themeVersion(base({ pages: [{ id: "p", context: "music", css: {}, elements: [] }] })), "v2");
  assert.equal(themeVersion(base({ category: "stage" })), "single");
  assert.equal(themeCoverageLabel(base()), "Layout único");
  assert.equal(
    themeCoverageLabel(base({ pages: [{ id: "p", context: "music", css: {}, elements: [] }] })),
    "Música",
  );
});

test("cria página duplicada com ids novos e página em branco sem elementos", () => {
  const theme = base();
  const source = { id: "src", context: "music" as const, css: { background: "#123" }, elements: [element("orig")] };
  const dup = createPage(theme, "bible", "duplicate", source);
  assert.equal(dup.context, "bible");
  assert.notEqual(dup.elements[0].id, "orig");
  assert.deepEqual(dup.css, source.css);
  const blank = createPage(theme, "text", "blank", source);
  assert.equal(blank.elements.length, 0);
  assert.equal(blank.css.background, "#000000");
});

test("clona tema regenerando guids de páginas e elementos", () => {
  const theme = base({
    pages: [{ id: "p1", context: "music", css: {}, elements: [element("e1")] }],
  });
  const cloned = cloneTheme(theme);
  assert.notEqual(cloned.guid, theme.guid);
  assert.notEqual(cloned.pages?.[0].id, "p1");
  assert.notEqual(cloned.pages?.[0].elements[0].id, "e1");
  assert.equal(cloned.title, "Tema (Cópia)");
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test src/features/slide-themes/pages.test.ts`
Expected: FAIL com `Cannot find module './pages.ts'`.

- [ ] **Step 3: Implementar `pages.ts`**

```ts
import type {
  SlideTheme,
  ThemeAsset,
  ThemeContext,
  ThemeElement,
  ThemePage,
} from "@/core/types";

export interface PageContextInfo {
  context: ThemeContext;
  label: string;
  asset: ThemeAsset;
}

export const PAGE_CONTEXTS: readonly PageContextInfo[] = [
  { context: "music", label: "Música", asset: "music" },
  { context: "bible", label: "Bíblia", asset: "bible" },
  { context: "text", label: "Texto", asset: "text" },
];

export function contextToAsset(context: ThemeContext): ThemeAsset {
  switch (context) {
    case "music":
      return "music";
    case "bible":
      return "bible";
    case "text":
      return "text";
  }
}

export function assetToContext(asset: ThemeAsset): ThemeContext {
  switch (asset) {
    case "music":
      return "music";
    case "bible":
      return "bible";
    case "text":
      return "text";
  }
}

export function getPageForContext(theme: SlideTheme, context: ThemeContext): ThemePage | null {
  return theme.pages?.find((page) => page.context === context) ?? null;
}

export function getActivePage(
  theme: SlideTheme | null,
  activePageId: string | null,
): ThemePage | null {
  if (!theme?.pages?.length) return null;
  return theme.pages.find((page) => page.id === activePageId) ?? theme.pages[0];
}

export function materializePage(theme: SlideTheme, page: ThemePage): SlideTheme {
  return { ...theme, css: page.css, elements: page.elements };
}

export function previewTheme(
  theme: SlideTheme,
  asset: ThemeAsset,
): { theme: SlideTheme; asset: ThemeAsset } {
  if (theme.pages?.length) {
    const page = getPageForContext(theme, assetToContext(asset)) ?? theme.pages[0];
    return { theme: materializePage(theme, page), asset: contextToAsset(page.context) };
  }
  return { theme, asset };
}

export type ThemeVersion = "v1" | "v2" | "single";

export function themeVersion(theme: SlideTheme): ThemeVersion {
  if (theme.category === "stage" || theme.category === "presentation") return "single";
  return theme.pages?.length ? "v2" : "v1";
}

export function isPublicTheme(theme: SlideTheme): boolean {
  return theme.category !== "stage" && theme.category !== "presentation";
}

export function isSingleLayout(theme: SlideTheme): boolean {
  return !theme.pages?.length;
}

export function themeCoverage(theme: SlideTheme): ThemeContext[] {
  return theme.pages?.map((page) => page.context) ?? [];
}

export function themeCoverageLabel(theme: SlideTheme): string {
  const contexts = themeCoverage(theme);
  if (contexts.length === 0) return "Layout único";
  if (contexts.length === PAGE_CONTEXTS.length) return "3 contextos";
  return contexts
    .map((context) => PAGE_CONTEXTS.find((info) => info.context === context)?.label ?? context)
    .join(" · ");
}

export function themeElements(theme: SlideTheme): ThemeElement[] {
  if (!theme.pages?.length) return theme.elements;
  return theme.pages.flatMap((page) => page.elements);
}

export function createPage(
  theme: SlideTheme,
  context: ThemeContext,
  mode: "duplicate" | "blank",
  sourcePage: ThemePage | null,
): ThemePage {
  if (mode === "blank") {
    return { id: crypto.randomUUID(), context, css: { background: "#000000" }, elements: [] };
  }
  const sourceCss = sourcePage?.css ?? theme.css;
  const sourceElements = sourcePage?.elements ?? theme.elements;
  return {
    id: crypto.randomUUID(),
    context,
    css: { ...sourceCss },
    elements: sourceElements.map((element) => ({
      ...structuredClone(element),
      id: crypto.randomUUID(),
    })),
  };
}

export function cloneTheme(theme: SlideTheme, title = `${theme.title} (Cópia)`): SlideTheme {
  const now = new Date().toISOString();
  const cloned = structuredClone(theme);
  cloned.guid = crypto.randomUUID();
  cloned.title = title;
  cloned.category = theme.category ?? "theme";
  cloned.createdAt = now;
  cloned.updatedAt = now;
  cloned.elements = cloned.elements.map((element) => ({ ...element, id: crypto.randomUUID() }));
  cloned.pages = cloned.pages?.map((page) => ({
    ...page,
    id: crypto.randomUUID(),
    elements: page.elements.map((element) => ({ ...element, id: crypto.randomUUID() })),
  }));
  return cloned;
}
```

- [ ] **Step 4: Rodar e confirmar**

Run: `node --test src/features/slide-themes/pages.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/slide-themes/pages.ts src/features/slide-themes/pages.test.ts
git commit -m "feat: adiciona utilitarios de paginas de tema"
```

---

### Task 4: Exportar/importar pacote v2

**Files:**
- Create: `src/features/slide-themes/themePackage.ts`
- Test: `src/features/slide-themes/themePackage.test.ts`
- Modify: `src/features/slide-themes/themeIo.ts`

**Interfaces:**
- Produces: `buildThemePackage(theme): ThemePackageV2`, `buildThemesBackup(themes): ThemesBackupPackageV2`, `parseThemeFromJson(raw, regenerateGuid?): SlideTheme`.
- `themeIo.ts` reexporta `parseThemeFromJson` e passa a usar os builders.

- [ ] **Step 1: Escrever os testes que falham**

Crie `themePackage.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildThemePackage, buildThemesBackup, parseThemeFromJson } from "./themePackage.ts";
import type { SlideTheme } from "@/core/types";

function v2(): SlideTheme {
  return {
    guid: "g1",
    title: "Festividade",
    category: "theme",
    css: {},
    elements: [],
    pages: [
      { id: "p1", context: "music", css: { background: "#000" }, elements: [
        { id: "e1", name: "Letra", type: "TEXT", x: 0, y: 0, visible: true, locked: false, css: {}, text: "{lyrics}" },
      ] },
      { id: "p2", context: "text", css: { background: "#111" }, elements: [] },
    ],
  };
}

test("exporta sempre em v2 preservando páginas e nomes", () => {
  const pkg = buildThemePackage(v2());
  assert.equal(pkg.version, 2);
  assert.equal(pkg.theme.pages?.length, 2);
  assert.equal(pkg.theme.pages?.[0].elements[0].name, "Letra");
});

test("importa v2 e regenera o guid", () => {
  const pkg = JSON.stringify(buildThemePackage(v2()));
  const imported = parseThemeFromJson(pkg);
  assert.notEqual(imported.guid, "g1");
  assert.equal(imported.pages?.length, 2);
  assert.equal(imported.pages?.[1].elements.length, 0);
});

test("importa v1 sem pages como tema v1", () => {
  const imported = parseThemeFromJson({
    format: "open-presenter-theme",
    version: 1,
    theme: {
      title: "Antigo",
      css: { background: "#000" },
      elements: [{ id: "e", type: "TEXT", x: 0, y: 0, visible: true, locked: false, css: {}, text: "oi" }],
    },
  });
  assert.equal(imported.pages, undefined);
  assert.equal(imported.elements.length, 1);
});

test("rejeita contexto duplicado e página sem contexto válido", () => {
  const pkg = buildThemePackage(v2());
  const duplicated = structuredClone(pkg);
  duplicated.theme.pages![1].context = "music";
  assert.throws(() => parseThemeFromJson(duplicated), /duplicado/);
  const invalid = structuredClone(pkg);
  invalid.theme.pages![0].context = "agenda";
  assert.throws(() => parseThemeFromJson(invalid), /contexto/i);
});

test("backup usa v2", () => {
  const backup = buildThemesBackup([v2()]);
  assert.equal(backup.version, 2);
  assert.equal(backup.themes[0].pages?.length, 2);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test src/features/slide-themes/themePackage.test.ts`
Expected: FAIL com módulo inexistente.

- [ ] **Step 3: Implementar `themePackage.ts`**

Implemente com estas funções e validações:

```ts
import type { SlideTheme, ThemeContext, ThemeElement, ThemePage } from "@/core/types";

export const THEME_PACKAGE_VERSION = 2;
export const THEME_CONTEXTS: readonly ThemeContext[] = ["music", "bible", "text"];

export interface ThemePackageV2 {
  $schema?: string;
  format: "open-presenter-theme";
  version: 2;
  exportedAt: string;
  theme: SlideTheme;
}

export interface ThemesBackupPackageV2 {
  $schema?: string;
  format: "open-presenter-themes-backup";
  version: 2;
  exportedAt: string;
  themes: SlideTheme[];
}

function normalizeElement(el: ThemeElement): ThemeElement {
  return {
    ...el,
    visible: el.visible !== false,
    locked: Boolean(el.locked),
    css: el.css ?? {},
    name: el.name?.trim() || undefined,
  };
}

function buildThemePayload(theme: SlideTheme): SlideTheme {
  const pages = theme.pages?.length
    ? theme.pages.map((page) => ({
        ...page,
        css: page.css ?? {},
        elements: page.elements.map(normalizeElement),
      }))
    : undefined;
  return {
    ...theme,
    category: theme.category || "theme",
    css: pages ? {} : (theme.css ?? {}),
    elements: pages ? [] : (theme.elements ?? []).map(normalizeElement),
    pages,
  };
}

export function buildThemePackage(theme: SlideTheme): ThemePackageV2 {
  return {
    $schema: "https://openpresenter.dev/schemas/theme-v2.json",
    format: "open-presenter-theme",
    version: 2,
    exportedAt: new Date().toISOString(),
    theme: buildThemePayload(theme),
  };
}

export function buildThemesBackup(themes: SlideTheme[]): ThemesBackupPackageV2 {
  return {
    $schema: "https://openpresenter.dev/schemas/themes-backup-v2.json",
    format: "open-presenter-themes-backup",
    version: 2,
    exportedAt: new Date().toISOString(),
    themes: themes.map(buildThemePayload),
  };
}

function parseCss(value: unknown): Record<string, string> {
  const css: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (raw !== undefined && raw !== null) css[key] = String(raw);
    }
  }
  return css;
}

function parseElement(raw: unknown, label: string): ThemeElement {
  if (!raw || typeof raw !== "object") throw new Error(`${label}: elemento inválido.`);
  const el = raw as Record<string, unknown>;
  const type = String(el.type || "TEXT").toUpperCase();
  if (!["TEXT", "IMAGE", "VIDEO", "RECTANGLE"].includes(type)) {
    throw new Error(`${label}: tipo de elemento inválido "${type}".`);
  }
  return {
    id: typeof el.id === "string" && el.id ? el.id : label.replace(/[^a-z0-9]+/gi, "-"),
    type: type as ThemeElement["type"],
    x: typeof el.x === "number" ? el.x : 0,
    y: typeof el.y === "number" ? el.y : 0,
    visible: el.visible !== false,
    locked: Boolean(el.locked),
    css: parseCss(el.css),
    text: typeof el.text === "string" ? el.text : undefined,
    name: typeof el.name === "string" && el.name.trim() ? el.name.trim() : undefined,
    src: typeof el.src === "string" ? el.src : undefined,
    assetTypeVisibility: Array.isArray(el.assetTypeVisibility)
      ? el.assetTypeVisibility.map(String)
      : undefined,
    fill: typeof el.fill === "string" ? el.fill : undefined,
    url: typeof el.url === "string" ? el.url : undefined,
  };
}

function parseElements(value: unknown, label: string): ThemeElement[] {
  if (!Array.isArray(value)) {
    throw new Error(`Tema inválido: campo '${label}' deve ser uma lista de elementos.`);
  }
  return value.map((element, index) => parseElement(element, `${label}[${index}]`));
}

function parsePage(raw: unknown, index: number): ThemePage {
  if (!raw || typeof raw !== "object") throw new Error(`Página #${index + 1} inválida.`);
  const page = raw as Record<string, unknown>;
  const context = String(page.context || "").toLowerCase();
  if (!THEME_CONTEXTS.includes(context as ThemeContext)) {
    throw new Error(`Página #${index + 1}: contexto inválido "${context}".`);
  }
  return {
    id: typeof page.id === "string" && page.id ? page.id : `page-${index + 1}`,
    context: context as ThemeContext,
    css: parseCss(page.css),
    elements: parseElements(page.elements, `pages[${index}].elements`),
  };
}

export function parseThemeFromJson(rawJson: string | unknown, regenerateGuid = true): SlideTheme {
  const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Arquivo JSON inválido: conteúdo deve ser um objeto.");
  }
  const candidate = (parsed as { theme?: unknown }).theme ?? parsed;
  const rawTheme = candidate as Record<string, unknown>;
  if (typeof rawTheme.title !== "string" || !rawTheme.title.trim()) {
    throw new Error("Tema inválido: campo 'title' é obrigatório.");
  }

  const hasPages = Array.isArray(rawTheme.pages);
  const pages = hasPages
    ? (rawTheme.pages as unknown[]).map((page, index) => parsePage(page, index))
    : undefined;
  if (hasPages && pages!.length === 0) {
    throw new Error("Tema inválido: deve conter ao menos uma página.");
  }
  if (pages) {
    const seen = new Set<string>();
    for (const page of pages) {
      if (seen.has(page.context)) {
        throw new Error(`Tema inválido: contexto duplicado "${page.context}".`);
      }
      seen.add(page.context);
    }
  }

  const elements = Array.isArray(rawTheme.elements)
    ? parseElements(rawTheme.elements, "elements")
    : [];
  if (!pages && elements.length === 0) {
    throw new Error("Tema inválido: o tema deve conter ao menos um elemento.");
  }

  const now = new Date().toISOString();
  return {
    guid: regenerateGuid
      ? crypto.randomUUID()
      : (typeof rawTheme.guid === "string" && rawTheme.guid ? rawTheme.guid : crypto.randomUUID()),
    title: rawTheme.title.trim(),
    category: typeof rawTheme.category === "string" ? rawTheme.category : "theme",
    css: pages ? {} : parseCss(rawTheme.css),
    elements: pages ? [] : elements,
    pages,
    createdAt: typeof rawTheme.createdAt === "string" ? rawTheme.createdAt : now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Atualizar `themeIo.ts`**

Remova as interfaces `ThemePackage`/`ThemesBackupPackage` e a implementação antiga de `parseThemeFromJson`. Importe e reexporte:

```ts
import { buildThemePackage, buildThemesBackup, parseThemeFromJson } from "./themePackage";
export { parseThemeFromJson } from "./themePackage";
```

Em `exportThemeAsJson`, use `const pkg = buildThemePackage(theme);`. Em `exportThemesBackup`, use `const pkg = buildThemesBackup(themes);`. Mantenha `triggerDownload`, `slugify` e `importThemeFile` como estão.

- [ ] **Step 5: Rodar e confirmar**

Run: `node --test src/features/slide-themes/themePackage.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/slide-themes/themePackage.ts src/features/slide-themes/themePackage.test.ts src/features/slide-themes/themeIo.ts
git commit -m "feat: exporta e importa temas v2 com paginas"
```

---

### Task 5: Resolução pura evento → vínculo → padrão

**Files:**
- Create: `src/features/slide-themes/themeResolution.ts`
- Test: `src/features/slide-themes/themeResolution.test.ts`

**Interfaces:**
- Produces: `resolveLiveTheme(input): SlideTheme | null`, `resolveThemePage(theme, context)`, `contextForSlide(kind, mediaKind?)`.
- Consumes: `materializePage` de `pages.ts`; `ThemeContext` dos tipos.

- [ ] **Step 1: Escrever os testes que falham**

Crie `themeResolution.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { contextForSlide, resolveLiveTheme } from "./themeResolution.ts";
import type { SlideTheme, ThemeBinding } from "@/core/types";

const page = (context: "music" | "bible" | "text", label: string) => ({
  id: `p-${context}`,
  context,
  css: { background: label },
  elements: [],
});
const publicTheme = (guid: string, contexts: ("music" | "bible" | "text")[]): SlideTheme => ({
  guid,
  title: guid,
  category: "theme",
  css: {},
  elements: [],
  pages: contexts.map((context) => page(context, guid)),
});
const v1 = (guid: string, label: string): SlideTheme => ({
  guid,
  title: guid,
  category: "theme",
  css: { background: label },
  elements: [],
});
const binding = (asset: "music" | "bible" | "text", guid: string): ThemeBinding => ({
  target: "public",
  asset,
  themeGuid: guid,
});

test("evento vence vínculo e padrão", () => {
  const event = publicTheme("event", ["music"]);
  const bound = publicTheme("bound", ["music"]);
  const def = publicTheme("default", ["music"]);
  const result = resolveLiveTheme({
    kind: "lyric",
    eventThemeGuid: "event",
    themes: [event, bound, def],
    bindings: [binding("music", "bound")],
    defaultTheme: def,
  });
  assert.equal(result?.pages?.[0].context, "music");
  assert.equal(result?.css.background, "event");
});

test("contexto ausente no evento cai no vínculo e depois no padrão", () => {
  const event = publicTheme("event", ["music"]);
  const bound = publicTheme("bound", ["bible"]);
  const def = publicTheme("default", ["text"]);
  const themes = [event, bound, def];
  const bindings = [binding("bible", "bound")];
  const eventResult = resolveLiveTheme({
    kind: "scripture", eventThemeGuid: "event", themes, bindings, defaultTheme: def,
  });
  assert.equal(eventResult?.css.background, "bound");
  const defaultResult = resolveLiveTheme({
    kind: "custom", eventThemeGuid: "event", themes, bindings, defaultTheme: def,
  });
  assert.equal(defaultResult?.css.background, "default");
});

test("tema v1 é universal", () => {
  const legacy = v1("legacy", "#111");
  const def = publicTheme("default", ["music"]);
  const result = resolveLiveTheme({
    kind: "scripture", eventThemeGuid: "legacy", themes: [legacy, def], bindings: [], defaultTheme: def,
  });
  assert.equal(result?.guid, "legacy");
});

test("apresentação usa layout único e não sofre fallback", () => {
  const presentation: SlideTheme = {
    guid: "pres", title: "Pres", category: "presentation", css: { background: "#abc" }, elements: [],
  };
  const result = resolveLiveTheme({
    kind: "media", mediaThemeId: "pres", themes: [presentation], bindings: [], defaultTheme: null,
  });
  assert.equal(result?.guid, "pres");
});

test("mídia com páginas usa página de texto; imagem e blank não recebem tema", () => {
  const pages = publicTheme("pages", ["text"]);
  const text = resolveLiveTheme({
    kind: "media", mediaKind: "text", mediaThemeId: "pages", themes: [pages], bindings: [], defaultTheme: null,
  });
  assert.equal(text?.css.background, "pages");
  const image = resolveLiveTheme({
    kind: "media", mediaKind: "image", mediaThemeId: "pages", themes: [pages], bindings: [], defaultTheme: null,
  });
  assert.equal(image, null);
  const blank = resolveLiveTheme({
    kind: "blank", themes: [pages], bindings: [], defaultTheme: pages,
  });
  assert.equal(blank, null);
});

test("ignora tema de palco em vínculo público", () => {
  const stage: SlideTheme = { guid: "stage", title: "Stage", category: "stage", css: {}, elements: [] };
  const result = resolveLiveTheme({
    kind: "lyric", themes: [stage], bindings: [binding("music", "stage")], defaultTheme: null,
  });
  assert.equal(result, null);
});

test("mapeia kind para contexto", () => {
  assert.equal(contextForSlide("lyric"), "music");
  assert.equal(contextForSlide("scripture"), "bible");
  assert.equal(contextForSlide("custom"), "text");
  assert.equal(contextForSlide("media", "text"), "text");
  assert.equal(contextForSlide("media", "image"), null);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test src/features/slide-themes/themeResolution.test.ts`
Expected: FAIL com módulo inexistente.

- [ ] **Step 3: Implementar `themeResolution.ts`**

```ts
import type {
  MediaKind,
  OutputTarget,
  SlideKind,
  SlideTheme,
  ThemeBinding,
  ThemeContext,
} from "@/core/types";
import { contextToAsset, materializePage } from "./pages.ts";

export interface ResolveLiveThemeInput {
  kind: SlideKind;
  mediaKind?: MediaKind | null;
  mediaThemeId?: string | null;
  eventThemeGuid?: string | null;
  themes: readonly SlideTheme[];
  bindings: readonly ThemeBinding[];
  target?: OutputTarget;
  defaultTheme?: SlideTheme | null;
}

export function contextForSlide(
  kind: SlideKind,
  mediaKind?: MediaKind | null,
): ThemeContext | null {
  switch (kind) {
    case "lyric":
      return "music";
    case "scripture":
      return "bible";
    case "custom":
      return "text";
    case "media":
      return mediaKind === "text" ? "text" : null;
    case "blank":
      return null;
  }
}

function findByGuid(themes: readonly SlideTheme[], guid: string | null | undefined): SlideTheme | null {
  if (!guid) return null;
  return themes.find((theme) => theme.guid === guid) ?? null;
}

export function resolveThemePage(
  theme: SlideTheme | null | undefined,
  context: ThemeContext,
): SlideTheme | null {
  if (!theme) return null;
  if (!theme.pages?.length) {
    if (theme.category === "stage" || theme.category === "presentation") return null;
    return theme;
  }
  const page = theme.pages.find((candidate) => candidate.context === context);
  return page ? materializePage(theme, page) : null;
}

export function resolveLiveTheme(input: ResolveLiveThemeInput): SlideTheme | null {
  const context = contextForSlide(input.kind, input.mediaKind);

  const mediaTheme = findByGuid(input.themes, input.mediaThemeId);
  if (mediaTheme) {
    if (mediaTheme.category === "presentation" || !mediaTheme.pages?.length) return mediaTheme;
    return context ? resolveThemePage(mediaTheme, context) : null;
  }

  if (!context || input.kind === "media" || input.kind === "blank") return null;

  const eventTheme = findByGuid(input.themes, input.eventThemeGuid);
  const eventResolved = resolveThemePage(eventTheme, context);
  if (eventResolved) return eventResolved;

  const target = input.target ?? "public";
  const asset = contextToAsset(context);
  const binding = input.bindings.find(
    (candidate) => candidate.target === target && candidate.asset === asset,
  );
  const boundTheme = findByGuid(input.themes, binding?.themeGuid);
  const boundResolved = resolveThemePage(boundTheme, context);
  if (boundResolved) return boundResolved;

  return resolveThemePage(input.defaultTheme ?? null, context);
}
```

- [ ] **Step 4: Rodar e confirmar**

Run: `node --test src/features/slide-themes/themeResolution.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/slide-themes/themeResolution.ts src/features/slide-themes/themeResolution.test.ts
git commit -m "feat: resolve tema por contexto com fallback"
```

### Task 6: Seed multi-contexto e store de temas

**Files:**
- Modify: `src/features/slide-themes/seedThemes.ts`
- Modify: `src/features/slide-themes/store.ts`
- Test: `src/features/slide-themes/presentation.test.ts`

**Interfaces:**
- Produces: `DEFAULT_PUBLIC_THEME`, `DEFAULT_PUBLIC_THEME_GUID`; `useSlideThemesStore.eventThemeGuid` e `setEventThemeGuid`; `resolveTheme(target, kind, customThemeId?, mediaKind?)` usando a resolução pura; `resolveStageTheme`/`resolveStageRestTheme` nunca devolvem tema só-com-páginas.

- [ ] **Step 1: Escrever os testes que falham**

Adicione em `src/features/slide-themes/presentation.test.ts`:

```ts
import { DEFAULT_PUBLIC_THEME, DEFAULT_STAGE_THEME } from "./seedThemes.ts";

test("tema público padrão tem uma página para cada contexto", () => {
  assert.equal(DEFAULT_PUBLIC_THEME.category, "theme");
  assert.deepEqual(
    DEFAULT_PUBLIC_THEME.pages?.map((page) => page.context),
    ["music", "bible", "text"],
  );
  assert.equal(DEFAULT_PUBLIC_THEME.elements.length, 0);
});

test("temas de retorno usam a categoria stage", () => {
  assert.equal(DEFAULT_STAGE_THEME.category, "stage");
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test src/features/slide-themes/presentation.test.ts`
Expected: FAIL porque `DEFAULT_PUBLIC_THEME` não existe e a categoria do stage ainda é `"theme"`.

- [ ] **Step 3: Implementar o seed**

Em `seedThemes.ts`, adicione a GUID nova (não reutilize as antigas):

```ts
export const DEFAULT_PUBLIC_THEME_GUID = "5f0c3a2e-9d4b-4e8a-8c1f-2a7b6d9e4c10";
```

Depois das definições de `DEFAULT_MUSIC_THEME`, `DEFAULT_TEXT_THEME` e `DEFAULT_SCRIPTURE_THEME`, adicione:

```ts
function themePage(
  id: string,
  context: "music" | "bible" | "text",
  source: SlideTheme,
) {
  return {
    id,
    context,
    css: { ...source.css },
    elements: structuredClone(source.elements),
  };
}

export const DEFAULT_PUBLIC_THEME: SlideTheme = {
  guid: DEFAULT_PUBLIC_THEME_GUID,
  title: "Tema Padrão",
  category: "theme",
  css: {},
  elements: [],
  pages: [
    themePage("default-music", "music", DEFAULT_MUSIC_THEME),
    themePage("default-bible", "bible", DEFAULT_SCRIPTURE_THEME),
    themePage("default-text", "text", DEFAULT_TEXT_THEME),
  ],
};
```

Troque `category: "theme"` por `category: "stage"` em `DEFAULT_STAGE_THEME` e `DEFAULT_STAGE_REST_THEME`.

- [ ] **Step 4: Implementar o store**

Em `store.ts`, troque os imports antigos de seed por:

```ts
import {
  DEFAULT_PUBLIC_THEME,
  DEFAULT_PUBLIC_THEME_GUID,
  DEFAULT_STAGE_REST_THEME,
  DEFAULT_STAGE_REST_THEME_GUID,
  DEFAULT_STAGE_THEME,
  DEFAULT_STAGE_THEME_GUID,
  createEmptyStudioTheme,
} from "./seedThemes";
import { cloneTheme, isSingleLayout } from "./pages";
import { resolveLiveTheme } from "./themeResolution";
```

Adicione ao estado:

```ts
eventThemeGuid: string | null;
setEventThemeGuid(guid: string | null): void;
```

E mude a assinatura de `resolveTheme`:

```ts
resolveTheme(
  target: OutputTarget,
  kind: SlideKind,
  customThemeId?: string | null,
  mediaKind?: MediaKind | null,
): SlideTheme | null;
```

No objeto inicial, inclua `eventThemeGuid: null`. Substitua `ensureSeeded` por:

```ts
ensureSeeded: async () => {
  let themes: SlideTheme[];
  try {
    themes = await listThemes();
  } catch {
    themes = get().themes;
  }
  const ensure = async (theme: SlideTheme) => {
    if (themes.some((item) => item.guid === theme.guid)) return;
    await saveTheme(theme);
    themes = [...themes, theme];
  };
  await ensure(DEFAULT_PUBLIC_THEME);
  await ensure(DEFAULT_STAGE_THEME);
  await ensure(DEFAULT_STAGE_REST_THEME);
  set({ themes });

  for (const asset of ["lyric", "scripture", "custom"] as SlideKind[]) {
    if (!get().bindings.some((b) => b.target === "public" && b.asset === asset)) {
      get().setBinding("public", asset, DEFAULT_PUBLIC_THEME_GUID);
    }
  }
  if (!get().stageThemeGuid) get().setStageTheme(DEFAULT_STAGE_THEME_GUID);
  if (!get().stageRestThemeGuid) get().setStageRestTheme(DEFAULT_STAGE_REST_THEME_GUID);
},
```

Substitua `duplicate` por:

```ts
duplicate: async (guid) => {
  const existing = get().themes.find((t) => t.guid === guid);
  if (!existing) throw new Error("Tema não encontrado.");
  const cloned = cloneTheme(existing);
  await get().save(cloned);
  return cloned;
},
```

Adicione a action:

```ts
setEventThemeGuid: (guid) => set({ eventThemeGuid: guid }),
```

Substitua `resolveTheme` por:

```ts
resolveTheme: (target, kind, customThemeId, mediaKind) =>
  resolveLiveTheme({
    kind,
    mediaKind,
    mediaThemeId: customThemeId,
    eventThemeGuid: get().eventThemeGuid,
    themes: get().themes,
    bindings: get().bindings,
    target,
    defaultTheme: DEFAULT_PUBLIC_THEME,
  }),
```

Substitua os fallbacks de `resolveStageTheme` e `resolveStageRestTheme` por:

```ts
resolveStageTheme: () => {
  const guid = get().stageThemeGuid ?? DEFAULT_STAGE_THEME_GUID;
  const found = get().themes.find((t) => t.guid === guid);
  if (found && isSingleLayout(found)) return found;
  const fallback =
    get().themes.find((t) => t.category === "stage" && isSingleLayout(t)) ??
    get().themes.find(
      (t) =>
        isSingleLayout(t) &&
        (t.title.toLowerCase().includes("retorno") ||
          t.title.toLowerCase().includes("palco") ||
          t.title.toLowerCase().includes("stage")),
    );
  return fallback ?? DEFAULT_STAGE_THEME;
},
resolveStageRestTheme: () => {
  const guid = get().stageRestThemeGuid ?? DEFAULT_STAGE_REST_THEME_GUID;
  const found = get().themes.find((t) => t.guid === guid);
  if (found && isSingleLayout(found)) return found;
  const fallback = get().themes.find(
    (t) =>
      isSingleLayout(t) &&
      (t.title.toLowerCase().includes("descanso") ||
        t.title.toLowerCase().includes("espera") ||
        t.title.toLowerCase().includes("relógio") ||
        t.title.toLowerCase().includes("relogio")),
  );
  return fallback ?? DEFAULT_STAGE_REST_THEME;
},
```

Importe `MediaKind` nos tipos do store. Não remova as constantes antigas de GUID; elas ainda são usadas por `StudioPage` para reconhecer temas de sistema antigos.

- [ ] **Step 5: Rodar e confirmar**

Run: `node --test src/features/slide-themes/presentation.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/slide-themes/seedThemes.ts src/features/slide-themes/store.ts src/features/slide-themes/presentation.test.ts
git commit -m "feat: tema padrao multi-contexto e resolucao no store"
```

---

### Task 7: Ciclo de vida do evento e ativação do tema

**Files:**
- Modify: `src/features/events-setlists/store.ts:34-46, 60-120, 381-520, 599-730, 793-810`

**Interfaces:**
- Consumes: `useSlideThemesStore.setEventThemeGuid`.
- Produces: `CreateRecurringEventParams.themeGuid?`; `updateEventDetails` aceita `themeGuid`; seleção/troca/exclusão de evento sincroniza o tema; sem eventos, cai na lista temporária.

- [ ] **Step 1: Atualizar tipos e imports**

No topo de `src/features/events-setlists/store.ts`:

```ts
import { useSlideThemesStore } from "@/features/slide-themes/store";
```

Adicione em `CreateRecurringEventParams`:

```ts
themeGuid?: string | null;
```

Em `SetlistState.updateEventDetails`, o tipo de `updates` passa a ser:

```ts
updates: {
  title?: string;
  eventDate?: string;
  wallpaper?: string | null;
  themeGuid?: string | null;
},
```

- [ ] **Step 2: Remover a criação automática de "Culto de Domingo"**

No `load`, apague o bloco `if (events.length === 0) { ... createEventCommand(defaultEvent) ... }` e substitua por:

```ts
if (events.length === 0) {
  set({
    events,
    listMode: "temporary",
    event: temporaryEvent,
    activeEventId: TEMPORARY_EVENT_ID,
    lastSelectedEventId: null,
    dirty: false,
    selectedItemId: null,
    error: null,
  });
  useSlideThemesStore.getState().setEventThemeGuid(null);
  return;
}
```

No branch `if (get().listMode === "temporary")`, adicione `useSlideThemesStore.getState().setEventThemeGuid(null);` antes do `return`.

- [ ] **Step 3: Sincronizar o tema na seleção/troca/exclusão**

Em `selectEvent`, depois do `set({ ... event ... })`:

```ts
useSlideThemesStore.getState().setEventThemeGuid(event?.themeGuid ?? null);
```

Em `switchListMode` no branch `mode === "temporary"`, depois do `set({ listMode: "temporary", ... })`:

```ts
useSlideThemesStore.getState().setEventThemeGuid(null);
```

Em `deleteEvent`, antes de `await get().load();`:

```ts
useSlideThemesStore.getState().setEventThemeGuid(null);
```

- [ ] **Step 4: Incluir o tema na criação e edição**

Em `createRecurringEvents`, no objeto `newEvent`:

```ts
themeGuid: params.themeGuid ?? null,
```

Em `updateEventDetails`, nos dois branches (`current` e `else`), inclua:

```ts
themeGuid:
  updates.themeGuid !== undefined ? updates.themeGuid : current.themeGuid,
```

(no branch `else`, use `ev.themeGuid`). Atualize também o mapeamento de `events` para incluir `themeGuid: updated.themeGuid`. Depois do `set(...)` do branch em que o evento é o ativo, adicione:

```ts
useSlideThemesStore.getState().setEventThemeGuid(updated.themeGuid ?? null);
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck`
Expected: PASS. Confirme com `grep -n "Culto de Domingo" src/features/events-setlists/store.ts` que não sobrou criação automática.

- [ ] **Step 6: Commit**

```bash
git add src/features/events-setlists/store.ts
git commit -m "feat: ativa tema do evento e remove evento padrao automatico"
```

---

### Task 8: Renomear camadas

**Files:**
- Modify: `src/features/theme-editor/LayersPanel.tsx`

**Interfaces:**
- Consumes: `updateElement(id, { name })` do store.
- Produces: nome cosmético persistido em `ThemeElement.name`; `id` continua sendo a chave.

- [ ] **Step 1: Implementar o rename inline**

No topo, importe `useState` e `Input`:

```ts
import { useState } from "react";
import { Input } from "@/components/ui/input";
```

Adicione os seletores:

```ts
const updateElement = useThemeEditorStore((s) => s.updateElement);
const [editingId, setEditingId] = useState<string | null>(null);
const [editName, setEditName] = useState("");
```

Dentro do `map`, antes do `return`:

```ts
const label = el.name?.trim() || el.id;

function commitRename() {
  updateElement(el.id, { name: editName.trim() || undefined });
  setEditingId(null);
}
```

Substitua o `<span>` do nome por:

```tsx
{editingId === el.id ? (
  <Input
    autoFocus
    value={editName}
    aria-label={`Renomear camada ${label}`}
    className="h-6 min-w-0 flex-1 px-1 text-xs"
    onChange={(event) => setEditName(event.target.value)}
    onClick={(event) => event.stopPropagation()}
    onBlur={commitRename}
    onKeyDown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitRename();
      } else if (event.key === "Escape") {
        setEditingId(null);
      }
    }}
  />
) : (
  <span
    className="min-w-0 flex-1 truncate text-xs font-medium"
    title="Duplo clique para renomear"
    onDoubleClick={(event) => {
      event.stopPropagation();
      setEditingId(el.id);
      setEditName(label);
    }}
  >
    {label}
  </span>
)}
```

Troque os `aria-label` que usam `el.id` por `label` (`Selecionar camada`, `Ocultar`, `Mostrar`, `Bloquear`, `Desbloquear`, `Subir`, `Descer`, `Excluir`).

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Manual: abra um tema, duplo clique numa camada, renomeie, salve e reabra; o nome deve persistir.

- [ ] **Step 3: Commit**

```bash
git add src/features/theme-editor/LayersPanel.tsx
git commit -m "feat: permite renomear camadas do tema"
```

### Task 9: Editor com páginas por contexto

**Files:**
- Modify: `src/features/theme-editor/store.ts`
- Modify: `src/features/theme-editor/LayersPanel.tsx`
- Modify: `src/features/theme-editor/PropertiesPanel.tsx`
- Modify: `src/views/ThemeEditorView.tsx`
- Create: `src/features/theme-editor/PagesBar.tsx`

**Interfaces:**
- Produces no store: `activePageId`, `selectPage`, `addPage(context, mode)`, `removePage`, `upgradeToV2(context)`; mutações de CSS/elementos passam a operar na página ativa.
- `PagesBar` lê o store diretamente e não recebe props.

- [ ] **Step 1: Adicionar operações de página ao store do editor**

Em `store.ts`, importe:

```ts
import type { SlideTheme, ThemeContext, ThemeElement, ThemePage } from "@/core/types";
import { cloneTheme, createPage, getActivePage } from "@/features/slide-themes/pages";
```

Adicione à interface:

```ts
activePageId: string | null;
selectPage(pageId: string): void;
addPage(context: ThemeContext, mode: "duplicate" | "blank"): void;
removePage(pageId: string): void;
upgradeToV2(context: ThemeContext): void;
```

Dentro de `create`, antes do `return`, adicione:

```ts
function firstPageId(theme: SlideTheme): string | null {
  return theme.pages?.[0]?.id ?? null;
}

function validPageId(theme: SlideTheme, current: string | null): string | null {
  if (theme.pages?.some((page) => page.id === current)) return current;
  return firstPageId(theme);
}
```

No estado inicial, adicione `activePageId: null`. Em `load`, nos dois branches de sucesso e no branch de tema não encontrado, defina `activePageId: firstPageId(theme)` (ou `null`).

Substitua as mutações por:

```ts
updateCss: (patch) => {
  const { draft, activePageId } = get();
  if (!draft) return;
  const next = clone(draft);
  const page = getActivePage(next, activePageId);
  if (page) page.css = { ...page.css, ...patch };
  else next.css = { ...next.css, ...patch };
  mutate(next);
},

updateElement: (id, patch) => {
  const { draft, activePageId } = get();
  if (!draft) return;
  const next = clone(draft);
  const page = getActivePage(next, activePageId);
  const elements = page ? page.elements : next.elements;
  if (!elements.some((el) => el.id === id)) return;
  const update = (list: ThemeElement[]) =>
    list.map((el) => (el.id === id ? { ...el, ...patch, id: el.id } : el));
  if (page) page.elements = update(page.elements);
  else next.elements = update(next.elements);
  mutate(next);
},

addElement: (el) => {
  const { draft, activePageId } = get();
  if (!draft) return;
  const next = clone(draft);
  const page = getActivePage(next, activePageId);
  if (page) page.elements = [...page.elements, structuredClone(el)];
  else next.elements = [...next.elements, structuredClone(el)];
  mutate(next);
},

removeElement: (id) => {
  const { draft, activePageId } = get();
  if (!draft) return;
  const next = clone(draft);
  const page = getActivePage(next, activePageId);
  const elements = page ? page.elements : next.elements;
  if (!elements.some((el) => el.id === id)) return;
  if (!page && elements.length <= 1) return;
  const remove = (list: ThemeElement[]) => list.filter((el) => el.id !== id);
  if (page) page.elements = remove(page.elements);
  else next.elements = remove(next.elements);
  mutate(next);
},

moveElement: (id, dir) => {
  const { draft, activePageId } = get();
  if (!draft) return;
  const next = clone(draft);
  const page = getActivePage(next, activePageId);
  const list = page ? page.elements : next.elements;
  const index = list.findIndex((el) => el.id === id);
  const target = index + dir;
  if (index < 0 || target < 0 || target >= list.length) return;
  const [moved] = list.splice(index, 1);
  list.splice(target, 0, moved);
  if (page) page.elements = list;
  else next.elements = list;
  mutate(next);
},
```

Em `undo`, `redo` e `revert`, inclua `activePageId` no `set`:

```ts
const previous = past[past.length - 1];
set({
  draft: clone(previous),
  activePageId: validPageId(previous, get().activePageId),
  past: past.slice(0, -1),
  future: [clone(draft), ...future],
});
```

(no `redo`, use `const nextTheme = next;` e `activePageId: validPageId(nextTheme, get().activePageId)`; no `revert`, use `activePageId: firstPageId(restored)`).

Adicione as actions:

```ts
selectPage: (pageId) => {
  const { draft } = get();
  if (!draft?.pages?.some((page) => page.id === pageId)) return;
  set({ activePageId: pageId });
},

addPage: (context, mode) => {
  const { draft, activePageId } = get();
  if (!draft) return;
  if (draft.pages?.some((page) => page.context === context)) return;
  const source = getActivePage(draft, activePageId);
  const page = createPage(draft, context, mode, source);
  const next = clone(draft);
  next.pages = [...(next.pages ?? []), page];
  mutate(next);
  set({ activePageId: page.id });
},

removePage: (pageId) => {
  const { draft } = get();
  if (!draft?.pages || draft.pages.length <= 1) return;
  const index = draft.pages.findIndex((page) => page.id === pageId);
  if (index < 0) return;
  const next = clone(draft);
  next.pages = next.pages!.filter((page) => page.id !== pageId);
  const nextActive =
    next.pages[Math.max(0, index - 1)]?.id ?? next.pages[0].id;
  mutate(next);
  set({ activePageId: nextActive });
},

upgradeToV2: (context) => {
  const { draft } = get();
  if (!draft || draft.pages?.length) return;
  const page: ThemePage = {
    id: crypto.randomUUID(),
    context,
    css: { ...draft.css },
    elements: structuredClone(draft.elements),
  };
  const next = cloneTheme(draft, draft.title);
  next.pages = [page];
  next.css = {};
  next.elements = [];
  mutate(next);
  set({ activePageId: page.id });
},
```

Simplifique o final de `removePage` para `set({ activePageId: nextActive });`. `cloneTheme` regenera o guid; em `upgradeToV2` restaure o guid original para não trocar a identidade do tema:

```ts
const guid = draft.guid;
const next = cloneTheme(draft, draft.title);
next.guid = guid;
```

- [ ] **Step 2: Fazer LayersPanel e PropertiesPanel lerem a página ativa**

Em `LayersPanel.tsx`:

```ts
import { getActivePage } from "@/features/slide-themes/pages";

const draft = useThemeEditorStore((s) => s.draft);
const activePageId = useThemeEditorStore((s) => s.activePageId);
const page = getActivePage(draft, activePageId);
const elements = page?.elements ?? draft?.elements;
const pageMode = Boolean(draft?.pages?.length);
```

Troque `const isLast = elements.length <= 1;` por `const isLast = !pageMode && elements.length <= 1;`.

Em `PropertiesPanel.tsx`:

```ts
import { getActivePage, materializePage } from "@/features/slide-themes/pages";

const draft = useThemeEditorStore((s) => s.draft);
const activePageId = useThemeEditorStore((s) => s.activePageId);
const page = getActivePage(draft, activePageId);
const viewTheme = draft && page ? materializePage(draft, page) : draft;
```

Use `viewTheme` no lugar de `draft` para `selected`, `ThemeBackground` e no `guid` de `ElementMediaSection` continue usando `draft.guid`.

- [ ] **Step 3: Ajustar ThemeEditorView**

Importe:

```ts
import type { SlideTheme, ThemeAsset, ThemeElement } from "@/core/types";
import {
  contextToAsset,
  getActivePage,
  materializePage,
  PAGE_CONTEXTS,
} from "@/features/slide-themes/pages";
import { PagesBar } from "@/features/theme-editor/PagesBar";
```

Adicione fora do componente:

```ts
function viewOf(theme: SlideTheme, activePageId: string | null): SlideTheme {
  const page = getActivePage(theme, activePageId);
  return page ? materializePage(theme, page) : theme;
}
```

Adicione o seletor `const activePageId = useThemeEditorStore((s) => s.activePageId);` e, após o guard de `draft`:

```ts
const currentPage = getActivePage(draft, activePageId);
const viewTheme = currentPage ? materializePage(draft, currentPage) : draft;
const activeAsset = currentPage ? contextToAsset(currentPage.context) : sampleAsset;
const sample = SAMPLES[activeAsset];
```

Adicione:

```ts
useEffect(() => {
  setSelectedId(null);
}, [activePageId]);
```

Nos handlers `handleAdd`, `handleAddSymbol` e `handleAddWidget`, troque `draft.elements` por:

```ts
const current = viewOf(
  draft,
  useThemeEditorStore.getState().activePageId,
);
const ids = current.elements.map((el) => el.id);
```

No `handleAddSymbol`, use `current.elements.find(...)`.

No `handleExport`, use:

```ts
const exportTheme = viewOf(
  draft,
  useThemeEditorStore.getState().activePageId,
);
await exportThemeAsImage(exportTheme, {
  fileName: draft.title ? `apresentacao-${draft.title}` : "apresentacao",
  format,
  width: resolution.width,
  height: resolution.height,
  sampleProps: SAMPLES[activeAsset]?.props ?? {},
});
```

No Canvas:

```tsx
<Canvas
  theme={viewTheme}
  asset={activeAsset}
  props={sample.props}
  ...
/>
```

Troque o seletor de amostra por condicional:

```tsx
{draft.pages?.length ? (
  <span className="mr-1 text-xs text-muted-foreground">
    Página:{" "}
    {PAGE_CONTEXTS.find((info) => info.context === currentPage?.context)?.label ?? "—"}
  </span>
) : (
  <>
    <span className="text-xs text-muted-foreground mr-1">Amostra:</span>
    <Select
      value={sampleAsset}
      onValueChange={(value) => setSampleAsset(value as ThemeAsset)}
    >
      <SelectTrigger size="sm" className="w-32 h-8 text-xs" aria-label="Amostra de conteúdo">
        <SelectValue placeholder="Amostra" />
      </SelectTrigger>
      <SelectContent position="popper">
        {(Object.keys(SAMPLES) as ThemeAsset[]).map((asset) => (
          <SelectItem key={asset} value={asset}>
            {SAMPLES[asset].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </>
)}
```

Adicione `<PagesBar />` dentro de `<main>`, depois da `div` que contém o Canvas.

- [ ] **Step 4: Criar `PagesBar.tsx`**

```tsx
import { useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScaledStage } from "@/features/slide-themes/ScaledStage";
import { SAMPLES } from "@/features/slide-themes/samples";
import {
  getActivePage,
  getPageForContext,
  materializePage,
  PAGE_CONTEXTS,
} from "@/features/slide-themes/pages";
import { cn } from "@/core/lib/utils";
import { useThemeEditorStore } from "./store";

const COLLAPSE_KEY = "open_presenter_theme_pages_collapsed";

export function PagesBar() {
  const theme = useThemeEditorStore((s) => s.draft);
  const activePageId = useThemeEditorStore((s) => s.activePageId);
  const selectPage = useThemeEditorStore((s) => s.selectPage);
  const addPage = useThemeEditorStore((s) => s.addPage);
  const removePage = useThemeEditorStore((s) => s.removePage);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!theme?.pages?.length) return null;

  const current = getActivePage(theme, activePageId);
  const toggle = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  return (
    <div className="shrink-0 border-t border-border bg-card/40">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Páginas
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={collapsed ? "Expandir páginas" : "Recolher páginas"}
          onClick={toggle}
        >
          {collapsed ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>

      {collapsed ? (
        <div className="flex items-center gap-3 px-3 pb-2">
          {PAGE_CONTEXTS.map((info) => {
            const page = getPageForContext(theme, info.context);
            return (
              <span key={info.context} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    page ? "bg-primary" : "border border-muted-foreground/50",
                    page?.id === current?.id && "ring-2 ring-primary/40",
                  )}
                />
                {info.label}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          {PAGE_CONTEXTS.map((info) => {
            const page = getPageForContext(theme, info.context);
            if (!page) {
              return (
                <DropdownMenu key={info.context}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Criar página de ${info.label}`}
                      className="flex h-[86px] w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    >
                      <Plus className="size-4" />
                      <span className="text-[11px]">{info.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      disabled={!current}
                      onSelect={() => addPage(info.context, "duplicate")}
                    >
                      Duplicar página atual
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addPage(info.context, "blank")}>
                      Página em branco
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            const isActive = page.id === current?.id;
            return (
              <div
                key={info.context}
                className={cn(
                  "group relative w-32 shrink-0 rounded-lg border p-1",
                  isActive ? "border-primary bg-primary/5" : "border-border bg-background/60",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 text-left"
                  onClick={() => selectPage(page.id)}
                >
                  <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-black">
                    <ScaledStage
                      theme={materializePage(theme, page)}
                      asset={info.asset}
                      props={SAMPLES[info.asset].props}
                    />
                  </span>
                  <span className="truncate px-0.5 text-[11px] font-medium text-foreground">
                    {info.label}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Opções da página ${info.label}`}
                      className="absolute right-1 top-1 size-5 bg-black/60 text-white opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={theme.pages!.length <= 1}
                      onSelect={() => removePage(page.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Remover página
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck && npm test`
Manual: tema v2 com 3 páginas; alternar páginas muda canvas/propriedades; criar duplicando e em branco; remover página (última bloqueada); colapsar e reabrir (localStorage); exportar PNG da página ativa.

- [ ] **Step 6: Commit**

```bash
git add src/features/theme-editor/store.ts src/features/theme-editor/LayersPanel.tsx src/features/theme-editor/PropertiesPanel.tsx src/features/theme-editor/PagesBar.tsx src/views/ThemeEditorView.tsx
git commit -m "feat: adiciona paginas por contexto ao editor"
```

---

### Task 10: Badge de versão e atualização v1 → v2

**Files:**
- Modify: `src/views/ThemeEditorView.tsx`

**Interfaces:**
- Consumes: `themeVersion(draft)`, `upgradeToV2(context)`.
- Produces: badge `v1`/`v2`/`Layout único` e diálogo "Atualizar para v2".

- [ ] **Step 1: Implementar o badge no cabeçalho**

Importe `Badge`, `themeVersion` e `ThemeContext`/`PAGE_CONTEXTS` (se ainda não estiverem):

```ts
import { Badge } from "@/components/ui/badge";
import { themeVersion } from "@/features/slide-themes/pages";
import type { ThemeContext } from "@/core/types";
```

Adicione os seletores:

```ts
const upgradeToV2 = useThemeEditorStore((s) => s.upgradeToV2);
const [upgradeOpen, setUpgradeOpen] = useState(false);
const [upgradeContext, setUpgradeContext] = useState<ThemeContext>("music");
```

Depois do bloco do título, adicione:

```tsx
{(() => {
  const version = themeVersion(draft);
  const label = version === "v2" ? "v2" : version === "v1" ? "v1" : "Layout único";
  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px]",
          version === "v2" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
          version === "v1" && "border-amber-500/40 bg-amber-500/10 text-amber-500",
        )}
      >
        {label}
      </Badge>
      {version === "v1" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setUpgradeOpen(true)}
        >
          Atualizar para v2
        </Button>
      )}
    </>
  );
})()}
```

Importe `cn` de `@/core/lib/utils` se necessário.

- [ ] **Step 2: Adicionar o diálogo**

Antes do diálogo de renomear, adicione:

```tsx
<Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Atualizar tema para v2</DialogTitle>
    </DialogHeader>
    <div className="flex flex-col gap-3 py-2 text-xs text-muted-foreground">
      <p>
        O layout atual será movido para a página do contexto escolhido. O visual
        não muda e você poderá adicionar as outras páginas depois.
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">Contexto da página</label>
        <Select
          value={upgradeContext}
          onValueChange={(value) => setUpgradeContext(value as ThemeContext)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_CONTEXTS.map((info) => (
              <SelectItem key={info.context} value={info.context}>
                {info.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
        Cancelar
      </Button>
      <Button
        onClick={() => {
          upgradeToV2(upgradeContext);
          setUpgradeOpen(false);
          toast.success("Tema atualizado para v2. Salve para aplicar.");
        }}
      >
        Atualizar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck`
Manual: abra um tema antigo (v1), confirme badge âmbar, atualize escolhendo Música, confirme que o canvas não mudou, salve e reabra (badge verde v2). Abra um tema de palco e confirme "Layout único".

- [ ] **Step 4: Commit**

```bash
git add src/views/ThemeEditorView.tsx
git commit -m "feat: mostra versao do tema e permite atualizar para v2"
```

### Task 11: Galeria de temas por contexto

**Files:**
- Modify: `src/features/preferences/tabs/ThemesTab.tsx`
- Modify: `src/features/preferences/tabs/StageTab.tsx`

**Interfaces:**
- Consumes: `PAGE_CONTEXTS`, `isPublicTheme`, `isSingleLayout`, `previewTheme`, `themeCoverageLabel`, `themeVersion`, `cloneTheme`, `DEFAULT_STAGE_THEME`.
- Produces: criação de tema público v2 com uma página do contexto; "Tema de Retorno (Stage)"; cards com cobertura; picker de vínculo só com temas públicos; picker de palco só com layout único.

- [ ] **Step 1: Atualizar imports e helpers**

Em `ThemesTab.tsx`, importe:

```ts
import { Monitor } from "lucide-react";
import type { ThemeContext } from "@/core/types";
import {
  cloneTheme,
  isPublicTheme,
  isSingleLayout,
  PAGE_CONTEXTS,
  previewTheme,
  themeCoverageLabel,
  themeVersion,
} from "@/features/slide-themes/pages";
import { DEFAULT_STAGE_THEME } from "@/features/slide-themes/seedThemes";
```

Depois de `newBlankTheme`, adicione:

```ts
function newPageTheme(title: string, context: ThemeContext): SlideTheme {
  const kind =
    context === "music" ? "lyric" : context === "bible" ? "scripture" : "text";
  const base = newBlankTheme(title, kind);
  return {
    ...base,
    guid: crypto.randomUUID(),
    category: "theme",
    css: {},
    elements: [],
    pages: [
      {
        id: crypto.randomUUID(),
        context,
        css: { ...base.css },
        elements: base.elements,
      },
    ],
  };
}

function newStageTheme(title: string): SlideTheme {
  const now = new Date().toISOString();
  const theme = structuredClone(DEFAULT_STAGE_THEME);
  return {
    ...theme,
    guid: crypto.randomUUID(),
    title,
    category: "stage",
    createdAt: now,
    updatedAt: now,
  };
}
```

Substitua os filtros:

```ts
const templateThemes = useMemo(() => themes.filter(isPublicTheme), [themes]);
const stageThemes = useMemo(
  () =>
    themes.filter(
      (theme) => theme.category !== "presentation" && isSingleLayout(theme),
    ),
  [themes],
);
```

- [ ] **Step 2: Trocar a criação**

Substitua `handleCreate` por:

```ts
async function handleCreatePublic(context: ThemeContext) {
  setError(null);
  try {
    const info = PAGE_CONTEXTS.find((item) => item.context === context)!;
    const theme = newPageTheme(
      `Novo Tema de ${info.label} ${templateThemes.length + 1}`,
      context,
    );
    await save(theme);
    navigate(`/theme-editor?guid=${theme.guid}`);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Falha ao criar tema");
  }
}

async function handleCreateStage() {
  setError(null);
  try {
    const theme = newStageTheme(`Novo Tema de Retorno ${themes.length + 1}`);
    await save(theme);
    navigate(`/theme-editor?guid=${theme.guid}`);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Falha ao criar tema");
  }
}
```

Troque `handleDuplicate` por:

```ts
async function handleDuplicate(theme: SlideTheme) {
  setError(null);
  try {
    await save(cloneTheme(theme));
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Falha ao duplicar tema");
  }
}
```

No menu "Novo tema", substitua os três itens por:

```tsx
<DropdownMenuItem onClick={() => void handleCreatePublic("music")} className="cursor-pointer gap-2">
  <Music className="size-3.5 text-primary" />
  <span>Tema para Música (Louvor)</span>
</DropdownMenuItem>
<DropdownMenuItem onClick={() => void handleCreatePublic("bible")} className="cursor-pointer gap-2">
  <BookOpen className="size-3.5 text-primary" />
  <span>Tema para Bíblia (Versículos)</span>
</DropdownMenuItem>
<DropdownMenuItem onClick={() => void handleCreatePublic("text")} className="cursor-pointer gap-2">
  <FileText className="size-3.5 text-primary" />
  <span>Tema para Texto (Avisos / Ministração)</span>
</DropdownMenuItem>
<DropdownMenuItem onClick={() => void handleCreateStage()} className="cursor-pointer gap-2">
  <Monitor className="size-3.5 text-primary" />
  <span>Tema de Retorno (Stage)</span>
</DropdownMenuItem>
```

- [ ] **Step 3: Atualizar previews e badges da galeria**

Na célula da grade (perto de `boundTheme`), use:

```tsx
const preview = previewTheme(boundTheme, col.sampleAsset);
```

e:

```tsx
<ScaledStage
  theme={preview.theme}
  asset={preview.asset}
  props={{
    ...SAMPLES[preview.asset].props,
    ...(col.sampleProps || {}),
  }}
/>
```

No card da galeria, antes do `return`:

```ts
const preview = previewTheme(theme, sampleAsset);
```

e no preview:

```tsx
<ScaledStage
  theme={preview.theme}
  asset={preview.asset}
  props={SAMPLES[preview.asset].props}
/>
```

Na linha de badges do card, adicione:

```tsx
{isPublicTheme(theme) && (
  <Badge variant="outline" className="text-[9px]">
    {themeCoverageLabel(theme)}
  </Badge>
)}
{themeVersion(theme) === "v1" && (
  <Badge variant="outline" className="border-amber-500/40 text-[9px] text-amber-500">
    v1
  </Badge>
)}
```

Troque o badge `Retorno` para aparecer quando `theme.category === "stage"` (além do `isStage` atual, se preferir manter).

- [ ] **Step 4: Filtrar o picker e atualizar o palco**

Antes do `return`, defina:

```ts
const pickerThemes = pickerTarget?.type === "stage" ? stageThemes : templateThemes;
```

No diálogo do picker, troque `templateThemes.map` por `pickerThemes.map`, compute `const preview = previewTheme(t, sampleAsset);` e use:

```tsx
<ScaledStage theme={preview.theme} asset={preview.asset} props={SAMPLES[preview.asset].props} />
```

Adicione a cobertura no rodapé do item:

```tsx
<span className="text-[10px] text-muted-foreground">{themeCoverageLabel(t)}</span>
```

Em `StageTab.tsx`, importe `isSingleLayout` e troque o filtro:

```ts
const templateThemes = useMemo(
  () =>
    themes.filter(
      (theme) => theme.category !== "presentation" && isSingleLayout(theme),
    ),
  [themes],
);
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck`
Manual: criar um tema de Música (nasce v2 com 1 página), abrir no editor e adicionar Bíblia/Texto; criar Tema de Retorno; conferir badges de cobertura; vínculo público não lista stage; palco lista apenas layout único.

- [ ] **Step 6: Commit**

```bash
git add src/features/preferences/tabs/ThemesTab.tsx src/features/preferences/tabs/StageTab.tsx
git commit -m "feat: cria temas por contexto e temas de retorno na galeria"
```

---

### Task 12: Previews e seletores de temas nos demais consumidores

**Files:**
- Modify: `src/features/songs/SongSlidesPreview.tsx`
- Modify: `src/features/songs/SongsPage.tsx`
- Modify: `src/features/slide-themes/ThemeRail.tsx`
- Modify: `src/features/studio/StudioPage.tsx`
- Modify: `src/features/events-setlists/StudioPickerDialog.tsx`

**Interfaces:**
- Consumes: `isPublicTheme`, `previewTheme`, `themeElements`, `DEFAULT_PUBLIC_THEME_GUID`.
- Produces: nenhum seletor público oferece tema de palco; cards de tema v2 mostram a página do contexto em vez do layout vazio.

- [ ] **Step 1: SongSlidesPreview e SongsPage**

Em `SongSlidesPreview.tsx`:

```ts
import { isPublicTheme, previewTheme } from "@/features/slide-themes/pages";

const templateThemes = useMemo(
  () => themes.filter(isPublicTheme),
  [themes],
);
const activePreview = useMemo(
  () =>
    activeTheme
      ? previewTheme(activeTheme, effectiveAsset)
      : null,
  [activeTheme, effectiveAsset],
);
```

Use `activePreview` no lugar de `activeTheme` no `ScaledStage`:

```tsx
<ScaledStage
  theme={activePreview.theme}
  asset={activePreview.asset}
  props={slideProps}
  showBackground={true}
/>
```

A condição continua `themePreviewActive && activePreview`.

Em `SongsPage.tsx`:

```ts
import { isPublicTheme, previewTheme } from "@/features/slide-themes/pages";

const templateThemes = useMemo(
  () => themes.filter(isPublicTheme),
  [themes],
);
const activePreview = useMemo(
  () => (activeTheme ? previewTheme(activeTheme, "music") : null),
  [activeTheme],
);
```

Use `themePreviewActive && activePreview` e `theme={activePreview.theme} asset={activePreview.asset}`.

- [ ] **Step 2: ThemeRail**

```ts
import { isPublicTheme, previewTheme } from "./pages";

const templateThemes = useMemo(
  () => themes.filter(isPublicTheme),
  [themes],
);
```

Dentro do `map`:

```ts
const preview = previewTheme(theme, asset);
```

e:

```tsx
<ScaledStage theme={preview.theme} asset={preview.asset} props={sample.props} />
```

- [ ] **Step 3: StudioPage**

Atualize imports:

```ts
import { DEFAULT_PUBLIC_THEME_GUID } from "@/features/slide-themes/seedThemes";
import {
  isPublicTheme,
  previewTheme,
  themeElements,
} from "@/features/slide-themes/pages";
```

Adicione `DEFAULT_PUBLIC_THEME_GUID` ao `SYSTEM_GUIDS`.

Troque a classificação:

```ts
const isPresentation = t.category === "presentation";
const isTemplate = isPublicTheme(t);
if (activeFilter === "presentations" && !isPresentation) return false;
if (activeFilter === "templates" && !isTemplate) return false;
```

No `counts`, use a mesma classificação e conte `templates` com `isPublicTheme`.

Na busca, troque `t.elements.some(...)` por:

```ts
themeElements(t).some((el) => (el.text ?? "").toLowerCase().includes(q))
```

Nos cards (grid e lista), antes do `return` do `map`:

```ts
const preview = previewTheme(theme, "text");
```

Use `preview.theme`/`preview.asset` no `ScaledStage` e troque as contagens `theme.elements.length` por `themeElements(theme).length`.

Em `handleExportCardImage`, use:

```ts
const preview = previewTheme(theme, "text");
await exportThemeAsImage(preview.theme, { ... });
```

- [ ] **Step 4: StudioPickerDialog**

```ts
import { DEFAULT_PUBLIC_THEME_GUID } from "@/features/slide-themes/seedThemes";
```

Adicione a GUID ao `SYSTEM_GUIDS` e troque o filtro:

```ts
return themes.filter(
  (t) =>
    t.category === "presentation" ||
    (t.category !== "stage" &&
      !SYSTEM_GUIDS.has(t.guid) &&
      t.category !== "theme"),
);
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck && npm test`
Manual: abra a prévia de uma música com um tema v2 (deve mostrar a página Música), o trilho de temas, a galeria do Studio e o picker de apresentações (não deve listar temas de palco nem públicos comuns).

- [ ] **Step 6: Commit**

```bash
git add src/features/songs/SongSlidesPreview.tsx src/features/songs/SongsPage.tsx src/features/slide-themes/ThemeRail.tsx src/features/studio/StudioPage.tsx src/features/events-setlists/StudioPickerDialog.tsx
git commit -m "feat: atualiza previews e seletores para temas com paginas"
```

### Task 13: Tema do evento na Agenda

**Files:**
- Create: `src/features/events-setlists/EventThemeSelect.tsx`
- Modify: `src/features/events-setlists/CreateEventDialog.tsx`
- Modify: `src/features/events-setlists/EditEventDialog.tsx`
- Modify: `src/features/events-setlists/EventDetailsDialog.tsx`
- Modify: `src/features/events-setlists/SetlistPanel.tsx`

**Interfaces:**
- Consumes: `isPublicTheme`, `themeCoverageLabel`, `useSlideThemesStore.remove`.
- Produces: seletor "Usar configurações" + temas públicos com páginas; exclusão opcional do tema vinculado, desmarcada por padrão.

- [ ] **Step 1: Criar `EventThemeSelect.tsx`**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPublicTheme, themeCoverageLabel } from "@/features/slide-themes/pages";
import { useSlideThemesStore } from "@/features/slide-themes/store";

const SETTINGS_VALUE = "__settings__";

export function EventThemeSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (guid: string | null) => void;
  disabled?: boolean;
}) {
  const themes = useSlideThemesStore((s) => s.themes);
  const options = themes.filter(
    (theme) => isPublicTheme(theme) && Boolean(theme.pages?.length),
  );

  return (
    <Select
      value={value ?? SETTINGS_VALUE}
      onValueChange={(next) => onChange(next === SETTINGS_VALUE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Usar configurações" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={SETTINGS_VALUE}>Usar configurações</SelectItem>
        {options.map((theme) => (
          <SelectItem key={theme.guid} value={theme.guid}>
            {theme.title} · {themeCoverageLabel(theme)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: CreateEventDialog**

Importe o componente, adicione o estado `const [themeGuid, setThemeGuid] = useState<string | null>(null);`, inclua `themeGuid` no objeto passado a `createRecurringEvents` e adicione o campo depois do título:

```tsx
<div className="flex flex-col gap-1.5">
  <label className="text-xs font-semibold text-foreground">
    Tema do evento (opcional)
  </label>
  <EventThemeSelect value={themeGuid} onChange={setThemeGuid} />
  <p className="text-[11px] text-muted-foreground">
    Vale para os cultos criados nesta série. Contextos ausentes usam o tema das configurações.
  </p>
</div>
```

No efeito que reinicializa o diálogo (quando `open` muda), adicione `setThemeGuid(null)`.

- [ ] **Step 3: EditEventDialog**

Importe o componente e adicione `const [themeGuid, setThemeGuid] = useState<string | null>(null);`. No `getEvent(...).then`, faça `setThemeGuid(ev.themeGuid ?? null);`. No submit de escopo único, inclua `themeGuid` no `updateEventDetails`. Adicione antes do `DialogFooter`:

```tsx
<div className="flex flex-col gap-1.5">
  <label className="text-xs font-semibold text-foreground">Tema do evento</label>
  <EventThemeSelect
    value={themeGuid}
    onChange={setThemeGuid}
    disabled={applyScope === "series"}
  />
  <p className="text-[11px] text-muted-foreground">
    {applyScope === "series"
      ? "O tema é individual por culto; altere-o apenas no escopo deste evento."
      : "Usado quando este evento está selecionado. Contextos ausentes usam as configurações."}
  </p>
</div>
```

- [ ] **Step 4: EventDetailsDialog — seletor**

Importe `EventThemeSelect` e `useSlideThemesStore`. Adicione o handler:

```ts
async function handleThemeChange(themeGuid: string | null) {
  if (!eventSummary) return;
  try {
    await updateEventDetails(eventSummary.id, { themeGuid });
    setFullEvent((prev) => (prev ? { ...prev, themeGuid } : prev));
    toast.success(
      themeGuid
        ? "Tema do evento atualizado!"
        : "Evento usando o tema das configurações.",
    );
  } catch {
    toast.error("Erro ao aplicar tema do evento.");
  }
}
```

Depois do bloco "Data e Horário" e antes do bloco de plano de fundo, adicione:

```tsx
<div className="rounded-xl border border-border/80 bg-card p-4 flex flex-col gap-3">
  <div className="flex items-center gap-2">
    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
      <Palette className="size-4" />
    </div>
    <div>
      <h4 className="text-xs font-semibold text-foreground">Tema do Evento</h4>
      <p className="text-[11px] text-muted-foreground">
        Define a identidade visual da projeção enquanto este culto está selecionado.
      </p>
    </div>
  </div>
  <EventThemeSelect
    value={fullEvent?.themeGuid ?? eventSummary.themeGuid ?? null}
    onChange={(guid) => void handleThemeChange(guid)}
  />
  <p className="text-[11px] text-muted-foreground">
    Contextos sem página neste tema usam o vínculo das configurações.
  </p>
</div>
```

Importe `Palette` de `lucide-react`.

- [ ] **Step 5: EventDetailsDialog — exclusão opcional**

Adicione o estado:

```ts
const [deleteLinkedTheme, setDeleteLinkedTheme] = useState(false);
```

Resete em `useEffect` quando `open`/`eventSummary` mudarem. No `handleDelete`, capture:

```ts
const linkedTheme = fullEvent?.themeGuid ?? eventSummary.themeGuid ?? null;
```

Depois de excluir (single ou série), antes de fechar:

```ts
if (deleteLinkedTheme && linkedTheme) {
  await useSlideThemesStore.getState().remove(linkedTheme);
}
```

No diálogo de exclusão, antes do `DialogFooter`, adicione quando houver tema:

```tsx
{linkedThemeGuid && (
  <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs text-foreground">
    <input
      type="checkbox"
      checked={deleteLinkedTheme}
      onChange={(event) => setDeleteLinkedTheme(event.target.checked)}
      className="size-4 accent-destructive"
    />
    Excluir também o tema vinculado
  </label>
)}
```

Defina `const linkedThemeGuid = fullEvent?.themeGuid ?? eventSummary.themeGuid ?? null;` antes do `return` do componente.

- [ ] **Step 6: SetlistPanel — checkbox na confirmação inline**

Importe `useSlideThemesStore`, adicione `const [deleteLinkedTheme, setDeleteLinkedTheme] = useState(false);` e resete no `useEffect` que já observa `activeEventId`. Troque `handleDelete` por async:

```ts
async function handleDelete() {
  if (event === null) return;
  if (!confirmDelete) {
    setConfirmDelete(true);
    return;
  }
  const linkedTheme = event.themeGuid ?? null;
  setConfirmDelete(false);
  setDeleteLinkedTheme(false);
  await deleteEvent(event.id);
  if (deleteLinkedTheme && linkedTheme) {
    await useSlideThemesStore.getState().remove(linkedTheme);
  }
}
```

Cuidado: capture `deleteLinkedTheme` antes de resetar; use:

```ts
const shouldDeleteTheme = deleteLinkedTheme;
```

Logo antes de `setConfirmDelete(false)`.

Ao lado do botão "Confirmar?", mostre:

```tsx
{confirmDelete && event.themeGuid && (
  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
    <input
      type="checkbox"
      checked={deleteLinkedTheme}
      onChange={(e) => setDeleteLinkedTheme(e.target.checked)}
      className="size-3.5 accent-destructive"
    />
    Excluir tema junto
  </label>
)}
```

- [ ] **Step 7: Verificar**

Run: `npm run typecheck`
Manual: criar evento com tema, abrir detalhes e trocar, selecionar o evento e conferir projeção; excluir evento com checkbox desmarcado (tema permanece) e marcado (tema some); alternar para temporário e conferir fallback.

- [ ] **Step 8: Commit**

```bash
git add src/features/events-setlists/EventThemeSelect.tsx src/features/events-setlists/CreateEventDialog.tsx src/features/events-setlists/EditEventDialog.tsx src/features/events-setlists/EventDetailsDialog.tsx src/features/events-setlists/SetlistPanel.tsx
git commit -m "feat: permite escolher tema do evento e excluir tema junto"
```

---

### Task 14: Publisher e resolução nas saídas locais

**Files:**
- Modify: `src/features/slide-themes/useThemeSync.ts`
- Modify: `src/features/presentation/LivePreview.tsx`
- Modify: `src/views/PublicView.tsx`

**Interfaces:**
- Consumes: `eventThemeGuid` do store e `mediaKind` do slide.
- Produces: `useLiveThemesPublisher` publica a página efetiva; previews e `PublicView` passam o tipo da mídia para `resolveTheme`.

- [ ] **Step 1: Atualizar o publisher**

Em `useThemeSync.ts`, adicione:

```ts
const eventThemeGuid = useSlideThemesStore((s) => s.eventThemeGuid);
const liveMediaKind = usePresentationStore(
  (s) => s.live.content.media?.kind ?? null,
);
```

No efeito:

```ts
const publicTheme = store.resolveTheme(
  "public",
  liveKind,
  liveMediaThemeId,
  liveMediaKind,
);
```

Adicione `eventThemeGuid` e `liveMediaKind` ao array de dependências. O `stageTheme` continua como está.

- [ ] **Step 2: Passar `mediaKind` no LivePreview**

Troque as duas chamadas:

```ts
return s.resolveTheme(
  "public",
  preview.kind,
  preview.media?.themeId,
  preview.media?.kind,
);
```

```ts
return s.resolveTheme(
  "public",
  live.content.kind,
  live.content.media?.themeId,
  live.content.media?.kind,
);
```

- [ ] **Step 3: Passar `mediaKind` no PublicView**

```ts
s.resolveTheme(
  "public",
  live.content.kind,
  mediaThemeId,
  live.content.media?.kind,
),
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm test`
Manual: com um evento ativo cujo tema tem páginas, projetar música, versículo e texto; cada um deve usar a página correta. Projetar uma apresentação do Studio deve manter o design próprio; `blank` e mídia sem `themeId` não devem receber tema.

- [ ] **Step 5: Commit**

```bash
git add src/features/slide-themes/useThemeSync.ts src/features/presentation/LivePreview.tsx src/views/PublicView.tsx
git commit -m "feat: publica pagina efetiva do tema do evento"
```

### Task 15: Atualizar a skill de temas para v2

**Files:**
- Modify: `.agents/skills/open-presenter-theme-creator/references/theme-schema.json`
- Modify: `.agents/skills/open-presenter-theme-creator/scripts/validate-theme.mjs`
- Modify: `.agents/skills/open-presenter-theme-creator/SKILL.md`
- Modify: `.agents/skills/open-presenter-theme-creator/references/prompt-for-other-ais.md`
- Create: `.agents/skills/open-presenter-theme-creator/examples/tema-paginas.openpresenter-theme.json`

**Interfaces:**
- Produces: schema v2, validador que aceita v1 e v2, instruções de páginas/fallback e um exemplo v2.

- [ ] **Step 1: Atualizar o schema**

Em `theme-schema.json`:

```json
"version": { "type": "integer", "const": 2 }
```

Em `SlideTheme`, troque os campos obrigatórios para `["title"]` e adicione `pages`:

```json
"pages": {
  "type": "array",
  "minItems": 1,
  "description": "Páginas por contexto. Presente em temas públicos v2.",
  "items": { "$ref": "#/definitions/ThemePage" }
}
```

Adicione em `ThemeElement.properties`:

```json
"name": {
  "type": "string",
  "description": "Nome cosmético da camada no editor. O id continua sendo a chave."
}
```

Adicione em `definitions`:

```json
"ThemeContext": {
  "type": "string",
  "enum": ["music", "bible", "text"]
},
"ThemePage": {
  "type": "object",
  "required": ["context", "css", "elements"],
  "properties": {
    "id": { "type": "string", "description": "UUID da página; gerado na importação se omitido." },
    "context": { "$ref": "#/definitions/ThemeContext" },
    "css": {
      "type": "object",
      "description": "Fundo e estilos da página.",
      "additionalProperties": { "type": "string" }
    },
    "elements": {
      "type": "array",
      "description": "Camadas da página. Pode ser vazio (página em branco).",
      "items": { "$ref": "#/definitions/ThemeElement" }
    }
  }
}
```

Na descrição de `elements` no `SlideTheme`, deixe claro que é usado por layout único (stage/presentation) e por temas v1; quando `pages` existe, o topo é ignorado.

- [ ] **Step 2: Atualizar o validador**

Substitua `scripts/validate-theme.mjs` por:

```js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Uso: node validate-theme.mjs <caminho-do-arquivo.json>");
  process.exit(1);
}

const allowedTypes = new Set(["TEXT", "IMAGE", "VIDEO", "RECTANGLE"]);
const allowedContexts = new Set(["music", "bible", "text"]);

function validateElements(elements, label, allowEmpty) {
  if (!Array.isArray(elements)) {
    throw new Error(`${label}: 'elements' deve ser uma lista.`);
  }
  if (!allowEmpty && elements.length === 0) {
    throw new Error(`${label}: deve conter pelo menos um elemento.`);
  }
  elements.forEach((el, idx) => {
    if (!el || typeof el !== "object") {
      throw new Error(`${label}: elemento #${idx + 1} inválido.`);
    }
    const type = String(el.type || "").toUpperCase();
    if (!allowedTypes.has(type)) {
      throw new Error(`${label}: elemento #${idx + 1} tem tipo inválido '${type}'.`);
    }
  });
}

try {
  const fullPath = path.resolve(process.cwd(), filePath);
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("O arquivo não contém um objeto JSON válido.");
  }

  const candidate = parsed.theme || parsed;
  const version = Number(parsed.version || candidate.version || 1);

  if (typeof candidate.title !== "string" || !candidate.title.trim()) {
    throw new Error("Campo 'title' ausente ou vazio.");
  }

  let contexts = [];
  if (Array.isArray(candidate.pages)) {
    if (candidate.pages.length === 0) {
      throw new Error("Campo 'pages' deve ter pelo menos uma página.");
    }
    const seen = new Set();
    candidate.pages.forEach((page, idx) => {
      if (!page || typeof page !== "object") {
        throw new Error(`Página #${idx + 1} inválida.`);
      }
      if (!allowedContexts.has(page.context)) {
        throw new Error(`Página #${idx + 1}: contexto inválido '${page.context}'.`);
      }
      if (seen.has(page.context)) {
        throw new Error(`Contexto duplicado '${page.context}'.`);
      }
      seen.add(page.context);
      contexts.push(page.context);
      validateElements(page.elements, `Página #${idx + 1}`, true);
    });
  } else {
    validateElements(candidate.elements, "Tema", false);
  }

  console.log(`✅ Sucesso! O arquivo '${path.basename(filePath)}' é um tema válido do Open Presenter.`);
  console.log(`   - Título: "${candidate.title}"`);
  console.log(`   - Versão: ${version}`);
  console.log(`   - Categoria: ${candidate.category || "theme"}`);
  if (contexts.length) {
    console.log(`   - Contextos (${contexts.length}): ${contexts.join(", ")}`);
  } else {
    console.log(`   - Elementos (${candidate.elements.length}): ${candidate.elements.map((e) => `${e.id} [${e.type}]`).join(", ")}`);
  }
  process.exit(0);
} catch (err) {
  console.error(`❌ Erro ao validar tema: ${err.message}`);
  process.exit(1);
}
```

- [ ] **Step 3: Atualizar `SKILL.md`**

Troque o exemplo de estrutura por v2:

```json
{
  "$schema": "https://openpresenter.dev/schemas/theme-v2.json",
  "format": "open-presenter-theme",
  "version": 2,
  "exportedAt": "2026-10-19T13:30:00.000Z",
  "theme": {
    "title": "Tema da Festividade",
    "category": "theme",
    "pages": [
      { "id": "music", "context": "music", "css": { "background": "#000" }, "elements": [] },
      { "id": "bible", "context": "bible", "css": { "background": "#000" }, "elements": [] }
    ]
  }
}
```

Adicione uma seção após "Quick Overview":

```markdown
## 1.1 Páginas por contexto (v2)

Temas públicos v2 organizam o visual em `pages`, uma por contexto:

- `music` — letra de música (variáveis `{lyrics}`, `{title}`, `{section}`, ...)
- `bible` — escritura (variáveis `{verse}`, `{title}`, ...)
- `text` — avisos, ministração e textos livres (variáveis `{texto}`, `{titulo}`, ...)

Regras:

- Cada página tem `id`, `context`, `css` (inclui o `background`) e `elements`.
- Não pode haver duas páginas com o mesmo contexto.
- Uma página pode ter zero elementos (página em branco).
- O topo do tema pode omitir `css`/`elements` quando `pages` existe.
- O fallback ao vivo é: tema do evento → vínculo das configurações → tema padrão embutido.
- `category: "stage"` (retorno) e `"presentation"` (Studio) continuam em layout único, sem `pages`.
- Tema público v1 (sem `pages`) continua válido e é universal até ser atualizado no editor.
```

Atualize a lista de exemplos com:

```markdown
- [Tema com páginas por contexto](./examples/tema-paginas.openpresenter-theme.json)
```

- [ ] **Step 4: Atualizar o prompt para outras IAs**

Em `prompt-for-other-ais.md`, troque o JSON de exemplo por:

```json
{
  "$schema": "https://openpresenter.dev/schemas/theme-v2.json",
  "format": "open-presenter-theme",
  "version": 2,
  "theme": {
    "title": "Nome do Tema",
    "category": "theme",
    "pages": [
      { "context": "music", "css": { "background": "#000000" }, "elements": [ ... ] },
      { "context": "bible", "css": { "background": "#000000" }, "elements": [ ... ] },
      { "context": "text", "css": { "background": "#000000" }, "elements": [ ... ] }
    ]
  }
}
```

Adicione às regras:

```markdown
7. Para temas públicos, use `pages` com no máximo uma página por contexto (`music`, `bible`, `text`); cada página tem seu próprio `css` e `elements`.
8. Páginas em branco são permitidas; o tema não pode ter contextos duplicados.
9. Para retorno de palco (`stage`) e apresentações (`presentation`), use layout único no topo (`css`/`elements`), sem `pages`.
10. Use `name` nos elementos quando quiser um rótulo legível no editor.
```

- [ ] **Step 5: Adicionar exemplo v2**

Crie `examples/tema-paginas.openpresenter-theme.json`:

```json
{
  "$schema": "https://openpresenter.dev/schemas/theme-v2.json",
  "format": "open-presenter-theme",
  "version": 2,
  "exportedAt": "2026-10-19T13:30:00.000Z",
  "theme": {
    "title": "Festividade com Páginas",
    "category": "theme",
    "pages": [
      {
        "id": "page-music",
        "context": "music",
        "css": { "background": "radial-gradient(circle at 50% 120%, #1e1b4b 0%, #000 70%)" },
        "elements": [
          {
            "id": "letra",
            "name": "Letra",
            "type": "TEXT",
            "x": 8,
            "y": 20,
            "visible": true,
            "locked": false,
            "text": "{lyrics}",
            "css": {
              "top": "20%",
              "left": "8%",
              "width": "84%",
              "height": "62%",
              "textAlign": "center",
              "fontSize": "58px",
              "fontWeight": "700",
              "lineHeight": "1.3",
              "color": "#ffffff",
              "textShadow": "0 3px 16px rgba(0,0,0,0.9)",
              "whiteSpace": "pre-wrap",
              "autoShrink": "true"
            }
          }
        ]
      },
      {
        "id": "page-text",
        "context": "text",
        "css": { "background": "linear-gradient(135deg, #0f172a 0%, #020617 100%)" },
        "elements": [
          {
            "id": "titulo",
            "name": "Título",
            "type": "TEXT",
            "x": 10,
            "y": 8,
            "visible": true,
            "locked": false,
            "text": "{titulo}",
            "css": {
              "top": "8%",
              "left": "10%",
              "width": "80%",
              "textAlign": "center",
              "fontSize": "30px",
              "fontWeight": "700",
              "letterSpacing": "3px",
              "textTransform": "uppercase",
              "color": "#60a5fa"
            }
          },
          {
            "id": "texto",
            "name": "Texto",
            "type": "TEXT",
            "x": 10,
            "y": 26,
            "visible": true,
            "locked": false,
            "text": "{texto}",
            "css": {
              "top": "26%",
              "left": "10%",
              "width": "80%",
              "textAlign": "center",
              "fontSize": "52px",
              "fontWeight": "600",
              "lineHeight": "1.35",
              "color": "#ffffff",
              "autoShrink": "true"
            }
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 6: Validar todos os exemplos**

Run:

```bash
for file in .agents/skills/open-presenter-theme-creator/examples/*.json; do
  node .agents/skills/open-presenter-theme-creator/scripts/validate-theme.mjs "$file" || exit 1
done
```

Expected: todos os v1 e o novo v2 passam.

- [ ] **Step 7: Commit**

```bash
git add .agents/skills/open-presenter-theme-creator
git commit -m "docs: atualiza skill de temas para o formato v2"
```

---

### Task 16: Verificação final

**Files:**
- Nenhum arquivo novo; corrija o que os comandos apontarem.

- [ ] **Step 1: Rodar a suíte completa**

```bash
npm run typecheck
npm test
cargo check -p open-presenter
cargo test -p open-presenter
```

Expected: todos PASS, sem warnings novos de `noUnusedLocals`/`noUnusedParameters`.

- [ ] **Step 2: Verificação manual no app**

Checklist:

- Criar tema público de Música; adicionar páginas de Bíblia e Texto duplicando e em branco.
- Alternar páginas; conferir canvas, propriedades, preview e export PNG.
- Remover página; confirmar que a última não pode ser removida.
- Colapsar a barra e reabrir; estado persiste.
- Renomear camadas e salvar.
- Abrir tema v1 antigo; badge âmbar; "Atualizar para v2" escolhendo contexto; visual preservado.
- Criar evento com tema; selecionar evento; projetar música, versículo e texto; conferir fallback quando falta uma página.
- Excluir evento com checkbox desmarcado (tema permanece) e marcado (tema é removido).
- Apagar todos os eventos; confirmar que o app cai na lista temporária e não cria "Culto de Domingo".
- Exportar tema com 3 páginas, apagar/importar e conferir páginas, fundos, camadas e nomes.
- Importar um JSON v1 e confirmar badge v1.
- Conferir que palco/descanso continuam usando temas próprios e que o Studio continua autocontido.

- [ ] **Step 3: Commit final (se houver correções)**

```bash
git add -A
git commit -m "fix: ajustes finais dos temas por contexto"
```

---

## Self-Review

**1. Cobertura do spec**

- Páginas por contexto, barra fixa, duplicar/em branco, remover, colapsar → Tasks 3, 9.
- Modelo `ThemeContext`/`ThemePage`/`name` → Tasks 1, 9, 15.
- Evento com `themeGuid`, ativação na seleção, sem "Culto de Domingo" → Tasks 2, 7, 13.
- Fallback evento → configurações → padrão → Tasks 5, 6, 14.
- Palco/descanso independentes e categoria `stage` → Tasks 6, 11.
- Apresentações autocontidas → Task 5 (media/presentation) e Task 12.
- Export/import v2 e v1 preservado → Task 4.
- Badge de versão e upgrade → Task 10.
- Galeria com cobertura e criação por contexto → Task 11.
- Preview de temas v2 em todos os consumidores → Task 12.
- Skill v2 → Task 15.
- Exclusão opcional do tema → Task 13.

**2. Tipos e nomes**

- `ThemeContext`, `ThemePage`, `ThemeElement.name`, `SlideTheme.pages`, `ServiceEvent.themeGuid`, `EventSummary.themeGuid`.
- Funções: `resolveLiveTheme`, `resolveThemePage`, `getActivePage`, `materializePage`, `previewTheme`, `themeVersion`, `themeCoverageLabel`, `createPage`, `cloneTheme`, `buildThemePackage`, `buildThemesBackup`, `parseThemeFromJson`.
- Store: `eventThemeGuid`, `setEventThemeGuid`, `activePageId`, `selectPage`, `addPage`, `removePage`, `upgradeToV2`.

**3. Riscos conhecidos**

- O seletor de evento e os vínculos usam `guid`; temas v1 continuam universais por compatibilidade.
- `media` com páginas e `media.kind !== "text"` resolve `null`; apresentações de layout único continuam funcionando.
- O publisher só existe na janela Tauri; em modo web o tema do evento não é sincronizado entre navegadores (limitação documentada).


