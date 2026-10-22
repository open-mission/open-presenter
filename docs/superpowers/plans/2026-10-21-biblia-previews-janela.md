# Ajustes Bíblia / Previews / Janela Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 4 approved adjustments: books grid as a dense abbreviation "tabela periódica" (replaces `cards`), zoom density + clean-text mode on Bible and setlist verse preview grids, and start-maximized app window with persisted geometry.

**Architecture:** Three independent parts on one feature branch. Part A is a view-mode swap plus a dense grid in `BiblePage.tsx`. Part B adds a shared pure model (`previewGrid.ts`), a persistent number hook, then wires zoom + `"text"` mode into the two existing scripture preview panels. Part C is Rust-side window geometry preference (settings keys, two new IPC commands, geometry capture in `on_window_event`, restore with monitor-intersection validation), plus a General tab switch.

**Tech Stack:** Tauri v2 (Rust), React 19 + TS, Zustand, Tailwind v4, lucide-react, `node --test` + `assert`, `cargo test` for the pure geometry module.

**Spec:** `docs/superpowers/specs/2026-10-21-biblia-previews-janela-design.md`

## Global Constraints

- Do not add dependencies or change pinned versions in `package.json` / `Cargo.toml`.
- Always `HashRouter`; never touch routing or the Tauri protocol serving.
- Keep Rust↔TS shared types synchronized; new IPC commands must go through `commands/mod.rs` registration + `src/core/ipc/commands.ts` typed wrappers.
- Rust command errors use `AppError`. Commands delegate to services; no direct SQLite/window access from commands.
- Commits in Conventional Commits (pt-BR or en), short, imperative.
- Run `npm run typecheck` before every TS commit; `cargo check -p open-presenter` before Rust commits.
- Tests: `npm test` (`node --test` + `node:assert`); new pure logic gets `*.test.ts` next to source.
- Do not commit `.superpowers/` (gitignored).
- `src/core/types/index.ts` SlideContent/ScriptureRef unchanged (consumed by Rust and outputs).

## Review Focus

Input classes and failure modes the spec implies but no single task fully exercises — each line is pinned by a test in the owning task below:

1. **Legacy stored view modes** — a user who has `"cards"` saved for `open_presenter_bible_books_view` must land on `table` (the new default), not the list or a broken state. Task 2 pins `parseViewMode("cards", …) === "table"`.
2. **Corrupt/out-of-range zoom values in localStorage** — NaN, "abc", 99 must clamp to the panel's `[minLevel, maxLevel]` and a missing value falls back to the panel default. Task 1 pins this via `parsePersistentNumber`.
3. **Grid must stay responsive** — shrinking the window must produce fewer columns (wrap), never horizontal overflow; shrank tiles must not get larger than track allows. Task 1 pins that the produced style uses `repeat(auto-fit, minmax(...), 1fr)` with `1fr` growth.
4. **Off-screen saved geometry** — if `app.window_rect` no longer intersects any available monitor (monitor unplugged, resolution change), the app must open centered 1400×900, never invisible/off-screen. Task 5 pins `rects_intersect` + `fallback_rect`.
5. **Zoom direction semantics** — "aumentar zoom" = fewer/bigger tiles, "diminuir zoom" = more/smaller. Task 1 pins the direction in `BIBLE_PREVIEW_GRID`/`SETLIST_PREVIEW_GRID` tables (higher level ⇒ smaller min-width ⇒ more columns).
6. **Browser mode (non-Tauri)** — the new start-maximized toggle must be hidden and harmless outside Tauri; zoom/modes still persist via localStorage and render identically. Task 6 guards the toggle with `isTauri()`; Tasks 3–4 never call Tauri APIs.

---

### Task 1: Shared preview-grid model + persistent zoom hook

**Files:**
- Create: `src/core/lib/previewGrid.ts`
- Create: `src/core/lib/previewGrid.test.ts`
- Create: `src/core/lib/usePersistentNumber.ts`
- Create: `src/core/lib/usePersistentNumber.test.ts`

**Interfaces:**
- Consumes: nothing (pure + existing localStorage pattern from `usePersistentViewMode.ts`).
- Produces:
  - `interface PreviewGridConfig { minLevel: number; maxLevel: number; defaultLevel: number; minWidths: Record<number, number> }`
  - `const BIBLE_PREVIEW_GRID: PreviewGridConfig` — `{ minLevel: 1, maxLevel: 3, defaultLevel: 2, minWidths: { 1: 520, 2: 340, 3: 230 } }`
  - `const SETLIST_PREVIEW_GRID: PreviewGridConfig` — `{ minLevel: 1, maxLevel: 5, defaultLevel: 4, minWidths: { 1: 340, 2: 270, 3: 210, 4: 165, 5: 130 } }`
  - `function clampPreviewLevel(config: PreviewGridConfig, level: number): number` — round + clamp to `[minLevel, maxLevel]`
  - `function previewGridMinWidth(config: PreviewGridConfig, level: number): number` — depth-max, returns `config.minWidths[clampPreviewLevel(...)]`
  - `function previewGridStyle(config: PreviewGridConfig, level: number): { gridTemplateColumns: string }` — returns `{ gridTemplateColumns: "repeat(auto-fit, minmax(<minWidth>px, 1fr))" }`
  - `function parsePersistentNumber(raw: string | null, fallback: number, minLevel: number, maxLevel: number): number`
  - `function usePersistentNumber(storageKey: string, fallback: number, minLevel: number, maxLevel: number): [number, (next: number) => void]`

Higher zoom level ⇒ smaller min-width ⇒ more columns per row ("diminuir zoom mostra mais"). Zoom-in moves `level` down (bigger tiles). Values are initial/tunable; the `auto-fit` + `minmax` wrap is what guarantees responsiveness.

- [ ] **Step 1: Write failing tests in `previewGrid.test.ts` and `usePersistentNumber.test.ts`**

```ts
// previewGrid.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  BIBLE_PREVIEW_GRID, SETLIST_PREVIEW_GRID,
  clampPreviewLevel, previewGridMinWidth, previewGridStyle,
} from "./previewGrid.ts";

test("clampPreviewLevel arredonda e limita no intervalo", () => {
  assert.equal(clampPreviewLevel(BIBLE_PREVIEW_GRID, 0), 1);
  assert.equal(clampPreviewLevel(BIBLE_PREVIEW_GRID, 3.6), 3);
  assert.equal(clampPreviewLevel(SETLIST_PREVIEW_GRID, 9), 5);
  assert.equal(clampPreviewLevel(SETLIST_PREVIEW_GRID, 2.4), 2);
});

test("zoom maior => largura mínima menor (mais colunas)", () => {
  assert.ok(previewGridMinWidth(BIBLE_PREVIEW_GRID, 1) > previewGridMinWidth(BIBLE_PREVIEW_GRID, 3));
  assert.equal(BIBLE_PREVIEW_GRID.defaultLevel, 2);
  assert.equal(SETLIST_PREVIEW_GRID.defaultLevel, 4);
});

test("previewGridStyle usa auto-fit com minmax e 1fr (wrap responsivo)", () => {
  const { gridTemplateColumns } = previewGridStyle(SETLIST_PREVIEW_GRID, 4);
  assert.match(gridTemplateColumns, /^repeat\(auto-fit,\s*minmax\(\d+px,\s*1fr\)\)$/);
  assert.ok(gridTemplateColumns.includes(String(previewGridMinWidth(SETLIST_PREVIEW_GRID, 4))));
});
```

```ts
// usePersistentNumber.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { parsePersistentNumber } from "./usePersistentNumber.ts";

test("parsePersistentNumber usa fallback para ausente/NaN", () => {
  assert.equal(parsePersistentNumber(null, 2, 1, 3), 2);
  assert.equal(parsePersistentNumber("abc", 2, 1, 3), 2);
  assert.equal(parsePersistentNumber("NaN", 2, 1, 3), 2);
});

test("parsePersistentNumber limita no intervalo", () => {
  assert.equal(parsePersistentNumber("99", 2, 1, 3), 3);
  assert.equal(parsePersistentNumber("0.4", 2, 1, 3), 1);
  assert.equal(parsePersistentNumber("2", 2, 1, 3), 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx node --test src/core/lib/previewGrid.test.ts src/core/lib/usePersistentNumber.test.ts`
Expected: FAIL with "module not found" / "Cannot find module".

- [ ] **Step 3: Implement `previewGrid.ts`**

Static config objects plus the three pure functions above. `minWidths` uses numeric keys (`{ 1: 520, 2: 340, 3: 230 }`). `previewGridStyle` string-formats the clamped width into `repeat(auto-fit, minmax(<w>px, 1fr))`.

- [ ] **Step 4: Implement `usePersistentNumber.ts`**

Mirror the try/catch + `localStorage` pattern from `usePersistentViewMode.ts`; re-export `parsePersistentNumber` from the same file (init and setter both clamp through it).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — both new test files green (full suite still green).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/lib/previewGrid.ts src/core/lib/previewGrid.test.ts src/core/lib/usePersistentNumber.ts src/core/lib/usePersistentNumber.test.ts
git commit -m "feat: modelo compartilhado de zoom na grade de previews"
```

---

### Task 2: Books grid "tabela periódica" (Lista | Tabela)

**Files:**
- Modify: `src/features/bible/BiblePage.tsx` (booksView hook ~L94-103; column width ~L560; toggle options ~L565-572; render branch ~L621-670)
- Modify: `src/core/lib/viewMode.ts` (`ViewMode` type only)
- Modify: `src/core/lib/viewMode.test.ts`

**Interfaces:**
- Consumes: `parseViewMode` (existing).
- Produces: nothing new; `booksView` now `"list" | "table"`, default `"table"`; legacy `"cards"` maps to `"table"`.

- [ ] **Step 1: Write failing test in `viewMode.test.ts`**

```ts
import {
  BOOKS_VIEW_DEFAULT,
  BOOKS_VIEW_MODES,
  parseViewMode,
} from "./viewMode.ts";

test("legado 'cards' migra para 'table' (novo padrão)", () => {
  assert.equal(
    parseViewMode("cards", BOOKS_VIEW_MODES, BOOKS_VIEW_DEFAULT),
    "table",
  );
  assert.equal(
    parseViewMode(null, BOOKS_VIEW_MODES, BOOKS_VIEW_DEFAULT),
    "table",
  );
  assert.equal(
    parseViewMode("list", BOOKS_VIEW_MODES, BOOKS_VIEW_DEFAULT),
    "list",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx node --test src/core/lib/viewMode.test.ts`
Expected: FAIL with `BOOKS_VIEW_MODES` / `BOOKS_VIEW_DEFAULT` undefined (import error is the failing proof).

- [ ] **Step 3: Add constants + update type in `viewMode.ts`**

```ts
export type ViewMode = "list" | "slides" | "text" | "table";

/** Modos da coluna de livros da Bíblia (gradle de abreviações). */
export const BOOKS_VIEW_MODES = ["list", "table"] as const;
export const BOOKS_VIEW_DEFAULT = "table";
```

Drop `"cards"` from `ViewMode`; the books panel stops using the raw array literal and consumes these constants.

- [ ] **Step 4: Implement books `table` mode in `BiblePage.tsx`**

- Hook: `usePersistentViewMode("open_presenter_bible_books_view", BOOKS_VIEW_DEFAULT, BOOKS_VIEW_MODES)`.
- Column width: replace the `booksView === "cards" ? "w-80 xl:w-96" : "w-64"` class with `"w-64"` (no wider table column).
- Toggle options: `[{ value: "list", label: "Lista", icon: List }, { value: "table", label: "Tabela", icon: LayoutGrid }]`.
- Replace the `booksView === "cards"` branch with `booksView === "table"`: dense tiles showing **only `book.abbrev`** (`font-mono text-[10px]`), `title={book.name}` tooltip, `min-h-7`, dense `gap-1`, inline style `{ gridTemplateColumns: "repeat(auto-fill, minmax(2.25rem, 1fr))" }`; keep testament coloring (amber OT / emerald NT), active = `border-primary bg-primary text-primary-foreground`, `overflow-y-auto` wrapper, same `onClick={() => void selectBook(book.id)}`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test && npm run typecheck` — Expected: PASS, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/bible/BiblePage.tsx src/core/lib/viewMode.ts src/core/lib/viewMode.test.ts
git commit -m "feat: grade de livros em tabela de abreviações (padrão)"
```

---

### Task 3: Bible verse preview — zoom + modo texto

**Files:**
- Modify: `src/features/bible/BiblePage.tsx` (versesView hook ~L94-103; `verseCards` memo ~L141-175; verses toggle ~L767-775; grid branch ~L816-869)

**Interfaces:**
- Consumes: `usePersistentNumber`, `BIBLE_PREVIEW_GRID`, `previewGridStyle` (Task 1).
- Produces: `versesView` becomes `"list" | "slides" | "text"` for key `open_presenter_bible_verses_view`; zoom persisted under `open_presenter_bible_verses_zoom`.

- [ ] **Step 1: Implement Bible verses zoom + text mode**

- Hook: `usePersistentViewMode("open_presenter_bible_verses_view", "list", ["list", "slides", "text"])`.
- Zoom: `const [verseZoom, setVerseZoom] = usePersistentNumber("open_presenter_bible_verses_zoom", BIBLE_PREVIEW_GRID.defaultLevel, BIBLE_PREVIEW_GRID.minLevel, BIBLE_PREVIEW_GRID.maxLevel);`
- `verseCards` memo: change the early-return guard from `versesView !== "slides"` to `versesView === "list"` so cards build for both `slides` and `text`.
- Verses `ViewModeToggle` options: `[{ list, List }, { slides, LayoutGrid }, { text, AlignLeft }]`.
- Zoom controls next to the toggle, shown only when `versesView !== "list"` (zooming applies to grid modes only): `ZoomOut` button (`title="Diminuir zoom (mais itens por linha)"`, `onClick={() => setVerseZoom(verseZoom + 1)}`), small level badge, `ZoomIn` button (`title="Aumentar zoom (menos itens por linha)"`, `onClick={() => setVerseZoom(verseZoom - 1)}`); both disabled at `maxLevel`/`minLevel`.
- Grid container: change the branch condition from `versesView === "slides"` to `versesView !== "list"` (grid now hosts both `slides` and `text`; the list branch stays for `list`). Remove the fixed `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` classes; use `className="grid gap-2"` + `style={previewGridStyle(BIBLE_PREVIEW_GRID, verseZoom)}`.
- Per-card content: when `versesView === "slides"` render `<SlideThumbnail>` (unchanged); when `"text"` render a clean text block — verse number (part badge when `totalParts > 1`) + `slide.lines[0]` in a text card, keeping identical select/live/highlight behavior and click/double-click handlers.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` — Expected: no errors.

- [ ] **Step 3: Manual verification of both grid modes**

Run: `npm run dev` (or `npm run tauri:dev`) — switch verses to `Slides`, then `Texto`; confirm `ZoomIn`/`ZoomOut` change tile size, `list` stays unchanged, resize window wraps columns without clipping. (Recorded as a manual check in the task note; automation behind `node --test` is not feasible for DOM.)

- [ ] **Step 4: Run full tests**

Run: `npm test` — Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/features/bible/BiblePage.tsx src/core/lib/previewGrid.test.ts
git commit -m "feat: zoom e modo texto na grade de versículos da bíblia"
```

---

### Task 4: Setlist verse preview — zoom + modo texto

**Files:**
- Modify: `src/features/events-setlists/ScriptureSlidesColumn.tsx` (viewMode hook ~L22-26; header controls ~L131-139; container ~L167-173; card render ~L179-229)

**Interfaces:**
- Consumes: `usePersistentNumber`, `SETLIST_PREVIEW_GRID`, `previewGridStyle` (Task 1).
- Produces: setlist scripture `viewMode` becomes `"list" | "slides" | "text"` for key `open_presenter_setlist_scripture_view`; zoom persisted under `open_presenter_setlist_scripture_zoom`.

- [ ] **Step 1: Implement setlist zoom + text mode**

- Hook: `usePersistentViewMode("open_presenter_setlist_scripture_view", "list", ["list", "slides", "text"])`.
- Zoom: `const [gridZoom, setGridZoom] = usePersistentNumber("open_presenter_setlist_scripture_zoom", SETLIST_PREVIEW_GRID.defaultLevel, SETLIST_PREVIEW_GRID.minLevel, SETLIST_PREVIEW_GRID.maxLevel);`
- `ViewModeToggle` options: `[{ list, List }, { slides, LayoutGrid }, { text, AlignLeft }]`.
- Zoom controls next to the toggle (same disabled semantics as Task 3, using `gridZoom`/`setGridZoom`).
- Container: when `viewMode === "list"` keep `space-y-2 overflow-y-auto p-3`; otherwise `<div className="grid flex-1 min-h-0 gap-2 overflow-y-auto p-3" style={previewGridStyle(SETLIST_PREVIEW_GRID, gridZoom)}>`.
- Card render: keep `viewMode === "slides" ? <SlideThumbnail …/> : <p …>{slide.lines.join("\n")}</p>` — the existing non-slides branch already renders clean text and now covers `text` mode inside the grid container.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` — Expected: no errors.

- [ ] **Step 3: Run full tests**

Run: `npm test` — Expected: all green.

- [ ] **Step 4: Manual verification (setlist)**

Open a setlist with a scripture item; toggle `Slides` and `Texto`; confirm default ≈ 4 tiles per row, zoom both ways, `list` unchanged. (Manual; recorded in task note.)

- [ ] **Step 5: Commit**

```bash
git add src/features/events-setlists/ScriptureSlidesColumn.tsx src/core/lib/previewGrid.test.ts
git commit -m "feat: zoom e modo texto na grade de versículos do setlist"
```

---

### Task 5: Window start-maximized + persist/restore geometry (Rust)

**Files:**
- Create: `src-tauri/src/services/window_state.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/commands/preferences.rs` (`START_MAXIMIZED_KEY`, `start_maximized()`, `get_start_maximized`, `set_start_maximized`)
- Modify: `src-tauri/src/lib.rs` (setup: apply geometry; `on_window_event`: save on Moved/Resized/CloseRequested; invoke_handler: register commands)

**Interfaces:**
- Consumes: `Db::with_conn`, `settings::{get_setting, set_setting}`, tauri `Manager`/`WebviewWindow`.
- Produces:
  - IPC: `get_start_maximized() -> bool`, `set_start_maximized(enabled: bool) -> Result<(), AppError>`.
  - Settings keys: `app.start_maximized` (`"true"`/`"false"`, default `"true"`), `app.window_rect` (JSON `{"x":i32,"y":i32,"w":u32,"h":u32}`).
  - Pure (testable): `window_state::{WindowRect, rects_intersect, fallback_rect}`.
  - Wrappers (Task 6 consumes): `getStartMaximized(): Promise<boolean>`, `setStartMaximized(enabled: boolean): Promise<void>`.

- [ ] **Step 1: Write failing Rust tests in `window_state.rs`**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rects_intersect_detecta_sobreposicao() {
        let a = WindowRect { x: 0, y: 0, w: 100, h: 100 };
        let b = WindowRect { x: 50, y: 50, w: 100, h: 100 };
        assert!(rects_intersect(&a, &b));
    }

    #[test]
    fn rects_intersect_falso_para_retangulos_disjuntos() {
        let a = WindowRect { x: 0, y: 0, w: 100, h: 100 };
        let c = WindowRect { x: 500, y: 500, w: 100, h: 100 };
        assert!(!rects_intersect(&a, &c));
    }

    #[test]
    fn fallback_rect_centraliza_e_limita_ao_monitor() {
        let r = fallback_rect(MonitorRect { x: 0, y: 0, w: 1024, h: 640 });
        assert_eq!(r.w, 1024); // clampa a 1400x900 ao tamanho do monitor
        assert_eq!(r.h, 640);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p open-presenter --lib window_state::tests` (warn: full `tauri::generate_context!` build; allow a long first compile)
Expected: FAIL with "unresolved import / cannot find `window_state`".

- [ ] **Step 3: Implement `window_state.rs`**

```rust
pub struct WindowRect { pub x: i32, pub y: i32, pub w: u32, pub h: u32 }
pub struct MonitorRect { pub x: i32, pub y: i32, pub w: u32, pub h: u32 }
```
- `rects_intersect(a: &WindowRect, b: &MonitorRect) -> bool` — standard AABB overlap.
- `fallback_rect(monitor: MonitorRect) -> WindowRect` — clamp 1400×900 to monitor size and center (`x = mx + (mw - w)/2`, same for y).
- `read_rect(app: &AppHandle) -> Option<WindowRect>` / `write_rect(app: &AppHandle, rect: &WindowRect)` — serde_json read/write of `app.window_rect` via `settings::get_setting/set_setting`.
- A `fn is_rect_usable(app, rect) -> bool` that checks `available_monitors()` — return `true` if `rects_intersect` against **any** monitor.

- [ ] **Step 4: Implement preferences commands**

In `commands/preferences.rs`, mirroring `close_to_tray`:
- `pub const START_MAXIMIZED_KEY: &str = "app.start_maximized";`
- `pub fn start_maximized(app: &AppHandle) -> bool` — default `true` when unset (`value != "false"`).
- `#[tauri::command] pub fn get_start_maximized(app: AppHandle) -> bool`
- `#[tauri::command] pub fn set_start_maximized(app: AppHandle, db: State<'_, Db>, enabled: bool) -> Result<(), AppError>` — persists and returns `Ok(())`.

- [ ] **Step 5: Wire setup restore + event capture in `lib.rs`**

- In `.setup`, after `app.manage(db.clone())`: get `app.get_webview_window("main")`; if `start_maximized(&app)` → `window.maximize()` + `set_focus()`; else if `read_rect` → if `is_rect_usable` → `set_position(PhysicalPosition::new(x,y))` + `set_size(PhysicalSize::new(w,h))` and then `unmaximize()` as a safety; else → primary monitor `fallback_rect` applied + `write_rect` (persist corrected state). All calls `.ok()`-swallowed (setup best-effort).
- In `.on_window_event`, extend the existing `main` handler:
  - On `WindowEvent::Moved(_)` / `WindowEvent::Resized(_)`: if `window.label() == "main"` and `!window.is_maximized().unwrap_or(false)` → read `outer_position()` + `inner_size()`, build `WindowRect`, `write_rect`.
  - Keep `CloseRequested` behavior; also run the same geometry save before the close dialog.
- Register `commands::preferences::get_start_maximized, set_start_maximized` in `invoke_handler`.

- [ ] **Step 6: Run Rust tests (pure module)**

Run: `cargo test -p open-presenter --lib window_state::tests`
Expected: PASS (3 tests).

- [ ] **Step 7: Compile check + TS unaffected**

Run: `cargo check -p open-presenter` — Expected: no errors.
Run: `npm run typecheck` — Expected: no errors (no TS change yet).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/services/window_state.rs src-tauri/src/services/mod.rs src-tauri/src/commands/preferences.rs src-tauri/src/lib.rs
git commit -m "feat: janela inicia maximizada com geometria persistida e validada"
```

---

### Task 6: Preferência "Iniciar maximizado" (frontend)

**Files:**
- Modify: `src/core/ipc/commands.ts` (wrappers near `getCloseToTray` ~L158-164)
- Modify: `src/features/preferences/tabs/GeneralTab.tsx` (screen switch pattern of `closeToTray` ~L44-63, tray card ~L113-140)

**Interfaces:**
- Consumes: `getStartMaximized` / `setStartMaximized` (Task 5), `isTauri()` (existing).
- Produces: nothing new.

- [ ] **Step 1: Add typed IPC wrappers in `commands.ts`**

```ts
export async function getStartMaximized(): Promise<boolean> {
  return (await invokeCommand<boolean>("get_start_maximized")) ?? true;
}

export async function setStartMaximized(enabled: boolean): Promise<void> {
  await invokeStrict("set_start_maximized", { enabled });
}
```

- [ ] **Step 2: Implement the General tab switch in `GeneralTab.tsx`**

- State: `const [startMaximized, setStartMaximizedState] = useState(true);`
- Load in the existing `useEffect` (only when `isTauri()`): `void getStartMaximized().then((v) => { if (active) setStartMaximizedState(v); });`
- `handleStartMaximized(enabled)` mirrors `handleCloseToTray` (optimistic set, `persistStartMaximized(enabled).catch` → revert + `toast.error("Não foi possível salvar a configuração da janela.")`).
- UI: inside the existing Tauri-only block, a card "Iniciar com a janela maximizada" — description: "Abre o aplicativo maximizado na inicialização. Ao desativar, o tamanho e a posição da última janela são restaurados." — with the `Switch`. Optionally add a `Maximize2` icon import from lucide-react.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build` — Expected: both PASS.

- [ ] **Step 4: Run full test suite**

Run: `npm test` — Expected: all green.

- [ ] **Step 5: Manual verification**

- Toggle ON → relaunch app → window opens maximized.
- Toggle OFF → resize/move window → relaunch → geometry restored; move window to a removed/off-screen layout → relaunch → app opens centered 1400×900.
- In a plain browser (no Tauri): preferences open, no window switch rendered, no errors.
(Manual; recorded in task note.)

- [ ] **Step 6: Commit**

```bash
git add src/core/ipc/commands.ts src/features/preferences/tabs/GeneralTab.tsx
git commit -m "feat: preferência para iniciar a janela maximizada"
```

---

## Gitflow / Finish

- Branch: `feature/ajustes-biblia-previews-janela` (already created; spec commit `42458c8`).
- After Task 6: run the whole gate once more — `npm test`, `npm run typecheck`, `cargo check -p open-presenter`, `npm run build`.
- End-of-branch review (subagent-driven) before merge into `develop` via `--no-ff`.
- Pushing `develop` remains user-gated (origin behind).