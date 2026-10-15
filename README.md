# Open Presenter

Software desktop open source e leve para apresentação em igrejas e eventos — foco em **setlists**, **projeção com fundos dinâmicos** (imagem, vídeo, CSS e shaders ISF) e **saídas multi-tela/Web**.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Desktop / Backend | Tauri v2 (Rust) + servidor HTTP/WebSocket embutido (axum, porta 5050) |
| Frontend | React 19 + TypeScript + Vite |
| Roteamento | react-router-dom (`HashRouter`: `/admin`, `/public`, `/stage`) |
| Estilo | Tailwind CSS v4 + componentes próprios (`src/components/ui`) + lucide-react |
| Estado | Zustand + sincronização híbrida (Tauri Events no desktop, WebSocket no navegador) |
| Persistência | SQLite via rusqlite (banco criado em `app_data_dir/open-presenter.db`) |

## Pré-requisitos

- Node.js ≥ 20.19 (`.nvmrc` fixa a versão 22)
- Rust ≥ 1.77.2 + toolchain de build da plataforma (no macOS: Xcode Command Line Tools)
- Dependências de WebView do sistema (Linux: pacotes `webkit2gtk`)

## Desenvolvimento

```bash
npm install
npm run dev            # frontend web (Vite, porta 1420)
npm run tauri:dev      # app desktop (compila o frontend e abre o Tauri)
```

## Build e qualidade

```bash
npm run typecheck      # tsc -b
npm run build          # tsc -b + vite build → dist/
npm run tauri:build    # instaladores/bundles do Tauri
```

O banco SQLite é criado automaticamente no diretório de dados do app (`open-presenter.db`); o servidor embutido sobe na porta **5050** e serve o próprio `dist/` compilado nas rotas `/#/public` e `/#/stage` (captura via OBS Browser Source ou tablets no palco), além do WebSocket `ws://<host>:5050/ws` para sincronização.

## Estrutura

```text
src-tauri/            # Backend Rust (commands, server, services, state)
src/
  components/ui/      # Componentes base de UI
  core/               # Shared kernel: config, lib, types, ipc, sync
  features/           # Módulos verticais (output-manager, presentation, media-shaders,
                      #   events-setlists, stage-display, songs, scriptures)
  views/              # AdminView (/), PublicView (/public), StageView (/stage)
AGENTS.md             # Governança para agentes de IA
```

## Gitflow

- `main`: releases estáveis. `develop`: integração contínua.
- Branches: `feature/*`, `fix/*`, `release/*`, `hotfix/*`.
- Commits em **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`…).
