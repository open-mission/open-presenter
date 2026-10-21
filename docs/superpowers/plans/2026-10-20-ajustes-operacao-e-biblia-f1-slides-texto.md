# F1 — Slides vazios e controle de texto · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer duas linhas em branco virarem um slide vazio de verdade, oferecer um slide vazio opcional no início de toda música e separar “ocultar texto” (`C`) de “mostrar só o papel de parede” (`F`).

**Architecture:** O parser Rust e o espelho TS passam a contar runs de linhas em branco e a preservar seções vazias. `buildSongSlides` ganha `sectionIndex`/`isBlank` e a opção `addEmptySlideAtStart`; as ações de edição usam `sectionIndex`, nunca o índice visual. `SongDefaults` ganha a preferência global e um store em `core` distribui o valor para setlist, runner, página de músicas e controle remoto. O estado ao vivo ganha `textHidden` em TS e Rust, e a renderização pública esvazia apenas os props de texto.

**Tech Stack:** Rust (Tauri 2, serde, rusqlite), React 19 + TypeScript + Zustand, Tailwind v4, testes com `node --test` e `cargo test`.

**Spec:** `docs/superpowers/specs/2026-10-20-ajustes-operacao-e-biblia-design.md`

## Global Constraints

- Não adicionar dependências.
- Não alterar o formato de armazenamento das músicas: o slide vazio é derivado do texto (`\n\n\n`), não de um novo campo persistido.
- `src-tauri` e `src/core/types` devem permanecer sincronizados para `LiveSlide` e `SongDefaults`.
- `src/features/*` não importa outro `src/features/*` diretamente. O store de preferências de música fica em `src/core/store/songDefaultsStore.ts`.
- O editor de texto (`SongEditorDialog`) não mostra o slide sintético inicial.
- O palco continua vendo a letra quando `textHidden = true`.
- Projetar um slide novo sempre volta a mostrar o texto; “Limpar” sempre mostra apenas o fundo.
- Commits em Conventional Commits, curtos e no imperativo.
- Antes de fechar: `npm run typecheck`, `npm test`, `cargo test -p open-presenter`, `cargo check -p open-presenter`.

## Review Focus

- A regra de uma linha em branco continua idêntica; só duas ou mais criam slide vazio.
- Comentários (`//`) não podem começar a criar slides vazios.
- `sectionIndex` não pode deslocar rótulo, divisão ou reordenação quando o slide inicial está ligado.
- `textHidden` não pode esconder o fundo do tema, o logo, a moldura ou o lower third vazio.
- Todos os construtores de `LiveSlide` precisam compilar com o campo novo.
- O remapeamento do `runnerIndex` não pode reprojetar o slide que está no ar.

## File Map

| Arquivo | Responsabilidade |
| --- | --- |
| `src-tauri/src/services/lyrics.rs` | Parser/serializador de slides vazios |
| `src-tauri/src/services/songs.rs` | `SongDefaults` com `add_empty_slide_at_start` |
| `src-tauri/src/services/slide_builder.rs` | Slides remotos com prefixo opcional |
| `src-tauri/src/server/remote.rs` | Endpoints de música leem a preferência e montam `LiveSlide` |
| `src-tauri/src/state/types.rs` | `LiveSlide.text_hidden` e `SongDefaults` |
| `src/core/types/index.ts` | `LiveSlide.textHidden` e `SongDefaults` |
| `src/core/lib/lyrics.ts` | `RunnerSlide`, `buildSongSlides`, `computeSlideGroups` |
| `src/core/lib/media.ts` | Literais de `RunnerSlide` com `sectionIndex`/`isBlank` |
| `src/core/store/songDefaultsStore.ts` | Store compartilhado da preferência |
| `src/core/ipc/commands.ts` | Contrato de `getSongDefaults`/`setSongDefaults` |
| `src/features/songs/songEditorUtils.ts` | `assignSectionLabel` preservando slides vazios |
| `src/features/songs/SongEditorDialog.tsx` | Preview do editor com slide sintético; texto cru não muda |
| `src/features/songs/SongSlidesPreview.tsx` | Rótulo por `sectionIndex`; placeholder de vazio |
| `src/features/songs/SongsPage.tsx` | Constrói slides com a preferência |
| `src/features/preferences/tabs/SongsTab.tsx` | Opção “Adicionar slide vazio no início” |
| `src/features/events-setlists/store.ts` | `projectSection`/`projectNext` e remapeamento |
| `src/features/events-setlists/SongSlidesColumn.tsx` | Consome `sectionIndex`, grupos vazios e atalhos com foco |
| `src/features/events-setlists/SongRunner.tsx` | Runner com slide vazio |
| `src/features/remote/remoteSetlist.ts` | Publisher remoto com a preferência |
| `src/features/remote/useRemoteSetlistPublisher.ts` | Escuta o store de preferências |
| `src/features/presentation/store.ts` | `textHidden`, `toggleClear`, `showBackground` |
| `src/features/presentation/LiveControls.tsx` | Literal sintético de `LiveSlide` com `textHidden` |
| `src/features/presentation/SlideTransition.tsx` | Repassa `hideText` |
| `src/features/presentation/SlideCanvas.tsx` | Fallback sem tema respeita `hideText` |
| `src/features/slide-themes/themeTemplate.ts` | `buildProps(..., { hideText })` |
| `src/views/PublicView.tsx`, `src/views/StreamView.tsx` | Saídas públicas |
| `src/features/presentation/LivePreview.tsx` | Monitor “Ao Vivo” |
| `src/features/remote/RemoteView.tsx` | Prévia do controle remoto |
| `src/components/AppTopBar.tsx` | Botões C/F e atalhos globais |

## Task 1: Parser e serialização preservam slides vazios (Rust)

**Files:**
- Modify: `src-tauri/src/services/lyrics.rs`
- Test: `src-tauri/src/services/lyrics.rs` (módulo `tests`)

- [ ] **Step 1: Escrever testes que falham**

Adicionar testes ao módulo existente. Cobrir exatamente:

```rust
#[test]
fn uma_linha_em_branco_nao_cria_slide_vazio() {
    let sections = parse_sections("A\n\nB");
    assert_eq!(
        sections,
        blocks(vec![(None, vec!["A"]), (None, vec!["B"])])
    );
}

#[test]
fn duas_linhas_em_branco_criam_um_slide_vazio() {
    let sections = parse_sections("A\n\n\nB");
    assert_eq!(
        sections,
        blocks(vec![
            (None, vec!["A"]),
            (None, vec![]),
            (None, vec!["B"]),
        ])
    );
}

#[test]
fn tres_ou_mais_linhas_em_branco_colapsam_em_um_slide_vazio() {
    let sections = parse_sections("A\n\n\n\n\nB");
    assert_eq!(sections.len(), 3);
    assert!(sections[1].lines.is_empty());
}

#[test]
fn brancos_iniciais_e_finais_sao_ignorados() {
    assert_eq!(
        parse_sections("\n\nA\n\n\n"),
        blocks(vec![(None, vec!["A"])])
    );
}

#[test]
fn comentarios_sozinhos_nao_criam_slide_vazio() {
    let sections = parse_sections("A\n\n\n// observação\nB");
    assert_eq!(sections.len(), 2);
    assert_eq!(sections[0].lines, vec!["A"]);
    assert_eq!(sections[1].lines, vec!["// observação", "B"]);
}

#[test]
fn round_trip_preserva_slide_vazio_entre_blocos() {
    let original = blocks(vec![
        (None, vec!["A"]),
        (None, vec![]),
        (None, vec!["B"]),
    ]);
    let text = sections_to_text(&original);
    assert_eq!(text, "A\n\n\nB");
    assert_eq!(parse_sections(&text), original);
}

#[test]
fn split_sections_preserva_secao_vazia() {
    let sections = blocks(vec![(None, vec![]), (None, vec!["A", "B"])]);
    let split = split_sections(&sections, 1);
    assert!(split[0].lines.is_empty());
    assert_eq!(split.len(), 3);
}
```

Atualizar o teste existente `normaliza_bom_crlf_espacos_e_linhas_em_branco_repetidas` (ou equivalente) para esperar um slide vazio em vez de apenas dois blocos.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cargo test -p open-presenter services::lyrics
```

Esperado: os testes novos falham porque runs de duas ou mais linhas em branco continuam sendo colapsados.

- [ ] **Step 3: Implementar**

Em `parse_sections`:

1. Manter o fechamento de bloco na primeira linha em branco.
2. Contar `blank_run` consecutivo, mas **não** inserir o vazio imediatamente.
3. Ao começar o próximo bloco, se a primeira linha for conteúdo real e `blank_run >= 2`, inserir **um** `SongSection { section_type: None, lines: vec![] }` antes do bloco, desde que já exista conteúdo antes.
4. Se a primeira linha do próximo bloco for comentário (`//`), descartar o `blank_run`: o bloco de comentário suprime o vazio, como no comportamento atual. Runs maiores que 2 continuam gerando um único vazio.
5. Blocos cujo `lines` só contêm comentários continuam sem fechar por linha em branco.
6. No final, remover seções vazias no início e no fim e colapsar vazias consecutivas; brancos finais não inserem vazio porque não há próximo bloco.

Em `sections_to_text`:

- Ignorar seções vazias no início/fim.
- Entre um bloco com conteúdo e o próximo bloco com conteúdo, usar `\n\n` quando não há vazio e `\n\n\n` quando há um vazio pendente.
- Dois ou mais vazios seguidos continuam gerando um único separador `\n\n\n`.
- Não colocar separador extra depois do último bloco.

`split_sections` já copia seções com `lines.len() <= per`; confirmar com o teste novo, sem alterar a lógica.

- [ ] **Step 4: Rodar e ver passar**

```bash
cargo test -p open-presenter services::lyrics
cargo test -p open-presenter services::songs
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/lyrics.rs
git commit -m "feat(lyrics): preserva slides vazios no parser"
```

## Task 2: `buildSongSlides` com `sectionIndex`, `isBlank` e slide inicial (TS)

**Files:**
- Modify: `src/core/lib/lyrics.ts`
- Modify: `src/core/lib/media.ts`
- Modify: `src/core/lib/lyrics.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Adicionar casos em `src/core/lib/lyrics.test.ts`:

```ts
test("marca sectionIndex e isBlank em todas as seções", () => {
  const song = makeSong({
    sections: [
      { sectionType: "verse", lines: ["A"] },
      { sectionType: null, lines: [] },
      { sectionType: "chorus", lines: ["B"] },
    ],
  });
  const slides = buildSongSlides(song);
  expect(slides.map((s) => s.sectionIndex)).toEqual([0, 1, 2]);
  expect(slides.map((s) => s.isBlank)).toEqual([false, true, false]);
  expect(slides.map((s) => s.index)).toEqual([0, 1, 2]);
});

test("prefixa slide sintético quando addEmptySlideAtStart é true", () => {
  const song = makeSong({
    sections: [{ sectionType: "verse", lines: ["A"] }],
  });
  const slides = buildSongSlides(song, { addEmptySlideAtStart: true });
  expect(slides).toHaveLength(2);
  expect(slides[0]).toMatchObject({
    index: 0,
    sectionIndex: null,
    isBlank: true,
    label: null,
    slide: {
      id: `${song.id}#empty-start`,
      title: "",
      lines: [],
    },
  });
  expect(slides[1]).toMatchObject({
    index: 1,
    sectionIndex: 0,
    isBlank: false,
  });
});

test("slide vazio abre um grupo próprio", () => {
  const groups = computeSlideGroups([
    { index: 0, label: "Verso", sectionType: "verse" },
    { index: 1, label: null, sectionType: null, isBlank: true },
    { index: 2, label: null, sectionType: null },
  ]);
  expect(groups.map((g) => g.indices)).toEqual([[0], [1], [2]]);
  expect(groups[1].isBlank).toBe(true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/core/lib/lyrics.test.ts
```

- [ ] **Step 3: Implementar**

Em `src/core/lib/lyrics.ts`:

```ts
export interface RunnerSlide {
  index: number;
  sectionIndex: number | null;
  isBlank: boolean;
  label: string | null;
  sectionType: SectionType | null;
  slide: SlideContent;
}

export interface BuildSongSlidesOptions {
  addEmptySlideAtStart?: boolean;
}

export function buildSongSlides(
  song: Song,
  options: BuildSongSlidesOptions = {},
): RunnerSlide[] {
  const labels = computeSectionLabels(song.sections);
  const offset = options.addEmptySlideAtStart ? 1 : 0;

  const realSlides = song.sections.map((section, sectionIndex) => ({
    index: sectionIndex + offset,
    sectionIndex,
    isBlank: section.lines.length === 0,
    label: labels[sectionIndex] ?? null,
    sectionType: section.sectionType,
    slide: {
      id: `${song.id}#${sectionIndex}`,
      kind: "lyric" as const,
      title: section.lines.length === 0 ? "" : song.title,
      lines: section.lines,
      section: labels[sectionIndex] ?? undefined,
    },
  }));

  if (!offset) return realSlides;

  return [
    {
      index: 0,
      sectionIndex: null,
      isBlank: true,
      label: null,
      sectionType: null,
      slide: {
        id: `${song.id}#empty-start`,
        kind: "lyric",
        title: "",
        lines: [],
      },
    },
    ...realSlides,
  ];
}
```

Em `SlideGroup`/`GroupableSlide`, adicionar `isBlank: boolean`/`isBlank?: boolean`. Em `computeSlideGroups`, iniciar um grupo novo quando `slide.isBlank === true`, mesmo com `label === null`, e preencher `isBlank`. Também iniciar grupo novo quando o grupo atual for `isBlank` e o próximo slide não for vazio, para o vazio não absorver o bloco seguinte sem rótulo.

Em `src/core/lib/media.ts`, todos os literais de `RunnerSlide` ganham `sectionIndex: null` e `isBlank: false` (mídia não participa da edição de seções). Atualizar também o helper `slide()` de `src/core/lib/lyrics.test.ts`.

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/core/lib/lyrics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/core/lib/lyrics.ts src/core/lib/media.ts src/core/lib/lyrics.test.ts
git commit -m "feat(lyrics): adiciona slide inicial e grupos vazios"
```

## Task 3: `assignSectionLabel` e editor preservam o slide vazio

**Files:**
- Modify: `src/features/songs/songEditorUtils.ts`
- Create: `src/features/songs/songEditorUtils.test.ts`
- Modify: `src/features/songs/SongSlidesPreview.tsx`
- Modify: `src/features/events-setlists/SongRunner.tsx`

- [ ] **Step 1: Escrever testes que falham**

Para o `node --test` resolver o módulo, trocar os imports de alias de `songEditorUtils.ts` por relativos (`../../core/config/lyrics.ts` e `../../core/types`) antes de criar o teste.

Criar `src/features/songs/songEditorUtils.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { assignSectionLabel } from "./songEditorUtils.ts";

test("rotula o bloco depois de um slide vazio sem destruí-lo", () => {
  assert.equal(
    assignSectionLabel("A\n\n\nB", 2, "chorus"),
    "A\n\n\n## Refrão\nB",
  );
});

test("rotula o primeiro bloco mantendo o vazio", () => {
  assert.equal(
    assignSectionLabel("A\n\n\nB", 0, "verse"),
    "## Verso\nA\n\n\nB",
  );
});

test("não altera o texto quando o alvo é um slide vazio", () => {
  assert.equal(assignSectionLabel("A\n\n\nB", 1, "chorus"), "A\n\n\nB");
});

test("remove rótulo preservando o slide vazio", () => {
  assert.equal(
    assignSectionLabel("A\n\n\n## Refrão\nB", 2, null),
    "A\n\n\nB",
  );
});
```

A sequência de `"A\n\n\nB"` é `[A, vazio, B]`: o índice 1 é o vazio e o índice 2 é B.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/features/songs/songEditorUtils.test.ts
```

- [ ] **Step 3: Implementar**

Substituir o parser interno de `assignSectionLabel` por helpers puros no mesmo arquivo:

```ts
interface RawSongSection {
  lines: string[];
  hasContent: boolean;
  headerLineIdx: number;
  isEmpty: boolean;
}

function parseRawSongSections(rawText: string): RawSongSection[];
function serializeRawSongSections(sections: RawSongSection[]): string;
```

Regras:

- O parser deve reconhecer `\n\n` como separador e `\n\n\n` (ou mais) como separador + seção vazia.
- `hasContent` só é verdadeiro para linhas que não são `//` nem `##`.
- Seções vazias entram na lista de slides, mas `assignSectionLabel` retorna `rawText` sem alteração quando o alvo é vazio.
- O serializador usa `\n\n` entre blocos e `\n\n\n` quando uma seção vazia estiver entre eles; ignora vazios nas pontas.
- Rótulo novo usa o formato atual `## ${SECTION_LABEL[type]}`.
- Remover rótulo apaga só a linha `##`.

Em `SongSlidesPreview`:

- Trocar a assinatura para `onSetLabel?: (sectionIndex: number, type: SectionType | null) => void`.
- Em todas as chamadas (menu de rótulo e menu de contexto), usar `item.sectionIndex`; se `null` ou `item.isBlank`, não renderizar/desabilitar a ação.
- Quando `item.slide.lines.length === 0`, mostrar `(Slide vazio)` no lugar das linhas.
- `onSetLabel` do `SongEditorDialog` já recebe `slideIndex`; renomear para `sectionIndex` e repassar para `assignSectionLabel`.

Em `SongEditorDialog`, apenas renomear o parâmetro de `onSetLabel` de `slideIndex` para `sectionIndex`. A integração do slide sintético no preview do editor fica na Task 5, depois que o store existir.

Em `SongRunner`, mostrar `Slide vazio` quando `block.isBlank` e não mostrar prévia de linhas vazia.

Em `SongsPage`, confirmar que o card de slide vazio mostra `(Slide vazio)`; se não mostrar, adicionar o placeholder no ponto onde as linhas são renderizadas.

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/features/songs/songEditorUtils.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/features/songs/songEditorUtils.ts src/features/songs/songEditorUtils.test.ts \
  src/features/songs/SongSlidesPreview.tsx src/features/songs/SongEditorDialog.tsx \
  src/features/events-setlists/SongRunner.tsx
git commit -m "feat(songs): preserva slide vazio ao editar rótulos"
```

## Task 4: Preferência global `addEmptySlideAtStart`

**Files:**
- Modify: `src-tauri/src/state/types.rs`
- Modify: `src-tauri/src/services/songs.rs`
- Modify: `src/core/types/index.ts`
- Create: `src/core/store/songDefaultsStore.ts`
- Modify: `src/features/preferences/tabs/SongsTab.tsx`
- Test: `src-tauri/src/services/songs.rs`

- [ ] **Step 1: Escrever testes que falham (Rust)**

Adicionar/ajustar testes de `song_defaults`:

```rust
#[test]
fn defaults_de_musica_incluem_slide_inicial() {
    let conn = open_in_memory();
    assert!(!song_defaults(&conn).unwrap().add_empty_slide_at_start);

    save_song_defaults(
        &conn,
        SongDefaults {
            lines_per_slide: LinesPerSlide::Two,
            add_empty_slide_at_start: true,
        },
    )
    .unwrap();

    let saved = song_defaults(&conn).unwrap();
    assert!(saved.add_empty_slide_at_start);
    assert_eq!(saved.lines_per_slide, LinesPerSlide::Two);
}
```

Atualizar todas as construções de `SongDefaults` nos testes existentes para incluir o campo novo.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cargo test -p open-presenter services::songs
```

- [ ] **Step 3: Implementar no Rust**

Em `src-tauri/src/state/types.rs`:

```rust
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SongDefaults {
    pub lines_per_slide: LinesPerSlide,
    #[serde(default)]
    pub add_empty_slide_at_start: bool,
}
```

Em `services/songs.rs`:

```rust
pub const LINES_PER_SLIDE_KEY: &str = "songs.lines_per_slide";
pub const ADD_EMPTY_SLIDE_AT_START_KEY: &str = "songs.add_empty_slide_at_start";
```

`song_defaults` lê `"true"` como verdadeiro; qualquer outro valor/ausência é `false`.
`save_song_defaults` grava `"true"`/`"false"` e continua gravando `lines_per_slide`.

- [ ] **Step 4: Implementar no frontend**

Em `src/core/types/index.ts`:

```ts
export interface SongDefaults {
  linesPerSlide: LinesPerSlide;
  addEmptySlideAtStart: boolean;
}
```

Criar `src/core/store/songDefaultsStore.ts`:

```ts
interface SongDefaultsState {
  linesPerSlide: LinesPerSlide;
  addEmptySlideAtStart: boolean;
  loaded: boolean;
  loading: boolean;
  load(): Promise<void>;
  update(patch: Partial<SongDefaults>): Promise<SongDefaults>;
}
```

- `load()` chama `getSongDefaults()` uma vez (idempotente: não repete se já estiver carregando/carregado); em ambiente web, marca `loaded` sem chamar IPC.
- `update(patch)` chama `setSongDefaults({ linesPerSlide, addEmptySlideAtStart, ...patch })` e atualiza o estado com a resposta.
- Erros sobem para o chamador; a UI mostra toast.

Em `SongsTab`:

- Remover o estado local `linesPerSlide` e o `useEffect` de carga.
- Usar `useSongDefaultsStore`.
- Adicionar `<Switch>` “Adicionar slide vazio no início de todas as músicas”, com descrição de que vale para músicas existentes e não altera a letra salva.
- Desabilitar enquanto `loading` ou `!loaded`.

- [ ] **Step 5: Rodar e ver passar**

```bash
cargo test -p open-presenter services::songs
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/state/types.rs src-tauri/src/services/songs.rs \
  src/core/types/index.ts src/core/store/songDefaultsStore.ts \
  src/features/preferences/tabs/SongsTab.tsx
git commit -m "feat(songs): adiciona preferência de slide vazio inicial"
```

## Task 5: Aplicar a preferência em todos os consumidores e remapear índices

**Files:**
- Modify: `src/features/events-setlists/store.ts`
- Modify: `src/features/events-setlists/SongSlidesColumn.tsx`
- Modify: `src/features/events-setlists/SongRunner.tsx`
- Modify: `src/features/songs/SongsPage.tsx`
- Modify: `src/features/songs/SongEditorDialog.tsx`
- Modify: `src/features/remote/remoteSetlist.ts`
- Modify: `src/features/remote/useRemoteSetlistPublisher.ts`
- Modify: `src/views/AdminView.tsx`
- Modify: `src-tauri/src/services/slide_builder.rs`
- Modify: `src-tauri/src/server/remote.rs`

- [ ] **Step 1: Escrever testes que falham (Rust)**

Em `slide_builder.rs`, adicionar:

```rust
#[test]
fn prefixa_slide_vazio_quando_solicitado() {
    let song = song_com_uma_secao();
    let slides = build_song_slides(&song, true);
    assert_eq!(slides.len(), 2);
    assert_eq!(slides[0].index, 0);
    assert_eq!(slides[0].content.id, format!("{}#empty-start", song.id));
    assert!(slides[0].content.lines.is_empty());
    assert!(slides[0].label.is_none());
    assert_eq!(slides[1].index, 1);
    assert_eq!(slides[1].section_type, Some(SectionType::Verse));
}
```

Atualizar as chamadas existentes para `build_song_slides(&song, false)`.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cargo test -p open-presenter services::slide_builder
```

- [ ] **Step 3: Implementar o slide remoto**

Em `slide_builder.rs`, mudar a assinatura para:

```rust
pub fn build_song_slides(song: &Song, add_empty_slide_at_start: bool) -> Vec<RemoteSlide>
```

- Quando `false`, manter os índices atuais.
- Quando `true`, prefixar um `RemoteSlide` com `index: 0`, `label: None`, `section_type: None`, `content.id = "{song.id}#empty-start"`, `title = ""`, `lines = vec![]`.
- Seções reais passam a `index + 1`; `content.id` continua `"{song.id}#{section_index}"`.

Em `server/remote.rs`, em `song_slides` e `present_song`:

```rust
let defaults = match db.with_conn(songs::song_defaults) {
    Ok(defaults) => defaults,
    Err(err) => return internal(&err.to_string()),
};
let slides = slide_builder::build_song_slides(&song, defaults.add_empty_slide_at_start);
```

Ao construir `LiveSlide`, adicionar `text_hidden: false` em **todos** os literais (será exigido na Task 6).

- [ ] **Step 4: Implementar os consumidores TS**

Em `useSetlistStore`:

- `projectSection` chama `buildSongSlides(song, { addEmptySlideAtStart: useSongDefaultsStore.getState().addEmptySlideAtStart })`.
- `projectNext` conta os slides com a mesma opção; o primeiro slide da próxima música também usa a opção.
- Adicionar ação:

```ts
shiftRunnerIndex(delta: -1 | 1, addEmptySlideAtStart: boolean): void
```

Regra:

- Se `runnerIndex === null`, não faz nada.
- Se `!addEmptySlideAtStart && runnerIndex === 0`, mantém `0`.
- Caso contrário, `Math.max(0, runnerIndex + delta)`.

Em `SongSlidesColumn`:

- Ler `addEmptySlideAtStart` do store e passar para `buildSongSlides`.
- Em um `useEffect` que observa a opção, ajustar `previewIndex` em `+1`/`-1` se ele não for `null`, limitar ao intervalo `[0, slides.length - 1]` e chamar `setPreview` com o slide correspondente.
- Não reprojetar o slide no ar.

Em `SongRunner` e `SongsPage`, passar a opção para `buildSongSlides`.

Em `SongEditorDialog`:

- `previewSlides(sections, draft, addEmptySlideAtStart)` chama `buildSongSlides(song, { addEmptySlideAtStart })`. O preview do editor mostra o slide sintético; o editor de texto cru continua sem mostrá-lo.
- Ler `addEmptySlideAtStart` de `useSongDefaultsStore` e incluir na chamada de `previewSlides`.

Em `remoteSetlist.ts`, adicionar `addEmptySlideAtStart` ao parâmetro de `buildRemoteSetlist`, repassar por `buildRemoteItem` e passar para `buildSongSlides`. Em `useRemoteSetlistPublisher`, ler a opção do store e incluí-la nas dependências do efeito.

Em `AdminView`:

- Chamar `useSongDefaultsStore.getState().load()` no mount.
- Observar `addEmptySlideAtStart` com `useRef` do valor anterior; quando mudar, chamar `useSetlistStore.getState().shiftRunnerIndex(delta, value)`.
- Importar `useRef` de `react` (o arquivo já importa `useEffect`/`useState`).

- [ ] **Step 5: Rodar e ver passar**

```bash
cargo test -p open-presenter services::slide_builder
cargo test -p open-presenter server::remote
npm run typecheck
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/features/events-setlists/store.ts src/features/events-setlists/SongSlidesColumn.tsx \
  src/features/events-setlists/SongRunner.tsx src/features/songs/SongsPage.tsx \
  src/features/songs/SongEditorDialog.tsx \
  src/features/remote/remoteSetlist.ts src/features/remote/useRemoteSetlistPublisher.ts \
  src/views/AdminView.tsx src-tauri/src/services/slide_builder.rs \
  src-tauri/src/server/remote.rs
git commit -m "feat(setlist): aplica slide inicial em todas as sequências"
```

## Task 6: `textHidden` no contrato ao vivo e nos controles

**Files:**
- Modify: `src/core/types/index.ts`
- Modify: `src-tauri/src/state/types.rs`
- Modify: `src/features/presentation/store.ts`
- Modify: `src/components/AppTopBar.tsx`
- Modify: `src-tauri/src/state/presentation.rs`
- Test: `src-tauri/src/state/presentation.rs` ou `src-tauri/src/state/types.rs`

- [ ] **Step 1: Escrever teste que falha (Rust)**

Adicionar em `state/presentation.rs`:

```rust
#[test]
fn live_slide_sem_text_hidden_no_json_usa_false() {
    let live: LiveSlide = serde_json::from_value(serde_json::json!({
        "content": {
            "id": "x",
            "kind": "lyric",
            "title": "T",
            "lines": ["L"],
            "notes": null
        },
        "background": { "id": "bg", "kind": "color", "value": "#000" },
        "blackout": false,
        "cleared": false,
        "updatedAt": "0"
    }))
    .unwrap();
    assert!(!live.text_hidden);
}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cargo test -p open-presenter state::presentation
```

- [ ] **Step 3: Implementar o contrato**

Em `src-tauri/src/state/types.rs`:

```rust
#[serde(default, rename = "textHidden")]
pub text_hidden: bool,
```

Em `src/core/types/index.ts`:

```ts
textHidden: boolean;
```

Adicionar `text_hidden: false` em todos os literais de `LiveSlide` em `server/remote.rs` e no JSON de `blank_slide`.

- [ ] **Step 4: Implementar o store e os botões**

Em `src/features/presentation/store.ts`:

- `EMPTY_SLIDE` ganha `textHidden: false`.
- `publishLive`: `textHidden: false`.
- `clearLive`: `cleared: true`, `textHidden: false`.
- `toggleClear`: alterna `textHidden`, força `cleared: false`, `blackout: false` e sincroniza `ipcSetBlackout(false)` se necessário.
- `showBackground`: alterna `cleared`, força `textHidden: false` e `blackout: false`.
- `setCleared` deve, ao ligar `cleared`, desligar `textHidden`.
- Atualizar `EMPTY_SLIDE`, o `LiveSlide` sintético de `LivePreview` e o literal de `LiveControls`.

Em `AppTopBar`:

- Botão “Plano de Fundo” usa `live.cleared && !live.blackout`.
- Botão “Sem Texto” usa `live.textHidden`.
- `C` chama `toggleClear()`; `F` chama `showBackground()`.
- Handler global retorna cedo se `live.content.kind === "blank"`.
- Handler ignora `target.closest("input, textarea, [contenteditable='true'], [role='dialog']")`.
- `B` também só funciona com apresentação ativa.

- [ ] **Step 5: Rodar e ver passar**

```bash
cargo test -p open-presenter state::presentation
cargo check -p open-presenter
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/core/types/index.ts src-tauri/src/state/types.rs \
  src-tauri/src/state/presentation.rs src-tauri/src/server/remote.rs \
  src/features/presentation/store.ts src/features/presentation/LivePreview.tsx \
  src/features/presentation/LiveControls.tsx src/components/AppTopBar.tsx
git commit -m "feat(live): separa ocultar texto de mostrar fundo"
```

## Task 7: Renderização pública com `textHidden`

**Files:**
- Modify: `src/features/slide-themes/themeTemplate.ts`
- Modify: `src/features/presentation/SlideTransition.tsx`
- Modify: `src/features/presentation/SlideCanvas.tsx`
- Modify: `src/views/PublicView.tsx`
- Modify: `src/views/StreamView.tsx`
- Modify: `src/features/presentation/LivePreview.tsx`
- Modify: `src/features/remote/RemoteView.tsx`
- Test: `src/features/slide-themes/themeTemplate.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Para o `node --test` resolver os imports, trocar os imports de alias de `themeTemplate.ts` por relativos com extensão explícita (`../../core/lib/lyrics.ts`, `../../core/types/index.ts`, `../../core/lib/format.ts`, `../bible/bibleParser.ts`). É o mesmo padrão já usado por `src/core/lib/lyrics.ts`.

Criar `src/features/slide-themes/themeTemplate.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildProps } from "./themeTemplate.ts";
import type { SlideContent } from "../../core/types/index.ts";

const lyric: SlideContent = {
  id: "s#0",
  kind: "lyric",
  title: "Título",
  lines: ["Linha"],
  section: "Verso",
};

test("hideText esvazia todos os props de texto", () => {
  const props = buildProps("lyric", lyric, null, { hideText: true });
  for (const value of Object.values(props)) {
    assert.equal(value, "");
  }
});

test("letra vazia não mostra título nem prévia do próximo", () => {
  const blank: SlideContent = {
    id: "s#empty-start",
    kind: "lyric",
    title: "",
    lines: [],
  };
  const props = buildProps("lyric", blank, lyric);
  assert.equal(props.title, "");
  assert.equal(props.lyrics, "");
  assert.equal(props.next_preview, "");
  assert.equal(props.next_line, "");
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/features/slide-themes/themeTemplate.test.ts
```

- [ ] **Step 3: Implementar `buildProps`**

Adicionar um quarto parâmetro:

```ts
export function buildProps(
  kind: SlideKind,
  content: SlideContent,
  nextUp?: SlideContent | null,
  options?: { hideText?: boolean },
): Record<string, string>
```

- Calcular `const hidesText = options?.hideText === true;`
- Calcular `const isBlankLyric = kind === "lyric" && cleanPublicLines(content.lines).length === 0;`
- Quando `isBlankLyric`, usar `""` para `nextVerse`, `nextPreview` e `nextLine`.
- No final, se `hidesText`, retornar um objeto com as mesmas chaves e todos os valores `""`.

Não esconder `hideText` de `media` ou `blank`; a função apenas zera os props.

- [ ] **Step 4: Propagar**

`SlideTransition`:

- Adicionar `textHidden?: boolean` às props.
- `RenderSingleSlide` recebe `hideText` e chama `buildProps(kind, content, nextUp, { hideText })`.
- `SlideCanvas` recebe `hideText`.
- `currentKey` pode continuar igual; o `useEffect` já atualiza `active` no ramo `else`. Incluir `textHidden` nas dependências.

`SlideCanvas`:

- Adicionar `hideText?: boolean` com default `false` (não usar `slide.textHidden` como default, para o palco continuar vendo a letra quando renderiza `SlideCanvas` direto).
- Não renderizar título/linhas quando `hideText` for verdadeiro; o fundo e a mídia continuam.
- `SlideTransition` é quem repassa `textHidden` para `hideText`.

`PublicView`:

- Passar `textHidden={live.textHidden}` para `SlideTransition`.

`StreamView`:

- Passar `textHidden={live.textHidden}`.
- Manter `shouldClear = live.cleared || !isPresenting`.

`LivePreview`:

- No monitor “Ao Vivo”, passar `textHidden={live.textHidden}`.
- No monitor “Preview”, não passar (texto visível).

`RemoteView`:

- No card ao vivo, se `live?.textHidden`, exibir “Sem texto (fundo do tema)” no resumo e não renderizar `content.lines`/`title` no canvas.
- Não alterar os botões existentes do controle remoto.
- `isLivePresenting` continua verdadeiro com `textHidden`, para a toolbar de seções funcionar.

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test -- src/features/slide-themes/themeTemplate.test.ts
npm run typecheck
cargo check -p open-presenter
```

- [ ] **Step 6: Commit**

```bash
git add src/features/slide-themes/themeTemplate.ts src/features/slide-themes/themeTemplate.test.ts \
  src/features/presentation/SlideTransition.tsx src/features/presentation/SlideCanvas.tsx \
  src/views/PublicView.tsx src/views/StreamView.tsx \
  src/features/presentation/LivePreview.tsx src/features/remote/RemoteView.tsx
git commit -m "feat(live): aplica texto oculto nas saídas públicas"
```

## Task 8: “Foco manda” e ações por `sectionIndex` no painel do setlist

**Files:**
- Modify: `src/features/events-setlists/SongSlidesColumn.tsx`

- [ ] **Step 1: Implementar foco e atalhos**

- Adicionar `sectionRef = useRef<HTMLElement>(null)` e `tabIndex={-1}` no `<section>`.
- No `onPointerDown` da seção, chamar `sectionRef.current?.focus({ preventScroll: true })` quando o alvo não for um controle interativo.
- No handler de grupos, antes de procurar o grupo:

```ts
if (!sectionRef.current?.contains(document.activeElement)) return;
```

- Manter a ordem atual: se não houver grupo correspondente, retornar sem `preventDefault`/`stopPropagation`, permitindo que `AppTopBar` trate `B/C/F`.
- Não capturar `B/C/F` quando o foco estiver fora da coluna.

- [ ] **Step 2: Ações por `sectionIndex`**

Em todos os pontos do card:

- Rótulo: `handleUpdateSectionLabel(block.sectionIndex, type)`.
- Remover rótulo: `handleRemoveSectionLabel(block.sectionIndex)`.
- Dividir: `handleSplitSection(block.sectionIndex, n)`.
- Desabilitar as três ações quando `block.sectionIndex === null` ou `block.isBlank`.
- `draggable={block.sectionIndex !== null && !block.isBlank}`.
- Em `handleReorderSlides(sourceIndex, targetIndex)`, converter:

```ts
const source = slides[sourceIndex]?.sectionIndex;
const target = slides[targetIndex]?.sectionIndex;
if (source === null || source === undefined || target === null || target === undefined) return;
```

- Passar `source`/`target` para a lógica existente de `song.sections`.
- O slide sintético não pode ser arrastado.

- [ ] **Step 3: Exibir o vazio**

- No cabeçalho do grupo, quando `group.isBlank`, mostrar “Slide vazio” em vez de “Sem grupo”.
- No card, quando `block.slide.lines.length === 0`, mostrar `(Slide vazio)` no modo lista.
- O contador `#${block.index + 1}` continua sendo o índice visual.

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
npm test
```

Verificação manual:

1. Selecione uma música com Refrão configurado em `C`.
2. Clique dentro da coluna de letras e pressione `C`: deve pular para o refrão, não ocultar o texto.
3. Clique fora da coluna e pressione `C`: deve ocultar o texto.
4. Repita com uma música sem grupo `C`: `C` deve ocultar o texto mesmo com foco na coluna.

- [ ] **Step 5: Commit**

```bash
git add src/features/events-setlists/SongSlidesColumn.tsx
git commit -m "feat(setlist): prioriza atalhos de grupo com foco na coluna"
```

## Verification

```bash
npm run typecheck
npm test
cargo test -p open-presenter
cargo check -p open-presenter
```

Manual:

- `A\n\nB`, `A\n\n\nB`, `A\n\n\n\nB`, brancos no início/fim no editor.
- Salvar/reabrir música com slide vazio.
- Ligar/desligar “Adicionar slide vazio no início” com música ao vivo.
- `C`, `F`, `B` com e sem apresentação ativa.
- `C` com foco dentro/fora da coluna de letras.
- `PublicView`, `StreamView`, `StageView` e `RemoteView` com `C` ligado.

## Acceptance Checklist

- [ ] Duas linhas em branco criam um slide vazio; uma continua separando seções.
- [ ] Runs de três ou mais colapsam em um vazio.
- [ ] Brancos iniciais/finais são ignorados.
- [ ] Comentários não criam slides vazios.
- [ ] Round-trip preserva vazios entre blocos.
- [ ] `sectionIndex` correto em todas as seções.
- [ ] Slide inicial sintético aparece no setlist/runner/remoto/preview do editor, mas não no texto cru do editor.
- [ ] Rótulo/dividir/reordenar usam `sectionIndex`.
- [ ] Preferência global persiste e vale para músicas antigas.
- [ ] Alternar a opção com música ao vivo não troca o slide no ar.
- [ ] `C` oculta só o texto; `F` mostra o fundo; estados são exclusivos.
- [ ] Palco continua vendo a letra.
- [ ] `B/C/F` globais só funcionam com apresentação ativa.
- [ ] “Foco manda” funciona nos dois sentidos.
