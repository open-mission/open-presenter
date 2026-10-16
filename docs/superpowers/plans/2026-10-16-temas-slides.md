# Slide Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Temas de slide estilo Spresenter: JSON `{title, css, elements[]}` com variáveis por tipo de conteúdo, seleção por saída e por tipo (letra/bíblia/texto), renderização no telão (`/public`) e retorno de palco (`/stage`), e camadas mínimas (Fundo/Conteúdo).

**Architecture:** Documentos de tema no SQLite via Rust (`commands/` → `services/` → banco, padrão do repo); motor de template testável no Rust (`cargo test`) com port fiel em TS para as views web (que rodam sem Tauri no `:5050`); um `ThemeRenderer` substitui o layout fixo do `SlideCanvas` quando há tema vinculado, com fallback para o layout atual.

**Tech Stack:** Tauri v2 + rusqlite, React 19 + TypeScript + Zustand + Tailwind v4, `HashRouter` (`/#/public`, `/#/stage`).

**Spec:** Análise REA do Spresenter 0.3.50 em conversa (2026-10-16). Evidências: `ev_fa317e93f4eff6f0670405c258f58feb9dc63da1f9fc1af8ea63eab6ec7df202` (asar completo), `ev_e6a71c15055b856d286f4685d3a76a79947d8be077cd8ded3d772e193e8dadd7` (slide renderer focado); arquivos extraídos em `/tmp` (`spres-extract/slide/static/js/main.b5a2d607.js` funções `Cn/Sn/ot/Vr/Br`, `assets/themes/default-theme-music.json`); runtime `~/Library/Application Support/spresenter/{config.json,assets/<guid>/manifest.json}`. Valores exatos abaixo em "Spec de referência".

## Global Constraints

- Branch: `feature/temas-slides` a partir de `develop`. Nunca commitar na `main`.
- AGENTS.md: `commands/` → `services/` → `state/`; comando IPC novo = declarar em `src-tauri/src/commands/`, registrar no `invoke_handler` **e** expor wrapper tipado em `src/core/ipc/commands.ts`; tipos compartilhados espelhados em `src/core/types/index.ts` ⇄ `src-tauri/src/state/types.rs`; `HashRouter`; Conventional Commits (pt-BR ok).
- Versões pinadas (sem `^`), inclusive deps novas.
- Sem infra de testes no front: verificação front = `npm run typecheck` + `npm run build`; lógica testável vive no Rust (`cargo test`).
- Args de comando Tauri: Rust `snake_case` ⇄ JS `camelCase`.
- IDs: front gera com `crypto.randomUUID()`; Rust via `SELECT lower(hex(randomblob(16)))`.
- Comandos de banco são síncronos (`pub fn`); transações com `conn.unchecked_transaction()`.

## Review Focus

- **Tipo sem tema vinculado** (ex.: bíblia sem binding): deve cair no layout atual do `SlideCanvas`, nunca tela vazia. → Task 5.
- **Variável desconhecida no template** (`{foo}`): apagada, nunca exibida literal. → Task 3 (Rust) + Task 4 (TS port).
- **Chave `__privada` em props**: nunca substituída (proteção de internos). → Task 3.
- **Elemento com `assetTypeVisibility` de outro tipo**: oculto, sem quebrar os demais. → Task 5.
- **Tema de retorno sem `nextUp`**: faixa "PRÓXIMO" some, relógio e atual permanecem. → Task 6.

---

## Spec de referência (valores exatos do Spresenter, adaptar nomes)

Tema = `{title: string, css: Record<string,string> (ex. {background}), elements: ThemeElement[]}`.

`ThemeElement`: `{id, type: "TEXT"|"IMAGE"|"VIDEO"|"RECTANGLE", x, y, visible, locked, css: Record<string,string|number>, text?: string (template), src?: "slide"|"nextSlide", assetTypeVisibility?: ("music"|"bible"|"slidePresentation"|"image"|"video"|"presentation")[], fill?: "solid"|"image"|"video"|"web", url?: string}`. V1 escopo: sem `timeline/keyframes`, sem `timerVisibility`, sem `stagger` (documentar como futuro).

Template `ot(text, props)`: substitui cada `{k}` por `String(props[k])` (exceto chaves que começam com `__`, ignoradas); depois remove com regex qualquer `{...}` restante, exceto relógio (`{HH:MM}`, `{tMM:tSS}`, `{H}`, `{M}` etc. — V1: suportar só `HH:MM` e `tMM:tSS`, resto é apagado pela regra geral).

Props por tipo (`Vr`): mapear `SlideKind` → asset: `lyric→music`, `scripture→bible`, `custom→text` (novo; usa mesmas chaves de `music` menos `cifra/secao`? NÃO — V1 `custom` usa `{titulo, texto, currentIndex, totalCount}`; ver Task 3).
- music/lyric: `titulo, artista, letra (linhas unidas por \n), nextVerse, secao, currentIndex, totalCount`.
- bible/scripture: `titulo, verso (texto), livro, capitulo, versiculo, versao, nextVerse`.
- Retorno global: `HH:MM` (hora atual), `tMM:tSS` (placeholder estático V1, sem timer real).

Seleção: por saída e por tipo — `bindings: [{target: "public"|"stage", asset: "lyric"|"scripture"|"custom", themeGuid}]` + `stageThemeGuid` separado para o tema de retorno (que usa layout próprio, não o binding).

Camadas V1: `Fundo` = `LiveSlide.background` existente; `Conteúdo` = tema. Sem Capa/Anúncios (futuro).

Render `Cn`: `div#theme` absoluto 100% com `theme.css`; para cada elemento visível e com `assetTypeVisibility` contendo o asset atual: posiciona com `position:absolute; top/left/width/height` do `css`, aplica resto do `css` como estilo; `TEXT` injeta `dangerouslySetInnerHTML` do template resolvido com `whiteSpace: pre-line`.

---

### Task 1: Tipos compartilhados Rust ⇄ TS

**Files:**
- Modify: `src-tauri/src/state/types.rs` (append)
- Modify: `src/core/types/index.ts` (append)

**Interfaces:**
- Consumes: `SlideKind` existente (`lyric | scripture | custom | blank`).
- Produces:
  - Rust: `pub enum ThemeElementType { Text, Image, Video, Rectangle }` (serde `SCREAMING_SNAKE_CASE`), `pub struct ThemeElement { id: String, element_type: ThemeElementType (rename "type"), x: f64, y: f64, visible: bool, locked: bool, css: HashMap<String, String>, text: Option<String>, src: Option<String>, asset_type_visibility: Option<Vec<String>> (rename "assetTypeVisibility"), fill: Option<String>, url: Option<String> }`, `pub struct SlideTheme { guid: String, title: String, css: HashMap<String,String>, elements: Vec<ThemeElement> }`, `pub struct ThemeBinding { target: OutputTarget (reuse), asset: String, theme_guid: String (rename "themeGuid") }` — todos `Serialize/Deserialize/Clone/Debug`, `#[serde(default)]` nos `Option` onde fizer falta para JSON antigo.
  - TS: `ThemeElementType = "TEXT"|"IMAGE"|"VIDEO"|"RECTANGLE"`, `ThemeAsset = "music"|"bible"|"text"`, interfaces `ThemeElement`, `SlideTheme {guid,title,css: Record<string,string>,elements}`, `ThemeBinding {target: OutputTarget, asset: SlideKind, themeGuid: string}`, `kindToAsset(kind: SlideKind): ThemeAsset | null` (`lyric→music`, `scripture→bible`, `custom→text`, `blank→null`).

- [ ] **Step 1: Adicionar os tipos no Rust** em `src-tauri/src/state/types.rs` com os serde renames acima.
- [ ] **Step 2: Espelhar os tipos no TS** em `src/core/types/index.ts` + `kindToAsset`.
- [ ] **Step 3: Verificar** — Run: `npm run typecheck` e `cargo check -p open-presenter`. Expected: ambos PASS.
- [ ] **Step 4: Commit** — `git add src-tauri/src/state/types.rs src/core/types/index.ts && git commit -m "feat: adiciona tipos compartilhados de temas de slide"`

### Task 2: Persistência de temas (SQLite + IPC)

**Files:**
- Modify: `src-tauri/src/services/database.rs` (migração v+1: tabela `themes(guid TEXT PRIMARY KEY, title TEXT NOT NULL, definition TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
- Create: `src-tauri/src/services/themes.rs` (`list_themes`, `get_theme`, `save_theme`, `delete_theme`, `seed_default_themes` com os 2 JSONs da Task 7 embutidos? NÃO — seed fica na Task 7; aqui só CRUD)
- Modify: `src-tauri/src/commands/` (novo `themes.rs` + registro no `invoke_handler`)
- Modify: `src/core/ipc/commands.ts` (wrappers `listThemes/getTheme/saveTheme/deleteTheme`)
- Test: `src-tauri/src/services/themes.rs` (`#[cfg(test)]`, usa `open_in_memory()` da Task 1 do plano anterior)

**Interfaces:**
- Consumes: `Db::with_conn`, `SlideTheme` (Task 1), convenção `snake_case⇄camelCase`.
- Produces: `list_themes() -> Vec<SlideTheme>` (ordenado por title), `get_theme(guid) -> Option<SlideTheme>`, `save_theme(theme) -> ()` (upsert por guid, valida `elements` não-vazio e `type` conhecido), `delete_theme(guid) -> ()`; IPC `list_themes/get_theme/save_theme/delete_theme`; TS `listThemes(): Promise<SlideTheme[]>`, etc.

- [ ] **Step 1: Escrever os testes que falham** em `themes.rs`: `save_e_list_roundtrip`, `save_invalido_sem_elementos_erro`, `delete_remove`, `get_inexistente_none`.
- [ ] **Step 2: Rodar e ver falhar** — Run: `cargo test -p open-presenter themes`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar migração + serviço + comandos + wrappers TS** mínimos para passar.
- [ ] **Step 4: Rodar e ver passar** — Run: `cargo test -p open-presenter themes && cargo check -p open-presenter && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src-tauri/src/services/themes.rs src-tauri/src/services/database.rs src-tauri/src/commands/ src/core/ipc/commands.ts && git commit -m "feat: adiciona CRUD de temas de slide"`

### Task 3: Motor de template no Rust (testável)

**Files:**
- Create: `src-tauri/src/services/theme_template.rs`
- Test: mesmo arquivo (`#[cfg(test)]`)

**Interfaces:**
- Consumes: `SlideContent`, `Song`/`sections` (para `nextVerse`), tipos da Task 1.
- Produces: `pub fn render_template(template: &str, props: &HashMap<String,String>) -> String`, `pub fn lyric_props(title, artist, text, next_verse, section, index, total) -> HashMap<...>`, `pub fn scripture_props(title, text, book, chapter, verse, version, next_verse) -> ...`, `pub fn custom_props(title, text, index, total) -> ...` (chaves exatamente as da Spec: `titulo, artista, letra, nextVerse, secao, currentIndex, totalCount, verso, livro, capitulo, versiculo, versao, titulo, texto`).

- [ ] **Step 1: Escrever os testes que falham**: substitui `{letra}`; remove `{desconhecida}`; ignora chave `__x`; `HH:MM` preservado quando em props e removido quando ausente; `custom_props` contém `texto` e não `cifra`.
- [ ] **Step 2: Rodar e ver falhar** — Run: `cargo test -p open-presenter theme_template`. Expected: FAIL.
- [ ] **Step 3: Implementar** `render_template` (split/join por `{k}` + regex de limpeza; relógio via props, sem acesso a relógio do sistema) e os 3 builders.
- [ ] **Step 4: Rodar e ver passar** — Run: `cargo test -p open-presenter theme_template`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src-tauri/src/services/theme_template.rs && git commit -m "feat: adiciona motor de template de temas"`

### Task 4: Store + template TS (port fiel)

**Files:**
- Create: `src/features/slide-themes/themeTemplate.ts` (`renderTemplate`, `buildProps(kind, content, nextUp)`, `kindToAsset` reuse da Task 1)
- Create: `src/features/slide-themes/store.ts` (Zustand: `themes: SlideTheme[]`, `bindings: ThemeBinding[]`, `stageThemeGuid: string|null`, `load()`, `save(theme)`, `remove(guid)`, `setBinding(target, asset, guid)`, `setStageTheme(guid|null)`, `resolveTheme(target, kind): SlideTheme|null`; bindings persistidos em `localStorage "open_presenter_theme_bindings"`)
- Test: verificação = typecheck (sem infra de testes front, convenção do repo).

**Interfaces:**
- Consumes: tipos Task 1, wrappers IPC Task 2, `SlideContent`.
- Produces: `renderTemplate(template: string, props: Record<string,string>): string`, `buildProps(kind, content: SlideContent, nextUp?: SlideContent|null): Record<string,string>`, `useSlideThemesStore` com a API acima.

- [ ] **Step 1: Implementar `themeTemplate.ts`** como port linha-a-linha do Rust (mesmos casos de borda da Task 3).
- [ ] **Step 2: Implementar `store.ts`** com bindings + persistência localStorage + `resolveTheme` (binding exato; sem binding → `null`, nunca throw).
- [ ] **Step 3: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS.
- [ ] **Step 4: Commit** — `git add src/features/slide-themes/themeTemplate.ts src/features/slide-themes/store.ts && git commit -m "feat: adiciona store e template de temas de slide"`

### Task 5: ThemeRenderer + telão

**Files:**
- Create: `src/features/slide-themes/ThemeRenderer.tsx` (props `{theme: SlideTheme, asset: ThemeAsset, props: Record<string,string>}`; `div#theme` + filtros `visible`/`assetTypeVisibility` + `TEXT→p dangerouslySetInnerHTML whiteSpace pre-line`, `IMAGE/VIDEO→img/video src`, `RECTANGLE→div` com `fill`)
- Modify: `src/views/PublicView.tsx` (usa tema resolvido via store quando existir; senão `SlideCanvas` atual — fallback do Review Focus)
- Modify: `src/features/presentation/SlideCanvas.tsx` (extrair bloco de linhas? NÃO — deixar intacto; PublicView escolhe entre os dois)

**Interfaces:**
- Consumes: `useSlideThemesStore.resolveTheme("public", kind)`, `buildProps`, `renderTemplate` (Task 4).
- Produces: `ThemeRenderer` exportado para reuse na Task 6.

- [ ] **Step 1: Implementar `ThemeRenderer.tsx`** (sem timeline/animação; `css` do elemento aplicado inline, `x/y` ignorados se `css` já tem `top/left` — precedência: `css` vence).
- [ ] **Step 2: Ligar na `PublicView.tsx`**: `const theme = resolveTheme("public", live.content.kind)`; se `theme && !live.blackout && !live.cleared` renderiza `ThemeRenderer` sobre `BackgroundRenderer` (Fundo), senão comportamento atual idêntico.
- [ ] **Step 3: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS. Manual: projetar letra com e sem binding; sem binding o telão fica igual a antes.
- [ ] **Step 4: Commit** — `git add src/features/slide-themes/ThemeRenderer.tsx src/views/PublicView.tsx && git commit -m "feat: renderiza temas no telão com fallback"`

### Task 6: Retorno de palco com tema

**Files:**
- Modify: `src/views/StageView.tsx` (quando `stageThemeGuid` setado e slide ativo: layout por tema; senão layout atual idêntico)
- Modify: `src/features/slide-themes/store.ts` (`resolveStageTheme(): SlideTheme|null`)

**Interfaces:**
- Consumes: `ThemeRenderer`, `buildProps` com `asset` do kind atual, `StageClock`/`StageAlerts` existentes (permanecem acima do tema).
- Produces: Stage com tema: `ThemeRenderer(theme=stage, asset, props+{HH:MM agora})`; faixa "PRÓXIMO" some sem `nextUp` (Review Focus); `blackout/cleared` mostram estado como hoje.

- [ ] **Step 1: Implementar `resolveStageTheme` + branch na `StageView.tsx`** (relógio atual entra via props `HH:MM` formatado `toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})`; `tMM:tSS` não suportado V1 — elemento com esse template exibe vazio, sem quebrar).
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS. Manual: com/sem stageTheme, com/sem nextUp.
- [ ] **Step 3: Commit** — `git add src/views/StageView.tsx src/features/slide-themes/store.ts && git commit -m "feat: aplica tema de retorno no palco"`

### Task 7: Galeria/CRUD + seeds + bindings por tipo

**Files:**
- Modify: `src/features/preferences/tabs/ThemesTab.tsx` (reescrever: lista temas do store, preview com sample por asset, criar/duplicar/excluir, seletores de binding por saída×tipo + tema de retorno)
- Create: `src/features/slide-themes/seedThemes.ts` (`DEFAULT_MUSIC_THEME` = JSON `default-theme-music.json` adaptado `{letra}` + css atual; `DEFAULT_STAGE_THEME` simplificado: título `{titulo}`, centro `{letra}`, rodapé `PRÓXIMO {nextVerse}` + `{HH:MM}` — guids fixos gerados uma vez via `crypto.randomUUID()`)
- Modify: `src/features/slide-themes/store.ts` (`ensureSeeded()` chamado na abertura das Preferências: se `listThemes()` vazio, salva os 2 seeds e cria bindings `public/lyric→music`, `stage→stageTheme`)

**Interfaces:**
- Consumes: tudo das Tasks 2–4.
- Produces: UI funcional sem dependência de rede; seeds versionados no código.

- [ ] **Step 1: Criar `seedThemes.ts`** com os 2 temas (elementos mínimos V1, sem timeline).
- [ ] **Step 2: Reescrever `ThemesTab.tsx`** (galeria + CRUD + bindings; textos pt-BR; reaproveitar `Badge/Button/Dialog` shadcn existentes).
- [ ] **Step 3: Verificar** — Run: `npm run typecheck && npm run build && cargo check -p open-presenter`. Expected: PASS. Manual: criar tema, vincular a bíblia, projetar versículo.
- [ ] **Step 4: Commit** — `git add src/features/slide-themes/seedThemes.ts src/features/preferences/tabs/ThemesTab.tsx src/features/slide-themes/store.ts && git commit -m "feat: adiciona galeria e seleção de temas por tipo"`
