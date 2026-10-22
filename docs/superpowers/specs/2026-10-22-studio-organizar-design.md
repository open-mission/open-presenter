# Design — Studio/Editor de Apresentação: guias, grupos, rotação e aba "Organizar"

> **Data:** 2026-10-22 · **Branch:** `feature/studio-organizar` · **Stack:** Tauri v2 (Rust), React 19 + TS, Zustand, Tailwind v4, `node --test`.

## Intent e porquê

O Studio (editor de temas/apresentações, janela `theme-editor`) é hoje o lugar onde o operador monta telas de **Stage** e **apresentações de pregação**. Na prática, ele monta composições com vários elementos (texto, formas, barra lower third) e precisa **alinhar, agrupar e organizar** esses elementos como faz em Canva/Pages. Hoje isso é penoso:

- Não dá para criar guias próprias: só existem as guias fixas de centro/margem. Alinhar "no olho" é chute.
- O grupo existe como etiqueta (`groupId`) e move junto, mas **não tem caixa própria**: as alças de redimensionar aparecem em um membro qualquer, não no grupo.
- Não há rotação (nem por alças, nem por campo numérico).
- Não há duplicar item por atalho; o Delete só funciona em seleção única.
- A janela do editor carrega chrome de navegador (menu de contexto do WebView com Voltar/Recarregar, botão "Voltar" no header) que não faz sentido numa janela própria que se fecha no X.
- A aba de geometria se chama "Forma" e mistura posição/dimensões com preenchimento e borda — confuso. E todas as seções abrem expandidas, enchendo a rolagem de ruído.

## Metas / Não-metas / Anti-metas

**Metas**
1. Duplicar item (e grupo) com `Cmd/Ctrl+D` e por botão na camada.
2. Delete/Backspace apagando a seleção (item ou grupo), com guardas.
3. Janela do editor sem menu de navegador do WebView; sem botão "Voltar" no header.
4. Guias arrastáveis a partir das réguas, salvas por página, que servem de alvo de snap (estilo Canva).
5. Agrupar/desagrupar por atalho (`Cmd/Ctrl+G`, `Cmd/Ctrl+Shift+G`).
6. Clique em área vazia deseleciona.
7. Clique seleciona o **grupo**; duplo-clique ou `Cmd/Ctrl+clique` entra no **item** do grupo.
8. Item de grupo entra alinhado **em relação ao grupo**.
9. Caixa do grupo com alças de redimensionar (Shift mantém proporção) e rotação do grupo.
10. Rotação de itens pelas alças e por campo numérico.
11. Aba "Forma" renomeada/reescopada para **"Organizar"** (posição, tamanho, rotação, alinhar, distribuir, ordem, agrupar) + aba **"Aparência"** para preenchimento/borda/opacidade.
12. Todas as seções de formatação fechadas por padrão.
13. `Cmd/Ctrl+A` seleciona todos os itens da página ativa (visíveis e destravados).

**Não-metas**
- Não é um novo renderizador: o visual projetado (tela pública/stage/OBS) tem que continuar idêntico ao do editor.
- Não são grupos aninhados (grupo dentro de grupo).
- Não é seleção por laço (marquee) nem caixa de seleção por arrasto na área vazia.
- Não é reescrever `exportImage.ts` como captura DOM, nem corrigir lacunas **preexistentes** do exportador (`transform: scale()` e `clipPath` de triângulo/estrela). A rotação entra no exportador Canvas 2D atual; o resto fica registrado como dívida separada.
- Não é duplicar página/slide (já existe em `PagesBar`) nem duplicar tema no Studio (já existe no `StudioPage`).
- Não é menear/teclas de seta para mover, nem distribuir em grade, nem "espaçamento igual" avançado.
- Não é refazer a barra de ferramentas de inserção (texto, formas, widgets, lower third).

**Anti-metas (falha mesmo funcionando)**
- Guias que aparecem na projeção/exportação (têm de ser só do editor).
- Rotação que quebra o snap, o export PNG/JPG ou o render de temas existentes (v1/v2).
- Redimensionar grupo que **não** escala os membros (deformar em vez de escalar) ou que perde o deslocamento relativo.
- Salvar o tema e perder as guias ou a rotação (round-trip Rust).
- Atalhos que disparam enquanto o operador digita em campo de texto/edita um texto no canvas.
- Perda de trabalho: fechar a janela com alterações não salvas continua sem avisar (comportamento atual) — mas o indicador "Não salvo" permanece visível.

## Estado atual (grounding verificado)

- **Janela:** `src-tauri/src/services/display_manager.rs::open_theme_editor_window` cria a janela `theme-editor` (`WebviewWindowBuilder`, `decorations(true)`, rota `index.html#/theme-editor?guid=…`, reusa a janela via evento `theme-editor://open`). Menu do app definido em `src-tauri/src/lib.rs` (global, macOS).
- **Rota/UI:** `src/views/ThemeEditorView.tsx` (header com botão Voltar `ArrowLeft`, toolbar de inserção, layout 3 colunas, `<Canvas>`, `<PagesBar>`, `<PropertiesPanel>`); estado local `selectedId: string | null` (seleção única), `showRulers`, `showGuides`, `snap`, `zoom`, `resolution`. Atalhos globais já tratados ali (Delete/Backspace em seleção única, Escape, Cmd+Z/Y/S).
- **Canvas:** `src/features/theme-editor/Canvas.tsx` — `ThemeRenderer` dentro de um `stage` escalado (`scale` = zoom), overlays de seleção por elemento, 8 alças (`HANDLE_OFFSETS`/`HANDLE_CURSORS`), gestos `move`/`resize` com `frameCoalescer`, snap em margens/centro/bordas/elementos (`calculateSnap`, `calculateResizeSnap`), réguas internas (`RulerTop`/`RulerLeft`, `20px`, `pointer-events-none`), guias fixas de centro/margem (toggle `showGuides`), medição real dos elementos via `ResizeObserver` (`measured`).
- **Store:** `src/features/theme-editor/store.ts` — Zustand com `draft: SlideTheme`, `past/future` (histórico de 50), `activePageId`, mutações (`updateElement`, `updateElements`, `groupElements`, `ungroupElements`, `moveElement`, `moveGroup`, `removeElement`, `removeGroup`…) e `save()` (persiste via IPC `saveTheme`).
- **Grupos (dados):** apenas `groupId`/`groupName` por elemento (`src/features/theme-editor/groups.ts`); `groupElementsInList`, `ungroupElementsInList`, `moveGroupInList`, etc.
- **Camadas:** `src/features/theme-editor/LayersPanel.tsx` — multi-seleção **local** (`selectedIds: Set<string>`) usada só para agrupar/desagrupar; linhas por grupo (`items`), ações (agrupar, desagrupar, renomear, visibilidade, trava, mover, remover). Não reflete a seleção do canvas.
- **Propriedades:** `src/features/theme-editor/PropertiesPanel.tsx` — abas por tipo: texto (`Texto`/`Forma`/`Animação`/`CSS`), mídia (`Mídia`/`Forma`/`Animação`/`CSS`), forma (`Forma`/`Animação`/`CSS`) e, sem seleção, `Fundo do Slide`/`Slide & Tela`. `Section` já é colapsável (`useState(defaultOpen)`, default `true`), com `GeneralSection` (ELEMENTO), `PositionSection` (POSIÇÃO & DIMENSÕES + `transform: scale()`), `RectangleSection`, `TextBoxBackgroundSection`, `AppearanceSection` (opacidade/borda/arredondamento), `TransitionsSection`, `AdvancedCssSection`.
- **Geometria:** `src/features/theme-editor/geometry.ts` (`elementRect`, `alignToScreen`, `LOGICAL_W/H`), `src/features/theme-editor/snapBoxes.ts`.
- **Tipos:** `src/core/types/index.ts` (`ThemeElement` com `css: Record<string,string>`, `x`, `y`, `groupId`, `groupName`; `ThemePage` com `css`/`elements`/`name`) e `src-tauri/src/state/types.rs` (`ThemeElement`, `ThemePage`, `SlideTheme` — **sem** `deny_unknown_fields`, `css` como `HashMap<String,String>`).
- **Render:** `src/features/slide-themes/ThemeRenderer.tsx` espalha `element.css` no `style` do nó (linha 65) — ou seja, `rotate: "12deg"` já renderiza. Export em `src/features/theme-editor/exportImage.ts`.

## Decisões do usuário (como saíram da conversa)

1. Contexto de uso: montar telas de Stage e apresentações de pregação; a dor é **alinhar e agrupar**.
2. **Clique simples seleciona o grupo inteiro**; entrar no item é **duplo-clique ou `Cmd/Ctrl+clique`**.
3. Duplicar item com atalho; apagar com Delete.
4. Remover o botão "Voltar" — a janela se fecha.
5. Guias arrastáveis a partir da régua, estilo Canva.
6. Agrupar por atalho.
7. Clicar fora/área vazia deseleciona.
8. Item dentro do grupo deve alinhar **baseado no grupo**.
9. O grupo deve ter as guias de borda com opção de redimensionar (hoje aparece só em um membro), com **Shift mantendo proporção**, e opção de **rotacionar** itens (pelas alças e pela aba de posição).
10. Aba "Forma" deveria se chamar **"Organizar"**, como no Pages.
11. Seções de formatação sempre fechadas por padrão.
12. "Menu de navegador" = o menu de **botão direito** dentro da janela (Voltar/Recarregar/Inspecionar), não o menu do app no topo da tela.
13. `Cmd+A` deve selecionar **todos os itens** da apresentação/tema (página ativa).

## Decisões do autor (minhas — checar)

- **Seleção como lista**: a seleção vira `{ ids: string[]; anchorId: string | null }` no store do editor (estado **efêmero**, fora do `draft`/histórico). `selectedId` atual (coluna única) é derivado (`anchorId`). Motivo: canvas e painel de camadas precisam da mesma fonte, e agrupar/duplicar/apagar operam em N itens.
- **Modo "dentro do grupo" é pegajoso (estilo Canva)**: além de `ids`/`anchorId`, o estado efêmero guarda `enteredGroupId`. Entrar por duplo-clique/`Cmd/Ctrl+clique` marca o grupo; enquanto o modo durar, um clique simples em irmão troca o item selecionado, e clicar fora do grupo ou em área vazia sai do modo. Sem modo, clique simples em membro seleciona o grupo inteiro. Selecionar um filho pela lista de camadas também "entra" (mesma semântica de Delete/alinhamento).
- **Seleção múltipla e grupo usam o mesmo motor**: arrastar qualquer item de uma seleção com 2+ itens move a seleção inteira; a caixa de seleção aparece sempre que houver 2+ itens (grupo nomeado ou não) e tem as mesmas alças de redimensionar/rotacionar. Grupo é apenas uma seleção persistida com nome.
- **Painel segue o escopo da seleção**: com grupo ou seleção múltipla, a aba "Organizar" mostra **a caixa** (X/Y/W/H) e edita a seleção inteira — X/Y move tudo, W/H escala proporcionalmente (mesma matemática do gesto), Rotação gira o conjunto. Com um item único, mostra/edita o item. Os números do painel nunca contradizem a caixa do canvas.
- **`Shift+clique`** adiciona/remove itens da seleção (canvas e camadas). Sem marquee.
- **`Cmd/Ctrl+A`** seleciona todos os elementos **visíveis e destravados da página ativa** (não os ocultos/travados, não os de outras páginas) e entra em modo de seleção múltipla. O menu nativo "Editar" do macOS tem `.select_all()` com o mesmo acelerador (`src-tauri/src/lib.rs`) e pode engolir o evento antes do WebView: a implementação começa no handler JS; **se o teste manual confirmar que o menu nativo intercepta**, remove-se o item `.select_all()` predefinido e confere-se que inputs das duas janelas continuam selecionando texto (o WebKit faz isso por key binding próprio). Verificação manual obrigatória no plano.
- **Duplicar** (`Cmd/Ctrl+D` ou botão na camada): cópia deslocada em +20/+20 px lógicos, inserida imediatamente depois do original na ordem Z, já selecionada. Duplicar um grupo duplica todos os membros com **novo** `groupId`, mantendo o nome.
- **Delete** apaga toda a seleção; com grupo selecionado apaga todos os membros; com um item "entrado" apaga só ele (e o grupo é dissolvido se sobrar 1 membro). Mantém a guarda de "não apagar o último elemento" em tema de layout único, e ignora quando o foco está em input/textarea/select/contentEditable.
- **Grupo = caixa derivada** (sem contêiner novo no modelo): caixa = *bounding box* dos retângulos **visuais** dos membros (retângulo girado → AABB dos 4 cantos). Redimensionar escala **posição e tamanho** de cada membro proporcionalmente em relação à caixa; `Shift` = escala uniforme (mantém proporção). Rotacionar o grupo rotaciona cada membro em torno do **centro do grupo** e soma o delta no `rotate` próprio de cada um.
- **Escala de grupo com membro rotacionado é aproximada e assumida**: posições escalam no eixo do mundo (centro do membro → centro novo), larguras/alturas escalam em `fx`/`fy` nos eixos locais do membro, então o AABB resultante pode não fechar exato com a moldura arrastada; a caixa é recalculada ao soltar. Em `TEXT`, o `fontSize` (quando em px) escala pelo fator médio `(fx+fy)/2` para o texto acompanhar a caixa. Sem skew.
- **Rotação por elemento** armazenada em `css.rotate = "<graus>deg"` (propriedade CSS `rotate`, suportada pelo WebKit do Tauri) — **não** cria campo novo em `ThemeElement`, então o round-trip Rust↔TS continua intacto. `transform` continua livre para escala/`scale()` já existente (a rotação não o sobrescreve).
- **Réguas de snap são visuais, não de layout**: snap, alinhamento, distribuição e a caixa de grupo usam o **AABB visual** (retângulo girado); os campos X/Y/W/H do painel continuam sendo os valores de layout (`css.left/top/width/height`), como no Figma. Um elemento rotacionado usa seu AABB visual como alvo de snap para os outros.
- **Alças giram com o elemento**: o overlay de seleção do item usa o mesmo `rotate`, e o arrasto das alças é convertido para o referencial local do elemento (rotaciona o delta por `-ângulo`), como no Canva/Figma. Alça de rotação circular acima do topo-centro com o overlay; `Shift` trava em passos de 15°.
- **Guias de usuário persistidas**: novo campo `guides` em `ThemePage` (e em `SlideTheme` para layout único): `{ id, axis: "x"|"y", pos }` em px lógicos. Exige espelhar em `src-tauri/src/state/types.rs` (AGENTS.md §2), sem `deny_unknown_fields` — nada quebra com temas antigos (campo opcional).
- Guias: criadas arrastando da régua; **arrastar de volta para a régua remove**; duplo-clique na guia também remove; são **invisíveis na projeção e na exportação**; entram no histórico de undo; a régua só precisa estar visível (toggle "Réguas") para criá-las, e ficam visíveis no editor independentemente do toggle "Guias" (que segue controlando centro/margens).
- **Alvo de alinhamento**: item de grupo selecionado individualmente → alinha pela **caixa do grupo**; 2+ itens selecionados → alinha pela **caixa da seleção**; caso contrário → pela **tela** (comportamento atual de `alignToScreen`).
- **Ordem na aba Organizar**: Posição/Dimensões/Rotação → Alinhar & Distribuir → Ordem (frente/trás) → Agrupar/Desagrupar → Elemento (id, visível, travado).
- **Abas**: `Organizar` | `Aparência` | `Animação` | `CSS` (+ `Texto` ou `Mídia` na frente). 5 abas com rótulo curto e `text-[10px]`; "Aparência" recebe `TextBoxBackgroundSection` (texto), `RectangleSection` (formas) e `AppearanceSection`.
- **Seções**: `defaultOpen = false` em todas (inclusive `CONFIGURAÇÕES DO SLIDE`, `POSIÇÃO & DIMENSÕES`, `ELEMENTO`, `TEXTO & TIPOGRAFIA`, `TRANSIÇÃO`, `PLANO DE FUNDO DO TEMA`); o estado aberto/fechado continua por sessão de UI, sem persistir.
- **Fechar a janela**: continua sem diálogo de "salvar antes de sair" (fora de escopo), mas o editor ganha um helper `closeEditor()` (Tauri: `getCurrentWindow().close()`; navegador: `window.close()` e, se bloqueado, `navigate("/preferences")`), usado no estado de erro ("Nenhum tema selecionado").

## Como vai ser

### Parte A — Janela sem chrome de navegador

- `ThemeEditorView.tsx`: remover o botão `ArrowLeft` do header e `handleBack` do fluxo normal; no estado de erro/`guid` vazio, trocar "Voltar" por **"Fechar"** (usa `closeEditor()`).
- Bloquear o **menu de contexto do WebView** (Voltar/Recarregar/Inspecionar) no contêiner raiz do editor: `onContextMenu` com `preventDefault()` (só no editor, não no app inteiro; campos de texto mantêm colar/copiar nativo — não interceptar `contextmenu` dentro de `input`/`textarea`/`contentEditable`).
- Impedir navegação de histórico dentro do editor: manter o `preventDefault` de Backspace/Cmd setas; remover o caminho `navigate(-1)`.
- Confirmado pelo usuário: "menu de navegador" é o **menu de contexto do WebView** (botão direito), não o menu do app no topo da tela. O menu do app (`Arquivo`/`Editar`/`Apresentação`) fica como está; a única ressalva é o `Cmd+A` do item nativo "Selecionar Tudo" (ver Decisões do autor / Parte C).

### Parte B — Seleção, grupos e caixa do grupo (Canvas)

**Modelo de seleção (store, efêmero):** `selection: { ids: string[]; anchorId: string | null; enteredGroupId: string | null }`, com ações `select(ids, anchor?)`, `toggleSelect(id)`, `clearSelection()`, `enterGroup(id)`, `exitGroup()`. `PropertiesPanel` e `LayersPanel` passam a ler tudo daqui (fim da `selectedIds` local do painel de camadas). O painel de propriedades recebe a seleção e deriva o escopo (item, grupo ou seleção múltipla).

**Cliques no canvas:**
- `pointerdown` em elemento fora de grupo e sem modificador → seleciona só ele (comportamento atual) e inicia arrasto. Se ele já faz parte de uma seleção múltipla, **mantém** a seleção e arrasta o conjunto.
- `pointerdown` em elemento **em grupo**, fora do modo "entrado" → seleciona **todos os membros** e inicia o arrasto do grupo (mover move o grupo inteiro, como hoje).
- `duplo-clique` (ou `Cmd/Ctrl+clique`) em elemento em grupo → **entra no grupo** (`enteredGroupId`) e seleciona o item; o grupo **não** move junto. Enquanto o modo durar, clique simples em irmão troca o item selecionado. Para texto, o duplo-clique continua abrindo o editor de texto; nesse caso entrar no grupo é `Cmd/Ctrl+clique`.
- Sair do modo "entrado": clique em área vazia, `Escape`, clique em elemento fora do grupo, ou seleção de outra camada.
- `Shift+clique` → alterna o item na seleção (funciona também para itens de grupo, sem precisar "entrar").
- Clique na área vazia (letterbox do wrapper, stage e artboard) → limpa a seleção (hoje só funciona quando o alvo é exatamente o wrapper/stage; passa a valer também clicando no `#theme` vazio).
- `Escape` limpa a seleção e sai do grupo (já existe para limpar).

**Caixa do grupo / da seleção:** sobreposição única, calculada dos membros (`AABB` dos retângulos visuais); aparece para grupo nomeado **ou** seleção múltipla sem grupo, com:
- 8 alças de redimensionar (mesmos estilos/cursores das alças de item), escalando membros proporcionalmente; `Shift` = uniforme (mantém proporção);
- 1 alça de rotação (círculo acima do topo-centro) que rotaciona o conjunto em torno do centro da caixa, com `Shift` = passos de 15°;
- contorno tracejado distinto (ex.: `border-dashed` + cor de grupo) para não confundir com a seleção de item;
- `lock`: membros travados não são movidos/escalados/rotacionados pelo gesto do grupo, mas continuam contando na caixa;
- ao soltar, a caixa é recalculada (a escala de membro rotacionado é aproximada — ver "Decisões do autor"); em `TEXT`, `fontSize` em px acompanha pelo fator médio.

**Caixa do item:** passa a girar junto com o elemento (overlay com o mesmo `rotate`), alças e alça de rotação próprias; arrasto convertido para o referencial local (`rotate(-ângulo)` do delta) tanto no resize quanto no move (o move continua em eixos globais).

**Snap:** a caixa do grupo usa as mesmas regras do item (margens, centro, 0/100%, bordas/centros dos outros elementos) — na prática, o gesto passa a operar sobre a caixa do grupo em vez da caixa do membro arrastado. Guias de usuário entram como alvos extras (ver Parte D).

### Parte C — Atalhos e comandos

| Atalho | Ação |
| --- | --- |
| `Cmd/Ctrl+D` | Duplicar seleção (item, itens ou grupo) |
| `Delete` / `Backspace` | Apagar seleção |
| `Cmd/Ctrl+G` | Agrupar seleção (≥2) |
| `Cmd/Ctrl+Shift+G` | Desagrupar grupo selecionado |
| `Cmd/Ctrl+A` | Selecionar todos (visíveis e destravados) da página ativa |
| `Escape` | Limpar seleção e sair do grupo |
| `Shift+clique` | Alternar item na seleção |
| `Cmd/Ctrl+clique` / duplo-clique | Entrar no item do grupo |
| `Shift` (durante gesto) | Escala uniforme / rotação em 15° |

- Novo no store: `selectAll()`, `duplicateSelection()`, `removeSelection()`, `groupSelection()`, `ungroupSelection()`, `setRotation(id, deg)`, `rotateGroup(groupId, deltaDeg, center)`, `scaleGroup(groupId, rect, factorX, factorY)`, `updateGuides(...)`. Reaproveitam `updateElements`, `groupElementsInList`, `ungroupElementsInList`.
- `LayersPanel`: passa a ler/escrever a seleção do store (fim da `selectedIds` local), destaca o grupo inteiro quando o grupo está selecionado, e ganha botão **Duplicar** por linha/grupo (ícone `Copy`) além do `Cmd/Ctrl+D`.
- Guardas: atalhos só quando o foco não está em input/textarea/select/contentEditable (já existe; generalizar com o mesmo predicado).

### Parte D — Réguas e guias arrastáveis

- **Régua interativa:** `RulerTop`/`RulerLeft` deixam de ser `pointer-events-none` e ganham `pointer-events-auto`, `cursor: crosshair` na faixa de criação, e um `pointerdown` que inicia a criação de guia (`axis: "x"` na régua do topo, `axis: "y"` na da esquerda). A conversão cliente→lógico continua via `toLogical()`; durante o arrasto a guia segue o ponteiro, com snap a alvos quando `Snap` está ligado.
- **Modelo:** `ThemeGuide = { id: string; axis: "x" | "y"; pos: number }` (px lógicos). Armazenado em `ThemePage.guides` e, em tema de layout único, `SlideTheme.guides`. Mutação pelo store (undo/redo junto com o resto do documento), persistida no `save()`.
- **Interação:** arrastar a guia → reposicionar; arrastar para fora/sobre a régua → remover; duplo-clique na guia → remover; hover mostra destacamento e cursor `grab`/`grabbing`. Botão **"Limpar guias"** aparece na toolbar quando existem guias.
- **Snap nas guias:** `calculateSnap`/`calculateResizeSnap` recebem uma lista extra de alvos (guias) com prioridade logo após tela/centro e antes dos outros elementos; guia ativa é realçada (cor própria) quando o snap acontece. Guias também servem de alvo para o resize do grupo.
- **Render:** guias do usuário não são exportadas (`exportImage`) nem renderizadas pelo `ThemeRenderer` — vivem só nos overlays do `Canvas`.
- **Rusto:** `ThemeGuide` + `guides: Option<Vec<ThemeGuide>>` em `ThemePage` e `SlideTheme` (`src-tauri/src/state/types.rs`), `skip_serializing_if = "Option::is_none"`.

### Parte E — Painel de propriedades: "Organizar", "Aparência" e seções fechadas

- **Escopo do painel = escopo da caixa**: o painel recebe a seleção e deriva `scope` (item único, grupo ou seleção múltipla). Com grupo/seleção múltipla, os campos representam **a caixa** e editam o conjunto (X/Y move, W/H escala proporcionalmente, Rotação gira); com item único, representam o item. Os números do painel e a sobreposição do canvas sempre batem.
- **Aba "Organizar"** (ícone `Move`/`LayoutGrid`, substitui "Forma"):
  1. `POSIÇÃO, DIMENSÕES & ROTAÇÃO` — X/Y/W/H atuais + **Rotação (°)** (input numérico `-180..180`, passo 1, normaliza o `rotate` em `css`) + escala percentual existente.
  2. `ALINHAR & DISTRIBUIR` — alinhar (esquerda/centro-X/direita/topo/meio/base) e distribuir (horizontal/vertical, só com 3+ selecionados), usando o alvo de alinhamento decidido acima; hoje não existe bloco de distribuir (o `alignToScreen` só alinha à tela).
  3. `ORDEM` — trazer para frente / avançar / recuar / enviar para trás (`moveElement`/`moveGroup` já existem).
  4. `AGRUPAR` — botões Agrupar/Desagrupar (espelho dos atalhos) + renomear grupo quando o grupo está selecionado.
  5. `ELEMENTO` — identificador, visibilidade, trava (move para o fim).
- **Aba "Aparência"** (ícone `Palette`): `TextBoxBackgroundSection` (texto) ou `RectangleSection` (formas) + `AppearanceSection` (opacidade, borda, arredondamento).
- **Abas por tipo:** texto/mídia → `Texto`|`Mídia`, `Organizar`, `Aparência`, `Animação`, `CSS` (5, `grid-cols-5`, rótulo `text-[10px]`); forma → `Organizar`, `Aparência`, `Animação`, `CSS` (4). Sem seleção → `Fundo do Slide`|`Slide & Tela` (inalterado).
- **Todas as seções fechadas por padrão:** `defaultOpen` passa a `false` e o default do componente `Section` vira `false`.

### Parte F — Exportação e projeção (invariantes)

- `rotate`/grupos/guias: nada disso muda o DOM projetado além do `rotate` no próprio elemento (que é o desejado: o que está no editor é o que vai ao ar). A projeção usa `ThemeRenderer`, que já espalha `css` no `style` — rotação sai de graça.
- **O export PNG/JPG NÃO é captura de DOM**: `exportImage.ts` é um renderizador **Canvas 2D** (`ctx.fillRect`/`drawTextElement`/`drawImage`) e hoje ignora `css.rotate` (e também `transform: scale()` e `clipPath` — lacunas preexistentes). Para cumprir a anti-meta, esta entrega **adiciona rotação ao exportador** (aplicar `ctx.rotate` em torno do centro de cada elemento, com o mesmo `rotate` lido do CSS para texto, imagem, vídeo, retângulo e formas); `transform: scale()` e `clipPath` ficam como dívida separada e documentada.
- Guias não são exportadas (não passam pelo exportador, que só recebe o tema).

## Riscos

- **Gestos no canvas já são complexos** (preview coalescido + snap + medição): a caixa de grupo/seleção e a rotação vão conviver com isso; mitigação é manter o gesto atual e parametrizar a "caixa base" (item, grupo ou seleção) em vez de duplicar o motor de arrasto.
- **Rotação + resize**: resize de elemento rotacionado exige projeção do delta no referencial local; se ficar instável, o fallback é desabilitar resize com rotação (só move) — preferível a deformar.
- **Rotação no exportador Canvas 2D**: cada tipo de elemento tem um caminho de desenho; é preciso salvar/rotacionar/restaurar o contexto no ponto certo e conferir texto (alinhamento), imagem (crop/cover) e formas (`fill`/borda). Teste visual manual comparando editor × PNG exportado é obrigatório.
- **`Cmd/Ctrl+D` no canvas** pode conflitar com o navegador (favorito) — precisa de `preventDefault`.
- **`Cmd/Ctrl+A` e o menu nativo**: se o item "Selecionar Tudo" do menu "Editar" (macOS) interceptar o atalho, o handler JS não roda; a mitigação está descrita em "Decisões do autor" e exige teste manual nas duas janelas (editor e principal), incluindo seleção de texto em inputs.
- **5 abas** em painel estreito (mínimo 320px): risco de rótulo cortado; mitigação é rótulo curto + `text-[10px]` + ícones.
- **Régua interna escala com o zoom**: em 25% a faixa fica fina para arrastar; mitigação é aceitar (o usuário controla o zoom) e, se incomodar, mover a régua para fora do stage escalado numa próxima iteração.
- **Round-trip Rust**: esquecer o campo `guides` em `state/types.rs` faz o `save()` perder as guias silenciosamente — tem de entrar no mesmo PR dos tipos TS.

## O que fica para o builder (decisões de implementação)

- Estrutura exata dos overlays no `Canvas` (um componente `SelectionOverlay` reutilizado por item, grupo e seleção múltipla) e nomes das props.
- Fórmulas de `AABB` de retângulo rotacionado e da escala do grupo (fatores por eixo vs uniforme com `Shift`), incluindo `Math.max(MIN_SIZE, …)` por membro e a escala de `fontSize` em texto.
- Ordem exata de prioridade dos alvos de snap (sugestão: 0/tela → margens 5/95% → centro → guias → elementos → grid).
- Passo/render das alças de rotação (tamanho ~18-24 px lógicos, posição acima do topo-centro com margem de ~24 px).
- Se a alça de rotação aparece também para grupos com 1 membro, e o que fazer com grupos órfãos (1 membro) ao desagrupar/apagar.
- Layout interno da aba "Organizar" (grid vs flex-wrap) e textos exatos dos botões/`title`.
- Como o `PropertiesPanel` deriva `scope` e repassa patches em lote (usar `updateElements`) sem reescrever cada seção.
- Teste manual de `Cmd+A` com o menu nativo do macOS ativo; fallback de remoção do `.select_all()` em `lib.rs` e reverificação de inputs nas duas janelas.
- Testes puros (`node --test`) para: AABB de retângulo rotacionado, escala de grupo (fatores por eixo e uniforme), rotação de ponto em torno do centro, normalização de `rotate`, criação/remoção de guias na lista, prioridade de snap com guias. Componentes/gestos ficam sem teste automatizado (padrão do repo).
- Atualizar `docs/` (site Fumadocs: atalhos de teclado e página do Studio, se existir seção) conforme AGENTS.md.
