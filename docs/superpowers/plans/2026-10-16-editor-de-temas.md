# Editor de Temas V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Janela visual de edição de temas (canvas 16:9 + camadas + propriedades) para configurar fontes, cores, layout, fundo e visibilidade por tipo, salvando no formato `SlideTheme` existente.

**Architecture:** Janela Tauri dedicada `/#/theme-editor?guid=…` (padrão `open_preferences_window`); estado de rascunho + undo em `useThemeEditorStore` (Zustand); mídia de usuário em app-data `theme-media/` servida pelo servidor embutido (`/theme-media/…`, padrão `/thumbnails/`); preview reaproveita `ThemeRenderer` com amostras por asset.

**Tech Stack:** Tauri v2 (Rust: rusqlite, axum, `app_data_dir`), React 19 + TypeScript + Zustand + Tailwind v4 + shadcn/ui, `HashRouter`.

**Spec:** `docs/superpowers/specs/2026-10-16-editor-de-temas-design.md` (leia antes de executar; §7 tem as respostas da revisão técnica, já incorporadas abaixo).

## Global Constraints

- Branch: `feature/editor-de-temas` a partir de `develop`. Nunca commitar na `main`.
- AGENTS.md: `commands/` → `services/` → `state/`; comando IPC novo = declarar em `src-tauri/src/commands/`, registrar no `invoke_handler` **e** expor wrapper tipado em `src/core/ipc/commands.ts`; tipos compartilhados espelhados `src/core/types/index.ts` ⇄ `src-tauri/src/state/types.rs` (SEM mudanças de schema nesta V1); strings pt-BR; Conventional Commits (pt-BR ok).
- Versões pinadas (sem `^`), inclusive deps novas (preferência: zero deps novas; drag/resize nativos com Pointer Events).
- Sem infra de testes no front: verificação front = `npm run typecheck` + `npm run build`; lógica testável vive no Rust (`cargo test` em `src-tauri/`; `npm run build` antes se `dist/` ausente).
- Args de comando Tauri: Rust `snake_case` ⇄ JS `camelCase`. IDs: `crypto.randomUUID()` no front.
- Comandos de banco são síncronos (`pub fn`); mídia usa `app_data_dir()` + sanitização de nome.
- Ruling (correção ao design §2): controle Auto-escala OMITIDO V1 (renderer ignora; prop morta engana). ANIMAÇÃO e TIMER omitidos (sem schema). Toolbar V1: Texto, Cor sólida, Imagem, Vídeo. Web/QR: V2.

## Review Focus

- **Traversal de mídia** (`media://…/…%2e%2e…`): nunca escapa de `theme-media/`; URL resolvida fora da base retorna 404. → teste Rust na Task 2 (`sanitize_rejeita_traversal`, `serve_rejeita_fora_da_base` ou equivalente).
- **Upload hostil** (>20MB ou `.exe`/`.svg`): rejeitado com erro pt-BR, nada escrito em disco. → teste Rust na Task 2.
- **Último elemento excluído**: `save_theme` exige ≥1 elemento; editor desabilita Excluir com 1 elemento restante. → verificação manual na Task 6.
- **`guid` inexistente na URL** (`?guid=desconhecido`): tela de erro amigável com voltar, sem crash. → verificação manual na Task 7.
- **Tema deletado na galeria enquanto aberto no editor**: salvar recria via upsert; badge mostra estado real após save. → verificação manual na Task 7.

---

### Task 1: Janela do editor (Rust + rota)

**Files:**
- Modify: `src-tauri/src/services/display_manager.rs` (append `open_theme_editor_window`)
- Modify: `src-tauri/src/commands/presentation.rs:68-75` (append `open_theme_editor`)
- Modify: `src-tauri/src/lib.rs:120-140` (registrar no `invoke_handler`)
- Modify: `src/core/ipc/commands.ts` (append `openThemeEditor`)
- Modify: `src/App.tsx:9-17` (append `<Route path="/theme-editor" …/>`)
- Create: `src/views/ThemeEditorView.tsx` (placeholder V1: lê `guid` da query, mostra título; corpo vem na Task 7)

**Interfaces:**
- Consumes: padrão `open_preferences_window` (label fixo, `WebviewUrl::App`, focus-se-existe).
- Produces:
  - Rust: `pub fn open_theme_editor_window(app: &AppHandle, guid: Option<String>) -> Result<(), AppError>` — label `"theme-editor"`, título `"Editor de Temas — Open Presenter"`, `inner_size(1280, 800)`, `min_inner_size(1024, 640)`; se janela existe: show+focus e `emit("theme-editor://open", guid)`; senão build com `WebviewUrl::App("/#/theme-editor?guid=<guid|''>")`.
  - IPC `open_theme_editor(guid: Option<String>)`; TS `openThemeEditor(guid?: string): Promise<void>`.

- [ ] **Step 1: Implementar** `open_theme_editor_window` + comando + registro + wrapper + rota + placeholder seguindo exatamente as assinaturas acima.
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && cd src-tauri && cargo check`. Expected: PASS, zero warnings novos.
- [ ] **Step 3: Commit** — `git add src-tauri/src/services/display_manager.rs src-tauri/src/commands/presentation.rs src-tauri/src/lib.rs src/core/ipc/commands.ts src/App.tsx src/views/ThemeEditorView.tsx && git commit -m "feat: adiciona janela do editor de temas"`

### Task 2: Mídia de temas (Rust + HTTP)

**Files:**
- Create: `src-tauri/src/services/theme_media.rs`
- Modify: `src-tauri/src/services/mod.rs` (registrar módulo)
- Modify: `src-tauri/src/commands/themes.rs` (append `save_theme_media`)
- Modify: `src-tauri/src/lib.rs` (registrar no `invoke_handler`)
- Modify: `src-tauri/src/server/http.rs:32-46` (append `.route("/theme-media/*path", get(theme_media_handler))`)
- Modify: `src/core/ipc/commands.ts` (append `saveThemeMedia`)
- Test: `src-tauri/src/services/theme_media.rs` (`#[cfg(test)]`)

**Interfaces:**
- Consumes: `AppHandle` (+ `app.path().app_data_dir()`), `axum::extract::Path`, padrão `save_theme`/`AppError::Storage`.
- Produces:
  - `pub fn sanitize_filename(name: &str) -> Result<String, AppError>` — permite `[A-Za-z0-9._-]`, rejeita vazio, separadores, `..`, tudo o mais; erro pt-BR `"nome de arquivo inválido"`.
  - `pub fn media_dir(app: &AppHandle, guid: &str) -> Result<PathBuf, AppError>` — `<app_data>/theme-media/<guid>` (guid validado como filename); cria com `create_dir_all`.
  - `#[tauri::command] pub fn save_theme_media(app: AppHandle, guid: String, filename: String, contents: Vec<u8>) -> Result<String, AppError>` — valida extensão (`png|jpg|jpeg|webp|mp4`), tamanho ≤ 20MB, escreve arquivo, retorna `"media://<guid>/<sanitized>"`; erros pt-BR.
  - `theme_media_handler`: serve arquivo sob `theme-media/` com `mime_guess`; fora da base ou inexistente → `404`; nunca `..` (comparar `starts_with` após join).
  - TS `saveThemeMedia(guid: string, filename: string, contents: number[]): Promise<string>`.

- [ ] **Step 1: Escrever os testes que falham**

```rust
#[test]
fn sanitize_rejeita_traversal() {
    assert!(sanitize_filename("../x.png").is_err());
    assert!(sanitize_filename("a/b.png").is_err());
    assert!(sanitize_filename("").is_err());
    assert_eq!(sanitize_filename("foto 1.PNG").unwrap(), "foto_1.PNG");
}
```

```rust
#[test]
fn save_recusa_extensao_e_tamanho() {
    // extensão .exe rejeitada; >20MB rejeitado; nada escrito (usar tempdir do SO)
}
```

- [ ] **Step 2: Rodar e ver falhar** — Run: `cd src-tauri && cargo test theme_media`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar** serviço + comando + rota + wrapper mínimos para passar.
- [ ] **Step 4: Rodar e ver passar** — Run: `cd src-tauri && cargo test theme_media && cargo check` e `npm run typecheck` na raiz. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src-tauri/src/services/theme_media.rs src-tauri/src/services/mod.rs src-tauri/src/commands/themes.rs src-tauri/src/lib.rs src-tauri/src/server/http.rs src/core/ipc/commands.ts && git commit -m "feat: adiciona midia de temas com servico http"`

### Task 3: Store do editor (draft + undo)

**Files:**
- Create: `src/features/theme-editor/store.ts`

**Interfaces:**
- Consumes: `SlideTheme`, `ThemeElement` (core/types), `getTheme/saveTheme` (ipc), `structuredClone`.
- Produces: `useThemeEditorStore` com `{ guid, draft: SlideTheme|null, savedJson: string|null, past: SlideTheme[], future: SlideTheme[], error, load(guid), updateCss(patch: Record<string,string>), updateElement(id, patch: Partial<ThemeElement>), addElement(el: ThemeElement), removeElement(id), moveElement(id, dir: 1|-1), toggleVisible(id), toggleLocked(id), setTitle(title), undo(), redo(), canUndo/canRedo, isDirty(), save(), revert() }`.
- Regras: `load` busca via `getTheme` (ausente → `error="Tema não encontrado"`); toda mutação empurra snapshot em `past` (cap 50, limpa `future`); `removeElement` bloqueado se `draft.elements.length <= 1`; `isDirty()` = `JSON.stringify(draft) !== savedJson`; `save` chama `saveTheme` e atualiza `savedJson`.

- [ ] **Step 1: Implementar** `store.ts` com a API e regras acima.
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS.
- [ ] **Step 3: Commit** — `git add src/features/theme-editor/store.ts && git commit -m "feat: adiciona store do editor de temas com undo"`

### Task 4: Amostras compartilhadas + `{·}`

**Files:**
- Create: `src/features/slide-themes/samples.ts` (move `SAMPLES` de `ThemesTab.tsx` + exporta `VARIABLE_KEYS: Record<ThemeAsset, string[]>` com exatamente as chaves de `buildProps`: music `[titulo,artista,letra,nextVerse,secao,currentIndex,totalCount]`, bible `[titulo,verso,livro,capitulo,versiculo,versao,nextVerse]`, text `[titulo,texto,currentIndex,totalCount]`, mais `HH:MM` em todos)
- Modify: `src/features/preferences/tabs/ThemesTab.tsx:30-67,187` (importar de `samples.ts`, remover definição local)

**Interfaces:**
- Consumes: `ThemeAsset`, `buildProps` (só como referência das chaves — sem importar).
- Produces: `SAMPLES`, `VARIABLE_KEYS`, `SAMPLE_ASSETS: ThemeAsset[] = ["music","bible","text"]`.

- [ ] **Step 1: Criar `samples.ts`** e trocar o import na `ThemesTab` (nenhuma mudança visual).
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS; galeria idêntica.
- [ ] **Step 3: Commit** — `git add src/features/slide-themes/samples.ts src/features/preferences/tabs/ThemesTab.tsx && git commit -m "feat: extrai amostras e chaves de variaveis de temas"`

### Task 5: Canvas (seleção, drag, resize, ajudas)

**Files:**
- Create: `src/features/theme-editor/geometry.ts` (`toPct(px, base)`, `toPx(pct, base)`, `LOGICAL_W=1920`, `LOGICAL_H=1080`, `alignToScreen(el, edge: "left|centerX|right|top|middle|bottom", W=1920,H=1080): Partial<ThemeElement>`)
- Create: `src/features/theme-editor/Canvas.tsx` (props `{ theme, asset, props, selectedId, onSelect, onChange(el), showGrid, gridSize, showLimit, snap }`; escala = largura/1920; fundo xadrez; moldura Limite 90%; grid CSS 50px; pointer drag-move com snap; 8 alças de resize; duplo-clique em TEXT foca edição inline via `contentEditable` que commita `text` no blur)

**Interfaces:**
- Consumes: `ThemeRenderer` (preview base — Canvas renderiza `ThemeRenderer` e sobrepõe camada de interação), `SAMPLES`/sample props da Task 4, `geometry.ts`.
- Produces: `Canvas` + `geometry.ts` (Task 6 usa `alignToScreen`, `toPct/toPx`).

- [ ] **Step 1: Implementar** `geometry.ts` + `Canvas.tsx` (drag nativo Pointer Events; `locked`/`visible=false` não interativos; commit no `pointerup` = 1 passo de undo).
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS.
- [ ] **Step 3: Commit** — `git add src/features/theme-editor/geometry.ts src/features/theme-editor/Canvas.tsx && git commit -m "feat: adiciona canvas do editor de temas"`

### Task 6: Camadas + Propriedades

**Files:**
- Create: `src/features/theme-editor/LayersPanel.tsx` (lista: ícone por tipo, nome, olho `toggleVisible`, cadeado `toggleLocked`, excluir (desabilitado se último), subir/descer; clique seleciona)
- Create: `src/features/theme-editor/PropertiesPanel.tsx` (seções: NOME; FUNDO PADRÃO quando nada selecionado — cor + gradiente presets + imagem via `saveThemeMedia` escrevendo `theme.css.background`; LAYOUT X/Y/L/A com toggle px/% + ALINHAR À TELA (usa `alignToScreen`) + SCALE % (só display? NÃO — scale escreve `font-size` proporcional? NÃO: scale V1 = zoom visual do elemento via `css.transform scale()` — hmm, transform quebra layout do renderer? `ThemeRenderer` aplica `css` cru, então `transform: scale()` renderiza igual no telão. OK: escreve `css.transform`; documentar; MARGEM T/R/B/L escreve `css` padding; TEXTO conteúdo + `{·}` (usa `VARIABLE_KEYS`) + Fonte (input+datalist presets) + TAM/PESO/ALT.LIN/ESPAÇ/Cor/H/V/Case/Ajuste; EFEITOS presets Sombra/Contorno/Brilho/Nenhum → `css.textShadow`; PREENCHIMENTO cor sólida → `fill:"solid"` + `background`; APARÊNCIA opacidade slider + borda px; VISIBILIDADE checkboxes dos 6 assetTypes; CSS AVANÇADO lista editável de pares + Nova propriedade)

**Interfaces:**
- Consumes: store Task 3, `VARIABLE_KEYS` Task 4, `alignToScreen` Task 5, `saveThemeMedia` Task 2 (upload imagem fundo/preenchimento).

- [ ] **Step 1: Implementar** `LayersPanel.tsx` + `PropertiesPanel.tsx` (pt-BR; shadcn Input/Select/Slider/Checkbox/Button; sem ANIMAÇÃO/TIMER/Auto-escala; sem Web/QR).
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS. Manual: excluir último elemento bloqueado (Review Focus).
- [ ] **Step 3: Commit** — `git add src/features/theme-editor/LayersPanel.tsx src/features/theme-editor/PropertiesPanel.tsx && git commit -m "feat: adiciona paineis de camadas e propriedades"`

### Task 7: Janela do editor (montagem final)

**Files:**
- Create: `src/features/theme-editor/media.ts` (`resolveThemeMediaUrl(value: string|undefined, host: string): string|undefined` — `media://g/f` → `http://<host>:5050/theme-media/g/f`; resto inalterado)
- Modify: `src/features/slide-themes/ThemeRenderer.tsx:38,60-71` (usar `resolveThemeMediaUrl` com `window.location.hostname` para `src` de IMAGE/VIDEO, `url` de RECTANGLE-web e `background` com `url(` — manter skip atual para `slide`/`nextSlide`/vazio)
- Modify: `src/views/ThemeEditorView.tsx` (compor: topbar título editável + undo/redo + Salvar/Salvo + menu; toolbar add (Texto/Cor/Imagem/Vídeo) + toggles Snap/Limite/Grid com tamanho + seletor de amostra music/bible/text via `SAMPLES`; saída simulada fixa 1920×1080; Canvas + Layers + Properties; guid inválido → erro amigável com voltar)
- Modify: `src/features/preferences/tabs/ThemesTab.tsx` (botão "Editar" por tema: Tauri → `openThemeEditor(guid)`; web → `window.open("/#/theme-editor?guid=")`)
- Modify: `src/features/slide-themes/store.ts` (após `save`/`remove`: se editor aberto? NÃO — editor tem store própria; sem mudanças. Manter `load()` na galeria.)

**Interfaces:**
- Consumes: tudo das Tasks 1–6.

- [ ] **Step 1: Implementar** `media.ts`, wiring da view, botões Editar, `resolveThemeMediaUrl` no renderer.
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && npm run build && cd src-tauri && cargo check`. Expected: PASS. Manual: guid inválido (Review Focus); deletar tema aberto e salvar (Review Focus); editar fonte+fundo e projetar no telão.
- [ ] **Step 3: Commit** — `git add src/features/theme-editor/media.ts src/features/slide-themes/ThemeRenderer.tsx src/views/ThemeEditorView.tsx src/features/preferences/tabs/ThemesTab.tsx && git commit -m "feat: monta janela do editor de temas"`

### Task 8: Trilho de temas (quick-switch)

**Files:**
- Create: `src/features/slide-themes/ThemeRail.tsx`
- Modify: `src/views/AdminView.tsx:32-45` (4ª coluna à direita, após a seção de preview)

**Interfaces:**
- Consumes: `useSlideThemesStore` (`themes/load/setBinding/remove`), `usePresentationStore` (kind ao vivo), `ThemeRenderer`, `SAMPLES` (samples.ts), `kindToAsset`, `openThemeEditor` (commands.ts).
- Produces: `ThemeRail` (sem props; lê tudo das stores).
- Comportamento: miniatura = `ThemeRenderer` com amostra do asset ao vivo (`kindToAsset(live.kind) ?? "music"`); badge "No ar" quando `guid === binding("public", liveKind)`; duplo-clique e item Aplicar = `setBinding("public", liveKind === "blank" ? "lyric" : liveKind, guid)`; menu de contexto próprio (posicionado no cursor; Editar/Aplicar/Remover-com-confirmação-em-dois-cliques; fecha em clique fora/Escape); Editar = Tauri `openThemeEditor(guid)` senão `window.open("/#/theme-editor?guid=")`; colapso com toggle persistido em `open_presenter_theme_rail_open` (default aberto); `load()` no mount; vazio = texto curto.

- [ ] **Step 1: Implementar** `ThemeRail.tsx` + montar no `AdminView` (pt-BR; sem deps novas; sem ANIMAÇÃO/TIMER).
- [ ] **Step 2: Verificar** — Run: `npm run typecheck && npm run build`. Expected: PASS. Manual: duplo-clique troca o telão; botão direito Editar abre o editor; Escape fecha o menu; live blank vincula `lyric`.
- [ ] **Step 3: Commit** — `git add src/features/slide-themes/ThemeRail.tsx src/views/AdminView.tsx && git commit -m "feat: adiciona trilho de temas para troca rapida"`
