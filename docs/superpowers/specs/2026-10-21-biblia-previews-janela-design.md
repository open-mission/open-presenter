# Design — Grade de livros "tabela periódica", zoom nos previews e janela maximizada

> **Data:** 2026-10-21 · **Branch:** a definir (feature/*) · **Stack:** Tauri v2 (Rust), React 19 + TS, Zustand, Tailwind v4, `node --test`.

## Intent e porquê

A operação de culto exige enviar versículos com muita rapidez, sobretudo durante a pregação. Hoje, para localizar um livro da Bíblia, o operador rola uma lista/cards grandes e perde tempo. O usuário pediu que o modo **grade** dos livros seja uma grelha apertada, estilo "tabela periódica" (modelo Rolibros/Holyrics/Spresenter), mostrando **apenas as abreviações** de todos os livros de uma vez, sem rolagem — para o operador saber "onde cada livro está" e clicar de imediato.

Da mesma forma, os previews de versículos (painel da Bíblia e no setlist) precisam de um **controle de densidade ("zoom")**: diminuir o zoom mostra mais miniaturas por linha (menos scroll), aumentar mostra poucas e grandes (inspeção). Na grade, o preview pode aparecer **com o tema** (como o slide seria projetado) ou **somente texto limpo** (cards sem tema). O zoom só atua na grade/slides — a lista não muda.

Por fim, o app inicia hoje numa janela 1400×900 fixa, que pode abrir "pequena". O usuário quer que ele inicie **maximizado** por padrão, com preferência para desligar, lembrando o tamanho/posição quando a preferência estiver desligada.

## Metas / Não-metas / Anti-metas

**Metas**
- Grade de livros com abreviações, todos visíveis sem rolagem, substituindo o modo "cards" atual.
- Zoom de densidade nos previews de versículo da Bíblia e do setlist, atuando só na grade.
- Modo por preview: grade com tema (atual) ou grade de texto limpo; persistidos.
- App inicia maximizado por padrão; preferência persistida; lembrar geometria ao desligar.
- Persistência de tudo (modos, zoom, preferência) entre sessões.

**Não-metas**
- Não alterar a lista (viewMode `list`) dos painéis.
- Não alterar o LivePreview, Prévia/Ao Vivo/Retorno, zoom do monitor nem o fluxo capítulo→versículo.
- Não é importar/download de textos bíblicos (a Bíblia já está no SQLite local).
- Não é novo tema/estilo visual além dos tiles/grade aqui descritos.

**Anti-metas (falha mesmo funcionando)**
- Grade dos livros que ainda exija scroll para achar um livro.
- Zoom confuso ou que mude a semântica de seleção/apresentação dos versículos.
- Janela que abre maximizada "de qualquer jeito" ignorando que o usuário mexeu nela.

## Estado atual (grounding verificado)

- `src/features/bible/BiblePage.tsx`: `booksView` via `usePersistentViewMode` (`open_presenter_bible_books_view`, `list|cards`); grade atual `grid-cols-2 xl:grid-cols-3` com nome + abreviação + nº de capítulos (`w-80 xl:w-96`). `versesView` via `usePersistentViewMode` (`open_presenter_bible_verses_view`, `list|slides`); grade atual `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. Há `testamentFilter` (all/ot/nt) e `bookFilter` acima da lista de livros.
- `src/features/events-setlists/ScriptureSlidesColumn.tsx`: `viewMode` via `usePersistentViewMode` (`open_presenter_setlist_scripture_view`, `list|slides`); grade `grid-cols-1`. (Painel de versículos do setlist.)
- `src/core/lib/viewMode.ts` / `usePersistentViewMode.ts`: helper de persistência de modos (localStorage + `parseViewMode`). `ViewMode = "list" | "slides" | "cards"`.
- `src/components/ViewModeToggle.tsx`: alternador Lista/Slides usado nos dois painéis.
- `src/components/SlideThumbnail.tsx` + `usePublicThemeResolver`: miniatura 16:9 com tema resolvido (já usada nas grades com tema).
- Janela: `src-tauri/tauri.conf.json` define `main` 1400×900, minWidth 1024, minHeight 640, fullscreen false. Gerenciamento por `WebviewWindowBuilder` em `src-tauri/src/services/display_manager.rs`.
- Preferências: SQLite via `services/settings.rs` (`get_setting`/`set_setting`) + comandos em `commands/preferences.rs` (padrão `app.close_to_tray`), UI em `src/features/preferences/tabs/GeneralTab.tsx`. `BIBLE_BOOKS` / `getBibleBooks` retornam `{ id, name, abbrev, aliases, ... }`; os livros vêm do SQLite com `abbrev`.

## Decisões do usuário (como saíram da conversa)

1. Grade de livros substitui o modo cards (vira **Lista | Tabela**).
2. Zoom atua **somente na grade/slides**; a lista não muda.
3. Previews: **Lista | Slides (tema) | Texto em grade**; o zoom muda a densidade (mais itens ao diminuir, menos/maiores ao aumentar).
4. Setlist: mesma lógica, **padrão 4 por linha**, zoom para os dois lados.
5. Janela: **inicia maximizada** por padrão; preferência persistida; lembrando último tamanho/posição se a preferência estiver desligada.
6. Modos/zoom **lembrados entre sessões** (padrão localStorage já usado).
7. **Modo texto em grade = um card por parte/slide** (verso dividido em partes 1/2, 2/2 → um card por parte, com live/atual por parte, igual o setlist já faz na lista).
8. **Grade de livros = modo padrão** para quem nunca escolheu (e para o valor legado `cards`).
9. Geometria salva **não pode deixar o app inacessível**: se `app.window_rect` não intersectar nenhum monitor visível, abrir **centralizado com 1400×900** (fallback), nunca restaura fora da tela.

## Como vai ser

### Parte A — Grade de livros "tabela periódica" (Lista | Tabela)

- Substituir a opção `cards` por `table` em `booksView` (`open_presenter_bible_books_view` passa a permitir `list|table`; valor legado `cards` cai no **padrão `table`** — preservar no parser para não quebrar quem tem `cards` salvo).
- **`table` é o modo padrão** do painel de livros para quem nunca escolheu (fallback de `usePersistentViewMode` para `open_presenter_bible_books_view`).
- A grade: tiles pequenos e densos, **apenas `abbrev`** (`font-mono`, ~10px), com `title` = nome completo para tooltip. Cor sutil por testamento (âmbar OT / esmeralda NT, como hoje), destaque do ativo com `border-primary`.
- Grade **sem scroll para ~8-10 linhas**: `grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr))` em coluna `w-64` (permanece `w-64`, sem alargar). Com 66 livros → ~8-9 colunas × ~8 linhas de ~28px ⇒ cabe no painel padrão. Manter `overflow-y-auto` como fallback seguro em janelas baixas.
- **Clicar** na abreviação → `selectBook(book.id)` (fluxo atual: capítulo → versículo nos painéis seguintes). Nada de duplo clique/apresentar direto: a grade é entrada rápida de seleção, não projeção.
- Manter filtros OT/NT e busca acima da grade (funcionam igual, filtram os tiles).
- Coluna permanece `w-64` (era `w-80 xl:w-96` só no modo cards); com o `auto-fill` a largura fixa `w-64` é suficiente.

### Parte B — Zoom de densidade na grade (Bíblia e setlist) + modo texto/tema

**Modelo de zoom compartilhado** (`src/core/lib/`): um helper puro tipo `previewGrid.ts` que mapeia um nível de zoom (int) para colunas-alvo, com clamp e valor padrão por painel:
- Bíblia: `zoomLevel` 1..3, padrão 2 (colunas alvo 1–3).
- Setlist: `zoomLevel` 1..5, padrão 4 (colunas alvo 2–6, mínimo 2 para não virar 1 coluna gigante).

Uso:
- Bíblia grade (tema): o atual `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` fixo por breakpoint é trocado por `style={{ gridTemplateColumns: "repeat(auto-fit, minmax(<X>px, 1fr))" }}`, onde `X` deriva do zoom: zoom menor → `X` menor → mais colunas; zoom maior → `X` maior → menos colunas. O `auto-fit`+`minmax` dá o **wrap responsivo** pedido ("se diminuir tela ajusta"): ao encolher a janela, cabem menos colunas e as linhas embrulham sozinhas.
- Setlist grade: idem, com o padrão 4.
- Tiles continuam usando `SlideThumbnail` (tema resolvido) e mantêm seleção/atual/presente/live idênticos.

**Modo texto limpo em grade** (novo viewMode `"text"`):
- `versesView` (Bíblia, `open_presenter_bible_verses_view`) e `viewMode` (setlist, `open_presenter_setlist_scripture_view`) passam a permitir `list|slides|text`.
- `slides` = grade com tema (miniatura 16:9) — hoje.
- `text` = grade de **cards de texto limpos** (sem tema): card com número/parte do versículo, texto limpo, mesmo destaque de seleção/atual/live, e **encaixa texto no card** (sem `SlideThumbnail`).
- **Granularidade do modo `text`: um card por parte/slide** — se o versículo é dividido em partes (`splitLongVerses`), cada parte é um card (espelho de `slides`), com `activePartIndex`/`liveVerseKey` por parte. Assim a contagem de tiles e o indicador de live ficam consistentes entre `slides` e `text`, e o texto de cada card é o texto de um slide (não o versículo inteiro).
- O zoom vale para os dois modos de grade (`slides` e `text`).

**Controle de zoom na UI:** botão de `ZoomIn`/`ZoomOut` (lucide) ao lado do `ViewModeToggle` em cada painel, com `title` "Aumentar/diminuir densidade" e exibição do nível atual opcional. Persistido via `usePersistentViewMode`-like: novo helper `usePersistentNumber(storageKey, fallback, min, max)` em `src/core/lib/` (mesmo padrão de try/catch). Persistir só no disparo (não a cada clique em atalhos de teclado).

### Parte C — Janela maximizada na abertura + lembrar geometria

**Rust (Tauri v2):**
- Nova setting `app.start_maximized` (default `"true"`), no padrão de `app.close_to_tray`:
  - `commands/preferences.rs`: `get_start_maximized` / `set_start_maximized` (IPC) + helper síncrono para uso no setup.
- Em `lib.rs` `.setup`: após carregar a janela `main`, se `start_maximized == true` → `window.maximize()`. Use `WebviewWindow::maximize` + `set_focus`.
- Nova setting `app.window_rect` (opcional, JSON `{x,y,w,h}`):
  - No `on_window_event` para `WindowEvent::Moved`/`Resized` (janela `main`, e **somente quando não maximizada**), gravar a geometria atual com debounce simples (gravar ao `Resized`/`Moved` e também no `CloseRequested`).
  - Em `setup`: se `start_maximized == false`, aplicar `window.set_position` + `window.set_size` a partir de `app.window_rect`.
  - **Validação de monitor visível:** antes de restaurar, conferir se o retângulo intersecta algum monitor de `tauri::Window::available_monitors()`. Se **nenhum** monitor intersectar (monitor removido, resolução mudou, janela foi movida para monitor ausente), **não restaurar**: abrir **centralizado com 1400×900** (fallback) e sobrescrever `app.window_rect` para o novo estado, para nunca deixar o app inacessível.
  - **Escala física:** em Tauri v2, `get_inner_size()`/`outer_position()` já retornam **unidades físicas**, e `set_size`/`set_position` também trabalham em unidades físicas. **Não multiplicar por `scale_factor`** ao salvar/ler (`Size`/`Position` físicos são usados como estão).
- Registrar os 2 comandos novos no `invoke_handler` e expor wrappers tipados em `src/core/ipc/commands.ts` (padrão AGENTS.md).

**Frontend:**
- `GeneralTab.tsx`: switch "Iniciar com a janela maximizada" (default ON), no padrão do switch `closeToTray` existente.
- `StartMaximized` vale para desktop (Tauri); em navegador, ocultar/ignorar (padrão `isTauri()` como em `closeToTray`).

**Nota de plataforma:** em macOS, `maximize()` = zoom verde. Manter `minWidth: 1024/minHeight: 640` do `tauri.conf.json`.

## O que fica para o builder (decisões de implementação)

- Valores exatos de `X` (minmax) por nível de zoom em cada painel (sugestão: Bíblia 1→180px, 2→120px, 3→90px; setlist 2→260px, 3→210px, 4→170px, 5→140px, 6→115px — ajustar com `aspect-ratio` dos tiles).
- Nome exato dos storage keys (sugestão: sufixo `_zoom` ao lado das keys existentes de view mode).
- Debounce da gravação de `app.window_rect` (sugestão: gravar a cada `Moved`/`Resized` quando não maximizado e no close; sem timer extra, pois eventos são raros o suficiente).
- Inclusão de testes para o helper puro `previewGrid.ts` (clamp/mapeamento) e não para componentes.
- `ViewMode` type em `src/core/lib/viewMode.ts`: adicionar `"text"`; `parseViewMode` já tolera arrays, então basta atualizar os `allowed` de cada painel. Valor legado "cards" → fallback `table` (padrão).