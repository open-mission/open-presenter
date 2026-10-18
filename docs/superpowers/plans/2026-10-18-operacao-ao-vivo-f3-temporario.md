# F3 — SetList Temporário no Desktop · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir uma lista "Temporária" avulsa, paralela ao evento/culto selecionado e sempre disponível no desktop (SetlistSidebar), com capacidade completa de adicionar itens, reordenar, apresentar e mover itens entre o culto e o temporário.

**Architecture:** 
- Backend Rust (`services/setlists.rs`): registro reservado `id = "__temporary__"` com título "Temporário" na tabela `service_events`; `list` exclui o temporário; comando `get_temporary_event` realiza get-or-create; `delete` protege o temporário contra exclusão.
- Tipos (`src/core/types/index.ts` e IPC `src/core/ipc/commands.ts`): constante `TEMPORARY_EVENT_ID = "__temporary__"` e wrapper tipado `getTemporaryEvent()`.
- Store (`src/features/events-setlists/store.ts`): estado com `listMode: "event" | "temporary"`, `temporaryEvent: ServiceEvent | null`, ações `switchListMode`, `clearTemporary` e `moveItemToOtherList`.
- UI (`src/features/events-setlists/SetlistSidebar.tsx`): seletor de lista visual no topo (Culto / Temporário) com transição de 1 clique, header adaptativo (detalhes do culto vs lista temporária) e menu de contexto com ação "Mover para Temporário / Culto".

**Tech Stack:** Rust (Tauri 2, rusqlite), React 19, TypeScript, Zustand, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-10-18-operacao-ao-vivo-design.md` (§6.3, D5, D14).

**Branch:** `feature/operacao-ao-vivo-f3-temporario` a partir de `develop`.

## Global Constraints

- Antes de cada commit: `cargo test -p open-presenter --manifest-path src-tauri/Cargo.toml` e `npm run typecheck` + `npm test` limpos.
- Comandos rodam da raiz do repositório; comandos cargo usam `--manifest-path src-tauri/Cargo.toml`.
- Strings de UI em pt-BR; sem comentários no código salvo lógica não-óbvia; Conventional Commits curtos e no imperativo.
- Stack pinada — nenhuma dependência nova.
- D5: Temporário usa a mesma tabela `service_events` com id `__temporary__` — sem migração de schema.
- D14: O remote espelha a lista ativa (`event` do store).

## Review Focus

1. **`list_events` nunca retorna o `__temporary__`** — a agenda e os diálogos de seleção de eventos mostram apenas cultos reais.
2. **`get_temporary_event` é idempotente** — cria na primeira chamada e retorna o mesmo registro nas seguintes.
3. **`delete_event("__temporary__")` é rejeitado** — impossível corromper ou deletar o registro reservado.
4. **Alternar entre Culto e Temporário é 1 clique** — preserva edições pendentes (`save`), restaura o evento anteriormente selecionado ao voltar para o modo Culto.
5. **Mover item entre listas (Culto ↔ Temporário)** — move o item preservando metadados de música/mídia, anexa à última parte ou cria parte "Avulsas" se a lista destino não tiver partes.
6. **Apresentação ao vivo e runner** — funcionam de forma idêntica tanto no culto quanto no temporário (`event` é a fonte da verdade).

---

### Task 1: Backend Rust — Suporte ao registro reservado `__temporary__`

**Files:**
- Modify: `src-tauri/src/services/setlists.rs`

**Interfaces:**
- Produces: `pub const TEMPORARY_EVENT_ID: &str = "__temporary__";`
- Produces: `pub fn get_temporary(conn: &Connection) -> Result<ServiceEvent, AppError>`
- Modifies: `list(conn)` para filtrar `WHERE id != ?1`
- Modifies: `delete(conn, id)` para bloquear `TEMPORARY_EVENT_ID`

- [ ] **Step 1: Escrever os testes unitários no módulo `tests` de `src-tauri/src/services/setlists.rs`**

```rust
#[test]
fn get_temporary_cria_se_nao_existir_e_reutiliza() {
    let conn = open_in_memory();
    let temp1 = get_temporary(&conn).unwrap();
    assert_eq!(temp1.id, TEMPORARY_EVENT_ID);
    assert_eq!(temp1.title, "Temporário");
    assert!(temp1.parts.is_empty());

    let temp2 = get_temporary(&conn).unwrap();
    assert_eq!(temp2.id, temp1.id);
    assert_eq!(temp2.title, temp1.title);
}

#[test]
fn list_exclui_evento_temporario() {
    let conn = open_in_memory();
    get_temporary(&conn).unwrap();
    let event = ServiceEvent {
        id: "e-culto".into(),
        title: "Culto de Domingo".into(),
        event_date: "2026-10-18".into(),
        wallpaper: None,
        parts: vec![],
    };
    create(&conn, &event).unwrap();

    let events = list(&conn).unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].id, "e-culto");
    assert!(!events.iter().any(|e| e.id == TEMPORARY_EVENT_ID));
}

#[test]
fn delete_recusa_exclusao_do_temporario() {
    let conn = open_in_memory();
    get_temporary(&conn).unwrap();
    let res = delete(&conn, TEMPORARY_EVENT_ID);
    assert!(res.is_err());
    assert!(get(&conn, TEMPORARY_EVENT_ID).unwrap().is_some());
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test -p open-presenter --manifest-path src-tauri/Cargo.toml services::setlists`

- [ ] **Step 3: Implementar em `src-tauri/src/services/setlists.rs`**

- Adicionar a constante:
  ```rust
  pub const TEMPORARY_EVENT_ID: &str = "__temporary__";
  ```
- Atualizar `list`:
  ```rust
  pub fn list(conn: &Connection) -> Result<Vec<EventSummary>, AppError> {
      let mut stmt = conn
          .prepare(
              "SELECT id, title, event_date, json_extract(setlist_json, '$.wallpaper') FROM service_events
               WHERE id != ?1
               ORDER BY event_date DESC, title",
          )
          .map_err(storage_error)?;
      let events = stmt
          .query_map(params![TEMPORARY_EVENT_ID], |row| {
              Ok(EventSummary {
                  id: row.get(0)?,
                  title: row.get(1)?,
                  event_date: row.get(2)?,
                  wallpaper: row.get::<_, Option<String>>(3).unwrap_or(None),
              })
          })
          .map_err(storage_error)?
          .collect::<Result<Vec<_>, _>>()
          .map_err(storage_error)?;
      Ok(events)
  }
  ```
- Implementar `get_temporary`:
  ```rust
  pub fn get_temporary(conn: &Connection) -> Result<ServiceEvent, AppError> {
      if let Some(event) = get(conn, TEMPORARY_EVENT_ID)? {
          return Ok(event);
      }
      let temp = ServiceEvent {
          id: TEMPORARY_EVENT_ID.to_string(),
          title: "Temporário".to_string(),
          event_date: "".to_string(),
          wallpaper: None,
          parts: vec![],
      };
      create(conn, &temp)?;
      Ok(temp)
  }
  ```
- Atualizar `delete`:
  ```rust
  pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
      if id == TEMPORARY_EVENT_ID {
          return Err(AppError::Validation("não é permitido excluir a lista temporária".into()));
      }
      conn.execute("DELETE FROM service_events WHERE id = ?1", params![id])
          .map_err(storage_error)?;
      Ok(())
  }
  ```

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test -p open-presenter --manifest-path src-tauri/Cargo.toml services::setlists`
Expected: Todos os testes de `services::setlists` passando.

- [ ] **Step 5: Commitar**

```bash
git add src-tauri/src/services/setlists.rs
git commit -m "feat(backend): suporte ao registro reservado temporario com protecao e exclusao da listagem"
```

---

### Task 2: IPC Rust & Frontend — Comando `get_temporary_event`

**Files:**
- Modify: `src-tauri/src/commands/setlists.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/core/types/index.ts`
- Modify: `src/core/ipc/commands.ts`

**Interfaces:**
- Produces: Tauri IPC `get_temporary_event`
- Produces: `TEMPORARY_EVENT_ID` e `SetlistListMode` em `src/core/types/index.ts`
- Produces: `getTemporaryEvent(): Promise<ServiceEvent>` em `src/core/ipc/commands.ts`

- [ ] **Step 1: Expor e registrar comando Tauri**

Em `src-tauri/src/commands/setlists.rs`:
```rust
#[tauri::command]
pub fn get_temporary_event(db: State<'_, Db>) -> Result<ServiceEvent, AppError> {
    db.with_conn(|conn| setlists::get_temporary(conn))
}
```

Em `src-tauri/src/commands/mod.rs`:
Exportar `get_temporary_event`.

Em `src-tauri/src/lib.rs`:
Registrar `commands::setlists::get_temporary_event` no `generate_handler!`.

- [ ] **Step 2: Tipos e wrapper IPC no frontend**

Em `src/core/types/index.ts`:
```ts
export const TEMPORARY_EVENT_ID = "__temporary__";
export type SetlistListMode = "event" | "temporary";
```

Em `src/core/ipc/commands.ts`:
```ts
export async function getTemporaryEvent(): Promise<ServiceEvent> {
  return invokeStrict<ServiceEvent>("get_temporary_event");
}
```

- [ ] **Step 3: Verificar testes e compilação**

Run: `cargo test -p open-presenter --manifest-path src-tauri/Cargo.toml && npm run typecheck`
Expected: 0 erros.

- [ ] **Step 4: Commitar**

```bash
git add src-tauri/src/commands/setlists.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src/core/types/index.ts src/core/ipc/commands.ts
git commit -m "feat(ipc): comando get_temporary_event e tipos compartilhados"
```

---

### Task 3: Store — Suporte aos modos Culto / Temporário e transferência de itens

**Files:**
- Create: `src/features/events-setlists/temporaryUtils.ts`
- Create: `src/features/events-setlists/temporaryUtils.test.ts`
- Modify: `src/features/events-setlists/store.ts`

**Interfaces:**
- Produces: `transferItemBetweenEvents(source: ServiceEvent, target: ServiceEvent, itemId: string): { updatedSource: ServiceEvent; updatedTarget: ServiceEvent; movedItem: EventItem } | null`
- Extends: `SetlistState` com:
  - `listMode: SetlistListMode;`
  - `lastSelectedEventId: string | null;`
  - `temporaryEvent: ServiceEvent | null;`
  - `switchListMode(mode: SetlistListMode): Promise<void>;`
  - `clearTemporary(): Promise<void>;`
  - `moveItemToOtherList(itemId: string): Promise<void>;`

- [ ] **Step 1: Criar utilitários puros `temporaryUtils.ts` com testes**

Criar `src/features/events-setlists/temporaryUtils.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { transferItemBetweenEvents } from "./temporaryUtils.ts";
import type { ServiceEvent, EventItem } from "@/core/types";

test("transfere item de um evento para o outro criando parte Avulsas se o destino for vazio", () => {
  const item: EventItem = { id: "item-1", songId: "s1", nextItemId: null, song: null, media: null };
  const source: ServiceEvent = {
    id: "e1",
    title: "Culto",
    eventDate: "2026-10-18",
    parts: [{ id: "p1", title: "Louvor", items: [item] }],
  };
  const target: ServiceEvent = {
    id: "__temporary__",
    title: "Temporário",
    eventDate: "",
    parts: [],
  };

  const result = transferItemBetweenEvents(source, target, "item-1");
  assert.ok(result);
  assert.equal(result.updatedSource.parts[0].items.length, 0);
  assert.equal(result.updatedTarget.parts.length, 1);
  assert.equal(result.updatedTarget.parts[0].title, "Avulsas");
  assert.equal(result.updatedTarget.parts[0].items.length, 1);
  assert.equal(result.updatedTarget.parts[0].items[0].id, "item-1");
});

test("transfere item anexando na última parte existente do destino", () => {
  const item: EventItem = { id: "item-2", songId: "s2", nextItemId: null, song: null, media: null };
  const source: ServiceEvent = {
    id: "__temporary__",
    title: "Temporário",
    eventDate: "",
    parts: [{ id: "p-temp", title: "Geral", items: [item] }],
  };
  const target: ServiceEvent = {
    id: "e1",
    title: "Culto",
    eventDate: "2026-10-18",
    parts: [
      { id: "p1", title: "Abertura", items: [] },
      { id: "p2", title: "Louvor", items: [] },
    ],
  };

  const result = transferItemBetweenEvents(source, target, "item-2");
  assert.ok(result);
  assert.equal(result.updatedSource.parts[0].items.length, 0);
  assert.equal(result.updatedTarget.parts[1].items.length, 1);
  assert.equal(result.updatedTarget.parts[1].items[0].id, "item-2");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/features/events-setlists/temporaryUtils.test.ts`

- [ ] **Step 3: Implementar `temporaryUtils.ts`**

Criar `src/features/events-setlists/temporaryUtils.ts`:
```ts
import type { EventItem, EventPart, ServiceEvent } from "@/core/types";

export function transferItemBetweenEvents(
  source: ServiceEvent,
  target: ServiceEvent,
  itemId: string,
): { updatedSource: ServiceEvent; updatedTarget: ServiceEvent; movedItem: EventItem } | null {
  let foundItem: EventItem | null = null;

  const newSourceParts: EventPart[] = source.parts.map((part) => {
    const item = part.items.find((i) => i.id === itemId);
    if (item) {
      foundItem = item;
      return {
        ...part,
        items: part.items.filter((i) => i.id !== itemId),
      };
    }
    return part;
  });

  if (!foundItem) return null;

  const itemToMove: EventItem = {
    ...(foundItem as EventItem),
    nextItemId: null,
  };

  let newTargetParts: EventPart[];
  if (target.parts.length === 0) {
    newTargetParts = [
      {
        id: crypto.randomUUID(),
        title: "Avulsas",
        items: [itemToMove],
      },
    ];
  } else {
    newTargetParts = target.parts.map((part, index) => {
      if (index === target.parts.length - 1) {
        return {
          ...part,
          items: [...part.items, itemToMove],
        };
      }
      return part;
    });
  }

  return {
    updatedSource: { ...source, parts: newSourceParts },
    updatedTarget: { ...target, parts: newTargetParts },
    movedItem: itemToMove,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/features/events-setlists/temporaryUtils.test.ts`
Expected: 2 testes passando.

- [ ] **Step 5: Integrar no `store.ts`**

Adicionar ao `SetlistState`:
- `listMode: SetlistListMode` (default `"event"`)
- `lastSelectedEventId: string | null`
- `temporaryEvent: ServiceEvent | null`
- `switchListMode(mode: SetlistListMode): Promise<void>`
- `clearTemporary(): Promise<void>`
- `moveItemToOtherList(itemId: string): Promise<void>`

No `load()`:
- Carrega `getTemporaryEvent()` e armazena em `temporaryEvent`.
- Se `events.length === 0`: em vez de bloquear, o temporário pode ser selecionado se não houver cultos, ou cria culto padrão mantendo o temporário pronto.

Na ação `switchListMode(mode)`:
- Se dirty, faz `save()`.
- Se mode === "temporary":
  - Guarda `lastSelectedEventId = activeEventId`.
  - Recarrega `temporaryEvent` (garante frescor).
  - Define `listMode = "temporary"`, `activeEventId = TEMPORARY_EVENT_ID`, `event = temporaryEvent`, `selectedItemId = null`, `runnerIndex = null`, `dirty = false`.
- Se mode === "event":
  - Define `listMode = "event"`.
  - Se houver `lastSelectedEventId` ou próximo evento em `events`, chama `selectEvent(...)`.

Na ação `moveItemToOtherList(itemId)`:
- Identifica se a origem é o evento ativo ou o temporário.
- Executa `transferItemBetweenEvents`.
- Salva o evento destino com `saveEvent(target)`.
- Atualiza o evento origem no state e salva via `save()`.

- [ ] **Step 6: Verificar typecheck e testes**

Run: `npm run typecheck && npm test`
Expected: 0 erros; 29/29 testes passando.

- [ ] **Step 7: Commitar**

```bash
git add src/features/events-setlists/temporaryUtils.ts src/features/events-setlists/temporaryUtils.test.ts src/features/events-setlists/store.ts
git commit -m "feat(store): suporte a alternancia de lista culto/temporario e transferencia de itens"
```

---

### Task 4: UI — Seletor de lista e menu de contexto no `SetlistSidebar.tsx`

**Files:**
- Modify: `src/features/events-setlists/SetlistSidebar.tsx`

**Interfaces:**
- Consumes: `listMode`, `switchListMode`, `clearTemporary`, `moveItemToOtherList` do `useSetlistStore`.
- Produces:
  1. Seletor de abas ("Culto / Evento" | "Temporário") no topo da sidebar.
  2. Header contextual:
     - No modo "Culto": Dropdown de cultos/agenda/wallpaper.
     - No modo "Temporário": Título "Lista Temporária" com badge "Avulsa" e opções "Limpar lista temporária".
  3. Menu de contexto dos itens:
     - "Mover para Temporário" (quando em modo Culto).
     - "Mover para Programação do Culto" (quando em modo Temporário).

- [ ] **Step 1: Adicionar o seletor de modo logo abaixo do header da sidebar**

```tsx
<div className="px-3 pt-2.5 pb-2 border-b border-border bg-background/50">
  <div className="grid grid-cols-2 p-0.5 rounded-lg bg-muted/60 text-xs font-medium">
    <button
      type="button"
      onClick={() => void switchListMode("event")}
      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all cursor-pointer ${
        listMode === "event"
          ? "bg-background text-foreground shadow-2xs font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Calendar className="size-3.5 text-primary" />
      <span className="truncate">Culto / Evento</span>
    </button>
    <button
      type="button"
      onClick={() => void switchListMode("temporary")}
      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all cursor-pointer ${
        listMode === "temporary"
          ? "bg-background text-foreground shadow-2xs font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
      <span className="truncate">Temporário</span>
    </button>
  </div>
</div>
```

- [ ] **Step 2: Header adaptativo para o modo Temporário**

Quando `listMode === "temporary"`, renderizar título "Lista Temporária" com Badge "Avulsa" e dropdown com opção de "Limpar lista temporária" (com confirmação ou toast).

- [ ] **Step 3: Ação "Mover para..." no menu de contexto dos itens**

No menu de contexto do item:
```tsx
<ContextMenuItem
  onClick={() => void moveItemToOtherList(item.id)}
  className="text-xs cursor-pointer"
>
  {listMode === "event" ? (
    <>
      <RotateCcw className="size-3.5 mr-2 text-amber-500" />
      <span>Mover para Temporário</span>
    </>
  ) : (
    <>
      <Calendar className="size-3.5 mr-2 text-primary" />
      <span>Mover para Culto</span>
    </>
  )}
</ContextMenuItem>
```

- [ ] **Step 4: Verificar typecheck e compilação**

Run: `npm run typecheck && npm test`
Expected: 0 erros.

- [ ] **Step 5: Commitar**

```bash
git add src/features/events-setlists/SetlistSidebar.tsx
git commit -m "feat(ui): seletor de lista culto/temporario e acao mover item na sidebar"
```

---

### Task 5: Validação completa da Fase 3 e documentação

**Files:**
- Modify: `src/views/ShortcutsView.tsx` (se aplicável para documentar a alternância)
- Verify: `cargo test -p open-presenter --manifest-path src-tauri/Cargo.toml`
- Verify: `npm run typecheck && npm test`

- [ ] **Step 1: Rodar suíte completa de testes no Rust e TypeScript**

Run:
```bash
cargo test -p open-presenter --manifest-path src-tauri/Cargo.toml
npm run typecheck
npm test
```
Expected: 100% de testes passando, sem warnings ou erros de tipos.

- [ ] **Step 2: Commitar e preparar para merge em `develop`**

```bash
git add .
git commit -m "docs: finaliza fase F3 temporario com testes e validacao"
```
