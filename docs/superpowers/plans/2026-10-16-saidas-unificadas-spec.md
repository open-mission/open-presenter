# Gestão unificada de saídas — especificação

Origem: pedido do usuário (pt-BR) + evidências REA do Spresenter 0.3.50.

## Requisitos (R1–R4)

- **R1.** Aplicar um tema pelo trilho lateral (painel de controle) atualiza a
  janela nativa do público imediatamente — hoje só reflete ao reabrir/recarregar.
- **R2.** As configurações de saídas (quais telas ativas, monitor, modo)
  persistem ao fechar e reabrir o programa; saídas nativas salvas como ativas
  são reabertas no boot.
- **R3.** Interface de gestão semelhante à do Spresenter, unificando as saídas
  (hoje há `OutputsTab`, `OutputManagerPanel` morto e botões espalhados):
  um só gestor com, por saída, liga/desliga, modo (Nativa/Web/Ambas),
  monitor físico, URL web e estado real (aberta/fechada).
- **R4.** O indicativo Público/Palco ativos no painel admin reflete o estado
  real das janelas (hoje congela: lê só o zustand local, sem evento nem
  persistência).
- **R5.** O gestor permite editar as configs do servidor local (porta),
  reiniciar e parar/iniciar o servidor quando preciso. Trocar a porta
  persiste, reinicia o servidor e atualiza todas as URLs/WS do app.
- **R6.** O gestor mostra os dispositivos conectados ao servidor e qual
  saída cada um está usando (Público/Palco), além das janelas nativas
  abertas — visível sem adivinhar IP.

## Modelo do Spresenter (evidências REA)

Arquivo: `~/Library/Application Support/spresenter/config.json`
(bytes observados, `outputs` + `stage`):

```json
"outputs": {
  "virtual_outputs": [{
    "id": "63f93447-…", "icon": "Monitor", "name": "Principal",
    "width": 1920, "height": 1080,
    "themes": [{ "assetType": "music", "themeGuid": "cee05641-…" }]
  }],
  "physical_outputs": [],
  "ndi_output": { "width": 1920, "height": 1080, "virtual_output": 0, "fps": 30 },
  "advanced_output_config": { "outputs": [] }
},
"stage": { "themeGuid": "eae2e2d2-…", "width": 1920, "height": 1080 }
```

Comportamentos observados nos logs (`logs/main-process.log`,
`logs/window-output-*.log`):

- `OutputService` resolve cada saída nomeada para um display físico por
  **id + label** (`saída "Público": id=5 label="SAMSUNG" NÃO encontrado.
  Conectados: 1/Tela Retina Integrada/- — não abrindo`): reconciliação no
  boot; monitor ausente ⇒ não abre, sem erro fatal.
- `advanced-output`: `createAdvancedOutputWindow()`, `config: outputs=0,
  testPattern=false`; nenhuma saída habilitada ⇒ nada a abrir.
- **Todas** as saídas (inclusive janelas nativas e NDI `win_renderer.node`)
  são clientes web do servidor local `:5050` via URLs
  `?output=9000&id=…&layer=32…` e `?output=stage&…&stageThemeGuid=…` —
  gestão unificada num só servidor.
- Servidor HTTP/WS próprio na porta 5050, mesma arquitetura do open-presenter.

Evidências REA: `ev_8b9b3b93eb80d97126e523433f309c039963d086cae2f143c0a85d506f5bf259`
(análise do `app.asar`, sha256 `f9df7bc7…e542`, 1408 arquivos JS, cobertura
parcial — bundles ofuscados `_0x…` + strings em tabela runtime).

Limites/unknowns explícitos: layout exato da tela de gestão do Spresenter
não foi recuperado (renderer ofuscado; observação runtime dispensada por
ser intrusiva — app do usuário com updater ativo). A UI aqui é desenho
original informado pelo modelo acima + rótulos observados
(Principal, Retorno, Projetor, Espelhar, Tela cheia, Janela, Desativada/o).
`physical_outputs`/`advanced_output_config.outputs` estavam vazios nesta
instalação — o formato quando preenchidos é desconhecido.

## Gaps do open-presenter (mapa da base, `develop` em `c3ce26e`)

- `syncBus.init()` no Tauri escuta `slide` e `stageMessage`, **nunca
  `themes`** (`src/core/sync/syncBus.ts:31-38`) ⇒ janela nativa não recebe
  `presentation://themes` (causa de R1; web recebe via WS). Fallback local
  usa snapshot stale do zustand daquela janela.
- `EVENT_OUTPUTS` (`outputs://changed`) existe e nunca é emitido nem ouvido.
- `useOutputManagerStore` sem `persist`, sem backend ⇒ tudo volta a `off`.
- `display_manager.rs`: abrir com janela existente só dá `focus` (não move);
  fechar (inclusive pelo ✕ do SO) não notifica; sem show/hide/move/fullscreen.
- Topbar (`AppTopBar.tsx:25-26`) e `LivePreview` leem `mode` local ⇒ R4.
- Sem NDI no open-presenter: fora de escopo.
