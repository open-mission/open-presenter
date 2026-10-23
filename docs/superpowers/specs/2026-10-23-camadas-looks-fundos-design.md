# Design — Camadas mestras, Looks por saída e fundos ao vivo

> **Data:** 2026-10-23 · **Branch:** `feature/camadas-looks` · **Stack:** Tauri v2 (Rust), React 19 + TS, Zustand, Tailwind v4, `node --test`.
> **Status:** proposta para revisão.
> **Relacionado:** `docs/superpowers/specs/2026-10-20-propresenter-theme-editor-design.md` (fundação gráfica e primeiro recorte de `OutputLook`). Este documento substitui a seção `OutputLook` daquele design e antecipa a parte de camadas/Looks da Fase 3.

## Intent e porquê

Hoje o editor de temas trata “camadas” como uma pilha plana de elementos (texto, imagem, vídeo, formas) com grupos puramente visuais. Isso não permite dizer **o que uma saída deve mostrar**: se o operador desliga mensagens em um monitor de palco, o alerta continua sendo renderizado; se quer trocar só o fundo de uma tela, o tema inteiro é afetado; e o tema padrão configurado na tela perde para bindings globais do ThemeRail, sem o operador saber.

O objetivo é alinhar o produto ao modelo do ProPresenter:

- as camadas viram **grupos mestres fixos** dentro do tema (Máscara, Mensagens, Props, Anúncios, Slide, Mídia, Entrada de Vídeo, Cor da Tela);
- cada saída ganha um **Look**: quais camadas aparecem, qual fundo usar e qual tema vale;
- o operador pode **arrastar um fundo para uma saída específica** sem tocar no texto nem nas outras saídas;
- existe uma **única régua de tema**: global da saída, tema do evento e ação ao vivo, nessa ordem de precedência (ao vivo > evento > global);
- o ThemeRail deixa de existir.

O ProPresenter 21.4 foi usado como referência via REA (strings localizadas do bundle). O Look real dele tem toggles de **Props, Messages, Announcements, Slide, Media, Video Input e Mask**, escolha de máscara, tema alternativo (“Presentation”) e duração de transição. **Screen Color não fica no Look**: é propriedade da tela. A Media Bin tem coluna **Camada** e distingue **Background / Foreground / Video Input**. Isso confirma a separação: Look não guarda elementos; ele filtra camadas.

## Metas

1. Definir as 8 camadas mestras fixas e a ordem de composição da saída.
2. Fazer todo elemento do tema pertencer a uma camada, com classificação automática por tipo e possibilidade de mover.
3. Mostrar as camadas mestras no editor de temas (árvore), mantendo grupos visuais dentro de cada camada.
4. Criar um `OutputLook` por saída com toggles de camada, tema padrão e fundo.
5. Unificar a resolução de tema: **override ao vivo > tema do evento > tema padrão da saída > fallback do sistema**.
6. Fazer a saída pública, o Lower Third e o Stage respeitarem os toggles que fizerem sentido em cada renderer.
7. Permitir trocar o fundo de **uma saída** sem alterar texto, tema ou as demais saídas.
8. Remover o ThemeRail e os bindings globais; toda escolha de tema passa a ter um dono explícito.
9. Publicar um **plano por saída** (tema + look + fundo) em vez de um tema por target.
10. Entregar a base para o novo painel de fundos/elementos (Fase 2), com arraste e validação de compatibilidade.

## Não-metas

- Não construir o painel completo de fundos/elementos nesta fase (Fase 2).
- Não implementar renderização real de **Props, Anúncios, Entrada de Vídeo e Máscara** nesta fase. Eles existem no modelo e no Look, mas ficam “em breve” até suas features existirem.
- Não criar presets reutilizáveis de Look (Live + Presets do ProPresenter) nesta fase.
- Não transformar o Stage em um renderer de tema em camadas nesta fase; o Stage continua com layout próprio.
- Não mexer no modelo visual de edição (posição, CSS, rotação, grupos, snapping, exportação de imagem).
- Não importar temas do ProPresenter.
- Não adicionar dependências novas.

## Anti-metas

- Um texto continuar aparecendo em uma saída de público/Lower Third com a camada Slide desligada (no Stage, o filtro por camada só vale na Fase 3).
- Um alerta continuar aparecendo em uma saída com Messages desligada.
- Trocar o fundo de uma saída e mudar o fundo das outras.
- Um fundo comum ser aceito em uma saída Lower Third.
- Perder temas, páginas, elementos ou o tema padrão de saídas existentes na migração.
- O tema do evento voltar a perder silenciosamente para um binding antigo.
- O editor mostrar uma camada mestra e a saída renderizar outra coisa.
- O Look virar uma segunda cópia da configuração da tela (dois donos para cor de tela, por exemplo).

## Estado atual verificado

- **Editor:** `src/features/theme-editor/LayersPanel.tsx` lista elementos planos e grupos (`groupId`/`groupName`). “Camada” ali é sinônimo de elemento ou grupo visual, não de camada de saída.
- **Tipos:** `ThemeElement` (`src/core/types/index.ts` e `src-tauri/src/state/types.rs`) não tem campo de camada. `ThemePage` guarda `css` e `elements` por contexto.
- **Temas:** `SlideTheme.category` é `"theme" | "stage" | "stream" | "presentation" | string`. O ThemeRail separa em Projeção/Palco/OBS; o seletor da tela filtra por categoria (`DisplaysTabsPanel.tsx`, `matchingThemes`/`otherThemes`). É o mesmo cadastro com duas réguas.
- **Precedência atual (inconsistente):**
  - `PublicView`: `customTheme ?? broadcastTheme ?? defaultTheme ?? localTheme`.
  - `StreamView`: `streamCustomTheme ?? defaultTheme ?? broadcastTheme ?? localTheme`.
  - `StageView`: `broadcastStageTheme ?? localStageTheme`.
  - O `broadcastTheme` vem de `useLiveThemesStore`, alimentado por `set_live_themes` no Rust a partir dos bindings do ThemeRail (`useThemeSync.ts`).
- **Estado ao vivo:** `LiveThemes` no Rust tem **um tema por target** (`public`, `stage`, `stream`). Isso não comporta temas padrão diferentes por saída.
- **Tela:** `DisplayOutput` já tem `backgroundColor`, `backgroundColorEnabled` e `defaultThemeGuid`. A cor da tela já é propriedade da saída.
- **Fundo:** `theme.css.background` é o fundo do tema/slide; `live.background` é o fundo do slide ao vivo. `PersistentBackground`/`BackgroundRenderer` desenham esse fundo. Não existe camada de mídia separada.
- **Mensagens:** os avisos são `CommunicationAlert`, renderizados em `StageAlertBanner`/`StageAlertOverlay` no `PublicView`, `StreamView` e `StageView`.
- **Stage:** `StageView` é um layout próprio (relógio, próximo slide, painéis), não o compositor de tema do público.
- **ThemeRail:** `src/features/slide-themes/ThemeRail.tsx` aplica bindings globais por target/asset e publica via `useLiveThemesPublisher`. Será removido.
- **Rotas:** `syncNativeWindow` abre as saídas padrão em `/#/public`, `/#/stage`, `/#/stream` **sem** `?id=`; `PublicView`, `StreamView` e `StageView` já caem na primeira saída habilitada da categoria quando não há `id`.
- **Bootstrap web:** o snapshot inicial do `/ws` (`handle_socket` em `server/http.rs`) envia slide, `EVENT_THEMES`, timer, wallpaper e mensagem de palco — **não** envia planos nem `DisplayOutput`. No navegador, `invoke` não existe, então uma Browser Source aberta com o admin fechado recebe o último `LiveThemes`, mas não a configuração da saída (cor da tela, look).
- **ProPresenter (REA):** `AUDIENCE_LOOKS_*` confirma `Props`, `Messages`, `Announcements`, `Slide`, `Media`, `Video Input`, `Mask`, `Presentation` (tema alternativo) e duração de transição. `SCREEN_CONFIGURATION_SCREEN_COLOR_label` confirma que a cor da tela fica na configuração da tela. `MEDIA_BIN_TABLE_VIEW_COLUMN_LAYER_title` e `MEDIA_TRIGGER_LAYER_BACKGROUND/FOREGROUND/VIDEO_INPUT` confirmam a camada nos itens de mídia.

## Decisões do usuário (como saíram da conversa)

1. As camadas são **grupos mestres fixos** dentro do tema; todo texto nasce na camada Slide.
2. O Look é **por saída** e liga/desliga camadas no render; o tema pode estar preparado para tudo.
3. Se Messages está desligada naquela saída, o alerta ativo não aparece nela.
4. O fundo é **por saída ativa**: arrastar um fundo para um preview muda só aquela saída.
5. Arrastar um fundo sobre a letra mantém o texto e troca o fundo.
6. Fundo comum não entra em saída Lower Third; só fundo/template compatível. Sem match, erro.
7. O ThemeRail será **removido**.
8. As três fontes de tema/fundo são: **global da saída**, **evento/setlist** e **painel de fundos/elementos**.
9. Precedência: **ação ao vivo > evento > global**.
10. Abordagem escolhida: **Caminho 1** — camadas no tema + Look na saída, com o painel de fundos na fase seguinte.

## Abordagens consideradas

### Caminho 1 — Camada como tag + Look na saída (escolhido)

`ThemeElement.layer` + `OutputLook` por saída + um resolvedor único de plano. O Look guarda os toggles e o fundo; o tema continua sendo a fonte dos elementos. O painel de fundos entra depois, escrevendo no mesmo plano.

**Por que foi escolhido:** entrega o comportamento central (camadas, Looks, precedência, remoção do ThemeRail) sem refatorar o modelo gráfico inteiro; cria a costura para o painel; preserva temas v1/v2.

**Trade-off:** Props, Anúncios, Vídeo e Máscara ficam no modelo, mas sem renderer até as fases seguintes. O Stage só respeita Messages/Announcements nesta fase.

### Caminho 2 — O mesmo modelo com o painel de fundos já nesta entrega

Inclui a media bin/aba de fundos, o arraste para os previews e a validação de compatibilidade desde o início.

**Trade-off:** mais visível, mas junta duas frentes grandes (camadas/Looks e biblioteca de mídia) e aumenta o risco de a entrega central atrasar.

### Caminho 3 — Look completo de primeira classe, como o ProPresenter

Look com Live + Presets, máscara, tema alternativo, transição própria e fontes independentes por camada.

**Trade-off:** é o mais fiel e o mais caro; mexe em estado Rust, sync, todos os renderers e migração. Só compensa se presets de Look forem requisito agora.

## Modelo

### As 8 camadas mestras

Ordem de exibição no editor e no Look (topo → base). A composição renderiza de baixo para cima.

| Ordem | id | Rótulo | O que contém nesta fase | Renderer |
|---|---|---|---|---|
| 1 (topo) | `mask` | Máscara | máscara aplicada à saída | futuro |
| 2 | `messages` | Mensagens | avisos/comunicação (`CommunicationAlert`) | Fase 1 |
| 3 | `props` | Props | bug/logo/overlay de props | futuro |
| 4 | `announcements` | Anúncios | apresentação secundária/anúncio | futuro |
| 5 | `slide` | Slide | fundo do slide + elementos de texto/formas | Fase 1 |
| 6 | `media` | Mídia | mídia da media bin/ações de mídia (Fase 2); elementos de tema ficam em Slide | Fase 2 |
| 7 | `videoInput` | Entrada de Vídeo | vídeo ao vivo/NDI | futuro |
| 8 (base) | `screenColor` | Cor da Tela | cor de fundo da saída | Fase 1 (já existe) |

**Decisão do autor:** o fundo arrastado para uma saída é um **override do fundo do Slide** (sub-camada “Slide Background”), não um item da camada Mídia. Motivo: os temas atuais quase sempre têm fundo opaco (`theme.css.background`); se o fundo arrastado ficasse na camada Mídia (abaixo do Slide), ele ficaria escondido. A camada Mídia fica reservada para ações de mídia da Fase 2 (foreground/background/video input).

**Decisão do autor:** `screenColor` não vira um segundo estado no `OutputLook`. O toggle do Look lê/escreve o `backgroundColorEnabled` existente da saída. A camada aparece na lista, mas a fonte da verdade continua sendo `DisplayOutput`.

### Elemento → camada

Novo campo opcional em `ThemeElement`:

```ts
type MasterLayerId =
  | "mask"
  | "messages"
  | "props"
  | "announcements"
  | "slide"
  | "media"
  | "videoInput"
  | "screenColor";

interface ThemeElement {
  // ...campos atuais
  layer?: MasterLayerId;
}
```

Classificação padrão ao criar:

| Tipo | Camada padrão |
|---|---|
| `TEXT` | `slide` |
| `RECTANGLE`, `CIRCLE`, `TRIANGLE`, `STAR` | `slide` |
| `IMAGE`, `VIDEO` | `slide` |
| ausente (tema antigo) | `slide` |

**Decisão do autor:** **todo elemento do tema nasce em `slide`**, inclusive imagens e vídeos. Motivo: a camada `media` fica **abaixo** do fundo do Slide; se uma imagem/vídeo do tema fosse para `media`, ela ficaria escondida atrás de um fundo opaco. A camada `media` é reservada para a media bin/ações de mídia da Fase 2 e não recebe elementos do editor nesta fase. O operador pode mover elementos para `props` (bug/logo) ou `announcements` (conteúdo secundário), que ainda não têm renderer nesta fase.

**Decisão do autor:** `mask`, `messages`, `videoInput` e `screenColor` são camadas de sistema; o editor não cria elementos nelas. `props` e `announcements` aceitam elementos movidos manualmente, mas **não têm renderer nesta fase**: os elementos ficam guardados e editáveis no tema, porém não aparecem na saída até a Fase 3. A UI do Look mostra o toggle com “sem renderer nesta fase”.

Grupos visuais (`groupId`/`groupName`) continuam existindo **dentro** de uma camada. A árvore do editor passa a ser: camada mestra → grupos → elementos. Elementos de um grupo não podem pertencer a camadas diferentes; mover um grupo move todos os membros.

### OutputLook

```ts
interface OutputLook {
  mask: boolean;
  messages: boolean;
  props: boolean;
  announcements: boolean;
  slide: boolean;
  media: boolean;
  videoInput: boolean;
  screenColor: boolean;
}
```

O Look é persistido em `DisplayOutput.look` (configuração da saída). A cor da tela continua em `backgroundColorEnabled`; o toggle `screenColor` é uma fachada para ela. No plano, `look.screenColor` é sempre igual a `screenColor.enabled`; a UI edita um e o resolvedor mantém o outro em sincronia.

**Default por categoria** (proposto; pode ser ajustado no builder):

| Camada | Público | Stage | Lower Third |
|---|---|---|---|
| `mask` | false | false | false |
| `messages` | true | true | true |
| `props` | true | true | false |
| `announcements` | true | true | false |
| `slide` | true | true | true |
| `media` | true | false | true |
| `videoInput` | true | false | false |
| `screenColor` | conforme `backgroundColorEnabled` | conforme | conforme |

**Decisão do autor:** o default preserva o comportamento atual: tudo o que já renderiza continua renderizando. `props`/`announcements`/`videoInput` não têm efeito visível até suas features existirem. `media` só passa a filtrar a media bin na Fase 2; elementos do tema são filtrados por `slide`. No Stage, nesta fase, só `messages` tem efeito; os demais valores ficam salvos para a Fase 3.

### Compatibilidade de tema

`themeSupportsCategory(theme, category)`:

| Saída | Aceita |
|---|---|
| Público | `theme` e `presentation` (páginas de música/bíblia/texto, ou deck de apresentação) |
| Stage | `stage` |
| Lower Third | `stream` (inclui `DEFAULT_STREAM_THEME`) |

O seletor da saída lista **todos** os temas, agrupados em “Recomendados” e “Outros”. Os de “Outros” aparecem **desabilitados** com o motivo (“Não compatível com esta saída”) e um atalho “Editar tema”; nada é escondido. Tema de evento e tema padrão só aceitam temas compatíveis. Se um dado antigo apontar para tema incompatível, o resolvedor ignora e cai no próximo da lista, com aviso na UI.

**Exceção — tema do conteúdo:** `media.themeId` pode ser um `presentation` (deck) e é renderizado como conteúdo, não como tema de saída. Para Lower Third, mantém-se a regra atual: só tema `stream`/default stream. Um tema de conteúdo incompatível é ignorado, nunca renderiza em branco.

### Override ao vivo

```ts
interface LiveOutputOverride {
  themeGuid?: string | null;
  background?: BackgroundLayer | null;
  updatedAt: string;
}
```

O override é **efêmero** (sessão), não persistido no SQLite. Ele vive no store do admin e viaja dentro do `OutputPlan` publicado; o Rust guarda o último plano, não um mapa separado de overrides. Ele é criado pela ação do painel/arraste e limpo por “Limpar fundo”/“Limpar tema” ou ao reiniciar o app. Motivo: é uma ação ao vivo; se persistisse, uma ação antiga continuaria vencendo o evento depois de trocar de evento.

**Decisão do autor:** o override de fundo é aplicado no render como fundo do Slide (substitui `theme.css.background` e o `live.background` daquele slide), mantendo os elementos de texto intactos. O override de tema troca o tema resolvido para aquela saída, mas **não** troca o tema de uma apresentação que já tem `media.themeId` próprio (o tema do conteúdo continua sendo do conteúdo).

**Reidratação (decisão do autor):** ao montar, o admin lê `get_live_output_plans()` e reconstitui seus overrides a partir do último plano (`backgroundOverride` e, quando `themeSource === "override"`, `theme.guid`). Assim um reload da janela do admin não perde a ação ao vivo; reiniciar o app perde, como planejado.

### Precedência de tema

Ordem final, por saída. Todos os passos são resolvidos pelo admin; o renderer aplica `contentTheme ?? theme`:

1. **Tema do conteúdo** (`live.content.media.themeId`, quando a apresentação/mídia tem tema próprio) — é parte do conteúdo, não uma escolha de tela; viaja em `OutputPlan.contentTheme` e é o primeiro na escolha do renderer. Republica quando o tema do conteúdo muda, não a cada slide.
2. **Override ao vivo** daquela saída (painel/arraste).
3. **Tema do evento** (`eventThemeGuid`), para saídas públicas; para Lower Third, somente tema compatível (`stream`); **Stage não usa tema de evento**.
4. **Tema padrão da saída** (`defaultThemeGuid`).
5. **Fallback do sistema** (tema padrão público/stage/stream).

O Stage tem um caso a mais: quando ocioso, usa o **tema de descanso**. O `idleThemeGuid` explícito vence a página `rest` do tema ativo; se não houver `idleThemeGuid`, usa a página `rest`; se o tema não tiver página `rest`, usa `DEFAULT_STAGE_REST_THEME`. Quando há conteúdo, usa o tema do conteúdo (se houver) ou o tema padrão da saída; evento não se aplica ao Stage.

### Precedência de fundo

1. **Fundo do tema do conteúdo** (`media.themeId` com `css.background` próprio) — parte do conteúdo.
2. **Override ao vivo** da saída (fundo arrastado).
3. **Fundo do slide ao vivo** (`live.background`), quando for customizado e não for o preto padrão.
4. **Fundo do tema resolvido** (evento > padrão da saída > fallback).
5. **Cor da tela** (`backgroundColorEnabled`/`backgroundColor`).

O fundo do tema é o `theme.css.background` da página materializada. O override ao vivo é um `BackgroundLayer` (cor, imagem, vídeo, CSS, ISF) e usa o mesmo `BackgroundRenderer`/`PersistentBackground`.

### Plano por saída (mudança de arquitetura)

O `LiveThemes` atual (um tema por target) não suporta temas padrão diferentes por saída. Introduzimos um plano por saída, **resolvido no admin** e apenas armazenado/publicado pelo Rust:

```ts
type PlanThemeSource = "override" | "event" | "default" | "fallback";

interface OutputPlan {
  outputId: string;
  category: "public" | "stage" | "lower";
  theme: SlideTheme | null; // documento; o renderer materializa a página do contexto
  themeSource: PlanThemeSource; // como `theme` foi escolhido
  contentTheme: SlideTheme | null; // tema do conteúdo (media.themeId), já resolvido para esta saída
  restTheme: SlideTheme | null; // stage ocioso
  look: OutputLook;
  backgroundOverride: BackgroundLayer | null;
  screenColor: { enabled: boolean; value: string };
  updatedAt: string;
}

interface LiveOutputPlans {
  plans: Record<string, OutputPlan>;
}
```

**Quem resolve o quê (decisão do autor):**

- O **admin** é o único resolvedor. Ele calcula `theme` (override > evento > padrão > fallback), `contentTheme` (quando `live.content.media.themeId` existe e é compatível), `restTheme`, `look`, `backgroundOverride` e `screenColor` para cada saída e publica via `set_live_output_plans`.
- O **Rust nunca resolve tema**: só guarda os planos, guarda o override dentro do próprio plano e faz broadcast.
- Republicação acontece quando: tema salvo/excluído, saída criada/editada (look, tema padrão, idle, cor), tema do evento alterado, override criado/limpo, **tema do conteúdo alterado** (`media.themeId`/tipo), admin monta. **Não** republica a cada slide.
- O plano carrega o **documento** do tema (de saída e de conteúdo), não só o GUID, para que saídas web/OBS consigam renderizar sem acesso ao SQLite.

**Identidade da saída (decisão do autor):**

- Janelas nativas e URLs geradas passam a incluir `?id=<outputId>` (`/#/public?id=...`, `/#/stage?id=...`, `/#/stream?id=...`).
- Rotas antigas sem `id` continuam funcionando: resolvem para a **primeira saída habilitada da categoria** (ordem do cadastro); se não houver, usam um plano de sistema com os defaults da categoria. `/#/output/:slug` resolve slug → id pelo snapshot de saídas.
- O plano é lido por `outputId`; sem plano publicado, a view cai no `defaultThemeGuid` local + defaults (modo degradado).

**Bootstrap de saídas web (decisão do autor):**

- O snapshot inicial do WebSocket (`/ws`) passa a incluir `EVENT_OUTPUT_PLANS` e `EVENT_OUTPUTS` (snapshot de `OutputsState`), além de slide/timer/wallpaper/mensagem. Hoje ele envia o último `EVENT_THEMES`, mas não planos nem saídas; a cor da tela e o Look não chegam ao navegador.
- `OutputPlan.screenColor` carrega a cor da tela porque `DisplayOutput` não é acessível no navegador; o restante da configuração da saída continua em `DisplayOutput`.
- `get_live_output_plans()` atende janelas Tauri; o WebSocket atende navegador/OBS.
- `LiveThemes` continua existindo como **fallback temporário** até todas as views migrarem; depois é removido.
- Saídas web/nativas recebem o mesmo plano; não dependem de localStorage.

**Decisão do autor:** o admin é a única fonte que resolve planos. Se não houver admin aberto, a saída usa o último plano recebido; se nunca recebeu, cai no `defaultThemeGuid` + tema padrão local. Isso evita que cada janela resolva diferente.

### Composição do render

Pilha do público (base → topo):

```text
screenColor
  → videoInput (futuro)
  → media (media bin/ações de mídia, Fase 2)
  → slide (fundo + elementos filtrados por layer)
  → announcements (futuro)
  → props (futuro)
  → messages (avisos)
  → mask (futuro)
  → blackout (controle global, fora do Look)
```

- O `blackout` e o `cleared` continuam sendo controles globais, não camadas do Look.
- `slide` desligado esconde o fundo e os elementos do tema; a cor da tela/wallpaper continua.
- `messages` desligado impede o render de `StageAlertBanner`/`StageAlertOverlay` naquela saída.
- `media` desligado esconde mídia da Fase 2; o fundo do Slide (tema/override) não é “media” para esse toggle.
- O `Lower Third` usa a mesma pilha, mas com `screenColor` transparente por padrão.
- O filtro por `layer` vale para **público e Lower Third**. O Stage continua renderizando o tema inteiro nesta fase (ver seção Stage).

Regra do filtro (Fase 1): um elemento aparece se `element.layer ?? "slide"` estiver ligado **e** a camada tiver renderer. Renderers nesta fase: `slide` (todos os elementos do tema) e `messages` (alertas de comunicação). `media`, `props`, `announcements`, `videoInput` e `mask` não renderizam elementos nesta fase.

### Editor de temas

`LayersPanel` passa a renderizar as 8 camadas mestras na ordem da tabela, com:

- contador de elementos por camada;
- expandir/recolher;
- olho de **visibilidade de edição** (liga/desliga todos os elementos daquela camada no draft, como o olho de grupo faz hoje) — **não** é o toggle do Look;
- cadeado;
- grupos existentes dentro da camada;
- ação “Mover para camada…” no menu de contexto de elemento/grupo, com `slide`/`props`/`announcements` habilitados e `media`/`videoInput`/`mask`/`messages`/`screenColor` desabilitados (“camada de sistema” / “Fase 2”);
- camadas de sistema (`mask`, `messages`, `media`, `videoInput`, `screenColor`) vazias, com texto explicativo e sem “adicionar elemento” (`media`: “mídia da Fase 2”).

As 8 camadas aparecem sempre, em todas as páginas; dentro de cada uma, os elementos da **página ativa** (os elementos continuam vivendo em `ThemePage`). Uma camada vazia na página ativa aparece vazia, mesmo que tenha elementos em outra página.

**Decisão do autor:** a visibilidade de edição e o toggle do Look são coisas diferentes e precisam de rótulos diferentes. O olho do editor controla o draft; o Look controla a saída. Para evitar confusão, o header da camada mostra “Edição” no tooltip e o Look mostra “Saída”.

**Decisão do autor:** a ordem de camadas é fixa; mover um elemento para cima/baixo só reordena dentro da camada. Não é possível “subir” um elemento de Slide para Messages por z-order; isso é feito por “Mover para camada”. Ao mover para `props`/`announcements`, o editor avisa que a camada ainda não aparece na saída (Fase 3).

### Configuração da saída (UI)

Na aba `template` (ou nova aba `Look`) de `DisplaysTabsPanel`:

- seletor de tema padrão com **todos** os temas, agrupados em “Recomendados” e “Outros”; os incompatíveis aparecem desabilitados com o motivo e atalho para editar o tema;
- botão “Editar tema”;
- toggles das 8 camadas, com defaults por categoria; camadas sem renderer naquela saída aparecem como “não se aplica nesta fase”;
- seletor de fundo/“Limpar fundo” (Fase 1: cor, wallpaper ou imagem para público/stage; só cor/transparente para Lower Third; Fase 2: arraste e ativos marcados `lower`);
- para Stage, um seletor de **tema de descanso** (`idleThemeGuid`), que vence a página `rest`;
- aviso de que o tema do evento e a ação ao vivo podem sobrepor o padrão.

**Decisão do autor:** o seletor de tema deixa de filtrar por categoria. Ele mostra todos e marca compatibilidade. Isso corrige diretamente o caso “o monitor não mostra os meus temas”. Tema incompatível aparece, mas não é selecionável, para evitar saída em branco; o usuário pode abrir o editor e ajustar a categoria do tema.

### Remoção do ThemeRail

- Remover `src/features/slide-themes/ThemeRail.tsx`, o uso em `AdminView`, a chave `open_presenter_theme_rail_open`, os tipos `ThemeBinding` e o estado `bindings`.
- Remover `bindings`/`setBinding`/`clearBinding` do `useSlideThemesStore` e a lógica de bindings em `themeResolution.ts`.
- `useLiveThemesPublisher` deixa de publicar temas por target; o admin publica `LiveOutputPlans`.
- A escolha de tema ao vivo passa a ser: seletor na saída (padrão) + evento + painel (Fase 2).
- Migração: para cada saída sem `defaultThemeGuid`, usar o binding antigo do seu target/asset principal (lyric para público, stage para stage, stream para lower); para Stage, migrar `stageThemeGuid` → `defaultThemeGuid` e `stageRestThemeGuid` → `idleThemeGuid`.

### Fundo ao vivo e arraste (Fase 1 + Fase 2)

**Fase 1:** o Look da saída tem um seletor de fundo que grava um `LiveOutputOverride.background` no plano. Para público/stage, oferece cor, wallpaper e imagem da biblioteca; para Lower Third, **somente cor/transparente** — imagens e wallpapers comuns não aparecem e, se chegarem por dado antigo, são rejeitados por `isBackgroundCompatible`. O render daquela saída aplica o override no fundo do Slide. “Limpar fundo” remove o override.

**Fase 2:** o painel de fundos/elementos permite arrastar:

- **fundo sobre o preview da letra** → override de fundo da saída ativa;
- **fundo sobre o preview de outra saída** → override só daquela saída;
- **tema sobre um preview** → override de tema daquela saída;
- **fundo comum em saída Lower Third** → rejeitado com erro;
- **fundo/template de Lower Third em saída Lower Third** → aceito;
- **qualquer item em saída incompatível** → erro com motivo.

Validação de compatibilidade:

```ts
interface BackgroundAsset {
  id: string;
  name: string;
  kind: "color" | "image" | "video" | "shader";
  source: string;
  category: "public" | "lower" | "stage" | "any";
  tags?: string[];
}
```

Regra: `asset.category === "any"` aceita qualquer saída; `lower` só em Lower Third; `public`/`stage` só na categoria correspondente. Ativo sem categoria é tratado como `public` (nunca `any`). Temas seguem `themeSupportsCategory`. O drop inválido não altera nada e mostra o motivo. O modelo `BackgroundAsset` completo entra na Fase 2; a Fase 1 usa `BackgroundLayer` + a regra por categoria da saída.

### Novo painel de fundos/elementos (Fase 2)

O painel substitui o ThemeRail e é a terceira fonte de tema/fundo. Estrutura inspirada no que o REA confirmou no ProPresenter:

- seção **Ao vivo** (o que está aplicado agora) e **Biblioteca** (temas + fundos);
- abas/filtros: Temas, Fundos, Lower Thirds, Vídeos, Shaders;
- preview em grade/lista, com indicação de compatibilidade por categoria;
- arraste para os previews de saída (cards do `LivePreview`/`Displays`);
- ações de contexto: aplicar, limpar, editar tema;
- sem presets de Look nesta fase.

O painel reutiliza a biblioteca de imagens existente (`features/image-browser`) e o serviço Rust de media library; temas continuam vindo do SQLite. O design detalhado do painel fica para a Fase 2, mas a base de dados e o resolvedor de planos já ficam prontos na Fase 1.

### Stage

O `StageView` continua com layout próprio e **não entra no filtro de camadas nesta fase** (decisão do usuário). Nesta fase:

- `messages` liga/desliga os avisos de comunicação (`StageAlerts`/`StageAlert*`);
- `slide`, `media`, `props`, `announcements`, `videoInput` e `mask` aparecem como “não se aplica nesta fase” e ficam desabilitados;
- `ScaledStage` continua renderizando o tema inteiro (todos os elementos e páginas), como hoje;
- o Stage não usa tema de evento; usa conteúdo > `defaultThemeGuid` > fallback; ocioso usa `idleThemeGuid` > página `rest` > `DEFAULT_STAGE_REST_THEME`.

**Consequência conhecida:** um elemento movido para `props`/`announcements`/`media` pode sumir no público (conforme o Look) e continuar aparecendo no Stage. Isso é aceito nesta fase e documentado nos riscos; o Stage em camadas fica para a Fase 3.

O Look do Stage mostra os toggles com estado “não se aplica” para as camadas que o renderer não suporta. Não fingir que aplica.

### Migração e compatibilidade

- `ThemeElement.layer` ausente → `slide` (temas v1/v2 continuam abrindo).
- `DisplayOutput.look` ausente → default da categoria.
- `DisplayOutput.idleThemeGuid` ausente → `stageRestThemeGuid` para Stage.
- Bindings antigos: migrar para `defaultThemeGuid`/`idleThemeGuid` conforme acima; ignorar as chaves de localStorage depois.
- URLs antigas sem `?id=` continuam válidas: resolvem para a primeira saída habilitada da categoria; `/#/output/:slug` continua resolvendo por slug.
- `OutputPlan.screenColor` é derivado de `DisplayOutput` no admin e viaja no plano; não é gravado no SQLite.
- `LiveThemes` antigo: manter como fallback de leitura até todas as views usarem `LiveOutputPlans`; a view usa `plan` se existir, senão `LiveThemes` do target. Remover no fim da fase.
- Nada de `deny_unknown_fields` nos structs Rust; campos novos são opcionais e serializados com `skip_serializing_if`.
- Temas existentes não são reescritos em massa; a normalização acontece na leitura e na primeira edição.

### IPC e estado Rust

Novos comandos:

- `set_live_output_plans(plans)` — o admin publica os planos resolvidos; o Rust guarda e faz broadcast. É o único comando de escrita de plano.
- `get_live_output_plans()` — leitura inicial para janelas Tauri e reidratação do admin.

O Rust **não** expõe `set_output_override`/`clear_output_override`: o override é um campo do plano (`backgroundOverride`, `themeSource`) calculado no admin. “Limpar” = publicar o mesmo plano sem o override.

Alterações de estado:

- `PresentationState` ganha `output_plans: LiveOutputPlans`.
- `broadcaster` publica `EVENT_OUTPUT_PLANS` (novo) e mantém `EVENT_THEMES` como fallback temporário.
- O snapshot inicial do `/ws` inclui `EVENT_OUTPUT_PLANS` e `EVENT_OUTPUTS`.
- `DisplayOutput` ganha `look: Option<OutputLook>` e `idle_theme_guid: Option<String>`.
- `ThemeElement` ganha `layer: Option<String>`.
- `LiveThemes` e `set_live_themes` continuam por uma versão, marcados como obsoletos.

Os wrappers tipados ficam em `src/core/ipc/commands.ts`; os tipos TS e Rust são espelhados em `src/core/types/index.ts` e `src-tauri/src/state/types.rs`.

## Fases

### Fase 1 — Fundação (esta entrega)

1. Tipos `MasterLayerId`, `OutputLook`, `LiveOutputOverride` (TS), `OutputPlan`/`LiveOutputPlans` (TS + Rust).
2. Campo `layer` em `ThemeElement` + normalização `slide` para temas antigos.
3. Classificação automática ao adicionar elemento e ação “Mover para camada”.
4. `LayersPanel` com as 8 camadas mestras e grupos dentro delas.
5. `OutputLook` por saída, defaults por categoria e UI de toggles.
6. Resolvedor único de tema/fundo por saída; remoção do ThemeRail e bindings.
7. `LiveOutputPlans` no Rust + broadcast por saída; `PublicView`/`StreamView`/`StageView` consomem o plano; snapshot inicial do `/ws` com planos + saídas.
8. Rotas com `?id=` + fallback “primeira saída habilitada da categoria”.
9. Fundo ao vivo por saída via seletor (sem arraste ainda) + “Limpar fundo”; Lower Third só cor/transparente.
10. Migração de bindings/temas de Stage.
11. Testes unitários de classificação, defaults, precedência, compatibilidade e bootstrap.

### Fase 2 — Painel de fundos/elementos + arraste

1. Biblioteca de fundos (imagens/vídeos/shaders) e temas no novo painel.
2. Cards de preview como drop targets.
3. Validação de compatibilidade (incluindo Lower Third).
4. Ações de contexto (aplicar/limpar/editar).
5. Substituição completa do ThemeRail.

### Fase 3 — Camadas que faltam

1. Props (bug/logo) e Anúncios (apresentação secundária).
2. Entrada de Vídeo (NDI/DeckLink) e Máscara.
3. Estágio em camadas, se fizer sentido.

## Testes e verificação

- `node --test` para funções puras (sem jsdom/React testing library; o repo não tem runner de `.tsx` e não vamos adicionar dependência):
  - classificação de elemento → camada;
  - `elementVisibleForLook(element, look)`: Slide off esconde texto/fundo/imagem; Media off esconde item da media bin (Fase 2);
  - defaults de `OutputLook` por categoria;
  - precedência de tema (conteúdo > ao vivo > evento > padrão > fallback);
  - precedência de fundo (conteúdo > ao vivo > slide > tema > cor da tela);
  - `themeSupportsCategory` e `isBackgroundCompatible`;
  - resolução de identidade da saída: `?id=` > primeira habilitada da categoria > fallback;
  - migração de `ThemeElement` sem layer, `DisplayOutput` sem look e plano sem `screenColor`.
- Rust:
  - round-trip de `ThemeElement.layer`, `OutputLook`, `OutputPlan`;
  - serde de campos ausentes;
  - `set_live_output_plans` reflete no estado e no broadcast; `get_live_output_plans` devolve o último plano.
- Verificação manual (DOM):
  - Slide desligado esconde texto, imagens e fundo do tema no público; Media desligado esconde mídia da media bin (Fase 2);
  - Messages desligado esconde o alerta só naquela saída;
  - Screen Color desligado fica transparente no Lower Third e preto no público;
  - criar uma saída pública e uma de palco; alternar Messages no palco e ver o alerta sumir só lá;
  - definir temas padrão diferentes para duas saídas públicas e conferir que cada uma abre com o seu;
  - definir tema de evento e ver o evento vencer o padrão;
  - selecionar fundo em uma saída e ver só ela mudar, com o texto intacto;
  - abrir um Lower Third e conferir que o seletor não oferece imagem comum;
  - abrir uma Browser Source sem admin e conferir que o plano inicial chega pelo `/ws`;
  - reiniciar o app e conferir que o override ao vivo sumiu, mas o tema padrão/look persistiu.
- `npm run typecheck` e `cargo check -p open-presenter`.

## Critérios de sucesso

1. O editor mostra as 8 camadas mestras e todo elemento tem uma camada.
2. O Look de cada saída liga/desliga camadas de verdade no render (público e Lower Third; Stage só Messages).
3. Messages desligado em uma saída esconde o alerta só nela.
4. Duas saídas públicas podem ter temas padrão diferentes, inclusive abertas por `?id=`.
5. Evento vence o padrão; ação ao vivo vence o evento.
6. Trocar o fundo de uma saída não altera texto nem outras saídas.
7. Lower Third não recebe fundo incompatível: na Fase 1 o seletor só oferece cor/transparente; na Fase 2 o arraste rejeita ativos `public`/sem categoria.
8. O ThemeRail não existe mais e todos os temas aparecem no seletor da saída, com os incompatíveis desabilitados e explicados.
9. Uma Browser Source aberta sem admin recebe plano, saída e cor de tela pelo snapshot inicial do `/ws`.
10. Temas v1/v2 e saídas existentes continuam abrindo sem perda, inclusive URLs antigas sem `?id=`.
11. `npm run typecheck` e `cargo check -p open-presenter` passam.

## Riscos e mitigação

- **Plano por saída é uma mudança grande de sync.** Mitigar mantendo `LiveThemes` como fallback temporário e migrando uma view por vez (Stream → Public → Stage).
- **Plano congelado com o admin fechado.** A saída usa o último plano publicado; se o admin nunca publicou, cai no modo degradado (`defaultThemeGuid` + defaults). Documentar que edições de tema/saída só acontecem com o admin aberto.
- **Stage é um renderer próprio.** Mitigar com escopo explícito: só Messages nesta fase; o resto desabilitado e documentado. Elementos movidos de camada ainda aparecem no Stage; isso é uma limitação conhecida até a Fase 3.
- **Tema incompatível em dado antigo.** O resolvedor ignora o tema inválido e cai no próximo, com aviso na UI; nunca renderiza em branco.
- **Rotas antigas sem `?id=`.** Mitigar com o fallback “primeira saída habilitada da categoria” e teste de identidade; `?id=` é adicionado a todas as janelas/URLs novas.
- **Browser Source sem tema no boot.** Mitigar incluindo planos e saídas no snapshot inicial do `/ws` e testando com o admin fechado.
- **Fundo opaco do tema vs. fundo arrastado.** Mitigar definindo o override como fundo do Slide (sub-camada), não como item da camada Mídia.
- **Categoria de tema confusa.** Mitigar com o seletor único “Recomendados/Outros” (incompatíveis desabilitados e explicados) e labels claros no editor.
- **Dados antigos.** Mitigar com campos opcionais, migração na leitura e testes de round-trip.
- **Alterações não commitadas do usuário.** Trabalhar em branch `feature/camadas-looks` e tocar só nos arquivos do escopo; não commitar mudanças alheias.
- **Disco quase cheio (~897 MB livres).** Evitar `npm install`, builds Tauri completos e análise nativa pesada; usar `CARGO_TARGET_DIR` existente quando precisar compilar.

## Decisões do autor (checar)

1. Fundo arrastado = override do fundo do Slide, não item da camada Mídia.
2. `screenColor` é fachada para `backgroundColorEnabled`; não duplica estado.
3. Override ao vivo é efêmero (sessão), viaja no plano e é reidratado pelo admin a partir de `get_live_output_plans`.
4. Tema do conteúdo (`media.themeId`) vence o override ao vivo e é aplicado no renderer, fora do plano.
5. Todo elemento do tema nasce em `slide`, inclusive imagens/vídeos; `media` é a media bin da Fase 2.
6. O seletor de tema mostra todos os temas; incompatíveis aparecem desabilitados com motivo.
7. Stage só aplica Messages nesta fase; não filtra elementos por camada; tema de evento não se aplica.
8. O painel de fundos é Fase 2; a Fase 1 entrega um seletor de fundo no Look (Lower Third só cor/transparente).
9. `LiveThemes` fica como fallback temporário até a migração das views.
10. Defaults de Look preservam o comportamento atual (tudo que já aparece continua aparecendo).
11. O admin é o único resolvedor de planos; o Rust só armazena e publica.
12. O plano carrega o documento do tema e `screenColor` para saídas web/OBS.
13. Rotas novas usam `?id=`; rotas antigas caem na primeira saída habilitada da categoria.
14. O snapshot inicial do `/ws` inclui planos e saídas.
15. `idleThemeGuid` vence a página `rest` do tema ativo.

## O que fica para o builder

- Nomes exatos dos componentes/arquivos e a ordem de implementação.
- Layout visual da árvore de camadas e da aba Look.
- Estratégia de migração de dados passo a passo.
- Como evitar loops de publicação entre admin, Rust e views.
- Estrutura do painel de fundos (Fase 2).
- Casos de teste adicionais além dos listados.

## Respostas ao builder check (2026-10-23)

| Pergunta | Decisão |
|---|---|
| Quem calcula o plano? | O admin resolve; o Rust só guarda e publica. Tema do conteúdo é aplicado no renderer. |
| URL sem `id`? | Primeira saída habilitada da categoria; rotas novas sempre com `?id=`. |
| Stage filtra `layer`? | Não nesta fase; só Messages. Limitação documentada; Fase 3. |
| Stage usa tema de evento? | Não. Ocioso: `idleThemeGuid` > página `rest` > default. |
| Tema incompatível? | Listado, desabilitado com motivo; nunca renderiza em branco. Tema de conteúdo é exceção. |
| Browser sem admin? | Snapshot inicial do `/ws` com planos + saídas; `screenColor` no plano. |
| Validação de fundo Lower Third? | Fase 1 restringe o seletor a cor/transparente; Fase 2 valida ativos no arraste. |
| Testes de render? | Sem dependência nova: funções puras no `node --test` + verificação manual. |
