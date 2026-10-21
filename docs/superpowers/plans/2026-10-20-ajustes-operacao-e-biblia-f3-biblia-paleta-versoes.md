# F3 — Bíblia: paleta por digitação e gestão de versões · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir a paleta de referências ao digitar na aba Bíblia, preservar a precedência de `B/C/F`, permitir importar vários arquivos e gerenciar versões em um modal com progresso e resumo por arquivo.

**Architecture:** A decisão de capturar a tecla vira uma função pura testável (`shouldOpenPaletteOnKey`); `BiblePage` usa um listener em fase de captura e passa `initialQuery` para a paleta. A importação em lote fica na store (`importBibleFiles`), com `onProgress` e erros por arquivo; um seletor compartilhado (`pickBibleFiles`) é usado pelo menu “…” e pelo modal `ManageBibleVersionsDialog`.

**Tech Stack:** React 19 + TypeScript + Zustand, Tauri `plugin-dialog`, `sonner`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-ajustes-operacao-e-biblia-design.md`

## Global Constraints

- Nenhuma dependência nova.
- `Enter` na paleta seleciona/carrega e **não** apresenta; `Shift+Enter` apresenta.
- Com apresentação ativa, `B/C/F` **não** abrem a paleta; continuam os atalhos globais.
- Sem apresentação ativa, qualquer letra/número imprimível abre a paleta.
- Digitação dentro de `input`, `textarea`, `contenteditable` ou modal não abre a paleta.
- `Cmd+K`/`Ctrl+K` continua abrindo/fechando a paleta.
- Importação em lote é sequencial e uma falha não interrompe as demais.
- Um único toast de resumo por lote.
- O modal permanece aberto durante a importação.
- Excluir a versão ativa escolhe a próxima; se não houver, limpa a leitura.
- Antes de fechar: `npm run typecheck` e `npm test`.

## Review Focus

- A precedência de teclado não pode fazer `B`/`C`/`F` abrirem a paleta quando há apresentação.
- O listener em captura não pode engolir `Enter`, setas ou `Esc`.
- A paleta deve abrir já preenchida com a primeira tecla e manter o foco no input.
- O parser já cobre os formatos; os testes são de regressão.
- O lote não pode emitir um toast por arquivo.
- O modal não pode perder o estado de progresso ao atualizar a lista de versões.
- `importBibleFile` individual continua funcionando para usos pontuais.

## File Map

| Arquivo | Responsabilidade |
| --- | --- |
| `src/features/bible/bibleParser.test.ts` | Regressão do parser de referências |
| `src/features/bible/bibleShortcuts.ts` | Decisão pura de captura da tecla |
| `src/features/bible/bibleShortcuts.test.ts` | Testes da precedência |
| `src/features/bible/BiblePage.tsx` | Listener de digitação, menu “…” e modal |
| `src/features/bible/BibleCommandPalette.tsx` | `initialQuery` e confirmação Enter/Shift+Enter |
| `src/features/bible/store.ts` | `importBibleFiles`, progresso e `silent` |
| `src/features/bible/bibleFilePicker.ts` | Seletor múltiplo compartilhado |
| `src/features/bible/ManageBibleVersionsDialog.tsx` | Lista, exclusão, adição e resumo |
| `src/core/ipc/commands.ts` | Sem mudança; `importBible` já importa um arquivo |

## Task 1: Travar o parser de referências com testes

**Files:**
- Create: `src/features/bible/bibleParser.test.ts`

- [ ] **Step 1: Escrever os testes**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseBibleReference } from "./bibleParser.ts";

test("Jo 3 abre o capítulo 3 no versículo 1", () => {
  const parsed = parseBibleReference("Jo 3");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, undefined);
});

test("Jo 3.16 seleciona o versículo 16", () => {
  const parsed = parseBibleReference("Jo 3.16");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, 16);
});

test("João 3 16 seleciona o versículo 16", () => {
  const parsed = parseBibleReference("João 3 16");
  assert.equal(parsed?.bookId, 43);
  assert.equal(parsed?.chapter, 3);
  assert.equal(parsed?.verse, 16);
});

test("1 Jo 1:9 seleciona 1 João", () => {
  const parsed = parseBibleReference("1 Jo 1:9");
  assert.equal(parsed?.bookId, 62);
  assert.equal(parsed?.chapter, 1);
  assert.equal(parsed?.verse, 9);
});

test("referência inválida retorna null", () => {
  assert.equal(parseBibleReference("livro inexistente"), null);
  assert.equal(parseBibleReference(""), null);
});
```

- [ ] **Step 2: Rodar e ver passar**

```bash
npm test -- src/features/bible/bibleParser.test.ts
```

Esperado: PASS. Se algum formato falhar, corrigir o parser antes de seguir — o comportamento é requisito de produto, não uma mudança nova.

- [ ] **Step 3: Commit**

```bash
git add src/features/bible/bibleParser.test.ts
git commit -m "test(bible): cobre referências por digitação"
```

## Task 2: Extrair a decisão de captura da tecla

**Files:**
- Create: `src/features/bible/bibleShortcuts.ts`
- Create: `src/features/bible/bibleShortcuts.test.ts`

- [ ] **Step 1: Escrever os testes**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { shouldOpenPaletteOnKey } from "./bibleShortcuts.ts";

const key = (value: string) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
});

test("sem apresentação, B/C/F abrem a paleta", () => {
  for (const value of ["b", "c", "f", "J", "3"]) {
    assert.equal(shouldOpenPaletteOnKey(key(value), false), true);
  }
});

test("com apresentação, B/C/F não abrem a paleta", () => {
  for (const value of ["b", "B", "c", "C", "f", "F"]) {
    assert.equal(shouldOpenPaletteOnKey(key(value), true), false);
  }
});

test("com apresentação, outras teclas ainda abrem a paleta", () => {
  assert.equal(shouldOpenPaletteOnKey(key("j"), true), true);
  assert.equal(shouldOpenPaletteOnKey(key("3"), true), true);
});

test("não captura modificadores, Enter ou espaço", () => {
  assert.equal(
    shouldOpenPaletteOnKey({ key: "j", metaKey: true, ctrlKey: false, altKey: false }, false),
    false,
  );
  assert.equal(
    shouldOpenPaletteOnKey({ key: "j", metaKey: false, ctrlKey: true, altKey: false }, false),
    false,
  );
  assert.equal(shouldOpenPaletteOnKey(key("Enter"), false), false);
  assert.equal(shouldOpenPaletteOnKey(key(" "), false), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/features/bible/bibleShortcuts.test.ts
```

- [ ] **Step 3: Implementar**

```ts
export interface PaletteKeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

const GLOBAL_KEYS = new Set(["b", "c", "f"]);

export function shouldOpenPaletteOnKey(
  input: PaletteKeyInput,
  presentationActive: boolean,
): boolean {
  if (input.metaKey || input.ctrlKey || input.altKey) return false;
  if (input.key.length !== 1) return false;
  if (!/[\p{L}\p{N}]/u.test(input.key)) return false;
  if (presentationActive && GLOBAL_KEYS.has(input.key.toLowerCase())) return false;
  return true;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/features/bible/bibleShortcuts.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/features/bible/bibleShortcuts.ts src/features/bible/bibleShortcuts.test.ts
git commit -m "test(bible): cobre precedência de digitação"
```

## Task 3: Abrir a paleta ao digitar e passar `initialQuery`

**Files:**
- Modify: `src/features/bible/BiblePage.tsx`
- Modify: `src/features/bible/BibleCommandPalette.tsx`

- [ ] **Step 1: Ajustar a paleta**

Em `BibleCommandPaletteProps`:

```ts
interface BibleCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}
```

Na assinatura:

```ts
export function BibleCommandPalette({
  open,
  onOpenChange,
  initialQuery = "",
}: BibleCommandPaletteProps) {
```

No efeito de abertura:

```ts
useEffect(() => {
  if (open) {
    setQuery(initialQuery);
    setVersePreview(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
}, [open, initialQuery]);
```

Não alterar `handleKeyDown`: ele já usa `const autoPresent = e.shiftKey`, chama `handleConfirm(parsed, autoPresent)` e fecha antes de `goToVerse`.

- [ ] **Step 2: Adicionar estado e helper no `BiblePage`**

```ts
const [paletteInitialQuery, setPaletteInitialQuery] = useState("");
const [isManageVersionsOpen, setIsManageVersionsOpen] = useState(false);

function openPalette(initial = "") {
  setPaletteInitialQuery(initial);
  setIsCommandPaletteOpen(true);
}
```

No botão da paleta, trocar `onClick={() => setIsCommandPaletteOpen(true)}` por `onClick={() => openPalette()}`.

No `BibleCommandPalette`, passar:

```tsx
<BibleCommandPalette
  open={isCommandPaletteOpen}
  onOpenChange={(open) => {
    setIsCommandPaletteOpen(open);
    if (!open) setPaletteInitialQuery("");
  }}
  initialQuery={paletteInitialQuery}
/>
```

- [ ] **Step 3: Alterar o listener**

No `useEffect` de teclado:

1. `Cmd/Ctrl+K`: alternar a paleta; ao abrir, `openPalette()`.
2. Guardar `target` e ignorar `INPUT`, `TEXTAREA`, `contenteditable` e `target.closest('[role="dialog"]')`.
3. Se `isCommandPaletteOpen` for verdadeiro, retornar.
4. Calcular:

```ts
const live = usePresentationStore.getState().live;
const presentationActive = live.content.kind !== "blank";
if (
  shouldOpenPaletteOnKey(
    {
      key: e.key,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    },
    presentationActive,
  )
) {
  e.preventDefault();
  e.stopPropagation();
  openPalette(e.key);
  return;
}
```

5. Só depois tratar `Enter`, setas, `Escape`.
6. Registrar com captura:

```ts
window.addEventListener("keydown", handleKeyDown, true);
return () => window.removeEventListener("keydown", handleKeyDown, true);
```

Incluir `isCommandPaletteOpen` e `isCurrentLiveScripture` nas dependências do efeito (além das já existentes).

Importar `shouldOpenPaletteOnKey` de `./bibleShortcuts`.

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
npm test -- src/features/bible/bibleShortcuts.test.ts
npm test -- src/features/bible/bibleParser.test.ts
```

Manual:

1. Na aba Bíblia, sem apresentação, digite `Jo 3` fora de um input: a paleta abre com `J` e o restante é digitado no input.
2. Com apresentação ativa, `C` oculta o texto; `B` faz blackout; `F` mostra o fundo. Nenhum abre a paleta.
3. Com apresentação ativa, `J` abre a paleta.
4. `Enter` seleciona e não apresenta; `Shift+Enter` apresenta.
5. Digitar dentro do campo de referência rápida não abre a paleta.

- [ ] **Step 5: Commit**

```bash
git add src/features/bible/BiblePage.tsx src/features/bible/BibleCommandPalette.tsx
git commit -m "feat(bible): abre paleta ao digitar"
```

## Task 4: Store de importação em lote

**Files:**
- Modify: `src/features/bible/store.ts`

- [ ] **Step 1: Definir os tipos**

No topo de `store.ts`:

```ts
export interface BibleImportProgress {
  done: number;
  total: number;
  file: string;
}

export interface BibleImportError {
  file: string;
  error: string;
}

export interface BibleImportResult {
  imported: BibleVersion[];
  errors: BibleImportError[];
}

export interface ImportBibleFilesOptions {
  onProgress?: (progress: BibleImportProgress) => void;
  silent?: boolean;
}
```

Na interface `BibleState`:

```ts
importBibleFiles(
  paths: string[],
  options?: ImportBibleFilesOptions,
): Promise<BibleImportResult>;
importBibleFile(
  path: string,
  customName?: string,
  options?: { silent?: boolean },
): Promise<boolean>;
```

- [ ] **Step 2: Implementar `importBibleFiles`**

```ts
importBibleFiles: async (paths, options) => {
  const imported: BibleVersion[] = [];
  const errors: BibleImportError[] = [];
  const total = paths.length;

  for (let index = 0; index < paths.length; index++) {
    const path = paths[index];
    const file = path.split(/[\\/]/).pop() ?? path;
    options?.onProgress?.({ done: index + 1, total, file });
    try {
      const version = await importBible(path);
      imported.push(version);
    } catch (err: unknown) {
      errors.push({
        file,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (imported.length > 0) {
    const versions = await listBibleVersions();
    set({ versions });
    if (!get().activeVersionId) {
      await get().setActiveVersion(imported[0].id);
    }
  }

  if (!options?.silent) {
    if (errors.length === 0) {
      toast.success(
        `${imported.length} ${imported.length === 1 ? "versão importada" : "versões importadas"}.`,
      );
    } else {
      toast.error(
        `${imported.length} importada(s), ${errors.length} com erro.`,
      );
    }
  }

  return { imported, errors };
},
```

Manter `importBibleFile` individual, adicionando o parâmetro `options` e condicionando os toasts a `!options?.silent`. Ele continua chamando `setActiveVersion(imported.id)`.

- [ ] **Step 3: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/features/bible/store.ts
git commit -m "feat(bible): importa versões em lote com progresso"
```

## Task 5: Seletor de arquivos compartilhado

**Files:**
- Create: `src/features/bible/bibleFilePicker.ts`

- [ ] **Step 1: Implementar**

```ts
import { toast } from "sonner";
import { isTauri } from "@/core/ipc/tauri";

const BIBLE_FILTERS = [
  { name: "Bíblias", extensions: ["sqlite", "db", "json"] },
];

export async function pickBibleFiles(multiple = true): Promise<string[]> {
  if (!isTauri()) {
    toast.info(
      "A importação de arquivos SQLite/JSON está disponível no aplicativo Desktop.",
    );
    return [];
  }

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple,
      title: multiple
        ? "Selecione os arquivos da Bíblia (SQLite ou JSON)"
        : "Selecione o arquivo da Bíblia (SQLite ou JSON)",
      filters: BIBLE_FILTERS,
    });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`Falha ao abrir seletor: ${message}`);
    return [];
  }
}
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/features/bible/bibleFilePicker.ts
git commit -m "feat(bible): extrai seletor de arquivos"
```

## Task 6: Modal “Gerenciar versões”

**Files:**
- Create: `src/features/bible/ManageBibleVersionsDialog.tsx`

- [ ] **Step 1: Criar o componente**

Estrutura:

```tsx
export function ManageBibleVersionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const versions = useBibleStore((s) => s.versions);
  const activeVersionId = useBibleStore((s) => s.activeVersionId);
  const importBibleFiles = useBibleStore((s) => s.importBibleFiles);
  const deleteBibleVersion = useBibleStore((s) => s.deleteBibleVersion);

  const [progress, setProgress] = useState<BibleImportProgress | null>(null);
  const [summary, setSummary] = useState<BibleImportResult | null>(null);

  async function handleAdd() {
    const paths = await pickBibleFiles(true);
    if (paths.length === 0) return;
    setSummary(null);
    const result = await importBibleFiles(paths, {
      silent: true,
      onProgress: setProgress,
    });
    setProgress(null);
    setSummary(result);
    if (result.errors.length === 0) {
      toast.success(`${result.imported.length} versão(ões) importada(s).`);
    } else {
      toast.error(
        `${result.imported.length} importada(s), ${result.errors.length} com erro.`,
      );
    }
  }

  async function handleDelete(version: BibleVersion) {
    if (!confirm(`Deseja realmente remover a versão "${version.name}"?`)) return;
    await deleteBibleVersion(version.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerenciar versões da Bíblia</DialogTitle>
          <DialogDescription>
            Versões com o mesmo id substituem o arquivo existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {versions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma versão instalada.
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{version.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {version.id} · {version.abbrev}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {version.id === activeVersionId && <Badge>Ativa</Badge>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(version)}
                      title={`Remover ${version.name}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {progress && (
            <p className="text-xs text-muted-foreground">
              Importando {progress.done} de {progress.total}… {progress.file}
            </p>
          )}

          {summary && (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
              <p className="font-semibold">
                {summary.imported.length} importada(s), {summary.errors.length} com erro.
              </p>
              {summary.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-destructive">
                  {summary.errors.map((error) => (
                    <li key={error.file}>
                      {error.file}: {error.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={() => void handleAdd()} disabled={progress !== null}>
            <Plus className="mr-1 size-4" />
            Adicionar versões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Importar `BibleImportProgress`, `BibleImportResult` e `useBibleStore` de `./store`; `BibleVersion` de `@/core/types`; `pickBibleFiles` de `./bibleFilePicker`; `toast` de `sonner`; `Trash2`, `Plus` de `lucide-react`; `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `Badge`, `Button` dos componentes de UI.

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/features/bible/ManageBibleVersionsDialog.tsx
git commit -m "feat(bible): adiciona modal de versões"
```

## Task 7: Menu “…” no cabeçalho da Bíblia

**Files:**
- Modify: `src/features/bible/BiblePage.tsx`

- [ ] **Step 1: Remover o antigo**

- Remover o botão “Importar” e o botão de lixeira.
- Remover `handleDeleteVersion`, `activeVersion` e os seletores `importBibleFile`/`deleteBibleVersion`.
- Remover imports não usados (`Download`, `Trash2`, `isTauri`, `toast` se não houver outro uso).

- [ ] **Step 2: Adicionar o menu**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-9"
      title="Mais ações da Bíblia"
    >
      <MoreHorizontal className="size-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start">
    <DropdownMenuItem onClick={() => void handleImport()}>
      <Upload className="mr-2 size-4" />
      Importar Bíblia…
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setIsManageVersionsOpen(true)}>
      <Settings2 className="mr-2 size-4" />
      Gerenciar versões…
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

`handleImport`:

```ts
async function handleImport() {
  const paths = await pickBibleFiles(true);
  if (paths.length === 0) return;
  await importBibleFiles(paths);
}
```

Adicionar o seletor `importBibleFiles` no componente.

- [ ] **Step 3: Renderizar o modal**

No final do JSX:

```tsx
<ManageBibleVersionsDialog
  open={isManageVersionsOpen}
  onOpenChange={setIsManageVersionsOpen}
/>
```

Importar `ManageBibleVersionsDialog`, `pickBibleFiles`, `MoreHorizontal`, `Upload`, `Settings2` e os componentes de dropdown/alert.

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
npm test
```

Manual:

1. O botão “…” tem exatamente “Importar Bíblia…” e “Gerenciar versões…”.
2. A lixeira do cabeçalho sumiu.
3. Importar 3 arquivos mostra “Importando 2 de 3…” e mantém o modal aberto.
4. Um arquivo inválido não impede os demais; o resumo mostra o nome e o erro.
5. Excluir a versão ativa escolhe a próxima; excluir a última limpa a leitura.
6. O seletor de versão ativa continua no cabeçalho.

- [ ] **Step 5: Commit**

```bash
git add src/features/bible/BiblePage.tsx
git commit -m "feat(bible): move importação para menu de ações"
```

## Verification

```bash
npm run typecheck
npm test
```

Manual:

- `Jo 3`, `Jo 3.16`, `João 3 16`, `1 Jo 1:9` na paleta.
- `Enter` e `Shift+Enter`.
- `B/C/F` com e sem apresentação.
- Digitação em inputs e modais.
- Lote com arquivos válidos e inválidos.
- Exclusão da versão ativa e da última versão.

## Acceptance Checklist

- [ ] Digitar `Jo 3` abre a paleta preenchida, seleciona capítulo 3/versículo 1 e não apresenta.
- [ ] `Shift+Enter` apresenta.
- [ ] `Jo 3.16` e `João 3 16` selecionam o versículo 16.
- [ ] `B/C/F` só disparam com apresentação ativa.
- [ ] Sem apresentação, digitar `B/C/F` abre a paleta.
- [ ] Menu “…” tem importar e gerenciar; lixeira removida.
- [ ] Seleção múltipla de arquivos funciona.
- [ ] Modal lista, exclui e adiciona versões.
- [ ] Excluir a ativa escolhe outra.
- [ ] Progresso “Importando 2 de 3…” aparece.
- [ ] Falha em um arquivo não impede os demais e aparece no resumo.
