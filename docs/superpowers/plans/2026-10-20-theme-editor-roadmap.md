# Alinhamento do editor de temas ao ProPresenter — roadmap

> **For agentic workers:** este roadmap é o índice das entregas. Cada fase deve virar um plano de implementação próprio em `docs/superpowers/plans/`, executado task-by-task com testes. Steps usam checkbox (`- [ ]`) para rastreamento.

**Goal:** evoluir o ThemeEditor e o Studio em fases independentes, começando por performance e chegando a máscaras, mensagens e composição de camadas, sem quebrar temas v1/v2.

**Architecture:** manter o renderer DOM/CSS atual e evoluir o modelo de dados de forma compatível. O fundo vira camada, elementos ganham fill/forma/rotação estruturados, máscaras e mensagens viram documentos próprios, e a saída ganha um compositor de camadas.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind v4, Tauri v2/Rust, SVG/CSS, protobuf apenas na importação futura.

**Spec:** `docs/superpowers/specs/2026-10-20-propresenter-theme-editor-design.md`

## Global Constraints

- Não adicionar dependências de canvas/editor (fabric, Konva, tldraw, react-rnd, dnd-kit, Three.js).
- Não alterar versões pinadas de `package.json`/`Cargo.toml`.
- Temas v1/v2 precisam continuar abrindo sem mudança visual.
- `npm run typecheck` e `npm test` passam antes de cada commit.
- Se mexer no Rust: `cargo check -p open-presenter` com `CARGO_TARGET_DIR=/Users/claudio/Projects/open-presenter/src-tauri/target`.
- Sem comentários no código, exceto quando a lógica não for auto-evidente.
- Commits em Conventional Commits, em pt-BR ou en, curtos e no imperativo.
- Disco: ~2 GiB livres. Não rodar `npm install` nem build Tauri completo dentro do worktree.
- Assets grandes (imagens, noise) não entram no JSON de definição do tema.

## Review Focus

- Texto com altura automática e largura fixa: mover na horizontal não pode re-medir; mover na vertical pode.
- Tema com 10+ elementos: arrastar um elemento não pode re-renderizar/re-medir os demais.
- Studio com 50+ temas: previews fora da viewport não podem montar canvas/ResizeObserver.
- Tema v1/v2 importado: nenhum elemento pode mudar de posição, ordem ou fundo.
- Máscara keyhole/overlay: uma forma não pode vazar para fora do palco 1920×1080.

---

## Épico A — Performance e resposta

**Objetivo:** reduzir trabalho por frame no editor e no Studio sem mudar o modelo de dados.

- [ ] **A1. Coalescer pointermove por frame**
  - Extrair `createFrameCoalescer` para `src/core/lib/frameCoalescer.ts`, com scheduler injetável.
  - Usar em `Canvas.updateGesture` para no máximo um update por frame.
  - Testes: múltiplos pushes antes do frame aplicam só o último; cancel não aplica.
  - Depende de: nenhum.

- [ ] **A2. Fit de texto sem posição**
  - Extrair `buildFitGeometryKey(css, autoHeight)` para `src/features/slide-themes/fitGeometry.ts`.
  - Incluir largura/altura/padding sempre; incluir `top/y` só quando `autoHeight`; excluir `left/x`.
  - Usar em `ThemeRenderer.AutoScaledText`.
  - Testes: mover na horizontal não muda a chave; mover na vertical só muda com altura automática.
  - Depende de: nenhum.

- [ ] **A3. Memoizar renderização de elementos**
  - Extrair `ThemeElementView` para arquivo próprio ou memoizar no local.
  - Comparador: mesmo objeto `element` e props iguais → não re-renderiza.
  - Testar o comparador puro; validar manualmente com React DevTools.
  - Depende de: nenhum.

- [ ] **A4. Cachear caixas de snap por gesto**
  - Calcular caixas dos outros elementos uma vez em `beginMove`, guardar no `Gesture`.
  - `calculateSnap` passa a receber as caixas prontas.
  - Testar `buildSnapBoxes(elements, boxOf, excludeId)`.
  - Depende de: nenhum.

- [ ] **A5. Studio com previews preguiçosos**
  - Extrair `ThemeCard` memoizado em `src/features/studio/ThemeCard.tsx`.
  - Montar `ScaledStage` só quando o card entra na viewport (`IntersectionObserver`), com fallback imediato quando `IntersectionObserver` não existe.
  - `content-visibility: auto` nos cards.
  - Validar manualmente com 50+ temas: rolar a lista e conferir que previews fora da tela não têm `canvas`/`ResizeObserver` ativo.
  - Depende de: nenhum.

- [ ] **A6. Seletores no PropertiesPanel**
  - Trocar assinaturas amplas do store por seletores do elemento ativo.
  - Separar seções grandes em componentes memoizados quando necessário.
  - Validar com React DevTools: editar um campo não re-renderiza o painel inteiro.
  - Depende de: A3.

- [ ] **A7. Resumo leve de temas no Rust**
  - Adicionar consulta de listagem com `guid`, `title`, `category`, `updated_at`, `thumbnail` (ou contagem de elementos).
  - `list_themes` deixa de decodificar o JSON completo.
  - Testes Rust para a consulta e fallback quando não há thumbnail.
  - Depende de: nenhum; requer `cargo check` com target compartilhado.

**Critério de saída do épico:** arrastar tema pesado fica fluido; Studio grande não monta previews fora da tela; typecheck/testes passam.

---

## Épico B — Fundação gráfica

**Objetivo:** unificar texto, imagem, vídeo, forma e fundo em um modelo gráfico compatível com v1/v2.

- [ ] **B1. `Fill` estruturado**
  - Tipos `solid | gradient | media | backdrop` em `src/core/types`.
  - Helpers `fillToCss`/`cssToFill` com testes de round-trip.
  - Renderer usa `fill` quando presente; cai no `css`/`src` legado.
  - Depende de: nenhum.

- [ ] **B2. Formas primitivas**
  - `shape`: rect, rounded, ellipse, triangle, star, polygon, arrow.
  - Renderer SVG ou `clip-path`; export PNG acompanha.
  - Testes de geometria/path para cada forma.
  - Depende de: B1.

- [ ] **B3. Rotação e aspect ratio lock**
  - `rotation` e `aspectLocked` first-class no elemento.
  - Canvas: alça de rotação, snap de 15°, resize respeitando lock.
  - PropertiesPanel: campo de rotação e cadeado.
  - Testes de geometria para resize com lock e rotação.
  - Depende de: B2.

- [ ] **B4. Stroke, shadow e feather estruturados**
  - Campos no elemento e controles no inspetor.
  - Renderer e export usam os mesmos valores.
  - Testes de serialização e CSS gerado.
  - Depende de: B1.

- [ ] **B5. Text fill avançado**
  - Gradiente, mídia e cut-out via `background-clip: text`/`mix-blend-mode`.
  - Stroke e shadow de texto estruturados.
  - Testes de CSS gerado e fallback sem suporte.
  - Depende de: B1.

- [ ] **B6. Fundo como camada**
  - Migrar `theme.css.background` para um elemento/grupo de fundo travado.
  - Manter fallback para temas antigos.
  - Testes de migração e ordem de camadas.
  - Depende de: B1.

- [ ] **B7. Múltiplos slides nomeados**
  - Evoluir `ThemePage` para `ThemeSlide[]` com `name`/`role`.
  - Relaxar a regra de contexto único no Rust; manter validação de contexto válido.
  - `PagesBar` vira barra de slides com adicionar/duplicar/renomear/reordenar.
  - Testes de import/export v1/v2 e resolução por contexto.
  - Depende de: B6.

- [ ] **B8. Schema v3 e migração**
  - `schemaVersion` no tema, normalize na leitura, export v3.
  - Migração de v1/v2 preservando visual.
  - Testes de round-trip e migração.
  - Depende de: B1–B7.

- [ ] **B9. Importador de temas do ProPresenter (opcional)**
  - Ler `Template.Document` protobuf (schema extraído), mapear elementos/fills/texto.
  - Resolver assets relativos (`ROOT_CURRENT_RESOURCE`), nunca caminhos absolutos.
  - Inverter a ordem dos elementos (ProPresenter é frente→fundo).
  - Testes com os temas Black e VIBIN embutidos no app.
  - Depende de: B8.

**Critério de saída do épico:** um tema com forma, gradiente, texto com fill e fundo como camada abre, edita, exporta e reimporta sem perda.

---

## Épico C — Máscaras

**Objetivo:** máscaras de saída no modelo do ProPresenter, reutilizando o canvas de formas.

- [ ] **C1. Documento e store de máscara**
  - `Mask { id, name, color, mode, shapes }` em `src/core/types`.
  - Store/feature `src/features/masks`.
  - Testes de CRUD e serialização.

- [ ] **C2. Editor de máscara**
  - Reutilizar `Canvas` em modo “somente formas”, com preview da saída atrás.
  - Inspetor: nome, tamanho, modo, cor.
  - Validação manual com máscara de 1 e 3 formas.

- [ ] **C3. Renderer SVG overlay/keyhole**
  - Gerar `<mask>`/`<clipPath>` a partir das formas normalizadas.
  - Overlay pinta por cima; keyhole recorta.
  - Testes de path e de inversão.

- [ ] **C4. Vínculo por saída**
  - `OutputTarget`/look ganha `maskId`.
  - UI de seleção em Configurações → Saídas.
  - Teste de resolução de máscara por target.

- [ ] **C5. Export com máscara**
  - `exportImage` aplica a mesma máscara do palco.
  - Teste visual/round-trip.

**Critério de saída do épico:** uma máscara keyhole recorta a saída inteira e aparece igual no PNG exportado.

---

## Épico D — Messages e compositor de saída

**Objetivo:** camada de mensagens para o público e toggles de camadas por tela.

- [ ] **D1. Documento e store de mensagem**
  - `Message`, tokens, clear rules, template.
  - Testes de token e clear.

- [ ] **D2. Editor de mensagens**
  - Lista + detalhe, “Theme:”, tokens, “Show/Hide”.
  - Validação manual.

- [ ] **D3. Renderer da camada de mensagens**
  - Reutilizar `ThemeRenderer` com o theme slide escolhido.
  - Tokens resolvidos em runtime.
  - Teste de resolução de tokens.

- [ ] **D4. `OutputLook` e toggles**
  - Modelo de look por target com background/foreground/announcements/props/messages/live video/mask.
  - Persistência no Rust e sync.
  - Testes de serialização.

- [ ] **D5. `StageComposer`**
  - Compor camadas na ordem correta no palco.
  - Testes de ordem e visibilidade.

- [ ] **D6. UI de looks por tela**
  - Configurações → Saídas com os toggles.
  - Validação manual.

- [ ] **D7. Mensagens no remote/web (opcional)**
  - Expor mensagens com `visibleOnNetwork`.
  - Fora do escopo inicial se apertar.

**Critério de saída do épico:** uma mensagem com token de nome aparece sobre o slide na saída pública e pode ser ocultada por tela.

---

## Épico E — Avançado

- [ ] **E1. Builds in/out** (on click, with previous, after previous, with slide; reveal por bullet/underline).
- [ ] **E2. Text scrolling** (créditos, loop, feathering).
- [ ] **E3. Data links estruturados** (subconjunto: slide text, notes, next slide, timer, clock, message, stage message).
- [ ] **E4. Blend modes e matte** (subconjunto: normal, multiply, screen, overlay, alpha matte).
- [ ] **E5. Pipeline único de render/export** (DOM e Canvas consumindo o mesmo plano de desenho).

---

## Ordem recomendada

1. **A1–A5** — performance e fluidez; baixo risco, sem migração.
2. **B1–B6** — modelo gráfico e fundo como camada; base para tudo.
3. **B7–B8** — múltiplos slides e schema v3.
4. **C1–C5** — máscaras.
5. **D1–D6** — mensagens e compositor.
6. **E1–E5** — diferenciais avançados.
7. **B9** — importador do ProPresenter, quando o modelo estiver estável.

## Definition of done por fase

- Plano detalhado em `docs/superpowers/plans/`.
- Testes unitários das funções puras.
- `npm run typecheck` e `npm test` verdes.
- Verificação manual descrita no plano.
- Commit(s) Conventional Commits.
- Nenhum tema v1/v2 quebrado.
