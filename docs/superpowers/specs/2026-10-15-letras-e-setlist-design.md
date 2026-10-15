# Design — Letras & Setlist do culto (v1)

- **Data:** 2026-10-15
- **Branch:** `feature/letras-e-setlist`
- **Status:** proposta — aguardando aprovação
- **Referência:** análise REA do Spresenter v0.3.48 (relatório anterior desta conversa)

## 1. Intenção (o porquê)

O operador monta o repertório de letras do culto e projeta no telão, de ponta a ponta, dentro do Open Presenter:

1. **Achar a letra** — busca na biblioteca; se não tem, busca na internet e importa; ou importa a biblioteca do Holyrics em lote.
2. **Organizar a letra** — a letra é feita de blocos (parágrafos), cada bloco com um rótulo de seção (Verso, Refrão, Ponte…) e cor.
3. **Montar o culto** — evento com partes tituladas (Abertura, Louvor, Ofertas…); músicas ordenadas dentro de cada parte. **Só letras entram no setlist.**
4. **Projetar** — verso a verso, com o rótulo da seção visível no telão.

Hoje nada disso é funcional: `songs` e `events-setlists` têm seed em memória e o SQLite tem tabelas criadas mas nenhuma camada de acesso (conexão descartada no `lib.rs`).

## 2. Decisões do dono do produto (validadas no mockup)

- **Menubar shadcn** (`npx shadcn@latest add menubar`) no topo do painel: menu **Arquivo** → **Nova música**, **Importar músicas do Holyrics…**
- **Menu de contexto (shadcn)** nos itens da setlist: **Editar**, **Remover**, **Definir a próxima música** (mostra as músicas do setlist para escolher).
- **Componentes shadcn/ui em todo o painel de controle** — aposentar os componentes artesanais de `src/components/ui` por versões oficiais do shadcn, customizando só o necessário.
- **Organização SOLID**, feature-based, conforme AGENTS.md.

## 3. Decisões do builder (ajustáveis — me diga se alguma incomoda)

| # | Decisão | Racional |
|---|---------|----------|
| D1 | Fonte online = **LRCLIB** (`api/search` + `api/get`, sem chave) | Espelha o fallback do Spresenter; Spotify exigiria credenciais → fora do v1 |
| D2 | Holyrics: **.json e .txt** (`.mufl` não suportado) | Formatos texto/JSON documentados; parser espelha o do Spresenter (§6.2) |
| D3 | **Parte do culto = grupo titulado**; música entra inteira na parte; sem "soltos" | Foi como o usuário descreveu ("partes com títulos", "ordeno as músicas em cada parte") |
| D4 | Setlist **referencia** a música (`songId` + ordem); editar a letra reflete no culto | Evita cópia congelada; confirmado no mockup ("editar depois reflete no culto") |
| D5 | Seções: os 9 tipos do Spresenter; rótulos/cores fixos; numeração só de exibição ("Verso 1") | Familiar ao usuário; sem grupos editáveis no v1 |
| D6 | Sem cifras/comentários/timecodes/sincronia no v1 | Fora do fluxo descrito; entram depois se quiser |
| D7 | Persistência em **SQLite** (Rust): músicas relacionais e pesquisáveis; setlist como documento JSON por evento | Músicas = biblioteca pesquisável (LIKE em título/artista/linha); setlist = documento de operador único (espelha o `.spe` do Spresenter) |
| D8 | Reordenar = botões ↑/↓ (sem lib de drag-and-drop no v1) | Zero dependência nova além do combinado; drag pode vir depois |
| D9 | IDs gerados no front (`crypto.randomUUID()`) | Evita dep `uuid` no Rust; app local de operador único |
| D10 | Busca online mora no **Rust** (`reqwest`/rustls) | Evita depender de CORS do LRCLIB na webview; rede é papel do main (padrão do Spresenter) |
| D11 | Navegação **para no fim da música**; troca é manual (clique no item do setlist ou no botão dedicado da próxima definida — D13); `nextUp` = próximo verso dentro da música | Decisão do dono do produto (confirmada nesta conversa); é o padrão do Spresenter (modo sequencial desligado) e o mais seguro ao vivo |
| D12 | `nextUp` viaja **dentro do `LiveSlide`** (`LiveSlide.nextUp?`, extensão opcional) | A tela de palco recebe por todos os canais existentes (`presentation://slide`, WS) sem canal novo; ver A2 |
| D13 | **Próxima música definida**: campo opcional por item da setlist (`nextItemId`) apontando para outro item do mesmo evento (pode cruzar partes; nunca o próprio item); no fim da música, botão dedicado **"Ir para [próxima]"** — nada automático | Pedido do dono do produto; botão dedicado (escolhido por ele) evita pular de música por clique repetido no Próximo |

## 4. Goals / Non-goals / Anti-goals

**Goals (v1)**
- G1 Biblioteca de letras: listar/buscar (título, artista, trecho), criar/editar/excluir, persistida.
- G2 Letra em blocos com rótulo de seção (nullable) + editor dedicado.
- G3 Importação Holyrics (.json/.txt) com relatório (importadas/puladas/erros) e dedupe por (título, artista).
- G4 Busca online (LRCLIB) + importar para a biblioteca (draft abre no editor).
- G5 Setlist do culto: eventos com partes tituladas e músicas ordenadas; menu de contexto por item (editar, remover, definir próxima); único tipo de entrada = letra.
- G6 Projeção: verso a verso (clique + Anterior/Próximo), telão com título + rótulo da seção; no fim da música, botão **"Ir para a próxima definida"** quando existir; a tela de palco mostra o próximo verso (`LiveSlide.nextUp?` — no fim, o 1º verso da próxima definida).
- G7 Painel todo em shadcn/ui + menubar "Arquivo".
- G8 Estrutura SOLID: comando → serviço → estado no Rust; features verticais no front; tipos espelhados Rust↔TS.

**Non-goals (v1)** — não construir agora: cifras/comentários, timecodes/letra sincronizada, Spotify/plugins, ProPresenter `.pro`, "soltos" no setlist, modo sequencial (atravessar músicas no Próximo), drag-and-drop, undo/redo, exportação/impressão, i18n, automação/MIDI, API pública, histórico de versões.

**Anti-goals** — sucesso não pode custar:
- A1 Congelar cópia da letra dentro do setlist (edição não refletiria no culto).
- A2 Quebrar contratos existentes: `HashRouter`, `core/types` (só extensões compatíveis: `SlideContent.section?` e `LiveSlide.nextUp?`), canal `presentation://slide`, porta 5050.
- A3 God-components: cada componente com responsabilidade única.
- A4 Mexer nas versões pinadas; dependências novas limitadas a: componentes shadcn (+ Radix/tw-animate-css que eles trazem) e `reqwest` no Rust.
- A5 Deixar o SQLite meio-migrado: schema v2 precisa funcionar do zero e sobre o banco v1 (vazio) existente.

## 5. Constraints

- AGENTS.md: feature-based + SOLID; `core/` shared kernel; tipos Rust↔TS sincronizados; comandos IPC registrados com wrapper tipado em `src/core/ipc/commands.ts`; strings pt-BR; Conventional Commits; Gitflow.
- Stack pinada (não atualizar): Tauri 2.12.4, React 19.3.1, TS 5.9, Vite 8, Tailwind 4.3, Zustand 5, lucide-react.
- Sem infra de testes no front → testes de unidade **no Rust** (`cargo test` nos parsers); front validado por `npm run typecheck` + uso.

## 6. Como fica

### 6.1 Modelo de dados (SQLite, schema v2)

Músicas (relacional, pesquisável — substitui o schema v1, que está vazio e não é usado por nenhum código):

```sql
songs(id TEXT PK, title TEXT, artist TEXT, song_key TEXT, created_at TEXT)
song_sections(song_id FK, position INT, section_type TEXT NULL, PK(song_id, position))
song_lyrics(song_id FK, section_position INT, line_position INT, line TEXT,
            PK(song_id, section_position, line_position))
```

`section_type` NULL = "sem rótulo" (importância: imports online não trazem rótulo).

Setlist (documento por evento):

```sql
service_events(id TEXT PK, title TEXT, event_date TEXT, created_at TEXT, setlist_json TEXT NOT NULL)
```

`setlist_json` = `{ "parts": [ { "id": "...", "title": "Louvor", "items": [ { "id": "...", "songId": "...", "nextItemId": null } ] } ] }` — a ordem das músicas é a ordem dos itens; `nextItemId` é o apontador opcional de "próxima música" (pode cruzar partes; nunca aponta para o próprio item); títulos/artistas resolvidos por join com `songs` na leitura; item cujo `songId` não existe mais aparece como "removida".

Tipos de seção (9, iguais aos do Spresenter) com rótulo pt-BR e cor fixa:
`verse` Verso · `pre-chorus` Pré-refrão · `chorus` Refrão · `bridge` Ponte · `intro` Introdução · `outro` Final · `instrumental` Instrumental · `tag` Tag · `ending` Encerramento. (Cores: as do relatório — `#3b82f6`, `#06b6d4`, `#ef4444`, `#a855f7`, `#22c55e`, `#f97316`, `#6b7280`, `#ec4899`, `#eab308`.) Numeração de display ("Verso 1", "Verso 2"; Refrão nunca numera) é calculada, não gravada.

### 6.2 Importação Holyrics (parser Rust, espelho do Spresenter)

- **.json** (backup): array com `title`, `artist`; `lyrics.paragraphs[{description, text}]`; fallback `lyrics.full_text` dividido por `\n{2,}`. `description` → tipo via dicionário pt-BR ("Refrão"→chorus, "Verso 1"→verse…, base sem número).
- **.txt**: músicas separadas por linha de `=` (10+); `Título:` / `Artista:`; marcador `##(Rótulo)` define a seção do parágrafo seguinte; linhas `//...` são comentários e são descartadas; parágrafos separados por linha em branco.
- **Normalização**: BOM, CRLF→LF; trim de espaços à direita por linha.
- **Dedupe**: pula (título, artista) já existentes (case-insensitive, trim).
- **Relatório** para a UI: `{ imported: [títulos], skipped: [{título, motivo}], errors: [{file/entrada, motivo}] }`.

### 6.3 Busca online (LRCLIB, Rust)

- `search_lyrics_online(query)` → `GET https://lrclib.net/api/search?q=` — filtra itens com `plainLyrics`, devolve `{ trackName, artistName, albumName }`.
- `fetch_online_lyrics(track_name, artist_name)` → `GET /api/get` — `plainLyrics.split('\n\n')` vira blocos (tipo NULL); guarda também `syncedLyrics` se vier (persistido? não no v1 — apenas ignorado).
- `User-Agent` do app (exigido pela etiqueta do LRCLIB); erros → mensagem amigável ("sem conexão" / "não encontrada"), nunca derruba a UI.

### 6.4 Camada Rust

```
commands/songs.rs     list_songs | get_song | save_song | delete_song
                      import_holyrics | search_lyrics_online | fetch_online_lyrics
commands/setlists.rs  list_events | get_event | create_event | save_event | delete_event
services/database.rs  conexão gerenciada (Mutex<Connection> em Tauri state) + migrações v1→v2
services/songs.service.rs     CRUD + busca (LIKE) + hidratação de seções/linhas (transações)
services/holyrics.service.rs  parser .json/.txt (+ testes unitários)
services/lrclib.service.rs    cliente HTTP (reqwest/rustls) + mapeamento
services/setlists.service.rs  ler/gravar documento + juntar títulos/artistas p/ exibição
```

- `save_song(song)` = upsert: grava título/artista e **substitui** seções+linhas numa transação.
- `save_event(event)` = documento inteiro (o front é dono da edição; operador único).
- Música excluída que está em setlist: o join da leitura devolve o item como "removida" (a UI mostra o marcador e permite tirar); nada quebra.
- Erros via `AppError` existente; campos compartilhados novos (extensão compatível, espelhados Rust↔TS): `SlideContent.section?: string` e `LiveSlide.nextUp?: SlideContent` — `nextUp` viaja no próprio slide ao vivo, então chega à tela de palco por todos os canais sem canal novo.

### 6.5 Front (features)

- **`features/songs`**: `store.ts` (catálogo, busca, draft do editor), `SongsPanel.tsx` (busca + lista + "Buscar na internet"), `SongEditorDialog.tsx` (título/artista + blocos: textarea por bloco, Select de rótulo, adicionar/remover/↑↓, Salvar), `OnlineLyricsDialog.tsx` (query → resultados → importar).
- **`features/events-setlists`**: `store.ts` (evento ativo + parte/item + dirty + persistência via IPC), `SetlistPanel.tsx` (partes tituladas, itens, picker "adicionar música", renomear/remover/reordenar partes e músicas, "salvar"), **menu de contexto (shadcn `ContextMenu`)** por item: **Editar** (abre o editor da letra da música), **Remover** (tira do setlist, sem diálogo) e **Definir a próxima música** ▸ submenu com os itens do setlist agrupados por parte (+ "Nenhuma" para limpar) — item com próxima definida ganha indicador discreto. `SongRunner.tsx`: blocos da música selecionada, clicar = projetar; Anterior/Próximo navegam **só dentro da música** (no último bloco "Próximo" desabilita); havendo próxima definida, aparece o botão **"Ir para [música]"**, que troca a seleção e projeta o 1º bloco dela; `nextUp` = próximo verso (no fim, o 1º bloco da próxima definida, ou vazio); Limpar.
- **`features/presentation`**: nova ação `publishLive(slide, nextUp?)` no store (aplica local + `publishSlide` IPC); `SlideCanvas` mostra chip "Título · Seção" quando `content.section` existe; `LiveSlide.nextUp?` alimenta a tela de palco em todas as saídas.
- **`components/ui`**: componentes oficiais do shadcn (button, card, badge, input, textarea, select, dialog, menubar, context-menu, dropdown-menu, scroll-area, separator), preservando variantes do projeto (`danger`, `live`) via cva.
- **Menubar** em `AdminView` (painel do operador): **Arquivo ▸ Nova música / Importar músicas do Holyrics…** — escolha de arquivo via `plugin-dialog`, resultado num Dialog (importadas/puladas/erros).
- **`core`**: tipos novos em `core/types` (Song, SongSection, SongLine, ServiceEvent, EventPart, OnlineLyricHit); wrappers em `core/ipc/commands.ts`; rótulos/cores das seções em `core/config/lyrics.ts`.
- Comunicação entre features pelos canais sancionados: `events-setlists` lê o store de `songs` (catálogo) e o store de `presentation` (projeção).

### 6.6 Shadcn (setup)

1. `npx shadcn@latest init` (Tailwind v4) com aliases: `ui` → `@/components/ui`, `utils` → `@/core/lib/utils` (nosso `cn`), `components` → `@/components`; tema dark (zinc) injetado no `index.css`; `class="dark"` no `index.html`.
2. `npx shadcn@latest add menubar context-menu dropdown-menu input textarea select dialog scroll-area separator button card badge`.
3. Substituir os componentes artesanais e ajustar os call-sites; dependências novas pinadas (sem `^`) no `package.json`, conforme AGENTS.md.

### 6.7 Testes / qualidade

- Rust: `cargo test` com fixtures sintéticas de Holyrics (.json e .txt) e do mapeamento LRCLIB; `cargo check` limpo.
- Front: `npm run typecheck`; validação manual do fluxo completo (criar letra → montar culto → projetar → importar).
- Commits atômicos em Conventional Commits; sem tocar `main`.

## 7. O que fica para o builder

- Ordem de implementação (sugestão: schema+tipos → songs CRUD → editor → projeção → setlist → menubar/shadcn → import Holyrics → busca online) e granularidade dos commits.
- Layout fino dos componentes, nomes exatos de comandos/assinaturas, textos de UI.
- Estados vazios/erro, confirmações de exclusão, atalhos de teclado (se sobrar espaço).
- Comportamento de borda: música excluída referenciada por setlist ("removida" na lista, mantendo o resto), `nextItemId` órfão (item-alvo removido — limpar ou ignorar), Editar em item "removida", momento de exibição do botão "Ir para [próxima]", import de arquivo vazio/inválido.
- Fixtures dos testes dos parsers.

## 8. Riscos conhecidos

- Formato real do Holyrics pode variar entre versões — se um arquivo seu falhar, me manda o arquivo que eu ajusto o parser (os testes cobrem o formato documentado).
- LRCLIB depende de rede; sem conexão a busca online fica indisponível (biblioteca local continua 100%).
- `shadcn init` em Vite+Tailwind v4 pode mexer no `index.css`/aliases — conferir o diff antes de integrar.
