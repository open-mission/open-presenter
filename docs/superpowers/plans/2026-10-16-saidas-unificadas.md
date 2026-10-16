# Saídas unificadas (estilo Spresenter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar a gestão das saídas (Público/Principal, Palco/Retorno) com estado real, persistência, propagação de tema à janela nativa, controle do servidor local e visibilidade dos dispositivos conectados.

**Architecture:** Rust vira fonte da verdade das saídas (`OutputsState` + tabela `settings` + evento `outputs://changed`) e do servidor (`ServerControl` + `Clients`); o frontend espelha via `useOutputsSync` (como `liveThemesStore`); o gestor vira um painel único; o `syncBus` Tauri passa a ouvir `themes` e o modo web anuncia qual saída exibe (`client://hello`).

**Tech Stack:** Tauri v2.12.4, React 19 + TS, Zustand, SQLite (rusqlite), `HashRouter` (inalterado).

**Spec:** `docs/superpowers/plans/2026-10-16-saidas-unificadas-spec.md`

## Global Constraints

- Versões pinadas (`package.json`, `src-tauri/Cargo.toml`) — só mexer por vuln/bug comprovado.
- Comandos IPC novos em `src-tauri/src/commands/`, registrados no `invoke_handler`, com wrapper em `src/core/ipc/commands.ts`.
- Tipos compartilhados Rust↔TS sincronizados (`src/core/types/`, `src-tauri/src/state/types.rs`).
- `commands/` → `services/` → `state/`; comandos não acessam SQLite/janelas direto.
- Commits em Conventional Commits, curtos, imperativo, pt-BR ou en.
- Branch: `feature/saidas-unificadas` a partir de `develop`; merge `--no-ff` ao final, sem push/PR.
- Antes de commitar: `npm run typecheck` (+ `cargo check/test` se mexeu Rust).

## Review Focus

- Monitor salvo desconectado no boot ⇒ saída fica fechada com aviso, sem crash; teste na Task 1 e 8.
- Fechar a janela nativa pelo ✕ do SO ⇒ dot apaga e estado persiste; teste na Task 1 e 8.
- Tema aplicado com saída fechada e aberta depois ⇒ janela abre já com o tema (fetch inicial); teste na Task 8.
- Dois monitores com mesmo nome ⇒ resolve por id primeiro, depois label; teste na Task 1.
- Modo `web` sem janela nativa ⇒ nada abre, URL continua válida; teste na Task 8.
- Servidor parado ⇒ saídas web morrem e a mídia de tema no nativo quebra
  (theme-media passa pelo servidor); gestor mostra "Servidor parado" e
  desabilita URLs; teste na Task 8.
- Troca de porta com clientes conectados ⇒ clientes precisam reabrir a nova
  URL; gestor exibe a nova URL após o restart; teste na Task 8.

---

### Task 1: Estado de saídas no backend (persistência + eventos reais)

**Files:**
- Modify: `src-tauri/src/services/database.rs` (schema 4 + `settings` KV)
- Modify: `src-tauri/src/services/display_manager.rs:46-108`
- Create: `src-tauri/src/state/outputs.rs` (`OutputsState`)
- Modify: `src-tauri/src/state/types.rs` (`OutputMode`, `OutputConfig`, `OutputRuntime`)
- Modify: `src-tauri/src/state/mod.rs` (export)
- Create: `src-tauri/src/services/settings.rs` (get/set via `Db`)
- Create: `src-tauri/src/commands/outputs.rs` (3 comandos)
- Modify: `src-tauri/src/lib.rs` (manage + handler)
- Test: `src-tauri/src/services/database.rs` (atualizar versão nos asserts), novo teste em `state/outputs.rs`

**Interfaces:**
- Consumes: `Db::with_conn` (`database.rs:54-64`), `EVENT_OUTPUTS` (`state/types.rs:247`), `display_manager::{list_monitors, pick_monitor}`, padrão `publish_themes` (`services/broadcaster.rs:39-53`) para `app.emit`.
- Produces:
  - `settings::get_setting(conn|app, key: &str) -> Result<Option<String>, AppError>`
  - `settings::set_setting(conn|app, key: &str, value: &str) -> Result<(), AppError>`
  - `OutputsState { set_config(t, cfg), get_config(t), set_open(t, open, monitor_id), snapshot() -> Vec<OutputRuntime> }`
  - Comandos: `get_output_config(target: OutputTarget) -> OutputConfig`, `set_output_config(config: OutputConfig)`, `get_outputs_state() -> Vec<OutputRuntime>`
  - `OutputConfig { target, mode: OutputMode, monitor_id: Option<String>, monitor_label: Option<String>, url: Option<String> }` (serde camelCase)
  - `OutputRuntime { target, open: bool, monitor_id: Option<String> }`

- [ ] **Step 1: Escrever testes que falham.** Em `database.rs`, atualizar os
  asserts de versão `3`→`4` e exigir a tabela `settings`; novo teste
  `settings_roundtrip` (set/get + sobrescrita). Em `state/outputs.rs`, teste
  `open_close_transitions` (set_open true/false por target).
- [ ] **Step 2: Rodar e ver falhar.** `cargo test -p open-presenter outputs`
  e `cargo test -p open-presenter database`. Esperado: FAIL (tabela/versão).
- [ ] **Step 3: Implementar.** `SETTINGS_DDL` + `SCHEMA_VERSION = 4`
  (migração preserva dados: só `CREATE TABLE IF NOT EXISTS settings`);
  `settings.rs`; `OutputsState` (Mutex<HashMap>, Default com configs `off`);
  `OutputMode`/`OutputConfig`/`OutputRuntime` com `#[serde(rename_all)]`.
- [ ] **Step 4: Ligar open/close aos eventos.** `open_output_window` e
  `close_output_window` passam a receber `State<OutputsState>` (ou
  `AppHandle` + `app.state()`), atualizam `open` e emitem `EVENT_OUTPUTS`
  com `snapshot()`; anexar `on_window_event` (CloseRequested ⇒ set_open
  false + emit). `pick_monitor` ganha fallback id → label → atual; comandos
  aceitam `monitor_label: Option<String>`.
- [ ] **Step 5: Registrar comandos** em `lib.rs` (`manage(OutputsState)` +
  `generate_handler![…, get_output_config, set_output_config, get_outputs_state]`).
- [ ] **Step 6: Rodar testes.** `cargo test -p open-presenter`. Esperado: PASS.
- [ ] **Step 7: Commit.** `git add src-tauri/...` + `fix: estado de saídas persistente com eventos reais`.

### Task 2: Sync frontend (temas no Tauri + espelho das saídas)

**Files:**
- Modify: `src/core/sync/syncBus.ts:31-38`
- Modify: `src/features/output-manager/store.ts`
- Create: `src/features/output-manager/useOutputsSync.ts`
- Modify: `src/core/ipc/commands.ts` (wrappers dos 3 comandos)
- Modify: `src/core/types/index.ts` (`OutputRuntime`)
- Modify: `src/views/AdminView.tsx` (montar sync + restore do boot)

**Interfaces:**
- Consumes: `TAURI_EVENTS` (`core/config/app.ts:12-18`), `listenCommand`/`invokeStrict` (`core/ipc/tauri.ts`, seguir `commands.ts:17-32`), `useLiveThemesStore.applyRemote` (padrão de `usePresentationSync.ts:25-27`).
- Produces:
  - `syncBus` passa a despachar `presentation://themes` também no Tauri.
  - `useOutputsSync(): void` — init: `load()` (config persistida + `get_outputs_state`) + subscribe `outputs://changed` ⇒ recarrega runtime; actions `setMode/setMonitor/toggle` chamam comandos e confiam no evento (sem otimismo divergente).
  - Admin monta `useOutputsSync()` uma vez e, após `load`, reabre saídas salvas `native|both` via `openOutputWindow` (comportamento Spresenter: monitor ausente ⇒ backend não abre).

- [ ] **Step 1: Adicionar listener de temas no Tauri.**
  Em `syncBus.init()`, após o `stageMessage`, registrar
  `listenCommand(TAURI_EVENTS.themes, dispatch)`. (R1: a janela nativa do
  público passa a aplicar o tema do trilho ao vivo.)
- [ ] **Step 2: Wrappers + tipos.** `getOutputConfig/setOutputConfig/getOutputsState` em `commands.ts`; `OutputRuntime` em `core/types`.
- [ ] **Step 3: Reescrever o store.** `configs` (persistido via backend),
  `runtime` (aberta/fechada real), `monitors`, `host`; `load()` + `applyRuntime()`.
  Criar `useOutputsSync.ts` no padrão de `usePresentationSync.ts`.
- [ ] **Step 4: Restore no boot.** `AdminView`: `useOutputsSync()` + efeito
  que reabre `native|both` salvas (idempotente; `open_output_window` com
  janela existente só foca).
- [ ] **Step 5: Verificar.** `npm run typecheck` e `npm run build`. Esperado: PASS.
- [ ] **Step 6: Commit.** `fix: saídas espelham backend e tema chega à janela nativa`.

### Task 3: Gestor único de saídas (UI estilo Spresenter)

**Files:**
- Modify: `src/features/preferences/tabs/OutputsTab.tsx:36-250` (TargetCard) e `252-376`
- Delete: `src/features/output-manager/OutputManagerPanel.tsx` (sem imports)
- Modify: `src/views/PreferencesView.tsx:183` apenas se mudar o mount (não muda)

**Interfaces:**
- Consumes: Task 2 (`useOutputManagerStore` com `configs/runtime/monitors/host`, `listMonitors/fetchServerHost/openOutputWindow/closeOutputWindow`, `outputHttpUrl`), bindings (`slide-themes/store.ts` — leitura do tema ligado, só exibição).
- Produces: painel "Saídas (telas)" com, por saída (Projeção Pública, Retorno de Palco): pill de estado real (Ativa/Desligada), liga/desliga, modo (Desligada/Nativa/Web/Ambas — inclui `both`, hoje ausente), seletor de monitor (marca "não conectado" quando o salvo sumiu), URL web copiar/abrir, linha "Tema atual" (somente leitura, do binding `public`/`stage`).

- [ ] **Step 1: Reescrever `TargetCard`.** Estado de `runtime.open`; toggle
  chama comandos via store (sem `setOutput` otimista divergente); monitor
  salva `{monitorId, monitorLabel}`; modo `both` abre nativa e exibe URL.
- [ ] **Step 2: Banner de monitores.** Manter, adicionando selo "em uso por
  <saída>" quando `runtime.monitor_id` coincidir.
- [ ] **Step 3: Remover morto.** Deletar `OutputManagerPanel.tsx`; confirmar
  `grep -r OutputManagerPanel src` vazio.
- [ ] **Step 4: Verificar.** `npm run typecheck`. Esperado: PASS.
- [ ] **Step 5: Commit.** `feat: gestor único de saídas com estado real`.

### Task 4: Indicadores do admin a partir do estado real

**Files:**
- Modify: `src/components/AppTopBar.tsx:23-26,81-111`
- Modify: `src/features/presentation/LivePreview.tsx:41,261-283`

**Interfaces:**
- Consumes: Task 2 (`runtime` do store).

- [ ] **Step 1: Dots reais.** `publicActive = runtime.public.open`,
  `stageActive = runtime.stage.open` (sem fallback para `mode`; antes de
  `load`, manter cinza). Tooltip mostra monitor/URL quando ativa.
- [ ] **Step 2: Badge do LivePreview.** Ler `runtime.stage` (Nativo/Web/…,
  bloco só se aberta).
- [ ] **Step 3: Verificar.** `npm run typecheck`. Esperado: PASS.
- [ ] **Step 4: Commit.** `fix: indicadores público/palco refletem janelas reais`.

### Task 6: Controle do servidor local (porta, reiniciar, parar)

**Files:**
- Modify: `src-tauri/src/server/http.rs` (bind na porta configurada + controle de ciclo de vida)
- Modify: `src-tauri/src/lib.rs` (ler `server.port` do `settings` no setup, gerenciar `ServerControl`)
- Create: `src-tauri/src/commands/server.rs`
- Modify: `src-tauri/src/state/types.rs` (`ServerStatus { running, port }`)
- Modify: `src/core/ipc/commands.ts` (wrappers), `src/core/config/app.ts` (URLs com porta)
- Modify: `src/core/sync/syncBus.ts` (modo web usa `window.location.host`, mesma origem do servidor)
- Modify: `src/features/output-manager/store.ts` + `useOutputsSync.ts` (guardar `server`)
- Modify: `src/features/preferences/tabs/OutputsTab.tsx` (seção "Servidor local")

**Interfaces:**
- Consumes: Task 1 (`settings` KV, chave `server.port`, default `5050`).
- Produces:
  - `ServerControl` (Mutex): `{ port: u16, running: bool, handle: Option<JoinHandle<()>> }`.
  - Comandos: `get_server_status() -> ServerStatus`, `set_server_port(port: u16)` (valida 1024–65535, persiste, reinicia o servidor), `stop_server()`, `start_server()` (erro `AppError::Network` se a porta estiver ocupada; bind falha no boot ⇒ `running:false` sem crash).
  - `outputHttpUrl(host, port, path)`, `outputWsUrl(host, port)` — atualizar chamadas.
  - Seção "Servidor local" no gestor: status, campo de porta, botões Reiniciar/Parar/Iniciar, URLs atualizadas; com servidor parado, URLs desabilitadas.

- [ ] **Step 1: Estado + comandos.** `ServerControl`, 4 comandos, registro no handler. Falha de bind vira erro legível, não panic.
- [ ] **Step 2: Boot usa a porta salva.** No `setup`, antes de iniciar o servidor: abrir `Db`, ler `server.port` (default 5050), dar bind; falha ⇒ log + `running:false`.
- [ ] **Step 3: URLs dinâmicas.** `app.ts` recebe `port`; `syncBus` web deriva de `window.location.host`; store guarda `server` via `get_server_status`; gestor exibe as URLs com a porta atual.
- [ ] **Step 4: Verificar.** `npm run typecheck`, `cargo check -p open-presenter`. Esperado: PASS.
- [ ] **Step 5: Commit.** `feat: controle do servidor local com porta configurável`.

### Task 7: Dispositivos conectados (quem usa qual saída)

**Files:**
- Modify: `src-tauri/src/server/http.rs` (registro `Clients` + mensagem `client://hello`)
- Modify: `src-tauri/src/commands/server.rs` (`get_connected_clients`)
- Modify: `src-tauri/src/state/types.rs` (`ConnectedClient { id, ip, output: Option<OutputTarget>, user_agent: Option<String>, connected_at }`)
- Modify: `src/core/sync/syncBus.ts` (enviar hello ao abrir o socket)
- Modify: `src/core/sync/usePresentationSync.ts` (parâmetro `output`)
- Modify: `src/views/PublicView.tsx`, `StageView.tsx`, `AdminView.tsx` (passar a saída)
- Modify: `src/features/preferences/tabs/OutputsTab.tsx` (seção "Dispositivos conectados")

**Interfaces:**
- Consumes: Task 6 (servidor), Task 1 (`get_outputs_state` para as janelas nativas).
- Produces:
  - `Clients` (Arc<Mutex<HashMap>>) gerenciado: registra no upgrade WS (ip do peer + UA truncada em 48 chars), atualiza `output` no `client://hello`, remove no disconnect. Mensagens desconhecidas continuam ignoradas.
  - `get_connected_clients() -> Vec<ConnectedClient>`.
  - `usePresentationSync(output?: "public" | "stage" | "admin")`; hello `{channel:"client://hello", payload:{output}}` (admin Tauri usa IPC, então só clientes web anunciam).
  - Seção no gestor: janelas nativas abertas (do runtime) + clientes WS (IP, saída, hora, UA curta); polling de 5s + botão atualizar (sem novo canal de evento).

- [ ] **Step 1: Registro no servidor.** `Clients`, hello, limpeza no disconnect, comando de leitura.
- [ ] **Step 2: Anúncio no cliente.** `syncBus` envia hello ao abrir; views passam a saída; wrappers TS.
- [ ] **Step 3: Seção na UI.** Tabela simples + merge com janelas nativas; estado vazio amigável ("Nenhum dispositivo conectado").
- [ ] **Step 4: Verificar.** `npm run typecheck`, `cargo check -p open-presenter`. Esperado: PASS.
- [ ] **Step 5: Commit.** `feat: mostra dispositivos conectados por saída`.

### Task 8: Verificação ponta a ponta e merge

- [ ] **Step 1: Build completo.** `npm run build`, `cargo check -p open-presenter`, `cargo test -p open-presenter`. Esperado: tudo verde.
- [ ] **Step 2: Tema no nativo (R1).** Abrir janela nativa do público pelo
  gestor; aplicar tema no trilho; capturar a janela nativa e confirmar o
  tema aplicado sem recarregar.
- [ ] **Step 3: Persistência (R2).** Ligar pública+nativa e palco, fechar o
  app, reabrir, confirmar reabertura e dots acesos; desconectar cenário =
  monitor salvo ausente ⇒ fechada com aviso no gestor.
- [ ] **Step 4: Indicador fecha pelo ✕ (R4).** Fechar janela nativa pelo SO;
  confirmar dot apagando e `get_outputs_state` com `open:false`.
- [ ] **Step 5: Porta e restart (R5).** Trocar a porta (ex. 5050→5051),
  confirmar restart, nova URL no gestor, web reconectando na nova URL;
  parar o servidor e confirmar "Servidor parado" + URLs desabilitadas;
  reiniciar e confirmar volta.
- [ ] **Step 6: Dispositivos (R6).** Abrir a saída web num segundo
  cliente (navegador/celular na rede) e confirmar a linha IP+saída+hora
  no gestor; fechar a aba e confirmar que a linha some no refresh.
- [ ] **Step 7: Merge.** `git checkout develop && git merge --no-ff
  feature/saidas-unificadas`, deletar branch. Sem push/PR.
