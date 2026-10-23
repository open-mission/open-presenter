# Plano — Camadas mestras, Looks por saída e fundos (Fase 1)

> **Data:** 2026-10-23 · **Branch:** `feature/camadas-looks` · **Design:** `docs/superpowers/specs/2026-10-23-camadas-looks-fundos-design.md`
> **Stack:** Tauri v2 (Rust), React 19 + TS, Zustand, Tailwind v4, `node --test`.
> **Status:** pronto para execução (design + builder check fechados).

## Escopo da Fase 1

Do design, itens 1–11 da Fase 1:

1. Tipos `MasterLayerId`, `OutputLook`, `LiveOutputOverride`, `OutputPlan`/`LiveOutputPlans` (TS + Rust).
2. Campo `layer` em `ThemeElement` + normalização `slide` para temas antigos.
3. Classificação automática ao adicionar elemento + ação "Mover para camada".
4. `LayersPanel` com as 8 camadas mestras e grupos dentro delas.
5. `OutputLook` por saída, defaults por categoria e UI de toggles.
6. Resolvedor único de tema/fundo por saída; remoção do ThemeRail e bindings.
7. `LiveOutputPlans` no Rust + broadcast por saída; views consomem o plano; snapshot inicial do `/ws`.
8. Rotas com `?id=` + fallback "primeira saída habilitada da categoria".
9. Fundo ao vivo por saída via seletor (sem arraste); Lower Third só cor/transparente.
10. Migração de bindings/temas de Stage.
11. Testes unitários de classificação, defaults, precedência, compatibilidade e bootstrap.

**Fora da Fase 1:** painel de fundos com arraste, props/anúncios/vídeo/máscara renderizando, Stage em camadas, presets de Look.

## Decisões já fechadas (não reabrir)

- **Admin é o único resolvedor.** Rust só guarda e publica. Tema do conteúdo (`media.themeId`) é aplicado no renderer, por cima do plano.
- **Precedência de tema:** conteúdo > override ao vivo > evento > padrão da saída > fallback do sistema.
- **Precedência de fundo:** conteúdo > override ao vivo > fundo do slide ao vivo > fundo do tema > cor da tela.
- **Identidade:** rotas novas sempre com `?id=<outputId>`; rota sem `id` cai na primeira saída habilitada da categoria (ordem do cadastro); sem saída, plano de sistema.
- **Stage (Fase 1):** não filtra elementos por camada; só `messages` tem efeito; não usa tema de evento. Ocioso: `idleThemeGuid` > página `rest` do tema ativo > `DEFAULT_STAGE_REST_THEME`.
- **Tema incompatível:** aparece no seletor, porém desabilitado com motivo; nunca renderiza em branco. Tema de conteúdo é exceção.
- **Navegador sem admin:** snapshot inicial do `/ws` inclui planos + saídas; `screenColor` viaja no plano.
- **Lower Third:** Fase 1 restringe o seletor de fundo a cor/transparente; validação de ativos fica na Fase 2.
- **Testes de render:** funções puras no `node --test` + verificação manual (sem dependência nova).
- **`screenColor` é fachada** para `backgroundColorEnabled`; não duplica estado.
- **Fundo arrastado** = override do fundo do Slide (sub-camada), não item da camada Mídia.

## Guardas de execução

- Trabalhar só em `feature/camadas-looks`; **não commitar o WIP alheio** (todo `src/features/displays/` está untracked).
- Sem `npm install` e sem build Tauri completo; `cargo check -p open-presenter` com o `CARGO_TARGET_DIR` existente.
- Nada de `deny_unknown_fields` nos structs Rust; campos novos opcionais com `skip_serializing_if`.
- Cada fatia termina com `npm run typecheck` (e `node --test` nos módulos tocados).

## Ordem das fatias

### Fatia 0 — Tipos TS + funções puras + testes

Sem dependência de UI/Rust; dá a base testável.

**`src/core/types/index.ts`**

```ts
export type MasterLayerId =
  | "mask" | "messages" | "props" | "announcements"
  | "slide" | "media" | "videoInput" | "screenColor";

export interface ThemeElement { /* ...atuais */ layer?: MasterLayerId; }

export interface OutputLook {
  mask: boolean; messages: boolean; props: boolean; announcements: boolean;
  slide: boolean; media: boolean; videoInput: boolean; screenColor: boolean;
}

export interface LiveOutputOverride {
  themeGuid?: string | null;
  background?: BackgroundLayer | null;
  updatedAt: string;
}

export type PlanThemeSource = "override" | "event" | "default" | "fallback";

export interface OutputPlan {
  outputId: string;
  category: OutputCategory;
  theme: SlideTheme | null;
  themeSource: PlanThemeSource;
  contentTheme: SlideTheme | null;
  restTheme: SlideTheme | null;
  look: OutputLook;
  backgroundOverride: BackgroundLayer | null;
  screenColor: { enabled: boolean; value: string };
  updatedAt: string;
}

export interface LiveOutputPlans { plans: Record<string, OutputPlan>; }

export interface DisplayOutput {
  /* ...atuais */
  look?: OutputLook;
  idleThemeGuid?: string | null;
}
```

**`src/features/slide-themes/layers.ts`** (novo, puro)

- `MASTER_LAYER_ORDER: MasterLayerId[]` (topo→base: mask, messages, props, announcements, slide, media, videoInput, screenColor).
- `MASTER_LAYER_LABELS: Record<MasterLayerId, string>` (pt-BR: Máscara, Mensagens, Props, Anúncios, Slide, Mídia, Entrada de Vídeo, Cor da Tela).
- `SYSTEM_LAYERS` (mask, messages, videoInput, screenColor) e `EDITABLE_LAYERS` (slide, props, announcements).
- `defaultLayerForElement(type): MasterLayerId` → `TEXT|RECTANGLE|CIRCLE|TRIANGLE|STAR → "slide"`; `IMAGE|VIDEO → "slide"` (decisão: tudo nasce em `slide`; `media` é a media bin da Fase 2).
- `elementLayer(el): MasterLayerId` → `el.layer ?? "slide"`.
- `elementVisibleForLook(el, look): boolean` → camada ligada e com renderer nesta fase (`slide`).
- `defaultLookForCategory(category): OutputLook` (tabela do design: público tudo `true` exceto `mask`; stage `messages/slide` `true`, resto `false`; lower `slide/media/messages` `true`, resto `false`).
- `normalizeLook(look?: OutputLook | null, category?): OutputLook` (default quando ausente).
- `normalizeElementLayer`/`normalizeThemeLayers(theme): SlideTheme` (migração na leitura).

**`src/features/slide-themes/outputPlan.ts`** (novo, puro)

- `themeSupportsCategory(theme, category): boolean` (público: `theme`/`presentation`; stage: `stage`; lower: `stream`).
- `isBackgroundCompatible(category, bg): boolean` (lower só `kind === "color"`).
- `materializeThemeForContent(theme, content): SlideTheme | null` (páginas por contexto; `presentation` por `media.index`).
- `resolveOutputTheme({ output, themes, eventThemeGuid, overrideThemeGuid, category }): { theme, source }` (override > evento > padrão > fallback; respeitando compatibilidade).
- `resolveOutputBackground({ contentTheme, override, liveBackground, theme, screenColor }): BackgroundLayer | null`.
- `resolveOutputPlan({ output, themes, eventThemeGuid, override, restThemeGuid, live }): OutputPlan`.
- `fallbackPlanForOutput(output, themes): OutputPlan` (modo degradado: padrão + look default, sem evento/override).
- `systemPlanForCategory(category, themes): OutputPlan`.

**Testes (node --test)** — `layers.test.ts`, `outputPlan.test.ts`:
- classificação de elemento → camada; defaults de `OutputLook` por categoria; `elementVisibleForLook` (slide off esconde; messages não é elemento);
- compatibilidade (`themeSupportsCategory`, `isBackgroundCompatible` incl. lower);
- precedência de tema (conteúdo > override > evento > padrão > fallback);
- precedência de fundo (override > slide > tema > cor da tela);
- normalização de tema sem `layer` e de output sem `look`.

### Fatia 1 — Rust: tipos, estado, broadcaster, comandos

**`src-tauri/src/state/types.rs`**
- `OutputLook` (serde camelCase; `screen_color` → `screenColor`), `OutputOverride`, `OutputPlan`, `LiveOutputPlans { plans: HashMap<String, OutputPlan> }`.
- `DisplayOutput` += `look: Option<OutputLook>`, `idle_theme_guid: Option<String>` (defaults + skip).
- `ThemeElement` += `layer: Option<String>` (default + skip).
- Constantes `EVENT_OUTPUT_PLANS = "presentation://output-plans"`, `EVENT_OUTPUT_OVERRIDES = "presentation://output-overrides"`.

**`src-tauri/src/state/presentation.rs`**
- Campos `output_plans: Arc<RwLock<LiveOutputPlans>>`, `output_overrides: Arc<RwLock<HashMap<String, OutputOverride>>>` + getters/setters. Incluir no `Default`.

**`src-tauri/src/services/broadcaster.rs`**
- `publish_output_plans(&LiveOutputPlans)` / `current_output_plans()` (emit + WS, como `publish_themes`).
- `publish_output_override(output_id, Option<&OutputOverride>)` / `current_output_overrides()`.

**`src-tauri/src/commands/presentation.rs`**
- `set_live_output_plans(broadcaster, plans: LiveOutputPlans)`.
- `get_live_output_plans(broadcaster) -> LiveOutputPlans`.
- `set_output_override(app, broadcaster, output_id, override_)` → grava no `PresentationState` + publica override (o admin recomputa os planos).
- `clear_output_override(app, broadcaster, output_id)`.

**`src-tauri/src/lib.rs`**: registrar os 4 comandos no `generate_handler!`.

**`src/core/ipc/commands.ts`**: wrappers `setLiveOutputPlans`, `fetchLiveOutputPlans`, `setOutputOverride`, `clearOutputOverride`.

**Testes Rust:** round-trip serde de `ThemeElement.layer`, `OutputLook`, `OutputPlan`; serde de campos ausentes (tema v1/v2 e output antigo); `set_output_override`/`get` reflete no estado.

### Fatia 2 — Sync no frontend

**`src/core/config/app.ts`**: `TAURI_EVENTS.outputPlans`, `TAURI_EVENTS.outputOverrides`.

**`src/features/slide-themes/outputPlansStore.ts`** (novo): Zustand `{ plans: LiveOutputPlans; applyRemote(unknown): void }` com normalização defensiva (como `liveThemesStore`).

**`src/core/sync/usePresentationSync.ts`**: assinar `outputPlans` e buscar `fetchLiveOutputPlans()` no boot.

### Fatia 3 — Admin publica planos

**`src/features/slide-themes/useOutputPlansPublisher.ts`** (novo): no admin, calcula `LiveOutputPlans` para todas as saídas (`outputs` do `useDisplaysStore` + `themes` + `eventThemeGuid` + overrides locais) e chama `setLiveOutputPlans`. Publicar quando: tema salvo/excluído, saída criada/editada (look/tema/idle/cor), evento alterado, override criado/limpo, admin monta. **Não** publica a cada slide.

**`src/views/AdminView.tsx`**: trocar `useLiveThemesPublisher` por `useOutputPlansPublisher` (manter o publisher antigo até migrar as views, depois remover).

### Fatia 4 — Views consomem o plano + filtro por camada

**`src/views/PublicView.tsx`**
- `activeOutput` por `?id=` → fallback "primeira habilitada da categoria".
- `plan = plans[activeOutput.id] ?? fallbackPlanForOutput(...)`.
- Tema: `plan.contentTheme ?? materializeThemeForContent(plan.theme, live.content)`.
- Look: filtra elementos por `elementVisibleForLook`; `look.slide === false` esconde fundo+elementos (cor da tela/wallpaper continua); `look.messages` gateia `StageAlertBanner/Overlay`.
- Fundo: `resolveOutputBackground(...)`.

**`src/views/StreamView.tsx`**: idem, com `screenColor` transparente por padrão e `isBackgroundCompatible` no override.

**`src/views/StageView.tsx`**: `plan.theme`/`plan.restTheme`; **sem** filtro de elementos; `look.messages` gateia alertas; ocioso = `plan.restTheme` > pág. `rest` > default. Corrigir `resolveStageRestRenderTheme` para usar tema sem `pages` como está (hoje cai no fallback).

**`src/features/displays/store.ts`**: `syncNativeWindow` passa a incluir `?id=` também nas rotas padrão (`/public?id=…`, `/stage?id=…`, `/stream?id=…`).

### Fatia 5 — Editor de temas: camadas mestras

**`src/features/theme-editor/LayersPanel.tsx`**
- Árvore: 8 seções mestras na ordem de `MASTER_LAYER_ORDER`, contador, expandir/recolher, olho de **edição** (liga/desliga todos os elementos da camada, como o olho de grupo) e cadeado.
- Grupos continuam dentro da camada; mover grupo move todos os membros.
- Camadas de sistema (`mask`, `messages`, `media`, `videoInput`, `screenColor`) aparecem vazias com texto explicativo e sem "adicionar elemento".
- Menu de contexto "Mover para camada…" (`slide`/`props`/`announcements` habilitados; resto desabilitado com motivo).

**`src/features/theme-editor/store.ts`**
- `addElement`/`addElements`: aplicam `layer: defaultLayerForElement(type)`.
- Nova ação `moveElementsToLayer(ids, layer)` (e `moveGroupToLayer(groupId, layer)`).
- `load`: normaliza elementos sem `layer` para `slide`.

**`src/features/theme-editor/elements.ts`**: helper de reordenação permanece; mover entre camadas é ação nova (não muda a ordem Z).

### Fatia 6 — UI de saída (Look)

**`src/features/displays/components/DisplaysTabsPanel.tsx`**
- Nova aba **"Camadas"** com os 8 toggles (defaults por categoria; sem renderer → "não se aplica nesta fase"), seletor de tema padrão com **todos** os temas agrupados "Recomendados"/"Outros" (incompatível desabilitado com motivo + "Editar tema"), e seletor de **fundo** (cor/wallpaper/imagem para público/stage; só cor/transparente para lower) com "Limpar fundo".
- Cor da Tela continua na aba existente; o toggle `screenColor` do Look é fachada para `backgroundColorEnabled`.
- Stage: seletor de **tema de descanso** (`idleThemeGuid`).
- Aviso: tema do evento e ação ao vivo podem sobrepor o padrão.

**`src/features/displays/components/DisplaysCanvasPreview.tsx`** e **`src/features/presentation/LivePreview.tsx`**: refletir look/fundo do plano (e `backgroundOverride`) nos previews.

### Fatia 7 — Remoção do ThemeRail + bindings + migração

- Remover `src/features/slide-themes/ThemeRail.tsx` e o uso em `AdminView.tsx`; remover `bindings`/`setBinding`/`clearBinding` do `useSlideThemesStore` e a lógica de bindings em `themeResolution.ts`; remover tipos `ThemeBinding` e as chaves `open_presenter_theme_bindings`/`open_presenter_stage_theme`/`open_presenter_stage_rest_theme`.
- **Migração** (na primeira leitura, sem reescrever em massa): para cada saída sem `defaultThemeGuid`, usar o binding antigo do seu target/asset principal; Stage: `stageThemeGuid → defaultThemeGuid`, `stageRestThemeGuid → idleThemeGuid`.
- `LiveThemes`/`set_live_themes` permanecem como leitura de fallback por uma versão; remover no fim da fase.

### Fatia 8 — Bootstrap do `/ws` (navegador/OBS)

- **`src-tauri/src/server/remote.rs`** (`handle_remote_socket`): enviar no snapshot inicial `EVENT_OUTPUT_PLANS` (`state.broadcaster.current_output_plans()`) e `EVENT_DISPLAYS` (lista de `DisplayOutput` lida do `state.db`).
- **`src-tauri/src/server/http.rs`**: helper `current_display_outputs(state)` lendo `displays.outputs` via `settings::get_setting`.
- **`src/features/displays/useDisplaysSync.ts`**: no navegador, assinar `displays://changed` via `syncBus` e aplicar o snapshot inicial.

### Fatia 9 — Verificação

- `npm run typecheck`; `node --test` (arquivos novos/alterados); `cargo check -p open-presenter`.
- Manual (do design): slide off esconde texto/imagem/fundo no público; messages off esconde alerta só naquela saída; cor da tela off → transparente no lower e preto no público; duas saídas públicas com temas padrão diferentes (inclusive por `?id=`); evento vence padrão; override ao vivo vence evento; fundo muda só uma saída e mantém o texto; lower não oferece imagem comum; Browser Source sem admin recebe plano via `/ws`; reiniciar o app limpa o override e mantém tema padrão/look; temas v1/v2 e URLs antigas sem `?id=` continuam abrindo.

## Riscos

- **Plano por saída é mudança grande de sync.** Mitigar mantendo `LiveThemes` como fallback e migrando uma view por vez (Stream → Public → Stage).
- **Editor x Stage:** elemento movido para `props`/`announcements` some no público conforme o look e continua no Stage (limitação documentada até a Fase 3).
- **Fundo opaco do tema x override:** override é fundo do Slide (sub-camada), não item da Mídia.
- **Dados antigos / WIP não commitado:** campos opcionais, migração na leitura, tocar só no escopo.
