# Letras & Setlist — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o fluxo completo de letras do culto: biblioteca pesquisável (criar/editar/excluir), importação do Holyrics, busca online (LRCLIB), setlist em partes com "próxima música" definida e projeção verso a verso no telão/palco — painel em shadcn/ui, persistência SQLite.

**Architecture:** SQLite (Rust): músicas relacionais e pesquisáveis; setlist como documento JSON por evento. Camadas `commands/` → `services/` → banco. Front feature-based (Zustand por feature) espelhando os tipos de `core/types`. A projeção continua num único `LiveSlide` transmitido pelo broadcaster — agora com `nextUp` embutido (`LiveSlide.nextUp?`).

**Tech Stack:** Tauri v2 (Rust: rusqlite, reqwest), React 19 + TypeScript + Zustand + Tailwind v4 + shadcn/ui, API LRCLIB.

**Spec:** `docs/superpowers/specs/2026-10-15-letras-e-setlist-design.md` (leia antes de executar; o plano argue a partir dele)

## Global Constraints

- Branch: `feature/letras-e-setlist` (ativa). Nunca commitar na `main`.
- AGENTS.md: `commands/` → `services/` → `state/`; comando IPC novo = declarar em `src-tauri/src/commands/`, registrar no `invoke_handler` **e** expor wrapper tipado em `src/core/ipc/commands.ts`; tipos compartilhados espelhados em `src/core/types/index.ts` ⇄ `src-tauri/src/state/types.rs`; strings pt-BR; Conventional Commits (pt-BR ok).
- Versões pinadas (sem `^`) — inclusive deps novas do shadcn e `reqwest`.
- Sem infra de testes no front: verificação front = `npm run typecheck` + `npm run build`; lógica testável vive no Rust (`cargo test`).
- Args de comando Tauri: Rust `snake_case` ⇄ JS `camelCase` (ex.: `track_name` ⇄ `trackName`).
- IDs: front gera com `crypto.randomUUID()`; importação gera no Rust via `SELECT lower(hex(randomblob(16)))`.
- Nada é automático na projeção: navegação para no fim da música; troca manual; "próxima definida" só por botão dedicado.
- Comandos de banco são síncronos (`pub fn`) para evitar guard de `Mutex` atravessando `await`; só os de rede são `async`.
- Transações em serviço: usar `conn.unchecked_transaction()` (funciona com `&Connection`).

## Review Focus

- **`nextItemId` órfão** (item-alvo removido do setlist): leitura não pode quebrar e o runner não pode oferecer o botão "Ir para". → teste em Task 7 + verificação na Task 13.
- **Curingas LIKE no termo de busca** (`%`, `_`): devem ser literais, nunca curinga. → teste na Task 3.
- **Importação hostil** (BOM, CRLF, rótulo desconhecido/numerado, música sem título, arquivo inválido): importa o que dá, reporta o resto, nunca derruba. → testes na Task 4 e Task 6.
- **Música excluída ainda referenciada por setlist**: item aparece "removida" e a leitura continua íntegra. → teste na Task 7.
- **LRCLIB irregular** (resultado sem `plainLyrics`, `plainLyrics` com 3+ linhas em branco, 404): filtra/ignora com mensagem amigável. → testes na Task 5.

---

### Task 1: Rust — banco SQLite v2 gerenciado (`Db`) + migração

**Files:**
- Modify: `src-tauri/src/services/database.rs` (reescrever)
- Modify: `src-tauri/src/lib.rs:34-36` (setup do banco)

**Interfaces:**
- Produces:
  - `pub struct Db(pub std::sync::Mutex<rusqlite::Connection>)` com `pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T, AppError>) -> Result<T, AppError>`
  - `pub fn migrate(conn: &Connection) -> Result<(), AppError>` (idempotente, versão alvo = 2)
  - `pub fn open(app: &AppHandle) -> Result<Connection, AppError>` (path + PRAGMA + migrate)
  - `#[cfg(test)] pub(crate) fn open_in_memory() -> Connection` (usada pelos testes das Tasks 3, 6 e 7)
  - `pub const SCHEMA_VERSION: i64 = 2;`

- [ ] **Step 1: Escrever os testes que falham**

Em `src-tauri/src/services/database.rs`, módulo `#[cfg(test)] mod tests`:

```rust
#[test]
fn migrate_cria_schema_v2_e_marca_versao() {
    let conn = open_in_memory();
    let v: i64 = conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0)).unwrap();
    assert_eq!(v, 2);
    let tabelas: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .unwrap()
        .query_map([], |r| r.get(0)).unwrap().collect::<Result<_, _>>().unwrap();
    for esperada in ["songs", "song_sections", "song_lyrics", "service_events"] {
        assert!(tabelas.contains(&esperada.to_string()), "faltou {esperada}");
    }
}

#[test]
fn migrate_e_idempotente() {
    let conn = open_in_memory();
    migrate(&conn).unwrap();
    migrate(&conn).unwrap();
    let v: i64 = conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0)).unwrap();
    assert_eq!(v, 2);
}

#[test]
fn migrate_descarta_schema_v1_vazio() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("CREATE TABLE songs (id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL DEFAULT '', song_key TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
        CREATE TABLE song_lyrics (song_id TEXT NOT NULL, position INTEGER NOT NULL, line TEXT NOT NULL, PRIMARY KEY (song_id, position));
        CREATE TABLE setlist_items (event_id TEXT NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL, slide_json TEXT NOT NULL, PRIMARY KEY (event_id, position));").unwrap();
    migrate(&conn).unwrap();
    let n: i64 = conn.query_row("SELECT count(*) FROM songs", [], |r| r.get(0)).unwrap();
    assert_eq!(n, 0);
    let tem_secoes: bool = conn.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='song_sections'", [], |r| r.get::<_, i64>(0)).unwrap() == 1;
    assert!(tem_secoes);
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --manifest-path src-tauri/Cargo.toml database::`
Expected: FAIL (`open_in_memory`/`migrate` não existem)

- [ ] **Step 3: Implementar**

- `SCHEMA_V2` (substitui o `SCHEMA` atual):
  - `schema_version (version INTEGER NOT NULL)`
  - `songs` (igual à v1)
  - `song_sections (song_id + position PK, section_type TEXT NULL, FK songs ON DELETE CASCADE)`
  - `song_lyrics (song_id, section_position, line_position PK composta, line TEXT NOT NULL, FK CASCADE)`
  - `service_events (id PK, title, event_date, created_at default, setlist_json TEXT NOT NULL DEFAULT '{"parts":[]}')`
- `migrate`: `PRAGMA foreign_keys = ON`; cria `schema_version` se faltar; lê versão (default 0); se `v < 2`: `DROP TABLE IF EXISTS` em `setlist_items`, `song_lyrics`, `song_sections`, `service_events`, `songs`; executa `SCHEMA_V2`; grava versão 2 (DELETE + INSERT, uma linha).
- `open`: `db_path` (como hoje) + `Connection::open` + `migrate`.
- `Db::with_conn`: lock do `Mutex`, map de erro para `AppError::Storage("banco indisponível".into())`, chama `f`.
- `lib.rs`: trocar o bloco do `init_database` por: `let conn = database::open(&handle).or_else(|err| { tracing::warn!(...); Connection::open_in_memory() })? com migrate` — ou seja, em falha abre em memória e migra (app continua sem persistência); `app.manage(database::Db(std::sync::Mutex::new(conn)))`.

- [ ] **Step 4: Rodar os testes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml database::` → PASS
Run: `cargo check --manifest-path src-tauri/Cargo.toml` → sem erros

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/database.rs src-tauri/src/lib.rs
git commit -m "feat(db): schema v2 de letras e setlist com conexão gerenciada"
```

---

### Task 2: Tipos compartilhados (Rust ⇄ TS) + config de seções

**Files:**
- Modify: `src-tauri/src/state/types.rs`
- Modify: `src-tauri/src/state/mod.rs` (reexportar novos tipos)
- Modify: `src/core/types/index.ts`
- Create: `src/core/config/lyrics.ts`
- Create: `src/core/lib/lyrics.ts`

**Interfaces:**
- Produces (Rust):
  - `pub enum SectionType { Verse, PreChorus, Chorus, Bridge, Intro, Outro, Instrumental, Tag, Ending }` com `#[serde(rename_all = "kebab-case")]`, `Copy`, `PartialEq`, `Eq`, `Hash`, e métodos `pub fn from_label(label: &str) -> Option<Self>` (dicionário pt-BR, sem sufixo numérico) e `pub fn as_str(self) -> &'static str`
  - `pub struct SongSection { pub section_type: Option<SectionType>, pub lines: Vec<String> }` (`#[serde(rename_all = "camelCase")]`, `PartialEq`)
  - `pub struct Song { pub id, pub title, pub artist: String, pub sections: Vec<SongSection> }` (`PartialEq`)
  - `pub struct SongSummary { pub id, pub title, pub artist: String }`
  - `pub struct EventItem { pub id, pub song_id: String, pub next_item_id: Option<String>, pub song: Option<SongSummary> }`
  - `pub struct EventPart { pub id, pub title: String, pub items: Vec<EventItem> }`
  - `pub struct ServiceEvent { pub id, pub title: String, pub event_date: String, pub parts: Vec<EventPart> }`
  - `pub struct EventSummary { pub id, pub title: String, pub event_date: String }`
  - `pub struct OnlineLyricHit { pub track_name, pub artist_name: String, pub album_name: Option<String> }`
  - `pub struct ImportSkip { pub title: String, pub reason: String }`
  - `pub struct ImportReport { pub imported: Vec<String>, pub skipped: Vec<ImportSkip>, pub errors: Vec<String> }`
  - Em `SlideContent`: `#[serde(default, skip_serializing_if = "Option::is_none")] pub section: Option<String>`
  - Em `LiveSlide`: `#[serde(default, skip_serializing_if = "Option::is_none", rename = "nextUp")] pub next_up: Option<SlideContent>`
- Produces (TS, espelho exato):
  - `export type SectionType = "verse" | "pre-chorus" | "chorus" | "bridge" | "intro" | "outro" | "instrumental" | "tag" | "ending";`
  - `SongSection { sectionType: SectionType | null; lines: string[] }`, `Song { id; title; artist; sections: SongSection[] }`, `SongSummary { id; title; artist }`, `EventItem { id; songId; nextItemId: string | null; song: SongSummary | null }`, `EventPart { id; title; items: EventItem[] }`, `ServiceEvent { id; title; eventDate; parts: EventPart[] }`, `EventSummary { id; title; eventDate }`, `OnlineLyricHit { trackName; artistName; albumName: string | null }`, `ImportSkip { title; reason }`, `ImportReport { imported: string[]; skipped: ImportSkip[]; errors: string[] }`
  - `SlideContent.section?: string`; `LiveSlide.nextUp?: SlideContent`
  - `src/core/config/lyrics.ts`: `SECTION_TYPES: { type: SectionType; label: string; color: string }[]` (9 itens, rótulos pt-BR e cores do spec §6.1), `SECTION_LABEL: Record<SectionType, string>`, `SECTION_COLOR: Record<SectionType, string>`
  - `src/core/lib/lyrics.ts`:
    - `export interface RunnerSlide { index: number; label: string | null; sectionType: SectionType | null; slide: SlideContent }`
    - `computeSectionLabels(sections: SongSection[]): (string | null)[]` — rótulo do tipo; numeração `${label} ${n}` (n = ocorrência, 1-based) **somente** quando o tipo se repete e o tipo ≠ `"chorus"`; `sectionType: null` → `null`
    - `buildSongSlides(song: Song): RunnerSlide[]` — `slide = { id: `${song.id}#${index}`, kind: "lyric", title: song.title, lines: section.lines, section: label ?? undefined }`

- [ ] **Step 1: Rust — adicionar tipos e campos** (`cargo check` deve passar; cuidado: `blank_slide()` em `state/presentation.rs` deserializa JSON sem os campos novos — os `#[serde(default)]` cobrem).
- [ ] **Step 2: TS — adicionar espelho + config/helpers** (arquivos acima).
- [ ] **Step 3: Verificar os dois lados**

Run: `cargo check --manifest-path src-tauri/Cargo.toml` → sem erros
Run: `npm run typecheck` → sem erros

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/state/types.rs src-tauri/src/state/mod.rs src/core/types/index.ts src/core/config/lyrics.ts src/core/lib/lyrics.ts
git commit -m "feat(core): tipos espelhados de letras/setlist e config de seções"
```

---

### Task 3: Rust — serviço de músicas (CRUD + busca)

**Files:**
- Create: `src-tauri/src/services/songs.rs`
- Modify: `src-tauri/src/services/mod.rs` (`pub mod songs;`)

**Interfaces:**
- Consumes: `Db::with_conn` (Task 1), tipos (Task 2), `database::open_in_memory` (Task 1)
- Produces:
  - `pub fn list(conn: &Connection, query: Option<&str>) -> Result<Vec<SongSummary>, AppError>`
  - `pub fn get(conn: &Connection, id: &str) -> Result<Option<Song>, AppError>`
  - `pub fn save(conn: &Connection, song: &Song) -> Result<(), AppError>` (upsert transacional: substitui seções e linhas)
  - `pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError>`
  - `pub fn find_duplicate(conn: &Connection, title: &str, artist: &str) -> Result<Option<String>, AppError>` (case-insensitive, trim)
  - `pub fn insert_new(conn: &Connection, title: &str, artist: &str, sections: &[SongSection]) -> Result<String, AppError>` (id via `SELECT lower(hex(randomblob(16)))`)

- [ ] **Step 1: Escrever os testes que falham** (módulo de testes em `songs.rs`)

```rust
#[test]
fn salva_e_retorna_musica_com_secoes() {
    let conn = open_in_memory();
    let song = Song { id: "s1".into(), title: "Grandes Coisas".into(), artist: "Fernandinho".into(),
        sections: vec![
            SongSection { section_type: Some(SectionType::Verse), lines: vec!["Grandes coisas".into(), "estão por vir".into()] },
            SongSection { section_type: Some(SectionType::Chorus), lines: vec!["Vão acontecer".into()] },
        ] };
    save(&conn, &song).unwrap();
    assert_eq!(get(&conn, "s1").unwrap().unwrap(), song);
}

#[test]
fn busca_por_trecho_de_letra() {
    let conn = open_in_memory();
    save(&conn, &Song { id: "s1".into(), title: "A".into(), artist: "B".into(),
        sections: vec![SongSection { section_type: None, lines: vec!["ousado amor".into()] }] }).unwrap();
    assert_eq!(list(&conn, Some("ousado")).unwrap().len(), 1);
    assert_eq!(list(&conn, Some("nada")).unwrap().len(), 0);
}

#[test]
fn busca_trata_curingas_like_como_texto_literal() {
    let conn = open_in_memory();
    save(&conn, &Song { id: "s1".into(), title: "100%".into(), artist: "".into(),
        sections: vec![SongSection { section_type: None, lines: vec!["a_b c%d".into()] }] }).unwrap();
    save(&conn, &Song { id: "s2".into(), title: "Outra".into(), artist: "".into(),
        sections: vec![SongSection { section_type: None, lines: vec!["sem curinga".into()] }] }).unwrap();
    assert_eq!(list(&conn, Some("%")).unwrap().len(), 1);   // sem escape, casaria 2
    assert_eq!(list(&conn, Some("_")).unwrap().len(), 1);   // sem escape, casaria 2
    assert_eq!(list(&conn, Some("%d")).unwrap().len(), 1);
    assert_eq!(list(&conn, Some("curinga")).unwrap().len(), 1);
}

#[test]
fn save_substitui_secoes_anteriores_e_delete_cascateia() {
    let conn = open_in_memory();
    let mut song = Song { id: "s1".into(), title: "T".into(), artist: "".into(),
        sections: vec![SongSection { section_type: Some(SectionType::Verse), lines: vec!["l1".into()] }] };
    save(&conn, &song).unwrap();
    song.sections = vec![SongSection { section_type: Some(SectionType::Bridge), lines: vec!["l2".into(), "l3".into()] }];
    save(&conn, &song).unwrap();
    assert_eq!(get(&conn, "s1").unwrap().unwrap(), song);
    let linhas: i64 = conn.query_row("SELECT count(*) FROM song_lyrics", [], |r| r.get(0)).unwrap();
    assert_eq!(linhas, 2);
    delete(&conn, "s1").unwrap();
    assert!(get(&conn, "s1").unwrap().is_none());
}

#[test]
fn insert_new_gera_id_e_find_duplicate_acha_case_insensitive() {
    let conn = open_in_memory();
    let id = insert_new(&conn, "Ousado Amor", "Isaias Saad", &[SongSection { section_type: None, lines: vec!["x".into()] }]).unwrap();
    assert_eq!(id.len(), 32);
    assert!(find_duplicate(&conn, " ousado amor ", "ISAIAS SAAD").unwrap().is_some());
    assert!(find_duplicate(&conn, "outra", "").unwrap().is_none());
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --manifest-path src-tauri/Cargo.toml songs::` → FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

Busca em `list` (query vazia/`None` → lista tudo ordenado por título):
```sql
SELECT id, title, artist FROM songs s
WHERE title LIKE ?1 ESCAPE '\' OR artist LIKE ?1 ESCAPE '\'
   OR EXISTS (SELECT 1 FROM song_lyrics l WHERE l.song_id = s.id AND l.line LIKE ?1 ESCAPE '\')
ORDER BY title
```
com `?1 = format!("%{}%", escaped)` e `escaped` trocando `\`→`\\`, `%`→`\%`, `_`→`\_`. (LIKE do SQLite já é case-insensitive em ASCII.) `get` monta `Song` lendo `song_sections` (ORDER position) + `song_lyrics` (ORDER section_position, line_position). `save`: `unchecked_transaction`, upsert em `songs` (`INSERT ... ON CONFLICT(id) DO UPDATE`), `DELETE` das seções/linhas antigas, reinsere na ordem. `delete`: `DELETE FROM songs WHERE id = ?` (FKs cascateiam).

- [ ] **Step 4: Rodar os testes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml songs::` → PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/songs.rs src-tauri/src/services/mod.rs
git commit -m "feat(rust): serviço de músicas com busca por trecho"
```

---

### Task 4: Rust — parser do Holyrics (.json/.txt)

**Files:**
- Create: `src-tauri/src/services/holyrics.rs`
- Modify: `src-tauri/src/services/mod.rs`

**Interfaces:**
- Consumes: `SectionType` (Task 2)
- Produces:
  - `pub struct ParsedSection { pub section_type: Option<SectionType>, pub lines: Vec<String> }`
  - `pub struct ParsedSong { pub title: String, pub artist: String, pub sections: Vec<ParsedSection> }`
  - `pub fn parse(text: &str, format: HolyricsFormat) -> Result<Vec<ParsedSong>, AppError>`
  - `pub enum HolyricsFormat { Json, Txt }` e `pub fn format_from_path(path: &Path) -> Result<HolyricsFormat, AppError>` (`.json`/`.txt`; `.mufl` → `AppError::Storage("formato .mufl não é suportado — exporte JSON ou TXT")`)

Regras (espelho do Spresenter — spec §6.2):
- Normalização: `\u{FEFF}` (BOM) removido no início; `\r\n`/`\r` → `\n`.
- JSON: array; item com `title` (não-vazio) e `artist`; `lyrics.paragraphs[{description?, text}]` → seções (`description` → `SectionType::from_label`); se não houver parágrafos com texto, fallback `lyrics.full_text` dividido por `\n{2,}`; linhas = `text` com trailing spaces por linha removidos, trim, split `\n`, descartando linhas vazias; seções vazias caem fora; item sem título ou sem seções é ignorado; JSON inválido → `AppError::Storage("arquivo JSON inválido")`.
- TXT: blocos separados por linha `/^[ \t]*={10,}[ \t]*$/`; dentro do bloco: `^Título:` / `^Artista:` (case-insensitive) preenchem campos; linha `##(X)` define o rótulo do próximo parágrafo (`from_label`; desconhecido → `None`); linhas iniciando `//` são descartadas; linha vazia fecha o parágrafo corrente; título vazio ou sem seções → bloco ignorado.
- `SectionType::from_label`: dicionário do Spresenter (`verso`, `refrão`/`refrao`, `pré-refrão`/`pre-refrao`, `ponte`, `introdução`/`introducao`/`intro`, `final`, `instrumental`, `tag`, `encerramento`), com `\s*\d+\s*$` removido antes do lookup e `.to_lowercase()`.

- [ ] **Step 1: Escrever os testes que falham** (fixtures exatas)

```rust
const TXT: &str = "\u{FEFF}Título: Ousado Amor\r\nArtista: Isaias Saad\r\n\r\n//Primeira Estrofe\r\n##(Verso 1)\r\nAntes de eu falar\r\nTu cantavas sobre mim\r\n\r\n##(Refrão)\r\nOusado amor\r\nDe Deus por mim\r\n\r\n==========\r\nTítulo: Sem Artista\r\n\r\n##(Estrofe A)\r\nLinha qualquer\r\n";

#[test]
fn parseia_txt_com_rotulos_artista_e_bom_crlf() {
    let songs = parse(TXT, HolyricsFormat::Txt).unwrap();
    assert_eq!(songs.len(), 2);
    let primeira = &songs[0];
    assert_eq!(primeira.title, "Ousado Amor");
    assert_eq!(primeira.artist, "Isaias Saad");
    assert_eq!(primeira.sections.len(), 2);
    assert_eq!(primeira.sections[0].section_type, Some(SectionType::Verse));
    assert_eq!(primeira.sections[0].lines, vec!["Antes de eu falar", "Tu cantavas sobre mim"]);
    assert_eq!(primeira.sections[1].section_type, Some(SectionType::Chorus));
    // rótulo desconhecido vira "sem rótulo" e o arquivo segue importando
    assert_eq!(songs[1].title, "Sem Artista");
    assert_eq!(songs[1].sections[0].section_type, None);
}

#[test]
fn parseia_json_paragraphs_e_mapeia_descricao_numerada() {
    let json = r#"[{"title":"T","artist":"A","lyrics":{"paragraphs":[
        {"description":"Verso 2","text":"linha um\nlinha dois\n"},{"description":"Refrão","text":"refrão"}]}}]"#;
    let songs = parse(json, HolyricsFormat::Json).unwrap();
    assert_eq!(songs[0].sections[0].section_type, Some(SectionType::Verse));
    assert_eq!(songs[0].sections[0].lines, vec!["linha um", "linha dois"]);
    assert_eq!(songs[0].sections[1].section_type, Some(SectionType::Chorus));
}

#[test]
fn parseia_json_fallback_full_text_e_ignora_invalidos() {
    let json = r#"[{"title":"X","artist":"","lyrics":{"full_text":"primeiro\n\n\nsegundo"}},
        {"title":"","artist":"","lyrics":{"paragraphs":[{"text":"a"}]}},
        {"title":"Y","artist":"","lyrics":{"paragraphs":[]}}]"#;
    let songs = parse(json, HolyricsFormat::Json).unwrap();
    assert_eq!(songs.len(), 1);
    assert_eq!(songs[0].sections.len(), 2);
    assert!(parse("não é json", HolyricsFormat::Json).is_err());
}
```

- [ ] **Step 2: Rodar e ver falhar** — `cargo test --manifest-path src-tauri/Cargo.toml holyrics::` → FAIL
- [ ] **Step 3: Implementar** conforme regras acima (parser puro, sem I/O; `serde_json::Value` para o JSON).
- [ ] **Step 4: Rodar os testes** — PASS
- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/holyrics.rs src-tauri/src/services/mod.rs
git commit -m "feat(rust): parser de biblioteca do Holyrics (json e txt)"
```

---

### Task 5: Rust — cliente LRCLIB (busca online)

**Files:**
- Create: `src-tauri/src/services/lrclib.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/Cargo.toml` (dependência `reqwest`; bump de `rust-version`)
- Modify: `src-tauri/src/error.rs` (variante `NotFound`)

**Interfaces:**
- Consumes: tipos (Task 2)
- Produces:
  - `pub fn client() -> reqwest::Client` (User-Agent `Open Presenter/0.1.0`)
  - `pub fn parse_search_payload(body: &str) -> Result<Vec<OnlineLyricHit>, AppError>` (filtra itens sem `plainLyrics`)
  - `pub fn split_plain_lyrics(plain: &str) -> Vec<Vec<String>>` (parágrafos por `\n{2,}`; linhas com trailing spaces removidos; parágrafos vazios descartados)
  - `pub fn parse_get_payload(body: &str) -> Result<(String, String, Vec<SongSection>), AppError>` → `(trackName, artistName, seções sem rótulo)`
  - `pub async fn search(client: &reqwest::Client, query: &str) -> Result<Vec<OnlineLyricHit>, AppError>`
  - `pub async fn fetch(client: &reqwest::Client, track: &str, artist: &str) -> Result<(String, String, Vec<SongSection>), AppError>`
  - `AppError::NotFound(String)` com `#[error("não encontrado: {0}")]`

- [ ] **Step 1: Cargo.toml** — adicionar `reqwest = { version = "0.13.5", features = ["json"] }` (defaults trazem rustls/system-proxy) e ajustar `rust-version = "1.85.0"` (exigência do reqwest 0.13; toolchain local é 1.96). Rodar `cargo check --manifest-path src-tauri/Cargo.toml`.
- [ ] **Step 2: Escrever os testes que falham**

```rust
#[test]
fn busca_filtra_resultados_sem_letra_plana() {
    let body = r#"[{"trackName":"A","artistName":"X","albumName":"Al","plainLyrics":"um\n\ndois"},
                   {"trackName":"B","artistName":"Y","albumName":null,"plainLyrics":null},
                   {"trackName":"C","artistName":"Z","albumName":"Al2","plainLyrics":"tres"}]"#;
    let hits = parse_search_payload(body).unwrap();
    assert_eq!(hits.len(), 2);
    assert_eq!(hits[0].track_name, "A");
    assert_eq!(hits[1].album_name, Some("Al2".into()));
}

#[test]
fn split_plain_lyrics_aguenta_linhas_em_branco_variadas() {
    let sections = split_plain_lyrics("um\n\ndois\n\n\n\ntres  \nquatro\n");
    assert_eq!(sections, vec![vec!["um".to_string()], vec!["dois".to_string()], vec!["tres".to_string(), "quatro".to_string()]]);
}

#[test]
fn parse_get_payload_monta_secoes_sem_rotulo() {
    let body = r#"{"trackName":"T","artistName":"A","plainLyrics":"um\n\ndois"}"#;
    let (title, artist, sections) = parse_get_payload(body).unwrap();
    assert_eq!(title, "T");
    assert_eq!(artist, "A");
    assert_eq!(sections.len(), 2);
    assert_eq!(sections[0].section_type, None);
    assert!(parse_get_payload(r#"{"trackName":"T"}"#).is_err());
}
```

- [ ] **Step 3: Rodar e ver falhar** — `cargo test --manifest-path src-tauri/Cargo.toml lrclib::` → FAIL
- [ ] **Step 4: Implementar** — `parse_*` puras (serde_json); `search`: `GET https://lrclib.net/api/search?q={query}` → `parse_search_payload`; `fetch`: `GET /api/get?track_name=…&artist_name=…` (query com encoding do reqwest) → status 404 vira `AppError::NotFound("letra não encontrada no LRCLIB".into())`; erros de rede → `AppError::Network("falha ao consultar o LRCLIB — verifique a conexão".into())`.
- [ ] **Step 5: Rodar os testes** — PASS; `cargo check` sem erros
- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/error.rs src-tauri/src/services/lrclib.rs src-tauri/src/services/mod.rs
git commit -m "feat(rust): busca de letras online via LRCLIB"
```

---

### Task 6: Rust — comando `import_holyrics` + relatório + comandos de músicas

**Files:**
- Create: `src-tauri/src/services/import.rs`
- Create: `src-tauri/src/commands/songs.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/services/mod.rs`, `src-tauri/src/lib.rs` (registrar no `invoke_handler`)

**Interfaces:**
- Consumes: Tasks 1–5
- Produces:
  - `pub fn import_holyrics_file(conn: &Connection, path: &Path) -> Result<ImportReport, AppError>` — lê o arquivo, `format_from_path`, `holyrics::parse`; por música: `find_duplicate` (título, artista) → skipped ("já existe"); senão `insert_new` → imported; erros de leitura/parse → `Err`.
  - Comandos (síncronos, `State<'_, Db>`): `list_songs(query: Option<String>)`, `get_song(id: String)`, `save_song(song: Song)`, `delete_song(id: String)`, `import_holyrics(path: String)`
  - Comandos (async, rede): `search_lyrics_online(query: String) -> Vec<OnlineLyricHit>`, `fetch_online_lyrics(id: String, track_name: String, artist_name: String) -> Song` (monta `Song { id, title, artist, sections }` com o id do front)

- [ ] **Step 1: Escrever os testes que falham** (em `import.rs`; escrever fixtures em `tempfile`? — não há crate `tempfile`; usar `std::env::temp_dir()` + nome único e limpar no fim)

```rust
#[test]
fn importa_txt_e_pula_duplicadas_na_segunda_vez() {
    let conn = open_in_memory();
    let path = std::env::temp_dir().join(format!("holyrics-{}.txt", std::process::id()));
    std::fs::write(&path, "Título: A\nArtista: X\n\nUm\n\n==========\n\nTítulo: B\nArtista: Y\n\nDois\n").unwrap();
    let r1 = import_holyrics_file(&conn, &path).unwrap();
    assert_eq!(r1.imported, vec!["A".to_string(), "B".to_string()]);
    let r2 = import_holyrics_file(&conn, &path).unwrap();
    assert!(r2.imported.is_empty());
    assert_eq!(r2.skipped.len(), 2);
    let n: i64 = conn.query_row("SELECT count(*) FROM songs", [], |r| r.get(0)).unwrap();
    assert_eq!(n, 2);
    std::fs::remove_file(&path).ok();
}

#[test]
fn arquivo_invalido_e_extensao_mufl_geram_erro() {
    let conn = open_in_memory();
    let json = std::env::temp_dir().join(format!("holyrics-{}.json", std::process::id()));
    std::fs::write(&json, "{nada").unwrap();
    assert!(import_holyrics_file(&conn, &json).is_err());
    std::fs::remove_file(&json).ok();
    let mufl = std::env::temp_dir().join(format!("holyrics-{}.mufl", std::process::id()));
    std::fs::write(&mufl, "x").unwrap();
    assert!(import_holyrics_file(&conn, &mufl).is_err());
    std::fs::remove_file(&mufl).ok();
}
```

- [ ] **Step 2: Rodar e ver falhar** — `cargo test --manifest-path src-tauri/Cargo.toml import::` → FAIL
- [ ] **Step 3: Implementar** — `import.rs` orquestra (§ acima); `commands/songs.rs` com os 7 comandos usando `db.with_conn(...)`; registrar em `lib.rs` e reexportar em `commands/mod.rs`.
- [ ] **Step 4: Verificar tudo** — `cargo test --manifest-path src-tauri/Cargo.toml` → todos PASS; `cargo check` sem erros
- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/import.rs src-tauri/src/services/mod.rs src-tauri/src/commands/songs.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(rust): importação do Holyrics e comandos de músicas"
```

---

### Task 7: Rust — serviço de setlists + comandos

**Files:**
- Create: `src-tauri/src/services/setlists.rs`
- Create: `src-tauri/src/commands/setlists.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/services/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Tasks 1, 2, 3
- Produces:
  - `pub fn list(conn: &Connection) -> Result<Vec<EventSummary>, AppError>` (ordenado por `event_date DESC, title`)
  - `pub fn get(conn: &Connection, id: &str) -> Result<Option<ServiceEvent>, AppError>` — lê `setlist_json` `{ parts: [{ id, title, items: [{ id, songId, nextItemId }] }] }` e **hidrata** `item.song` com `songs::get`→`SongSummary` (`None` = removida); `nextItemId` é mantido como está (órfão não quebra)
  - `pub fn create(conn: &Connection, event: &ServiceEvent) -> Result<(), AppError>`
  - `pub fn save(conn: &Connection, event: &ServiceEvent) -> Result<(), AppError>` (update de `title`; `event_date` mantém o existente; regrava o JSON — grava **só** estrutura `{id,title,songId,nextItemId}`, nunca conteúdo de letra)
  - `pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError>`
  - Comandos: `list_events()`, `get_event(id)`, `create_event(event: ServiceEvent)`, `save_event(event: ServiceEvent)`, `delete_event(id)`

- [ ] **Step 1: Escrever os testes que falham**

```rust
#[test]
fn create_get_roundtrip_hidrata_musicas_da_setlist() {
    let conn = open_in_memory();
    let song_id = songs::insert_new(&conn, "Ousado Amor", "Isaias Saad", &[SongSection { section_type: None, lines: vec!["x".into()] }]).unwrap();
    let event = ServiceEvent { id: "e1".into(), title: "Culto".into(), event_date: "2026-10-18".into(),
        parts: vec![EventPart { id: "p1".into(), title: "Louvor".into(), items: vec![
            EventItem { id: "i1".into(), song_id: song_id.clone(), next_item_id: Some("i2".into()), song: None },
            EventItem { id: "i2".into(), song_id: song_id.clone(), next_item_id: None, song: None },
        ] }] };
    create(&conn, &event).unwrap();
    let loaded = get(&conn, "e1").unwrap().unwrap();
    assert_eq!(loaded.parts[0].items[0].song.as_ref().unwrap().title, "Ousado Amor");
    assert_eq!(loaded.parts[0].items[0].next_item_id.as_deref(), Some("i2"));
}

#[test]
fn musica_excluida_vira_item_removido_e_next_orfao_nao_quebra() {
    let conn = open_in_memory();
    let song_id = songs::insert_new(&conn, "T", "", &[SongSection { section_type: None, lines: vec!["l".into()] }]).unwrap();
    let event = ServiceEvent { id: "e1".into(), title: "C".into(), event_date: "2026-10-18".into(),
        parts: vec![EventPart { id: "p1".into(), title: "P".into(), items: vec![
            EventItem { id: "i1".into(), song_id: song_id.clone(), next_item_id: Some("i-que-nao-existe".into()), song: None }] }] };
    create(&conn, &event).unwrap();
    songs::delete(&conn, &song_id).unwrap();
    let loaded = get(&conn, "e1").unwrap().unwrap();
    assert!(loaded.parts[0].items[0].song.is_none());
    assert_eq!(loaded.parts[0].items[0].next_item_id.as_deref(), Some("i-que-nao-existe"));
}

#[test]
fn save_persiste_ordem_e_delete_remove() {
    let conn = open_in_memory();
    let song_id = songs::insert_new(&conn, "T", "", &[SongSection { section_type: None, lines: vec!["l".into()] }]).unwrap();
    let mut event = ServiceEvent { id: "e1".into(), title: "C".into(), event_date: "2026-10-18".into(),
        parts: vec![EventPart { id: "p1".into(), title: "P".into(), items: vec![EventItem { id: "i1".into(), song_id: song_id.clone(), next_item_id: None, song: None }] }] };
    create(&conn, &event).unwrap();
    event.parts[0].items.push(EventItem { id: "i2".into(), song_id, next_item_id: None, song: None });
    save(&conn, &event).unwrap();
    assert_eq!(get(&conn, "e1").unwrap().unwrap().parts[0].items.len(), 2);
    assert_eq!(list(&conn).unwrap().len(), 1);
    delete(&conn, "e1").unwrap();
    assert!(get(&conn, "e1").unwrap().is_none());
}
```

- [ ] **Step 2: Rodar e ver falhar** — `cargo test --manifest-path src-tauri/Cargo.toml setlists::` → FAIL
- [ ] **Step 3: Implementar** — serialização com `serde_json` (structs internas `StoredEvent/StoredPart/StoredItem` com `songId`/`nextItemId`); `create` insere com `setlist_json`; `save` = `UPDATE service_events SET title=?, setlist_json=? WHERE id=?` (linhas afetadas 0 → `AppError::NotFound`); comandos em `commands/setlists.rs` + registros.
- [ ] **Step 4: Verificar tudo** — `cargo test --manifest-path src-tauri/Cargo.toml` → todos PASS; `cargo check`
- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/setlists.rs src-tauri/src/services/mod.rs src-tauri/src/commands/setlists.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(rust): setlists por evento com comandos IPC"
```

---

### Task 8: Front — wrappers IPC + invokeStrict + fix de camelCase

**Files:**
- Modify: `src/core/ipc/tauri.ts`
- Modify: `src/core/ipc/commands.ts`

**Interfaces:**
- Produces:
  - `export async function invokeStrict<T>(command: string, args?: Record<string, unknown>): Promise<T>` — fora do Tauri lança `Error("Disponível apenas no app desktop.")`; erro do Tauri é re-lançado (a mensagem serializada do `AppError` chega como string)
  - Wrappers novos: `listSongs(query?: string)`, `getSong(id)`, `saveSong(song)`, `deleteSong(id)`, `importHolyrics(path)`, `searchLyricsOnline(query)`, `fetchOnlineLyrics(id, trackName, artistName)`, `listEvents()`, `getEvent(id)`, `createEvent(event)`, `saveEvent(event)`, `deleteEvent(id)` — todos via `invokeStrict` e **camelCase** nos args (`trackName`, `artistName`)
- Consumes: contratos das Tasks 6 e 7

- [ ] **Step 1: Implementar `invokeStrict`** em `tauri.ts` (o `invokeCommand` atual continua igual para os fluxos existentes).
- [ ] **Step 2: Adicionar os wrappers** em `commands.ts`, importando os tipos da Task 2. **Bug latente**: `openOutputWindow` passa `monitor_id` (snake_case) — Tauri espera `monitorId`; corrigir para `{ target, monitorId }` (hoje o monitor escolhido é silenciosamente ignorado porque `Option<String>` vira `None`).
- [ ] **Step 3: Verificar**

Run: `npm run typecheck` → sem erros

- [ ] **Step 4: Commit**

```bash
git add src/core/ipc/tauri.ts src/core/ipc/commands.ts
git commit -m "feat(ipc): wrappers de músicas/setlist e correção de args camelCase"
```

---

### Task 9: Front — setup shadcn/ui (componentes oficiais)

**Files:**
- Create/Modify: `components.json`, `src/index.css`, `package.json`
- Modify: `src/components/ui/*.tsx` (button, card, badge — oficiais; input, textarea, select, dialog, menubar, context-menu, dropdown-menu, scroll-area, separator — novos)

**Interfaces:**
- Produces: componentes oficiais em `src/components/ui`; `cn` continua vindo de `@/core/lib/utils`; variante extra `danger` no `buttonVariants` (bg-red-600 text-white hover:bg-red-500) e `live` no `badgeVariants` (bg-red-600 text-white) — preservam os call-sites atuais.

- [ ] **Step 1: Init** — `npx shadcn@latest init -d -y`; depois editar `components.json`: `style: "new-york"`, `tailwind.css: "src/index.css"`, `tailwind.baseColor: "neutral"`, `tailwind.cssVariables: true`, `aliases: { components: "@/components", utils: "@/core/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" }`, `iconLibrary: "lucide"`. Se `src/lib/utils.ts` for criado, apagar (nada importa dele: conferir `grep -r "@/lib/utils" src` antes).
- [ ] **Step 2: Add** — `npx shadcn@latest add -y -o button card badge input textarea select dialog menubar context-menu dropdown-menu scroll-area separator`. Se o CLI reclamar de peer-deps do React 19, resolver com `--force`/`--legacy-peer-deps` (as libs Radix atuais suportam React 19).
- [ ] **Step 3: Pinagem** — para cada dependência nova (pacotes `@radix-ui/*`, `tw-animate-css`, etc.), ler a versão instalada (`npm ls --depth=0`) e fixar **exata** no `package.json` (sem `^`); `npm install` para atualizar o lock.
- [ ] **Step 4: Variantes do projeto** — reaplicar `danger` (button) e `live` (badge) nos arquivos gerados; conferir que `LiveControls.tsx` (variant condicional `danger`) e `LivePreview.tsx` (badge `live`) continuam ok.
- [ ] **Step 5: CSS** — conferir que `src/index.css` manteve os tokens existentes (`--font-sans`, `--color-stage`, `--color-panel`) junto aos do shadcn; `index.html` já tem `class="dark"`.
- [ ] **Step 6: Verificar**

Run: `npm run typecheck` e `npm run build` → sem erros

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components.json src/index.css src/components/ui
git commit -m "feat(ui): adota componentes oficiais do shadcn/ui"
```

---

### Task 10: Front — store de músicas + painel + editor

**Files:**
- Modify: `src/features/songs/store.ts` (reescrever)
- Modify: `src/features/songs/SongsPanel.tsx` (reescrever)
- Create: `src/features/songs/SongEditorDialog.tsx`
- Create: `src/features/songs/services/files.ts`

**Interfaces:**
- Consumes: Tasks 2, 8, 9
- Produces (store): estado `{ songs: SongSummary[]; query: string; loading: boolean; error: string | null; editorSong: Song | null }`; ações:
  - `load(): Promise<void>` (usa `query` corrente; `listSongs`)
  - `setQuery(q: string): void` (só estado; o painel faz debounce 250 ms e chama `load()`)
  - `startNewSong(): void` (draft `{ id: crypto.randomUUID(), title: "", artist: "", sections: [{ sectionType: null, lines: [""] }] }`)
  - `editSong(id: string): Promise<void>` (`getSong` → `editorSong`)
  - `closeEditor(): void`
  - `saveEditor(song: Song): Promise<boolean>` (`saveSong` → recarrega lista; erro → `error`)
  - `deleteSong(id: string): Promise<void>`
  - `services/files.ts`: `pickHolyricsFile(): Promise<string | null>` (plugin-dialog `open`, filtros json/txt; fora do Tauri → `null`)
- Produces (UI): `SongEditorDialog` — Dialog oficial com Input (título/artista) e editor de blocos: por bloco um `Select` de rótulo (9 tipos + "Sem rótulo"), `Textarea` (uma linha por linha da letra), botões remover/↑/↓, botão "＋ bloco"; rodapé Salvar (desabilitado sem título)/Excluir (confirmação em dois cliques: "Excluir" → "Confirmar?")/Cancelar. `SongsPanel` — Input de busca, lista (título · artista), estados vazio/loading/erro, botões "Nova música" e "Buscar na internet" (o último fica desabilitado até a Task 15); clique na linha abre o editor; renderiza `SongEditorDialog`.

- [ ] **Step 1: Implementar** store + `files.ts` + painel + editor conforme interfaces.
- [ ] **Step 2: Verificar** — `npm run typecheck` → sem erros; `npm run build` → ok
- [ ] **Step 3: Commit**

```bash
git add src/features/songs
git commit -m "feat(songs): biblioteca de letras com busca e editor de seções"
```

---

### Task 11: Front — projeção: `publishLive`, chip de seção e palco

**Files:**
- Modify: `src/features/presentation/store.ts`
- Modify: `src/features/presentation/SlideCanvas.tsx`
- Modify: `src/features/presentation/LivePreview.tsx`
- Modify: `src/views/StageView.tsx`
- Modify: `src/features/presentation/LiveControls.tsx` (usar a ação nova)

**Interfaces:**
- Produces (store): `publishLive(slide: SlideContent, nextUp: SlideContent | null): Promise<void>` — monta `LiveSlide` a partir do `live` atual (`content: slide`, `cleared: false`, `blackout: false`, `nextUp: nextUp ?? undefined`, `updatedAt` novo), aplica local (`applyRemote`) e chama `publishSlide`; `clearLive(): Promise<void>` (extraído do `LiveControls.clear`).
- Remove: `nextUp`/`setNextUp` do store (fonte única passa a ser `live.nextUp`).
- `SlideCanvas`: título vira `{content.title}{content.section ? " · " + content.section : ""}`.
- `LivePreview`: idem chip.
- `StageView`: `const nextUp = usePresentationStore((s) => s.live.nextUp)`.
- `LiveControls`: `clear` usa `usePresentationStore.getState().clearLive()`.

- [ ] **Step 1: Implementar** as mudanças acima.
- [ ] **Step 2: Verificar** — `npm run typecheck` → sem erros; `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/features/presentation src/views/StageView.tsx
git commit -m "feat(presentation): projeção com seção e próximo verso no slide ao vivo"
```

---

### Task 12: Front — setlist: store, painel com partes e menu de contexto

**Files:**
- Modify: `src/features/events-setlists/store.ts` (reescrever)
- Modify: `src/features/events-setlists/SetlistPanel.tsx` (reescrever)
- Create: `src/features/events-setlists/SongPickerDialog.tsx`

**Interfaces:**
- Consumes: Tasks 2, 8, 9, 10
- Produces (store): estado `{ events: EventSummary[]; activeEventId: string | null; event: ServiceEvent | null; dirty: boolean; selectedItemId: string | null; error: string | null }`; ações:
  - `load()`, `selectEvent(id)` (salva pendências antes de trocar), `createEvent(title)` (hoje como `eventDate`), `deleteEvent(id)`, `renameEvent(title)` (dirty)
  - `addPart(title)`, `renamePart(partId, title)`, `removePart(partId)`, `movePart(partId, dir: -1 | 1)`
  - `addSong(partId, songId)` (id do item = `crypto.randomUUID()`), `removeItem(itemId)`, `moveItem(itemId, dir)`, `setNextItem(itemId, nextItemId | null)`
  - `save()` (`saveEvent`), `selectItem(itemId | null)`
  - Regra: ao remover item/parte, **limpar ponteiros `nextItemId` que apontavam para o removido**.
- Produces (UI): `SetlistPanel` — Select de evento + "＋ evento" (dialog com input de título) + "Salvar" (badge "não salvo" quando `dirty`) + excluir evento (confirmação em dois cliques); seções de partes: título editável inline (Input), ↑/↓/remover, "＋ música" → `SongPickerDialog(partId)`; itens: linha com título · artista (ou "Música removida" quando `song === null`), ícone `ArrowRight` quando `nextItemId` existe, clique seleciona (`selectItem`); `ContextMenu` (botão direito) com **Editar** (chama `useSongsStore.getState().editSong(item.song_id)`; desabilitado se removida), **Remover** e **Definir a próxima música** ▸ submenu com `ContextMenuLabel` por parte e item por música (todas do evento, exceto o próprio item) + "Nenhuma". `SongPickerDialog` — Dialog com Input de busca do catálogo (usa `useSongsStore`, chamando `load()` se vazio; cross-feature sancionado "via stores"), clique adiciona e fecha.

- [ ] **Step 1: Implementar** store + diálogos + painel conforme interfaces.
- [ ] **Step 2: Verificar** — `npm run typecheck`; `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/features/events-setlists
git commit -m "feat(setlist): culto em partes com próxima música definida"
```

---

### Task 13: Front — runner da letra (projeção verso a verso)

**Files:**
- Create: `src/features/events-setlists/SongRunner.tsx`
- Modify: `src/features/events-setlists/store.ts` (cache de músicas + ações do runner)
- Modify: `src/views/AdminView.tsx` (renderizar `SongRunner` sob o `SetlistPanel`)

**Interfaces:**
- Consumes: Tasks 2, 11, 12
- Produces (store): `songsCache: Record<string, Song>`; `runnerIndex: number | null`; ações:
  - `loadItemSong(itemId: string): Promise<Song | null>` (usa cache; `getSong` senão)
  - `projectSection(itemId: string, index: number): Promise<void>` — `buildSongSlides(song)[index].slide` → `publishLive(slide, nextUp)`, onde `nextUp` = próximo bloco da mesma música; no último bloco, 1º bloco da música do `nextItemId` (carregada sob demanda) se o ponteiro for válido/existente; senão `null`; grava `runnerIndex = index`
  - `projectNext()` / `projectPrev()` (com index `null`, Próximo projeta 0)
- Comportamento (spec D11/D13): ao selecionar item (`selectItem`), carregar a música e zerar `runnerIndex` (nada vai ao ar sozinho); **no último bloco "Próximo" desabilita**; quando `runnerIndex === n-1` e existe próxima válida, aparece o botão **"Ir para [título]"** que faz `selectItem(next)` + `projectSection(next, 0)`; "Limpar" chama `clearLive()`; `nextItemId` órfão → botão não aparece e `nextUp` fica `null`; item "removida" → runner mostra aviso e não projeta.
- UI: lista de blocos com rótulo colorido (`SECTION_COLOR`/`SECTION_LABEL`; sem rótulo → "—") e prévia das linhas; bloco atual destacado; rodapé: Anterior, Próximo, Limpar, botão "Ir para [próxima]" quando aplicável.

- [ ] **Step 1: Implementar** conforme interfaces.
- [ ] **Step 2: Verificar** — `npm run typecheck`; `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/features/events-setlists src/views/AdminView.tsx
git commit -m "feat(runner): projeção verso a verso com próxima música"
```

---

### Task 14: Front — menubar "Arquivo" + importação com relatório

**Files:**
- Create: `src/components/AppMenubar.tsx`
- Create: `src/features/songs/ImportReportDialog.tsx`
- Modify: `src/features/songs/store.ts` (ação de import + `importReport`)
- Modify: `src/features/songs/SongsPanel.tsx` (renderizar o dialog)
- Modify: `src/views/AdminView.tsx` (header com o menubar)

**Interfaces:**
- Consumes: Tasks 9, 10 e `pickHolyricsFile` (`services/files.ts`, Task 10)
- Produces (store): `importReport: ImportReport | null`, `startHolyricsImport(): Promise<void>` (pick → `importHolyrics` → `importReport`; recarrega a lista; erro → `error`), `closeImportReport()`.
- `AppMenubar`: `<Menubar>` com menu **Arquivo** → **Nova música** (`startNewSong`) e **Importar músicas do Holyrics…** (`startHolyricsImport`).
- `ImportReportDialog`: Dialog com "N músicas importadas" (lista), "puladas" (título + motivo) e "erros"; botão Fechar.
- `AdminView`: header ganha `<AppMenubar />` acima do título.

- [ ] **Step 1: Implementar** conforme interfaces.
- [ ] **Step 2: Verificar** — `npm run typecheck`; `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/components src/features/songs src/views/AdminView.tsx
git commit -m "feat(menu): menubar Arquivo com nova música e importação do Holyrics"
```

---

### Task 15: Front — busca online (LRCLIB) no painel de músicas

**Files:**
- Create: `src/features/songs/OnlineLyricsDialog.tsx`
- Modify: `src/features/songs/store.ts` (slice online)
- Modify: `src/features/songs/SongsPanel.tsx` (botão + render do dialog)

**Interfaces:**
- Consumes: Tasks 8, 10
- Produces (store): estado `{ onlineOpen: boolean; onlineQuery: string; onlineResults: OnlineLyricHit[]; onlineLoading: boolean; onlineError: string | null }`; ações: `openOnlineSearch()`, `closeOnlineSearch()`, `setOnlineQuery(q)`, `searchOnline(): Promise<void>` (`searchLyricsOnline`; vazio → mensagem "nada encontrado"), `importOnlineHit(hit: OnlineLyricHit): Promise<void>` — `fetchOnlineLyrics(crypto.randomUUID(), hit.trackName, hit.artistName)` → `editorSong` (draft abre no editor) e fecha o dialog; erros → `onlineError` (ex.: "falha ao consultar o LRCLIB — verifique a conexão").
- `OnlineLyricsDialog`: Input + Buscar; lista de resultados (`trackName` · `artistName` · `albumName`); clique importa; estados de loading/erro/vazio.
- `SongsPanel`: botão "Buscar na internet" abre o dialog (deixa de ficar desabilitado).

- [ ] **Step 1: Implementar** conforme interfaces.
- [ ] **Step 2: Verificar** — `npm run typecheck`; `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/features/songs
git commit -m "feat(songs): busca de letras online com importação para o editor"
```

---

### Task 16: Verificação final ponta a ponta + polimento

**Files:** (correções que a verificação apontar)

- [ ] **Step 1: Suíte completa**

Run: `cargo test --manifest-path src-tauri/Cargo.toml` → todos PASS
Run: `cargo check --manifest-path src-tauri/Cargo.toml` → sem warnings novos relevantes
Run: `npm run typecheck` → sem erros
Run: `npm run build` → ok

- [ ] **Step 2: Fluxo manual no app** (`npm run tauri:dev`, com o usuário quando possível)

Checklist (esperado):
1. Menubar Arquivo → Nova música abre o editor; salvar com título e blocos com rótulos; aparece na busca por título e por trecho.
2. Editar uma seção e salvar; reabrir confirma persistência (reiniciar o app).
3. Arquivo → Importar músicas do Holyrics… com um `.txt` real; relatório mostra importadas/puladas; reimportar pula tudo.
4. Criar evento, adicionar partes com título, adicionar músicas em cada parte, reordenar, salvar; reabrir o app confirma persistência.
5. Botão direito numa música → Editar abre o editor; Definir a próxima música mostra o submenu por parte; "Nenhuma" limpa; indicador aparece na linha.
6. Selecionar música no setlist → blocos aparecem; clicar num bloco projeta no preview/telão com chip "Título · Seção"; Anterior/Próximo navegam só dentro da música; no último bloco Próximo desabilita.
7. Com próxima definida: no último bloco, "Ir para [música]" troca e projeta o 1º bloco da próxima.
8. Tela do palco (janela de saída ou `/#/stage` no navegador) mostra "Próximo · [título]" com o verso seguinte.
9. Buscar na internet (com rede): resultado do LRCLIB importa e abre o editor com blocos sem rótulo; desconectar a rede e repetir mostra erro amigável.
10. Excluir uma música usada no setlist → a linha vira "Música removida" e o resto do culto continua funcionando.

- [ ] **Step 3: Corrigir o que a verificação apontar** e repetir os comandos do Step 1.
- [ ] **Step 4: Commit final de polimento (se houver mudanças)**

```bash
git add -A
git commit -m "fix: ajustes da verificação ponta a ponta de letras e setlist"
```

---

## Self-review (feito na escrita do plano)

- **Cobertura do spec:** G1 (T3/T6/T8/T10), G2 (T2/T10), G3 (T4/T6/T14), G4 (T5/T6/T15), G5 (T2/T7/T12), G6 (T11/T13), G7 (T9/T14), G8 (todas as camadas); D1–D13 cobertas; riscos do spec §8 viraram passos de verificação.
- **Consistência de tipos:** `Song/SongSection/SectionType/EventItem/EventPart/ServiceEvent/EventSummary/OnlineLyricHit/ImportReport` com os mesmos nomes nos dois lados; ações de store e assinaturas conferidas entre tarefas (ex.: `publishLive` na T11 ⇄ uso na T13; `pickHolyricsFile` na T10 ⇄ T14).
- **Review Focus:** cada linha tem teste na tarefa dona (T3/T4/T5/T6/T7) ou verificação explícita (T13, órfão).
