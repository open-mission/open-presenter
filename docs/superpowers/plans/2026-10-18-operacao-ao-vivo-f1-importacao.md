# F1 — Importação Holyrics + "linhas por slide" · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar músicas do Holyrics em JSON (música única ou várias, um ou vários arquivos, relatório agregado) já quebrando as estrofes no padrão configurável de "linhas por slide".

**Architecture:** O parser (`services/holyrics.rs`) passa a aceitar raiz objeto ou array; a quebra por layout vira função pura (`lyrics::split_sections`) + preferência persistida em `settings` (`songs.lines_per_slide`, default 2); a aplicação acontece nos dois pontos de criação de música (`import::import_holyrics_file` e o comando `fetch_online_lyrics`); o comando de importação passa a receber lista de arquivos e agregar relatório.

**Tech Stack:** Rust (Tauri 2, rusqlite, serde_json, thiserror) e React 19/TS/Zustand (painel).

**Spec:** `docs/superpowers/specs/2026-10-18-operacao-ao-vivo-design.md` — este plano cobre a fase **F1** (Importação + config "linhas por slide"). F2–F5 terão planos próprios.

**Branch:** `feature/operacao-ao-vivo-f1` a partir de `develop` (Gitflow).

## Global Constraints

- Antes de cada commit: `cargo test -p open-presenter` e `npm run typecheck` verdes (o front só é tocado de T4 em diante).
- Comandos rodam da raiz do repositório; crate em `src-tauri/`.
- Strings de UI em pt-BR; sem comentários no código salvo lógica não-óbvia; Conventional Commits curtos e no imperativo.
- Stack pinada — nenhuma dependência nova.
- Tipos compartilhados Rust↔TS ficam espelhados: `src-tauri/src/state/types.rs` ↔ `src/core/types/index.ts`.
- Decisões fixadas no design (D1–D4, D13): `songs.lines_per_slide` ∈ `"1" | "2" | "keep"`, **default efetivo "2"** quando ausente/desconhecido; a importação **não inventa rótulos**; ao quebrar uma seção em fragmentos, **só o primeiro mantém o `section_type`**.

## Review Focus

Comportamentos que o design implica mas nenhum código atual exercita — entrada/condição e o que uma pessoa esperaria:

1. **`paragraphs[].description` vazia (os exports reais)** → a letra importa e nenhum rótulo é inventado. (Teste em T1.)
2. **Lote com um arquivo inválido no meio** → os demais arquivos importam; o erro nomeia o arquivo que falhou. (Teste em T6.)
3. **Setting ausente/inválida (`""`, `"x"`)** → comporta como `"2"`, sem erro. (Teste em T3 e T5.)
4. **Estrofe rotulada quebrada pelo layout** → só o primeiro fragmento fica com o rótulo (nada de "Verso 1"/"Verso 2" para as duas metades da mesma estrofe). (Teste em T2 e T5.)
5. **Nome de arquivo com acento/parênteses** (`A Boa Parte (Florianópolis…)`) → leitura e parse idênticos aos de arquivo simples. (Fixture real em T1/T5/T6.)

---

### Task 1: Parser aceita objeto único na raiz (+ fixtures reais)

**Files:**
- Create: `src-tauri/tests/fixtures/holyrics_array.json` (cópia do export real de 3 músicas)
- Create: `src-tauri/tests/fixtures/holyrics_single.json` (cópia do export real de música única)
- Modify: `src-tauri/src/services/holyrics.rs` (`parse_json`, módulo `tests`)

**Interfaces:**
- Produces: `holyrics::parse(text: &str, format: HolyricsFormat) -> Result<Vec<ParsedSong>, AppError>` — assinatura inalterada; comportamento ampliado para raiz objeto.

- [ ] **Step 1: Copiar as fixtures reais para o repositório**

```bash
mkdir -p src-tauri/tests/fixtures
cp "/Users/claudio/Downloads/2026-10-18_00-17-04.json" src-tauri/tests/fixtures/holyrics_array.json
cp "/Users/claudio/Downloads/A Boa Parte (Florianópolis House Of Prayer e Nívea Soares).json" src-tauri/tests/fixtures/holyrics_single.json
```

- [ ] **Step 2: Escrever os testes que falham**

Em `src-tauri/src/services/holyrics.rs`, módulo `tests` (constantes no topo do módulo):

```rust
const FIXTURE_ARRAY: &str = include_str!("../../tests/fixtures/holyrics_array.json");
const FIXTURE_SINGLE: &str = include_str!("../../tests/fixtures/holyrics_single.json");

#[test]
fn parseia_json_do_export_real_com_varias_musicas() {
    let songs = parse(FIXTURE_ARRAY, HolyricsFormat::Json).unwrap();
    let titulos: Vec<&str> = songs.iter().map(|s| s.title.as_str()).collect();
    assert_eq!(titulos, vec!["A Coroa", "A Estrela da Alva", "A Fonte Salvadora"]);
    assert!(!songs[0].sections.is_empty());
    // export sem `description` → nenhum rótulo inventado
    assert!(songs.iter().flat_map(|s| &s.sections).all(|s| s.section_type.is_none()));
}

#[test]
fn parseia_json_de_musica_unica_na_raiz() {
    let songs = parse(FIXTURE_SINGLE, HolyricsFormat::Json).unwrap();
    assert_eq!(songs.len(), 1);
    assert_eq!(songs[0].title, "A Boa Parte");
    assert_eq!(songs[0].artist, "Florianópolis House Of Prayer e Nívea Soares");
    assert_eq!(songs[0].sections.len(), 11);
    assert!(songs[0].sections.iter().all(|s| s.section_type.is_none()));
}

#[test]
fn raiz_json_que_nao_e_objeto_nem_array_gera_erro() {
    assert!(parse("42", HolyricsFormat::Json).is_err());
}
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cargo test -p open-presenter services::holyrics`
Expected: `parseia_json_de_musica_unica_na_raiz` FAIL (erro "arquivo JSON inválido"); os demais passam.

- [ ] **Step 4: Implementar**

Em `parse_json`, trocar o `root.as_array()` por:

```rust
let items: Vec<Value> = match root {
    Value::Array(items) => items,
    Value::Object(_) => vec![root],
    _ => return Err(AppError::Storage(JSON_INVALIDO.into())),
};
```

e iterar `for item in items` (o restante do laço fica como está).

- [ ] **Step 5: Rodar e ver passar**

Run: `cargo test -p open-presenter services::holyrics`
Expected: todos os testes do módulo PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/tests/fixtures src-tauri/src/services/holyrics.rs
git commit -m "feat: import Holyrics aceita export JSON de música única"
```

---

### Task 2: `split_sections` — quebra estrofes com rótulo só no primeiro fragmento

**Files:**
- Modify: `src-tauri/src/services/lyrics.rs` (nova função + testes)

**Interfaces:**
- Produces: `lyrics::split_sections(sections: &[SongSection], lines_per_slide: usize) -> Vec<SongSection>` — cada seção vira fragmentos de `max(1, lines_per_slide)` linhas; o **primeiro** fragmento preserva `section_type`, os demais ficam `None`; seção com `lines.len() <= per` fica intacta.

- [ ] **Step 1: Escrever os testes que falham**

No módulo `tests` de `lyrics.rs` (usando o helper `blocks` que já existe):

```rust
#[test]
fn divide_estrofe_e_so_o_primeiro_fragmento_mantem_rotulo() {
    let original = blocks(vec![(
        Some(SectionType::Verse),
        vec!["a", "b", "c", "d", "e"],
    )]);
    assert_eq!(
        split_sections(&original, 2),
        blocks(vec![
            (Some(SectionType::Verse), vec!["a", "b"]),
            (None, vec!["c", "d"]),
            (None, vec!["e"]),
        ])
    );
}

#[test]
fn secao_curta_fica_intacta() {
    let original = blocks(vec![(Some(SectionType::Chorus), vec!["a", "b"])]);
    assert_eq!(split_sections(&original, 2), original);
}

#[test]
fn uma_linha_por_slide_quebra_cada_linha() {
    let original = blocks(vec![(None, vec!["a", "b", "c"])]);
    assert_eq!(
        split_sections(&original, 1),
        blocks(vec![(None, vec!["a"]), (None, vec!["b"]), (None, vec!["c"])])
    );
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test -p open-presenter services::lyrics`
Expected: FAIL — `split_sections` não existe.

- [ ] **Step 3: Implementar `split_sections`**

```rust
pub fn split_sections(sections: &[SongSection], lines_per_slide: usize) -> Vec<SongSection> {
    let per = lines_per_slide.max(1);
    let mut result = Vec::new();
    for section in sections {
        if section.lines.len() <= per {
            result.push(section.clone());
            continue;
        }
        for (index, chunk) in section.lines.chunks(per).enumerate() {
            result.push(SongSection {
                section_type: if index == 0 { section.section_type } else { None },
                lines: chunk.to_vec(),
            });
        }
    }
    result
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test -p open-presenter services::lyrics`
Expected: PASS (incluindo os testes antigos do módulo).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/lyrics.rs
git commit -m "feat: quebra estrofes em fragmentos com rótulo só no primeiro"
```

---

### Task 3: Preferência `songs.lines_per_slide` (tipo, leitura e escrita)

**Files:**
- Modify: `src-tauri/src/state/types.rs` (tipo `LinesPerSlide` + `SongDefaults`)
- Modify: `src-tauri/src/services/songs.rs` (chave, leitura/escrita, aplicação + testes)

**Interfaces:**
- Produces:
  - `state::types::LinesPerSlide` — enum serializado como `"1" | "2" | "keep"`; helpers `as_setting(self) -> &'static str`, `from_setting(value: Option<&str>) -> Self` (default `Two` para ausente/desconhecido), `lines_per_slide(self) -> Option<usize>`.
  - `state::types::SongDefaults { lines_per_slide: LinesPerSlide }` (serde camelCase → `linesPerSlide`; derives `Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize`).
  - `songs::LINES_PER_SLIDE_KEY: &str = "songs.lines_per_slide"`.
  - `songs::song_defaults(conn: &Connection) -> Result<SongDefaults, AppError>`.
  - `songs::save_song_defaults(conn: &Connection, defaults: SongDefaults) -> Result<(), AppError>`.
  - `songs::apply_layout(sections: Vec<SongSection>, defaults: SongDefaults) -> Vec<SongSection>` — `Keep` devolve como está; senão delega a `lyrics::split_sections`.

- [ ] **Step 1: Escrever os testes que falham**

No módulo `tests` de `services/songs.rs` (novo se não existir; usa `use crate::services::database::open_in_memory;`):

```rust
#[test]
fn from_setting_mapeia_valores_com_default_dois() {
    assert_eq!(LinesPerSlide::from_setting(Some("1")), LinesPerSlide::One);
    assert_eq!(LinesPerSlide::from_setting(Some("2")), LinesPerSlide::Two);
    assert_eq!(LinesPerSlide::from_setting(Some("keep")), LinesPerSlide::Keep);
    assert_eq!(LinesPerSlide::from_setting(Some("x")), LinesPerSlide::Two);
    assert_eq!(LinesPerSlide::from_setting(Some("")), LinesPerSlide::Two);
    assert_eq!(LinesPerSlide::from_setting(None), LinesPerSlide::Two);
}

#[test]
fn defaults_persistem_com_default_dois_na_ausencia() {
    let conn = open_in_memory();
    assert_eq!(song_defaults(&conn).unwrap().lines_per_slide, LinesPerSlide::Two);
    save_song_defaults(&conn, SongDefaults { lines_per_slide: LinesPerSlide::Keep }).unwrap();
    assert_eq!(song_defaults(&conn).unwrap().lines_per_slide, LinesPerSlide::Keep);
    save_song_defaults(&conn, SongDefaults { lines_per_slide: LinesPerSlide::One }).unwrap();
    assert_eq!(song_defaults(&conn).unwrap().lines_per_slide, LinesPerSlide::One);
}

#[test]
fn apply_layout_respeita_keep_e_quebra() {
    let sections = vec![SongSection { section_type: Some(SectionType::Verse), lines: vec!["a".into(), "b".into(), "c".into()] }];
    assert_eq!(apply_layout(sections.clone(), SongDefaults { lines_per_slide: LinesPerSlide::Keep }), sections);
    assert_eq!(apply_layout(sections, SongDefaults { lines_per_slide: LinesPerSlide::Two }).len(), 2);
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test -p open-presenter services::songs`
Expected: FAIL — tipos/funções não existem.

- [ ] **Step 3: Implementar**

Em `state/types.rs`: `LinesPerSlide` com `#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]` e variantes `#[serde(rename = "1")] One`, `#[serde(rename = "2")] Two`, `#[serde(rename = "keep")] Keep`; `SongDefaults` com os mesmos derives + `#[serde(rename_all = "camelCase")]`.

Em `services/songs.rs`:

```rust
pub const LINES_PER_SLIDE_KEY: &str = "songs.lines_per_slide";

pub fn song_defaults(conn: &Connection) -> Result<SongDefaults, AppError> {
    let value = settings::get_setting(conn, LINES_PER_SLIDE_KEY)?;
    Ok(SongDefaults {
        lines_per_slide: LinesPerSlide::from_setting(value.as_deref()),
    })
}

pub fn save_song_defaults(conn: &Connection, defaults: SongDefaults) -> Result<(), AppError> {
    settings::set_setting(conn, LINES_PER_SLIDE_KEY, defaults.lines_per_slide.as_setting())
}

pub fn apply_layout(sections: Vec<SongSection>, defaults: SongDefaults) -> Vec<SongSection> {
    match defaults.lines_per_slide.lines_per_slide() {
        Some(per) => lyrics::split_sections(&sections, per),
        None => sections,
    }
}
```

(imports: `crate::services::settings`, `crate::services::lyrics`, `crate::state::{LinesPerSlide, SongDefaults}`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test -p open-presenter services::songs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/state/types.rs src-tauri/src/services/songs.rs
git commit -m "feat: preferência de linhas por slide com persistência"
```

---

### Task 4: Comandos IPC + tipo TS + UI em Preferências → Músicas

**Files:**
- Modify: `src-tauri/src/commands/songs.rs` (novos comandos)
- Modify: `src-tauri/src/commands/mod.rs` (reexport)
- Modify: `src-tauri/src/lib.rs` (registro no `invoke_handler`, junto dos demais `commands::songs::*`)
- Modify: `src/core/types/index.ts` (espelho TS)
- Modify: `src/core/ipc/commands.ts` (wrappers)
- Modify: `src/features/preferences/tabs/SongsTab.tsx` (seção "Linhas por slide")

**Interfaces:**
- Consumes: `songs::song_defaults`, `songs::save_song_defaults`, `SongDefaults` (Task 3).
- Produces:
  - Rust: `#[tauri::command] pub fn get_song_defaults(db: State<'_, Db>) -> Result<SongDefaults, AppError>`; `#[tauri::command] pub fn set_song_defaults(db: State<'_, Db>, defaults: SongDefaults) -> Result<SongDefaults, AppError>` (salva e devolve o efetivo).
  - TS: `export type LinesPerSlide = "1" | "2" | "keep";` `export interface SongDefaults { linesPerSlide: LinesPerSlide; }` em `core/types`; `getSongDefaults(): Promise<SongDefaults>` e `setSongDefaults(defaults: SongDefaults): Promise<SongDefaults>` em `core/ipc/commands.ts`.

- [ ] **Step 1: Implementar os comandos Rust e registrar**

`commands/songs.rs`:

```rust
#[tauri::command]
pub fn get_song_defaults(db: State<'_, Db>) -> Result<SongDefaults, AppError> {
    db.with_conn(songs::song_defaults)
}

#[tauri::command]
pub fn set_song_defaults(db: State<'_, Db>, defaults: SongDefaults) -> Result<SongDefaults, AppError> {
    db.with_conn(|conn| {
        songs::save_song_defaults(conn, defaults)?;
        songs::song_defaults(conn)
    })
}
```

Reexportar em `commands/mod.rs` e registrar as duas linhas no `invoke_handler` de `lib.rs`.

- [ ] **Step 2: Espelhar tipos e wrappers no front**

`src/core/types/index.ts` (perto dos tipos de música):

```ts
export type LinesPerSlide = "1" | "2" | "keep";

export interface SongDefaults {
  linesPerSlide: LinesPerSlide;
}
```

`src/core/ipc/commands.ts`:

```ts
export async function getSongDefaults(): Promise<SongDefaults> {
  return invokeStrict<SongDefaults>("get_song_defaults");
}

export async function setSongDefaults(defaults: SongDefaults): Promise<SongDefaults> {
  return invokeStrict<SongDefaults>("set_song_defaults", { defaults });
}
```

- [ ] **Step 3: UI em Preferências → Músicas**

Em `SongsTab.tsx`, entre a seção "Importar de outro software de projeção" e "Grupos de música", adicionar a seção **"Linhas por slide"**: três opções ("1 linha por slide" → `"1"`, "2 linhas por slide" → `"2"`, "Estrofe inteira" → `"keep"`), carregando o valor com `getSongDefaults()` num `useEffect` e persistindo com `setSongDefaults(...)` ao escolher; em erro, `toast.error(err.message)`. Microcopy: "Padrão ao importar músicas e ao salvar letras da internet." (Abreviações de estilo: seguir os cards/radios já usados na aba.)

- [ ] **Step 4: Verificar**

Run: `cargo check -p open-presenter && npm run typecheck`
Expected: sem erros. Manual (desktop): Preferências → Músicas → trocar para "Estrofe inteira", fechar e reabrir o app, seção mostra "Estrofe inteira".

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands src-tauri/src/lib.rs src/core/types/index.ts src/core/ipc/commands.ts src/features/preferences/tabs/SongsTab.tsx
git commit -m "feat: preferência de linhas por slide no painel de músicas"
```

---

### Task 5: Aplicar o layout na importação e no salvar da internet

**Files:**
- Modify: `src-tauri/src/services/import.rs` (`import_holyrics_file` + testes)
- Modify: `src-tauri/src/commands/songs.rs` (`fetch_online_lyrics` ganha `db: State<'_, Db>`)

**Interfaces:**
- Consumes: `songs::song_defaults`, `songs::apply_layout` (Task 3), `lyrics::split_sections` (Task 2).
- Produces: `fetch_online_lyrics(db: State<'_, Db>, id: String, track_name: String, artist_name: String) -> Result<Song, AppError>` — mesma semântica, seções já quebradas pelo layout (sem mudança visível para o front; o wrapper TS continua igual).

- [ ] **Step 1: Escrever os testes que falham (em `services/import.rs`)**

```rust
const FIXTURE_SINGLE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/holyrics_single.json");

#[test]
fn importa_quebrando_estrofes_no_layout_padrao() {
    let conn = open_in_memory();
    let report = import_holyrics_file(&conn, Path::new(FIXTURE_SINGLE)).unwrap();
    assert_eq!(report.imported, vec!["A Boa Parte".to_string()]);
    let summary = songs::list(&conn, Some("A Boa Parte")).unwrap();
    let song = songs::get(&conn, &summary[0].id).unwrap().unwrap();
    // 11 parágrafos quebrados de 2 em 2 linhas → 19 seções (default = "2")
    assert_eq!(song.sections.len(), 19);
    assert_eq!(song.sections[0].lines, vec!["Precioso Jesus", "Aos Teus pés aqui estou"]);
}

#[test]
fn estrofe_rotulada_quebrada_mantem_rotulo_so_no_primeiro_fragmento() {
    let conn = open_in_memory();
    let path = std::env::temp_dir().join(format!("layout-{}.txt", std::process::id()));
    std::fs::write(
        &path,
        "Título: Hino\nArtista: X\n\n##(Verso 1)\nlinha 1\nlinha 2\nlinha 3\nlinha 4\n",
    )
    .unwrap();
    import_holyrics_file(&conn, &path).unwrap();
    let summary = songs::list(&conn, Some("Hino")).unwrap();
    let song = songs::get(&conn, &summary[0].id).unwrap().unwrap();
    assert_eq!(song.sections.len(), 2);
    assert_eq!(song.sections[0].section_type, Some(SectionType::Verse));
    assert_eq!(song.sections[1].section_type, None);
    std::fs::remove_file(&path).ok();
}

#[test]
fn layout_keep_nao_quebra_estrofes() {
    let conn = open_in_memory();
    songs::save_song_defaults(
        &conn,
        SongDefaults { lines_per_slide: LinesPerSlide::Keep },
    )
    .unwrap();
    import_holyrics_file(&conn, Path::new(FIXTURE_SINGLE)).unwrap();
    let summary = songs::list(&conn, Some("A Boa Parte")).unwrap();
    let song = songs::get(&conn, &summary[0].id).unwrap().unwrap();
    assert_eq!(song.sections.len(), 11);
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test -p open-presenter services::import`
Expected: `importa_quebrando_estrofes_no_layout_padrao` FAIL (19 ≠ 11); `layout_keep_nao_quebra_estrofes` pode passar por acidente — os outros dois definem a mudança.

- [ ] **Step 3: Implementar**

`import_holyrics_file`: ler `let defaults = songs::song_defaults(conn)?;` uma vez e, antes do `insert_new`, aplicar `let sections = songs::apply_layout(song.sections, defaults);`.

`fetch_online_lyrics` (commands/songs.rs): adicionar `db: State<'_, Db>` e, depois do `lrclib::fetch` (rede primeiro, lock depois):

```rust
let sections = db.with_conn(|conn| {
    let defaults = songs::song_defaults(conn)?;
    Ok(songs::apply_layout(sections, defaults))
})?;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test -p open-presenter services::import` e depois `cargo test -p open-presenter`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/import.rs src-tauri/src/commands/songs.rs
git commit -m "feat: importação e letra da internet aplicam linhas por slide"
```

---

### Task 6: Vários arquivos + relatório agregado + copy da tela

**Files:**
- Modify: `src-tauri/src/services/import.rs` (`import_holyrics_files` + testes)
- Modify: `src-tauri/src/commands/songs.rs` (`import_holyrics` passa a receber `paths: Vec<String>`)
- Modify: `src/core/ipc/commands.ts` (`importHolyrics(paths: string[])`)
- Modify: `src/features/songs/services/files.ts` (`pickHolyricsFiles`)
- Modify: `src/features/songs/store.ts` (`startHolyricsImport`)
- Modify: `src/features/preferences/tabs/SongsTab.tsx` (copy da importação)

**Interfaces:**
- Produces:
  - Rust: `import::import_holyrics_files(conn: &Connection, paths: &[String]) -> Result<ImportReport, AppError>` — agrega; erro por arquivo entra em `errors` como `"{nome do arquivo} — {mensagem}"` e o lote continua.
  - Rust: `#[tauri::command] pub fn import_holyrics(db: State<'_, Db>, paths: Vec<String>) -> Result<ImportReport, AppError>`.
  - TS: `importHolyrics(paths: string[]): Promise<ImportReport>`; `pickHolyricsFiles(): Promise<string[]>` (sempre array; `[]` quando cancelado).

- [ ] **Step 1: Escrever o teste que falha (em `services/import.rs`)**

```rust
const FIXTURE_ARRAY: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/holyrics_array.json");

#[test]
fn importa_varios_arquivos_e_reporta_erro_por_arquivo() {
    let conn = open_in_memory();
    let ausente = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/nao-existe.json").to_string();
    let report = import_holyrics_files(
        &conn,
        &[FIXTURE_ARRAY.to_string(), FIXTURE_SINGLE.to_string(), ausente],
    )
    .unwrap();
    assert_eq!(report.imported.len(), 4);
    assert!(report.errors.is_empty() == false);
    assert!(report.errors[0].contains("nao-existe.json"));

    let segunda_rodada = import_holyrics_files(
        &conn,
        &[FIXTURE_ARRAY.to_string(), FIXTURE_SINGLE.to_string()],
    )
    .unwrap();
    assert!(segunda_rodada.imported.is_empty());
    assert_eq!(segunda_rodada.skipped.len(), 4);
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test -p open-presenter services::import`
Expected: FAIL — `import_holyrics_files` não existe.

- [ ] **Step 3: Implementar (Rust + front)**

`import_holyrics_files`: laço sobre `paths` chamando o `import_holyrics_file` atual; merge de `imported`/`skipped`; em `Err`, `report.errors.push(format!("{} — {}", file_name, e))` usando `Path::new(path).file_name()` (lossy) e `e.to_string()`.

`commands/songs.rs`: trocar `import_holyrics(path: String)` por `import_holyrics(db, paths: Vec<String>)` delegando a `import::import_holyrics_files`.

`files.ts`:

```ts
export async function pickHolyricsFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const selected = await open({
    multiple: true,
    filters: [{ name: "Holyrics", extensions: ["json", "txt"] }],
  });
  if (typeof selected === "string") return [selected];
  return Array.isArray(selected) ? selected : [];
}
```

`store.ts` (`startHolyricsImport`): `const paths = await pickHolyricsFiles(); if (paths.length === 0) return;` e `importHolyrics(paths)` no lugar de `importHolyrics(path)`.

`SongsTab.tsx` (copy, linhas ~101–105 e botão ~114): "Importe sua biblioteca de músicas de outro software de projeção (.json ou .txt). Selecione um ou vários arquivos. Músicas já existentes (mesmo título e artista) são ignoradas." e botão "Importar músicas (.json, .txt)".

- [ ] **Step 4: Verificar**

Run: `cargo test -p open-presenter && npm run typecheck`
Expected: PASS / sem erros. Manual (desktop): importar `holyrics_array.json` + `holyrics_single.json` juntos → relatório com 4 músicas; importar de novo → 4 puladas; menu "Importar Músicas do Holyrics…" continua funcionando.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/import.rs src-tauri/src/commands/songs.rs src/core/ipc/commands.ts src/features/songs/services/files.ts src/features/songs/store.ts src/features/preferences/tabs/SongsTab.tsx
git commit -m "feat: importa vários arquivos Holyrics com relatório agregado"
```

---

## Self-Review Notes

- **Cobertura da spec (F1):** D1 (objeto/array) → T1; D2 (copy) → T6; D3 (sem inventar rótulo) → T1; D4 (config + default 2 + aplicar em importar/internet) → T3/T4/T5; D13 (rótulo só no primeiro fragmento) → T2/T5; fixtures reais → T1; multi-arquivo agregado → T6.
- **Fora deste plano (só nas fases seguintes):** o botão "Dividir em 1/2 linhas" do painel passa a seguir a regra do primeiro fragmento (F2, é UI de slides) e o remote usa o layout no salvar da internet (F4) — este plano deixa a aplicação centralizada em `songs::apply_layout` para as duas fases reusarem.
