# AGENTS.md — Governança para Agentes de IA

Regras obrigatórias para qualquer agente (humano ou IA) contribuindo com o **Open Presenter**.

## 1. Stack e versões (não atualizar sem motivo)

- Tauri v2 (Rust), React 19 + TypeScript, Vite, react-router-dom com **`HashRouter`**.
- Tailwind CSS v4 (via plugin `@tailwindcss/vite`), Zustand, lucide-react.
- `package.json` e `src-tauri/Cargo.toml` usam **versões pinadas** — só altere para corrigir vulnerabilidade ou bug comprovado.

## 2. Arquitetura

- **Feature-based + SOLID.** Nada de "God Components": cada componente tem uma responsabilidade única.
- `src/core/` é o **shared kernel** (config, lib, types, ipc, sync). Tipos compartilhados Rust↔TS vivem em `src/core/types/` e `src-tauri/src/state/types.rs` — mantenha os dois **sincronizados** (`LiveSlide`, `MonitorInfo`, `OutputTarget`, `WsEnvelope`).
- `src/features/*` são módulos verticais com `store.ts` + componentes próprios. Comunicação entre features passa por `core/sync` ou stores, nunca por imports cruzados diretos.
- `src/views/` contém apenas composição de features por rota (`/admin`, `/public`, `/stage`).

## 3. Roteamento

- Sempre `HashRouter`: o app roda sob protocolo customizado do Tauri (`tauri://`) e servido como arquivos estáticos pelo servidor embutido — `BrowserRouter` quebra nesses ambientes.
- Novas rotas de saída web devem funcionar nas três formas: janela nativa Tauri, preview embutido e navegador externo.

## 4. Sincronização

- Fonte da verdade do slide ao vivo: `PresentationState` (Rust). O frontend espelha via `syncBus` (Tauri Events no desktop, WebSocket `/ws` no navegador).
- Comandos IPC novos: declare em `src-tauri/src/commands/`, registre no `invoke_handler` e exponha wrapper tipado em `src/core/ipc/commands.ts`.

## 5. Backend Rust

- `commands/` (IPC) → `services/` (regras) → `state/` (dados). Comandos não acessam SQLite ou janelas diretamente; delegam a serviços.
- Erros de comando usam `AppError` (já serializa para o frontend).
- Servidor embutido (porta 5050) serve o `dist/` compilado; nunca sirva paths fora dele.

## 6. Qualidade

- Antes de commitar: `npm run typecheck` (e `cargo check -p open-presenter` se mexeu no Rust).
- Estilo: sem comentários no código salvo quando a lógica não for auto-evidente; siga os padrões existentes (shadcn-like em `components/ui`, stores Zustand por feature).
- Commits em **Conventional Commits**, em pt-BR ou en, curtos e no imperativo.

## 7. Gitflow

- `main` (releases) ← `develop` (integração). Features em `feature/*`, fixes em `fix/*`.
- Nunca commite direto na `main`.
