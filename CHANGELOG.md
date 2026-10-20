# Changelog

Todas as mudanças relevantes do Open Presenter são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
