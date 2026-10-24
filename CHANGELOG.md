# Changelog

Todas as mudanças relevantes do Open Presenter são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.5.1] - 2026-10-24

Correção crítica de inicialização no Windows 10 para processos ocultos no Gerenciador de Tarefas, suporte a instância única, contenção de erros com ErrorBoundary e barras de rolagem nativas na busca de músicas e no painel de monitores.

### Corrigido

#### Desktop e Windows 10
- Corrigida a inicialização do WebView2 no Windows 10: a janela agora é criada com `visible: true` e exibida incondicionalmente, eliminando o cenário em que o processo ficava em segundo plano no Gerenciador de Tarefas sem abrir a interface.
- Bloqueada a persistência de coordenadas minimizadas (`-32000, -32000`) no banco de dados SQLite, evitando que o app abrisse fora dos limites visíveis dos monitores.
- Implementado plugin de instância única (`tauri-plugin-single-instance`): clicar no atalho do aplicativo com uma instância já em execução agora desminimiza, exibe e foca a janela existente, impedindo acúmulo de processos concorrentes e conflitos de porta.
- Proteção contra sequestro de tela em monitor único: saídas de projeção configuradas para monitores externos ausentes não abrem mais em tela cheia sobre a tela principal do operador.
- Adicionado `ErrorBoundary` global no React para capturar exceções de renderização e oferecer botões de recarga e restauração em vez de tela preta.

#### Interface e Rolagem
- Adicionada rolagem nativa com barra visível e responsiva (`overflow-y-auto` e `[scrollbar-gutter:stable]`) na janela de busca de letras na internet (`OnlineLyricsDialog`).
- Corrigido o container de abas inferiores do painel de monitores e saídas (`DisplaysTabsPanel`), permitindo rolagem fluida em todas as 7 abas de configuração de saídas (*Hardware*, *Cor*, *Plano de Fundo*, *Modelo Padrão*, *Camadas*, *Prévia* e *Palco & Relógio*).
- Adicionada rolagem com `min-h-0` na barra lateral de saídas (`DisplaysSidebar`) e rolagem nativa estilizada na aba de Saídas das Preferências (`PreferencesView`).

## [0.5.0] - 2026-10-24

Nova interface com Multiview de Previews, Paleta de Comandos Global (Cmd+K), controles de mídia integrados, abas de Avisos e Timers, integração direta da Bíblia no painel de mídia e arrastar e soltar universal para a programação.

### Adicionado

#### Previews e Layout
- Grade Multiview configurável (2x2, 3x3, 4x4) com seletor de saída via botão direito e visual limpo sem bordas.
- Controles de mídia centralizados logo abaixo da grade de previews, desobstruindo o cabeçalho.
- Abas inferiores dedicadas de Avisos (alertas rápidos) e Cronômetros/Timers de palco.
- Menu nativo "Exibir" para controle de visibilidade das abas e janelas auxiliares.
- Botão para recolher/expandir a barra de abas no painel de mídia.

#### Paleta de Comandos Global
- Abertura via `Cmd+K` / `Ctrl+K` para busca instantânea de músicas, versículos da Bíblia, mídias e comandos.
- Pressione `Enter` para navegar até o recurso ou `Shift+Enter` para apresentá-lo ao vivo imediatamente.

#### Arrastar e Soltar (DnD) e Organização
- Arraste mídias, temas, músicas ou passagens bíblicas para qualquer ponto da programação com criação automática de seções.
- Menus de contexto nos itens de mídia para adicionar diretamente à programação.
- Seleção de múltiplos versículos segurando `Cmd` ou `Ctrl`.

#### Bíblia e Agenda
- Aba da Bíblia unificada no painel de mídia.
- Busca rápida com reconhecimento inteligente de versões bíblicas (ex: `Joao 3.16 Ara`).
- Seletor de versão limpo exibindo apenas o nome e a abreviação oficial.
- Agenda de Eventos desacoplada em janela dedicada.

#### Shaders
- Pré-visualização estática (snapshot WebGL) na biblioteca de shaders ISF sem sobrecarga de renderização contínua.

## [0.4.2] - 2026-10-23

O telão volta a exibir o papel de parede quando está livre: a camada de entrada de
vídeo não escurece mais a saída, o papel de parede tem prioridade sobre o
placeholder e as imagens deixam de apontar para uma porta morta.

### Corrigido

#### Entrada de vídeo (NDI)

- A camada Entrada de Vídeo tinha fundo preto em tela cheia (`z-15`), acima do
  papel de parede (`z-0`) e do fundo do tema (`z-10`). Sem frames, o feed MJPEG
  não desenha nada e o preto cobria a saída inteira — no telão nativo e na web.
  A camada agora é transparente e o vídeo aparece quando há sinal.
- No Lower Third o preto também quebrava a transparência da saída.

#### Papel de parede e placeholder

- Com o telão livre, o papel de parede passa a ter prioridade sobre o placeholder
  da saída, que vira fallback de quem não tem wallpaper.
- Antes o placeholder (inclusive o logo do Open Presenter, quando o tipo era
  imagem sem arquivo) escondia o papel de parede do culto no telão.
- O placeholder de saída resolve `media://` para a URL do servidor, então a
  imagem volta a carregar em saídas html abertas no navegador, sem o erro
  "URL incompatível".

#### Mídia

- Enquanto a porta real do servidor não chega via IPC, a mídia não aponta mais
  para a porta padrão do código (5050), que fica morta quando o operador
  configura outra porta.

## [0.4.1] - 2026-10-23

Correções de mídia e de monitores reportadas no Windows.

### Corrigido

#### Mídia (fundo/tema)

- A porta de mídia é revalidada quando o estado das saídas muda, em vez de
  ficar fixada na porta lida no boot (servidor pode subir, parar ou trocar de
  porta depois).
- No desktop sem servidor HTTP, a mídia resolve para o protocolo `media://` em
  vez de apontar para uma porta morta.
- O caminho é codificado por segmento (sem escapar `/`), alinhado ao resolvedor
  da biblioteca de imagens.
- `BackgroundRenderer` tenta `media://` quando o HTTP falha, evitando imagem
  quebrada.
- A janela do evento mostra "Arquivo não encontrado" com a URL resolvida quando
  o plano de fundo falha.

#### Monitores (Windows)

- Identidade de monitor estável (nome + resolução) no lugar do índice, que varia
  entre chamadas no Windows e fazia a atribuição se perder.
- `monitorId`/`monitorName` salvos são reconciliados com os monitores atuais ao
  carregar.
- O fallback escolhe um monitor não-primário, em vez do índice 1.
- Auto-activate só no processo principal e uma vez por sessão: abrir a janela de
  Configuração de tela não reabre nem foca mais as saídas.
- Janela nativa existente não recebe foco; é reposicionada apenas se o monitor
  mudou.
- Nova saída prefere um monitor livre que não seja o principal.

## [0.4.0] - 2026-10-23

Release que consolida camadas mestras, Looks por saída e o painel de mídia (0.3.9)
e fecha a Fase 3: Props/Anúncios, Máscara, Stage em camadas e Entrada de Vídeo NDI.

### Adicionado

#### Props e Anúncios

- Elementos movidos para as camadas **Props** e **Anúncios** no editor de temas
  passam a renderizar em overlays próprios acima do Slide (`z-21` e `z-22`).
- Funciona no público, no Lower Third e no Stage; desligar a camada no Look
  esconde o overlay só naquela saída.

#### Máscara

- `MaskConfig` por saída com formas **cantos arredondados**, **elipse**, **faixas**
  e **laterais**, margem percentual, raio e cor.
- Máscara aplicada na camada superior, acima de Slide/Props/Anúncios e abaixo do
  blackout/alertas.
- Configuração na aba **Camadas**; escolher uma forma já liga a camada Máscara.
- Previews (`LivePreview` e `Displays`) refletem a máscara.

#### Stage em camadas

- `StageView` e `StageMiniPreview` filtram o tema pelo Look (Slide, Props,
  Anúncios, Máscara e Mensagens).
- **Slide** desligado esconde o painel do slide (tema, apresentação e mídia).
- Overlays de Anúncios/Props, máscara e cor da tela também valem no Stage.
- O Look libera todos os toggles no Stage, exceto Mídia (sem renderer).

#### Entrada de Vídeo (NDI)

- Descoberta de fontes NDI e seleção no Painel da saída (aba Camadas).
- Receptor NDI com carregamento dinâmico do runtime, conversão RGBX → JPEG a
  ~15 fps e publicação do último frame.
- Endpoints `/ndi/frame.jpg` e `/ndi/stream` (MJPEG) no servidor embutido.
- Camada **Entrada de Vídeo** no público, Lower Third e Stage, abaixo do Slide.
- No Stage, o fundo do tema é omitido com a entrada ligada para o vídeo aparecer
  atrás do relógio/próximo slide.
- Comandos `list_ndi_sources`, `get_ndi_input_status`, `start_ndi_input` e
  `stop_ndi_input`.

#### Consolidação da 0.3.9

- Camadas mestras, Looks por saída, plano de render por saída, remoção do
  ThemeRail/bindings e painel de mídia inferior com arraste de temas/fundos.
- Detalhes na entrada [0.3.9].

### Alterado

- `ThemeElement` ganhou `layer`; temas antigos continuam abrindo (sem camada =
  Slide).
- `DisplayOutput` ganhou `look`, `mask` e `idleThemeGuid`.
- A escolha de tema passa a ter donos explícitos: saída (padrão/Look), evento e
  ação ao vivo.

### Corrigido

- Tema padrão da tela não é mais sobreposto por vínculos globais.
- Messages desligada esconde os alertas só naquela saída.
- Arrastar fundo para a letra/prévia aplica o override na saída.
- Alternância de tela cheia funciona nas janelas nativas do macOS.
- O divisor do painel de mídia não inverte mais a direção.

### Notas técnicas

- Entrada NDI usa `ndi-sdk` (headers vendorizados + `dlopen`) em vez de
  `grafton-ndi`, que exigiria o NDI SDK instalado em toda máquina de build/CI.
  O **runtime NDI** continua sendo requisito em tempo de execução.
- Fonte NDI é **global e por sessão** nesta versão; a seleção não é persistida.
- O feed é entregue em MJPEG a ~15 fps; sem áudio e sem fonte por saída.
- CI instala libclang no Linux/Windows para o bindgen.

## [0.3.9] - 2026-10-23

Release com camadas mestras e Looks por saída, plano de render por saída, painel de
mídia inferior com arraste de temas/fundos e correções nas janelas nativas.

### Adicionado

#### Camadas mestras e Looks por saída

- 8 camadas mestras fixas no tema: Máscara, Mensagens, Props, Anúncios, Slide,
  Mídia, Entrada de Vídeo e Cor da Tela.
- Campo `layer` em `ThemeElement`; temas antigos sem o campo são tratados como
  `slide`.
- Editor de Temas com árvore por camada, visibilidade/bloqueio por camada e ação
  **Mover para camada**.
- `OutputLook` por saída, com toggles de camada, defaults por categoria e a Cor da
  Tela como fachada de `backgroundColorEnabled`.
- `OutputPlan`/`LiveOutputPlans` por saída: o admin resolve tema, look, fundo e
  cor da tela; o Rust guarda e publica via evento e `/ws`.
- Precedência única de tema: conteúdo > override ao vivo > evento > padrão da
  saída > fallback do sistema.
- Precedência de fundo: conteúdo > override ao vivo > fundo do slide ao vivo >
  fundo do tema > Cor da Tela.
- Rotas nativas passam a carregar `?id=<outputId>`; rotas antigas sem `id` caem na
  primeira saída habilitada da categoria.
- Snapshot inicial do `/ws` inclui os planos por saída e a configuração das saídas.

#### Painel de mídia (Fase 2)

- Painel inferior estilo media bin, com abas em sidebar vertical
  (Temas/Fundos/Lower/Shaders), altura redimensionável e estado persistido.
- Arraste de temas e fundos para os previews de saída, gravando override ao vivo
  apenas naquela saída.
- Compatibilidade por categoria de ativo: Lower Third aceita só cor/transparente
  ou tema `stream`.
- Ações de aplicar, editar tema e limpar override no painel.
- Presets de shader e imagens da biblioteca entram como ativos de fundo.

#### Janelas nativas

- Alternância confiável de tela cheia: item **Janela → Tela Cheia**
  (`Ctrl+Cmd+F` no macOS, `F11` nos demais) e comando `toggle_fullscreen`.
- Janelas de saída redimensionáveis, permitindo reentrar em tela cheia no macOS.

### Alterado

- ThemeRail e bindings globais removidos. A escolha de tema passa a ter três
  donos explícitos: saída (padrão/Look), evento e ação ao vivo.
- Seletor de tema da saída lista todos os temas, com incompatíveis desabilitados
  e explicados.
- Previews de saída (`LivePreview` e `Displays`) refletem o Look e o override de
  fundo.
- Preferências → Temas vira galeria; a aplicação de tema acontece na saída/evento
  e no painel de mídia.
- `LiveThemes`/`set_live_themes` removidos; `LiveOutputPlans` é o novo contrato de
  sincronização.

### Corrigido

- O tema padrão configurado na tela deixava de valer por causa dos bindings
  globais do ThemeRail.
- Alertas continuavam sendo renderizados em saídas com Mensagens desligada.
- Arrastar um fundo para a letra/prévia não aplicava o override na saída.
- Não era possível voltar à tela cheia depois de sair dela nas janelas nativas do
  macOS.
- O divisor do painel de mídia invertia a direção ao redimensionar.

### Migração

- Bindings antigos do ThemeRail são migrados na leitura para
  `defaultThemeGuid`/`idleThemeGuid` das saídas.
- Temas v1/v2 continuam abrindo; elementos sem `layer` viram `slide`.
- `screenColor` continua vindo de `backgroundColorEnabled` (sem estado duplicado).

## [0.3.8] - 2026-10-20

### Corrigido

#### Editor de Temas & Auto-scale

- **Auto-scale com mínimo e máximo reais:** o teste de largura comparava
  `scrollWidth` de um bloco `100%` com `98%` da mesma largura, forçando todo texto
  multilinha ao tamanho mínimo. A medição agora usa as linhas reais do texto
  (`Range.getClientRects`) em um medidor oculto, com busca binária inteira entre
  `minFontSize` e `maxFontSize`.
- **Paridade entre palco e export:** o PNG passou a usar o mesmo resolvedor de
  tamanho do palco, respeitando padding, line-height e clipping da caixa.

#### Atalhos de Seção

- **Atualização imediata dos rótulos:** os grupos de música agora sincronizam entre
  a janela principal e a janela de Preferências (evento Tauri, `BroadcastChannel` e
  `storage`). Mudar o atalho nas Preferências atualiza os badges da letra sem
  reiniciar o aplicativo.
- **Prioridade contextual:** os atalhos de seção configurados têm prioridade sobre
  os atalhos globais `B`/`C`/`F` quando há uma música com seções no painel de letras,
  evitando que `C` (Refrão) também limpe o texto. As Preferências destacam conflitos
  com os atalhos globais.

## [0.3.7] - 2026-10-20

Release de correção com suporte completo a agrupamento e renomeação de camadas no
Editor de Temas, movimentação sincronizada de elementos agrupados no canvas,
refatoração do motor de auto-shrink/auto-fit de texto por tamanho de fonte real e
unificação visual de estrofes e seções de slides na programação do culto.

### Adicionado

#### Editor de Temas & Camadas

- **Agrupamento de Camadas:** Seleção múltipla de camadas no painel através de
  `Ctrl + Clique`, `Cmd + Clique` ou `Shift + Clique`, com botão direto `Agrupar (N)`.
- **Gerenciamento Completo de Grupos:**
  - Renomeação inline com duplo-clique no título do grupo.
  - Ações em lote no cabeçalho do grupo: ocultar/mostrar todas as camadas do grupo,
    bloquear/desbloquear em lote, reordenar a pilha (subir/descer) e excluir o grupo.
  - Recolhimento e expansão de itens do grupo com ícone de pasta.
  - Ação `Desagrupar` para desfazer o agrupamento mantendo os elementos individuais.
- **Movimentação Sincronizada no Canvas:** Arrastar qualquer elemento de um grupo
  translada simultaneamente todos os elementos desbloqueados daquele grupo com preview
  em tempo real e persistência atômica das coordenadas.
- **Sincronização Rust / TypeScript:** Campos `groupId` e `groupName` adicionados ao
  modelo de dados `ThemeElement` no shared kernel TS e backend Rust.

### Corrigido

#### Renderização de Slides & Auto-shrink de Texto

- **Reduzir para Caber e Preencher Caixa:** O algoritmo anterior baseado em
  `transform: scale(...)` foi substituído por busca binária rápida que calibra
  diretamente o `fontSize` e `lineHeight` proporcional.
  - O texto agora quebra naturalmente na largura real do container (`targetW = cw * 0.98`),
    garantindo que frases longas de hinos e leituras não sejam cortadas vertical ou
    horizontalmente.
  - Compatível com textos de linha única (`nowrap`) e parágrafos multilinhas (`pretty` /
    `pre-wrap`), respeitando com precisão a propriedade `minFontSize`.

#### Programação do Culto (Events / Setlists)

- **Agrupamento Visual de Slides:** Estrofes e seções com múltiplos slides (ex: `Refrão`)
  agora são agrupadas em um card unificado e envolvente, com cabeçalho único contendo o
  nome da seção e indicador de quantidade de slides, eliminando bordas repetidas e
  rótulos duplicados para cada slide da mesma estrofe.

## [0.3.6] - 2026-10-20

Release com reformulação ergonômica da barra inferior e drawer do controle remoto,
layout responsivo de 2 colunas para tablets e computadores, preview ao vivo compacto,
relógio com dois pontos piscantes (:), centralização robusta em widgets de temas e
variáveis bíblicas independentes e higienizadas.

### Adicionado

#### Controle Remoto

- Barra flutuante inferior com alça visual de puxar (drawer grabber handle), resumo
  do slide ao vivo (badge de seção, título da música truncado e contador de slides)
  e 3 botões ergonômicos: `Anterior`, `Sem texto` (com destaque visual quando o texto
  está oculto mantendo o fundo) e `Próximo`.
- Drawer de apresentação expandido ocupando maior área útil (`max-h-[88vh]`), com
  atalhos de navegação interna (`Slide Anterior` e `Próximo Slide`), navegação
  por seções de louvor, versículos ou slides e botão `Encerrar apresentação`.
- Modo compacto da prévia ao vivo em linha única (`grid-cols-5`), apresentando os
  cinco controles (`Anterior`, `Próximo`, `Sem texto`, `Papel de parede`, `Tela preta`)
  em botões enquadrados icon-only para economia de espaço em telas verticais.
- Layout responsivo automático em 2 colunas (`lg:`): coluna 1 fixa com o monitoramento
  ao vivo, ações e cronômetro; coluna 2 com a navegação por abas e conteúdos.

#### Editor de Temas & Widgets

- Suporte a dois pontos piscantes no relógio (`op-clock-colon-blink`), animando
  o separador de horas e minutos em intervalo de 1 segundo como um display digital.
- Nova propriedade `blinkColon` configurável com interruptor no painel de propriedades
  tipográficas do Editor de Temas.
- O widget de relógio adicionado no editor e o tema padrão de retorno agora vêm
  centralizados e com os dois pontos piscantes ativados por padrão.

#### Variáveis Bíblicas Limpas

- Sanitização automática de nomes de arquivo SQLite (ex: `nvi.sqlite` vira `NVI`).
- Novas variáveis públicas e de retorno:
  - `{reference}` / `{referencia}`: Apenas a referência bíblica sem a versão anexada.
  - `{version}` / `{versao}`: Sigla da versão bíblica em maiúsculas.
  - `{reference_full}` / `{referencia_completa}`: Nome por extenso do livro com capítulo e versículo.
  - `{reference_abbr}` / `{referencia_abreviada}`: Nome abreviado do livro com capítulo e versículo.
- Inclusão dos badges rápidos de inserção de `{reference}`, `{version}` e `{reference_abbr}`
  no painel de propriedades do editor.

### Corrigido

- **Alinhamento Centralizado em Widgets:** Corrigido o alinhamento de flexbox em
  elementos com `whiteSpace: "nowrap"`, garantindo que relógios, cronômetros e
  títulos respeitem `textAlign: center` dentro do contêiner do elemento.
- **Auto-shrink e Auto-fit de Texto:** O cálculo de escalonamento agora mede a
  largura natural do texto desempacotado antes de aplicar a redução, evitando
  quebras de linha prematuras e corte de palavras ou frases longas.
- **Atalhos de Teclado no macOS:** Registrado o menu nativo `Editar` no backend
  Tauri, restaurando o funcionamento padrão de `Cmd+C`, `Cmd+V`, `Cmd+X` e `Cmd+A`
  em campos de texto e no editor.

## [0.3.5] - 2026-10-20

Release com saída transparente para OBS Studio via Browser Source, temas de Lower
Third contextualizados, transições e animações configuráveis por camada no Editor
de Temas, gradientes visuais com gerador de texturas de ruído (noise), integração
completa de versículos bíblicos na setlist e melhorias no controle remoto.

### Adicionado

#### Transmissão & Lower Thirds (OBS / Streaming)

- Saída web transparente acessível na rota `#/stream`, utilizável como Browser
  Source no OBS Studio, vMix ou Wirecast via protocolo nativo e servidor HTTP
  embutido (`http://<ip>:5050/#/stream`).
- Nova aba dedicada **Transmissão** em **Preferências**, com toggle de ativação,
  resolução, taxa de quadros e seleção de tema de transmissão.
- Tema padrão Lower Third (`DEFAULT_STREAM_THEME`) com páginas formatadas para
  música (`music`), escrituras (`bible`) e texto (`text`), com fundo translúcido
  e barras de destaque.
- Simulação de câmera com vídeo/webcam no Editor de Temas para pré-visualizar a
  sobreposição de lower thirds sobre cenas reais.
- Estrutura base e comando IPC para streaming NDI em rede local.

#### Transições e Efeitos no Editor de Temas

- Nova seção **TRANSIÇÃO & ANIMAÇÃO** no painel de propriedades ao selecionar
  qualquer elemento no Editor de Temas.
- **Camadas Fixas / Persistentes (`none` / Fixo):** Elementos estáticos (como
  retângulos de fundo, molduras, tarjas e logotipos) agora permanecem fixos na
  tela sem piscar ou sofrer fade ao trocar os slides de música ou versículos.
- **Transições Direcionais Suaves:** Efeitos configuráveis individualmente por
  camada (`Fade`, `Fade para Cima`, `Fade para Baixo`, `Fade para Esquerda`,
  `Fade para Direita`) com durações de `150ms`, `250ms`, `400ms` e `600ms`.
- Construtor visual de gradientes lineares em retângulos e plano de fundo, com
  múltiplos stops de cor, porcentagens, controle angular e presets modernos.
- Gerador procedural de textura de ruído SVG (Noise) baseado em `feTurbulence`,
  com inserção com 1 clique e presets de granulação.

#### Bíblia na Programação & Palco

- Versículos da Bíblia podem ser adicionados à programação do culto pelo menu
  **Adicionar Versículo** (barra lateral e menus de contexto) ou pelo seletor
  de versículo, com escolha da seção de destino.
- Itens de Escritura na setlist abrem a coluna de slides do versículo e mantêm
  a Bíblia do painel sincronizada com o texto que está no ar.
- O controle remoto ganhou o botão **Encerrar** para cancelar a apresentação e
  liberar o telão.
- Seleção de tema de palco nas preferências e suporte a descanso de palco.
- O menu de adicionar itens da programação foi reorganizado em grupos
  (Músicas, Bíblia, Mídias e Studio), sem opções duplicadas.
- O **EventDetailsDialog** agora oferece os mesmos tipos de item da barra
  lateral: músicas, versículos, textos, imagens, vídeos, pastas, seções e
  apresentações do Studio.

### Corrigido

- Prevenção do fechamento da janela no macOS ao pressionar `Backspace` ou
  `Delete` no Editor de Temas; a tecla agora exclui com segurança o elemento
  selecionado, e `Escape` limpa a seleção.
- Materialização contínua de temas em `PublicView`, `LivePreview` e `StreamView`,
  garantindo que palcos e lower thirds mantenham camadas fixas estáveis.
- Os metadados de referência bíblica (`ScriptureRef`) agora acompanham os
  slides ao vivo, permitindo que **Anterior/Próximo** no controle remoto
  naveguem entre partes e versículos em vez de pular para o próximo item da
  setlist.
- O editor de temas mede o tamanho real dos elementos ao abrir, inclusive após
  o carregamento das fontes, usando `ResizeObserver`.
- O arrastar-e-soltar de seções e itens da programação voltou a funcionar no
  WebView (`dragDropEnabled: false`).
- O ícone da bandeja no macOS foi ampliado para ficar alinhado aos ícones do
  sistema.
- O logotipo e o botão de ocultar a programação foram trocados de lugar, e o
  botão **Remote** passou a ser o último do cabeçalho do painel.
- Os cabeçalhos dos painéis da apresentação foram padronizados em 56 px, com o
  toggle da programação ao lado das abas e o cabeçalho do trilho de temas
  refinado.
- O controle remoto não aplica mais zoom por pinça/double-tap e evita o
  auto-zoom dos navegadores móveis ao focar campos de texto.
- A lista de eventos da programação passou a ser ordenada por data ascendente,
  do evento mais próximo para o mais distante.
- A adição do primeiro item a um evento vazio agora atualiza a lista e persiste
  imediatamente, tanto na barra lateral quanto no **EventDetailsDialog**.

## [0.3.1] - 2026-10-19

Release de identidade visual e sistema de temas da interface, com presets,
edição de tokens shadcn/ui, importação/exportação em JSON e CSS e aplicação
independente dos temas de projeção.

### Adicionado

#### Identidade visual

- Novos assets SVG em `docs/brand/` (ícones claro, escuro, invertido, preenchido,
  monocromático e wordmarks).
- Ícones do aplicativo regenerados para macOS, Windows, Linux, Android e iOS.
- Ícone monocromático dedicado à bandeja do macOS com `icon_as_template`,
  adaptando-se automaticamente ao modo claro e escuro do sistema.
- Favicon SVG, PNG 32×32, ICO e Apple Touch Icon servidos junto com o frontend.
- Wordmark oficial no README e marca aplicada no dock, preferências, atalhos,
  controle remoto e tela de informações do app.

#### Tema da interface (shadcn/ui)

- Novo núcleo `src/core/theme/uiTheme.ts` com 31 tokens shadcn/ui para as
  paletas clara e escura, incluindo cores de gráficos e barra lateral.
- Presets: Open Presenter, Slate, Azul, Violeta, Verde, Âmbar, Rosa e Alto
  contraste.
- Editor completo em **Preferências → Aparência**, em uma seção recolhível, com
  seletor de paleta claro/escuro, prévia ao vivo e ajuste de arredondamento
  (`--radius`).
- Persistência em `localStorage` na chave `open_presenter_ui_theme`.
- Aplicação em tempo real via CSS custom properties no elemento `:root`,
  integrada ao modo claro/escuro/sistema existente.
- Importação e exportação em JSON (`open-presenter-ui-theme`) e CSS com blocos
  `:root` e `.dark`.
- Importação parcial: tokens ausentes são completados com o tema padrão.
- Validação de valores CSS e limites de arredondamento para evitar injeção de
  declarações no CSS.
- Prévia da interface com variáveis CSS isoladas no contêiner, permitindo editar
  a paleta escura mesmo com o app no modo claro.

### Alterado

- Tokens padrão de `src/index.css` convertidos para a paleta neutra em hex,
  alinhados ao preset Open Presenter.
- Barras de rolagem passam a usar `--muted-foreground` com `color-mix`, seguindo
  o tema ativo.
- `src/core/theme/theme.ts` aplica a paleta personalizada ao alternar entre
  claro, escuro e sistema, inclusive em mudanças do sistema operacional.
- README atualizado com o wordmark, a seção de aparência e a nova captura de
  tela.
- Documentação de release separada entre changelog técnico (GitHub) e novidades
  amigáveis (app).

### Corrigido

- A janela de atalhos agora exibe a versão real do aplicativo, em vez de
  `v0.1.0` fixo.
- Pequenos ajustes de contraste e consistência visual nas preferências.

### Manutenção

- Testes de cores e do núcleo de temas com `node:test` (normalização de hex,
  contraste, presets, serialização, importação/exportação e aplicação de
  variáveis).
- Feature `image-png` habilitada no Tauri para carregar o ícone PNG da bandeja.
- Versão atualizada para `0.3.1` em `package.json`, `package-lock.json`,
  `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` e `src-tauri/tauri.conf.json`.

## [0.3.0] - 2026-10-19

Release com o módulo Bíblia, temas organizados por momento do culto,
atualizações dentro do app e melhorias na projeção.

### Adicionado

#### Bíblia

- Módulo Bíblia com persistência em SQLite, comandos IPC e endpoints no servidor
  embutido.
- Importação de versões/traduções da Bíblia para uso offline.
- Página Bíblia com paleta de comandos, busca por livro, capítulo, versículo e
  texto.
- Comparação de versículos entre diferentes traduções.
- Exibição de versículos no público e no palco.
- Aba Bíblia no controle remoto, com atalho no dock.
- Campos `prevUp` e `nextUp` no `LiveSlide` para navegação entre versículos.

#### Temas por contexto

- Suporte a páginas de tema para público e palco.
- Temas específicos para contextos do culto (louvor, pregação, avisos e retorno
  do palco).
- Resolução automática do tema por contexto, com fallback para o tema padrão.
- Vinculação de tema ao evento e ativação do tema efetivo por página.
- Seleção e exclusão de tema diretamente no evento.
- Remoção da criação automática de evento padrão.

#### Editor e galeria de temas

- Páginas por contexto no editor de temas.
- Renomeação de camadas.
- Exportação e importação de temas em JSON (`.openpresenter-theme.json`).
- Atualização de temas antigos para o formato com páginas.
- Exibição da versão do tema e ação de atualização para a versão atual.
- Pré-visualizações e seletores atualizados para temas com páginas.
- Tema padrão de Bíblia/Versículos e vínculo do asset `scripture` nas
  preferências.

#### Projeção e palco

- Widgets de prévia do próximo slide (`{next_preview}`, `{next_line}`).
- Versículo anterior disponível na tela do palco.
- Auto-shrink com margem de segurança e melhor quebra de texto no renderer.

#### Atualizações

- Atualização in-app com o plugin oficial do Tauri, artefatos assinados e
  verificação de integridade.
- Aba **Atualizações** nas preferências, com versão instalada, verificação
  manual, verificação automática e instalação.
- Modal de novidades com resumo amigável das mudanças da versão.
- Endpoint de atualização apontando para o `latest.json` das GitHub Releases.
- Assinatura de updates integrada ao workflow de release.

#### Bandeja do sistema

- Ícone permanente na bandeja com menu para reabrir o app, acessar os links de
  público, palco e controle remoto, reiniciar o servidor e sair.
- Links de acesso habilitados apenas quando o servidor e a saída correspondente
  estão ativos.
- Opção de fechar a janela principal para a bandeja, configurável em
  **Preferências > Geral**.
- Encerramento explícito pelo menu da bandeja, evitando um processo em segundo
  plano sem indicação visual.

### Alterado

- Temas padrão unificados por contexto.
- Galeria e seletores passam a considerar páginas e contexto do evento.
- Publicação do tema ao vivo passa a usar a página efetiva do contexto.
- Página efetiva do tema é publicada para público e palco.
- Versão exibida nas preferências e na tela Geral passa a vir do build.

### Corrigido

- Exclusão de tema não deixa mais o diálogo em estado inconsistente ao fechar.
- Ajustes internos de estabilidade no editor e na publicação de temas.

### Documentação e manutenção

- Documentação do desenho de temas por contexto.
- Skill de criação de temas para agentes de IA, com schema, guia de variáveis,
  exemplos e script de validação.
- `dist-releases/` adicionado ao `.gitignore`.
- Workflow de release multi-plataforma com macOS (arm64/x64), Linux e Windows.

## [0.2.0] - 2026-10-18

Primeira release pública com a base de operação ao vivo.

### Adicionado

- Aplicativo desktop Tauri v2 + React 19 com servidor HTTP/WebSocket embutido.
- Setlists e agenda de eventos.
- Módulo de músicas com importação do Holyrics, busca online de letras e grupos.
- Editor e galeria de temas de slides.
- Saídas unificadas para público e palco (janela nativa, web ou ambas).
- Controle remoto pelo navegador/celular.
- Studio de criação de apresentações.
- Biblioteca de imagens e mídia.
- Tela de descanso no retorno do palco.
- Atalhos de operador, blackout, limpeza de texto e plano de fundo.
- Persistência local em SQLite.

[0.3.0]: https://github.com/open-mission/open-presenter/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/open-mission/open-presenter/releases/tag/v0.2.0
