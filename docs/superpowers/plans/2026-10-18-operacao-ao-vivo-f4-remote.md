# F4/F5 — Operação ao Vivo: Remote Músicas, Imagens e Infraestrutura · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir operação ao vivo pelo celular/remoto através de abas no topo (Programação, Músicas, Imagens). Músicas permite busca local e LRCLIB, salvar letra aplicando linhas por slide, visualizar seções e apresentar com registro automático no culto do desktop (`remote://imprevisto`). Imagens permite navegar na árvore de imagens da biblioteca e projetar diretamente no telão.

**Architecture:**
- **Backend Rust:**
  - `services/database.rs`: tornar `Db` clonável com `Arc<Mutex<Connection>>` e construtor `Db::new(conn)`.
  - `server/http.rs`: incluir `db: Option<Db>` e `app_handle: Option<AppHandle>` em `ServerState`.
  - `services/slide_builder.rs`: monta slides (`RemoteSlide`) a partir de `Song` mantendo paridade com `buildSongSlides` do TS (rótulos `compute_section_labels` e IDs `{song_id}#{index}`).
  - `services/media_library.rs`: expor `list_images_in_dir(root: &Path)` para ser chamado com o caminho de imagens do servidor.
  - `server/remote.rs`: novos endpoints autenticados:
    - `GET /api/v1/songs?q=` (busca na biblioteca)
    - `GET /api/v1/songs/{id}/slides` (slides montados com slide_builder)
    - `GET /api/v1/lyrics/search?q=` (busca no LRCLIB)
    - `POST /api/v1/lyrics/save` (busca letra, aplica quebra de linhas por slide com base na preferência `songs.lines_per_slide`, salva na biblioteca via `songs::insert_new` e retorna a música salva)
    - `POST /api/v1/present-song` (apresenta slide da música e emite `remote://imprevisto` via `app_handle`)
    - `GET /api/v1/images` (árvore de imagens da biblioteca)
    - `POST /api/v1/present-image` (apresenta imagem validando que está contida em `library/images`)
- **Desktop (Admin):**
  - Adicionar ação `appendImprevistoSong(songId: string)` no store de eventos (`src/features/events-setlists/store.ts`) que anexa a música ao fim da última parte da lista ativa (ou cria parte "Avulsas" se vazia) e salva no SQLite.
  - Escutar evento Tauri `remote://imprevisto` no desktop (`src/App.tsx` ou `AdminView.tsx`) e invocar `appendImprevistoSong`.
- **Remote UI (Mobile):**
  - Em `src/features/remote/`:
    - Componentes dedicados: `RemoteRail.tsx`, `RemoteSongsTab.tsx`, `RemoteImagesTab.tsx`.
    - `RemoteView.tsx`: navegação entre as 3 abas (`programacao`, `musicas`, `imagens`).
    - Cartão Ao Vivo / barra compacta preservada nas abas ou acessível com visual moderno.

**Tech Stack:** Rust (Tauri v2, Axum, rusqlite), React 19, TypeScript, Zustand, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-10-18-operacao-ao-vivo-design.md` (§6.6, §6.7, G6, G7, D10).

**Branch:** `feature/operacao-ao-vivo-f4-remote`.

---

## Tasks

- [ ] Task 1: Backend Rust — `Db` clonável e injeção no `ServerState`
- [ ] Task 2: Backend Rust — `slide_builder.rs` (montagem de slides com paridade TS)
- [ ] Task 3: Backend Rust — `media_library::list_images_in_dir` e endpoints do Remote
- [ ] Task 4: Frontend Desktop — Listener de `remote://imprevisto` e registro automático na lista ativa
- [ ] Task 5: Frontend Remote — Rail de navegação e aba Músicas (busca local, LRCLIB, slides e apresentação)
- [ ] Task 6: Frontend Remote — Aba Imagens (árvore de pastas, miniaturas e projeção direta)
- [ ] Task 7: Verificação completa, testes e merge
