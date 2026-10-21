# Ajustes de operação ao vivo e Bíblia — desenho

Data: 2026-10-20
Status: aprovado

## 1. Intenção e porquê

O operador precisa de um "botão de pânico" no telão: quando o cantor improvisa,
a letra precisa sair do ar sem levar junto a identidade visual do tema. Hoje o
comando de limpar esconde o slide inteiro e revela o papel de parede do evento,
o que não é a mesma coisa que ocultar apenas o texto.

O mesmo operador também não consegue ver no painel o que o público verá: as
letras e os versículos aparecem como listas de texto, não como slides com tema.
Na Bíblia, a navegação por lista de livros e a importação/gestão de versões
ficam abaixo do fluxo de quem usa Holyrics no dia a dia. Por fim, a janela
principal tem larguras fixas e o painel de monitores ocupa espaço mesmo quando
não é necessário.

Esta entrega resolve esses atritos sem mudar o modelo de temas, sem trocar o
formato de armazenamento das músicas e sem adicionar dependências novas.

## 2. Escopo

### 2.1 Slides vazios e controle de texto

- Duas linhas em branco entre estrofes criam um slide vazio (sem texto).
- Uma linha em branco continua apenas separando estrofes.
- Opção em Configurações → Músicas para inserir um slide vazio no início de
  toda música, inclusive nas já cadastradas.
- Separação entre "ocultar texto" (mantém o fundo do tema) e "mostrar apenas o
  fundo" (papel de parede do evento/saída).

### 2.2 Previews em slides

- Alternador lista/slides nos painéis de letra e de versículo do setlist.
- Alternador lista/slides na coluna de versículos da Bíblia.
- Miniatura 16:9 com o tema público resolvido, igual ao que vai ao telão.

### 2.3 Bíblia

- Alternador lista/cards para os livros, no estilo Holyrics.
- Paleta de referências abre ao começar a digitar na aba Bíblia.
- `Enter` seleciona e prepara o versículo; `Shift+Enter` apresenta ao vivo.
- `Jo 3` abre o capítulo 3 no versículo 1; `Jo 3.16` e `João 3 16` selecionam o
  versículo 16.
- Importação movida para um menu de ações, com "Importar Bíblia…" e
  "Gerenciar versões…".
- Importação de várias versões de uma vez.
- Modal de gerenciamento com lista, exclusão e adição de versões.

### 2.4 Layout da janela principal

- Redimensionar as colunas de programação, letra/versículos e monitores.
- Ocultar por completo o painel de monitores, liberando espaço para os slides.
- Larguras e visibilidade persistidas entre sessões.

## 3. Fora de escopo

- Redesenho do controle remoto. O comportamento atual de "limpar" continua
  equivalendo a "mostrar apenas o fundo".
- Novas traduções, download de Bíblias ou edição de texto bíblico.
- Renomear versões bíblicas existentes.
- Mudanças no editor de temas ou no formato de exportação de temas.
- Reordenar ou redimensionar os monitores internos do painel; os controles de
  zoom e visibilidade por monitor continuam como estão.
- Preview em slides para mídias (imagens/vídeos) no setlist.
- Persistência de larguras no backend: o layout fica em `localStorage`.

## 4. Decisões tomadas

Itens marcados como **(construção)** foram decididos por mim para fechar
lacunas do desenho; os demais vieram do pedido ou da sua escolha.

1. **Regra do slide vazio:** duas ou mais linhas em branco consecutivas entre
   blocos de conteúdo geram **um** slide vazio. Uma linha em branco é apenas
   separador. Linhas em branco no início ou no fim do texto são ignoradas.
2. **Slide vazio no início:** a opção é global, desligada por padrão, e vale
   para todas as músicas no momento de montar a sequência — não é gravada dentro
   da música.
3. **Ocultar texto x mostrar fundo:** são estados independentes. `C` oculta só o
   texto e mantém o fundo/elementos do tema; `F` mostra apenas o fundo (papel de
   parede). Ao ativar um, o outro é desligado.
4. **Texto oculto não afeta o palco (construção):** o monitor de retorno
   continua vendo a letra. O estado vale para as saídas públicas (telão,
   transmissão e preview remoto).
5. **Atalhos globais:** `B`, `C` e `F` só disparam quando há um slide carregado
   no telão (conteúdo diferente de `blank`). Sem apresentação ativa, digitar na
   Bíblia abre a paleta normalmente.
6. **Foco manda (sua escolha):** quando o foco está dentro da coluna de
   letra/versículos e a música tem um grupo com atalho `C`/`B`/`F`, o atalho de
   grupo vence. Fora dessa coluna (barra superior, monitores, Bíblia), os
   atalhos globais vencem. Se o grupo não existir na música, o atalho global
   assume.
7. **Precedência na Bíblia:** se houver apresentação ativa, `B`, `C` e `F`
   continuam sendo atalhos globais quando o foco não estiver na coluna de
   letras; as demais teclas imprimíveis abrem a paleta. Sem apresentação ativa,
   qualquer tecla imprimível abre a paleta.
8. **Previews:** lista é o modo padrão; a escolha lista/slides é lembrada por
   painel. As miniaturas usam o tema público resolvido (incluindo tema do
   evento) e o mesmo renderer da saída ao vivo.
9. **Livros:** lista é o modo padrão; cards são uma opção lembrada. Os cards
   mostram nome, abreviação e quantidade de capítulos, com destaque por
   testamento.
10. **Painéis:** as três colunas são redimensionáveis; larguras ficam em
    `localStorage`; duplo clique no divisor restaura o padrão. O painel de
    monitores some por completo e volta por um botão na barra superior.
11. **Importação:** o menu "…" tem "Importar Bíblia…" (múltiplos arquivos) e
    "Gerenciar versões…" (modal com lista/adicionar/excluir). O botão de lixeira
    do cabeçalho sai. Arquivos com o mesmo nome continuam substituindo a versão
    existente, como o backend já faz hoje.
12. **Slide vazio é silêncio visual (construção):** ele mantém
    `kind: "lyric"` (para o telão entender que há apresentação ativa), mas não
    mostra título, letra nem prévia do próximo. Só permanecem o fundo e os
    elementos visuais do tema.
13. **Transmissão é saída pública (construção):** `StreamView` também respeita
    `textHidden`; o texto é esvaziado e a moldura/lower third do tema permanece.
    O palco continua vendo a letra.
14. **A opção do slide inicial vale na hora (construção):** o store de padrões
    atualiza imediatamente. Se uma música estiver ao vivo, o slide no ar não é
    reprojetado; a sequência e o `runnerIndex` são remapeados (+1 ao ligar,
    −1 ao desligar) para próximo/anterior continuarem corretos.
15. **Importação em lote com progresso (construção):** o store recebe
    `onProgress` e devolve erros com o nome do arquivo; o modal mostra
    "Importando 2 de 3…" e um único resumo.

## 5. Modelo de dados e contratos

### 5.1 Música

`SongSection` continua `{ sectionType, lines }`. Um slide vazio é representado
por `lines: []` e `sectionType: null`. Não há novo campo persistido na música.

`RunnerSlide` ganha o índice da seção de origem, para que o slide sintético do
início não desloque as ações de edição:

```ts
interface RunnerSlide {
  index: number; // índice na sequência de slides (0-based)
  sectionIndex: number | null; // índice em song.sections; null no slide sintético
  isBlank: boolean;
  label: string | null;
  sectionType: SectionType | null;
  slide: SlideContent;
}
```

`SongDefaults` ganha a opção global:

```ts
interface SongDefaults {
  linesPerSlide: LinesPerSlide;
  addEmptySlideAtStart: boolean; // padrão: false
}
```

No Rust, `SongDefaults` recebe `#[serde(default)] add_empty_slide_at_start`.
A chave correspondente é persistida em `settings`; não há migração de tabela.

### 5.2 Slide ao vivo

`LiveSlide` ganha o estado de texto oculto:

```ts
interface LiveSlide {
  content: SlideContent;
  background: BackgroundLayer;
  blackout: boolean;
  cleared: boolean; // "mostrar apenas o fundo"
  textHidden: boolean; // "ocultar texto"
  updatedAt: string;
  nextUp?: SlideContent;
  prevUp?: SlideContent;
}
```

No Rust, `text_hidden: bool` com `#[serde(default, rename = "textHidden")]`,
para aceitar mensagens antigas sem quebrar. `cleared` mantém o significado
atual: esconde o slide inteiro e revela o papel de parede quando existir.

### 5.3 Layout

Novo store `usePanelLayoutStore` (Zustand + `localStorage`):

```ts
interface PanelLayoutState {
  setlistWidth: number; // 240–480, padrão 320
  slidesWidth: number; // 280–640, padrão 384
  monitorsVisible: boolean; // padrão true
  setSetlistWidth(width: number): void;
  setSlidesWidth(width: number): void;
  setMonitorsVisible(visible: boolean): void;
  toggleMonitors(): void;
  reset(): void;
}
```

Chave: `open_presenter_panel_layout`. Valores fora da faixa são limitados ao
carregar.

### 5.4 Bíblia

Nenhuma mudança de schema. O store ganha uma ação de importação em lote com
progresso observável e erros por arquivo:

```ts
interface BibleImportError {
  file: string;
  error: string;
}

interface BibleBatchImportOptions {
  onProgress?: (done: number, total: number, file: string) => void;
  silent?: boolean; // não dispara toast por arquivo
}

interface BibleBatchImportResult {
  imported: BibleVersion[];
  errors: BibleImportError[];
}

importBibleFiles(
  paths: string[],
  options?: BibleBatchImportOptions,
): Promise<BibleBatchImportResult>;
```

`importBibleFile` individual ganha a opção `silent` para o lote não emitir um
toast por arquivo. As versões continuam sendo arquivos `.sqlite` em `bibles/`;
o backend atual já suporta importar um arquivo por chamada.

## 6. Comportamentos detalhados

### 6.1 Parser de letras e serialização

Regra:

| Texto | Resultado |
| --- | --- |
| `A\n\nB` | slide A, slide B |
| `A\n\n\nB` | slide A, slide vazio, slide B |
| `A\n\n\n\nB` | slide A, slide vazio, slide B |
| `\n\nA` | slide A (brancos iniciais ignorados) |
| `A\n\n\n` | slide A (brancos finais ignorados) |

Implementação em `src-tauri/src/services/lyrics.rs` e no espelho TypeScript
`src/features/songs/songEditorUtils.ts`:

- Ao encontrar uma linha em branco, o bloco atual é fechado (se tiver conteúdo).
- Se a linha anterior também era em branco e o bloco atual já foi fechado,
  insere um único slide vazio, desde que exista conteúdo antes e depois.
- Runs de três ou mais linhas em branco colapsam em um slide vazio.
- Blocos só de comentários (`//`) preservam o comportamento atual: a linha em
  branco continua sendo espaçamento, não slide vazio.
- `split_sections` não divide seções vazias; elas passam intactas.

Serialização `sections_to_text`:

- Blocos com conteúdo são unidos por `\n\n`.
- Um slide vazio entre dois blocos com conteúdo é serializado como um separador
  extra (`\n\n\n`), produzindo exatamente duas linhas em branco.
- Slides vazios no início/fim são descartados na serialização, porque o parser
  também os ignora.
- O round-trip `parse_sections(sections_to_text(sections))` deve devolver a
  mesma lista para seções vazias apenas entre blocos com conteúdo.

Editor e previews:

- `SongSlidesPreview`, `SongsPage` e o painel do setlist mostram
  `(Slide vazio)` quando `lines` está vazio.
- O editor de letras continua trabalhando no texto cru; apagar as duas linhas em
  branco remove o slide vazio.
- `assignSectionLabel` passa a usar a mesma regra de contagem. Rótulo em slide
  vazio é desabilitado na interface; se chamado por código, não altera o texto.
- No slide vazio, `title` é `""` e `buildProps` zera `next_*`, `next_preview` e
  `next_line` quando a letra atual está vazia. O `kind` continua `"lyric"`, para
  o telão tratar como apresentação ativa. Textos estáticos do próprio tema
  (nome da igreja, logo etc.) permanecem, pois são parte do visual.

### 6.2 Slide vazio no início da música

`buildSongSlides(song, options)` aceita `addEmptySlideAtStart`. A função:

- Prefixa um `RunnerSlide` sintético com `sectionIndex: null`, `isBlank: true`,
  `label: null`, `lines: []`, `title: ""` e `id: "${song.id}#empty-start"`.
- Mantém `sectionIndex` de cada seção real igual ao índice em `song.sections`.
- A opção é lida de um store `useSongDefaultsStore`, carregado a partir de
  `getSongDefaults()` e atualizado quando as preferências mudam. O valor vale
  para todas as músicas, sem alterar o texto salvo.
- Se a opção mudar com uma música ao vivo, o slide no ar não é reprojetado. A
  sequência é recalculada e o `runnerIndex` (e a seleção do controle remoto) é
  remapeado em +1 ao ligar ou −1 ao desligar, para próximo/anterior continuarem
  no lugar certo. Se o slide no ar for o próprio sintético e a opção for
  desligada, o índice vira `0` (primeiro slide real), sem trocar o conteúdo no
  ar.
- A sequência com o slide inicial é usada em: painel do setlist, runner,
  `projectSection`/próximo/anterior, publisher do controle remoto, página de
  músicas e preview do editor. O editor de texto não mostra o slide sintético.

Ações de edição no painel do setlist e no preview de músicas:

- Rótulo, dividir e reordenar usam `sectionIndex`; quando ele é `null`, a ação
  fica desabilitada. Isso vale para `SongSlidesColumn`, `SongSlidesPreview` e
  `SongsPage`.
- Arrastar o slide sintético é bloqueado.
- O slide vazio do início aparece como um grupo próprio "Slide vazio", para ser
  alcançado com um clique ou pelo número do slide.
- Slides vazios criados por duas linhas em branco também abrem um grupo próprio
  (não são absorvidos pelo grupo anterior), para ficarem fáceis de localizar.

### 6.3 Ocultar texto x mostrar apenas o fundo

Estados:

- `textHidden = true`: o telão público mantém o fundo e os elementos não textuais
  do tema; apenas os textos (letra, referência, título, próximo versículo) são
  esvaziados.
- `cleared = true`: o telão público esconde o slide inteiro e mostra o papel de
  parede do evento/saída quando existir; sem papel de parede, permanece o fundo
  do tema.
- Ao ligar `textHidden`, `cleared` é desligado; ao ligar `cleared`, `textHidden`
  é desligado.
- `publishLive` e `clearLive` resetam os dois estados de forma coerente:
  projetar um slide novo mostra o texto; "Limpar" mostra apenas o fundo.

Renderização:

- `SlideTransition` recebe `textHidden` e repassa para o renderer.
- `buildProps` recebe `hideText` e devolve os props de texto como strings
  vazias; `ScaledStage` recebe esses props e mantém os elementos visuais do
  tema.
- `SlideCanvas` (fallback sem tema) não renderiza título/linhas quando
  `textHidden`.
- `PublicView`, `StreamView` e o monitor "Ao Vivo" do `LivePreview` aplicam
  `textHidden`.
- No `StreamView`, o texto do lower third é esvaziado, mas a moldura/elementos
  do tema permanecem. Quem quiser esconder a transmissão inteira usa `F`.
- `StageView` ignora `textHidden`; o músico continua vendo a letra.
- O monitor "Preview" do `LivePreview` continua mostrando o texto, pois é a
  prévia do próximo slide.
- O preview do controle remoto reflete `textHidden` para não mostrar uma letra
  que já saiu do ar; os botões do controle remoto continuam como estão.

Botões e atalhos:

- `C` / "Ocultar texto" controla `textHidden`.
- `F` / "Plano de Fundo" controla `cleared`.
- Os dois botões deixam de compartilhar o mesmo estado visual.
- `C`, `B` e `F` globais só funcionam quando `live.content.kind !== "blank"`.
- **Foco manda:** o handler dos atalhos de grupo só intercepta a tecla quando o
  foco está dentro da coluna de letra/versículos e existe um grupo com aquele
  atalho. Fora da coluna, `AppTopBar` recebe a tecla e aplica o atalho global.
  Se o grupo não existir na música, o evento não é consumido e o global assume.
- O handler global ignora eventos dentro de `input`/`textarea`/
  `contenteditable` e de diálogos abertos.

### 6.4 Previews em slides

Componente compartilhado `SlideThumbnail`:

- Recebe `SlideContent`, tema resolvido e `showBackground`.
- Usa `kindToAsset`, `buildProps` e `ScaledStage` quando há tema; senão cai no
  `SlideCanvas` com um `LiveSlide` sintético.
- É memoizado e ocupa uma caixa `aspect-video` com `overflow-hidden`.
- A resolução do tema (evento → vínculo público → padrão) é extraída da lógica
  já usada em `LivePreview` para um hook compartilhado, evitando três cópias.

Painel de letra do setlist (`SongSlidesColumn`):

- Alternador "Lista | Slides" no cabeçalho, persistido em
  `open_presenter_setlist_song_view` (padrão `list`).
- Em "Slides", cada card mantém o cabeçalho de grupo e passa a mostrar a
  miniatura 16:9 no lugar da lista de linhas.
- Clique seleciona, duplo clique apresenta, arrastar reordena e o menu de
  contexto continua funcionando.
- Badges "Prévia"/"Ao Vivo" e o número do slide permanecem sobre a miniatura.

Painel de versículo do setlist (`ScriptureSlidesColumn`):

- Mesmo alternador, persistido em `open_presenter_setlist_scripture_view`
  (padrão `list`).
- Em "Slides", cada parte do versículo vira uma miniatura 16:9 com a referência
  e o badge de parte.

Aba Bíblia:

- Alternador "Lista | Slides" na barra da coluna de versículos, persistido em
  `open_presenter_bible_verses_view` (padrão `list`).
- Em "Slides", a lista vira uma grade responsiva de miniaturas 16:9
  (`1` coluna em telas estreitas, `2` em telas médias, `3` em telas largas).
- Cada card mostra o versículo no slide, a referência, a parte e os estados
  selecionado/ao vivo. Clique seleciona; duplo clique apresenta.
- A opção "Dividir versículos longos" continua valendo: cada parte é um card.

### 6.5 Livros da Bíblia em cards

- Alternador "Lista | Cards" no cabeçalho da coluna de livros, persistido em
  `open_presenter_bible_books_view` (padrão `list`).
- Em "Cards", a coluna de livros fica mais larga (`w-80` em telas médias,
  `w-96` em telas largas) e usa uma grade de 2 colunas (3 quando houver largura
  suficiente), com cartões que mostram nome, abreviação e quantidade de
  capítulos.
- Cada testamento tem uma cor de destaque sutil (AT âmbar, NT esmeralda), sem
  competir com o estado ativo.
- Filtros "Todos/AT/NT" e campo de filtro continuam acima da grade.
- O card ativo usa a mesma linguagem visual do item ativo da lista.
- Clicar no card seleciona o livro e abre o capítulo 1, como hoje.

### 6.6 Paleta de referências da Bíblia

Abertura por digitação:

- Com a aba Bíblia ativa, uma tecla imprimível (letra/número) sem `Cmd/Ctrl/Alt`
  e fora de `input`/`textarea`/`contenteditable`/modal abre a
  `BibleCommandPalette` já preenchida com essa tecla.
- O listener usa fase de captura para impedir que o atalho global reaja à mesma
  tecla, exceto nos casos de precedência abaixo.
- Se houver apresentação ativa (`live.content.kind !== "blank"`), `B`, `C` e `F`
  não são capturados: continuam executando blackout, ocultar texto e mostrar
  fundo. As demais teclas abrem a paleta. Como o foco está na Bíblia e não na
  coluna de letras, os atalhos de grupo da música não se aplicam.
- Sem apresentação ativa, qualquer tecla imprimível abre a paleta.
- `Cmd+K`/`Ctrl+K` continua abrindo a paleta.
- A paleta recebe uma prop `initialQuery` para abrir já preenchida.

Comportamento de confirmação (já existente, preservado e testado):

- `Enter` chama `goToVerse(..., autoPresent = false)`: carrega o capítulo,
  seleciona o versículo, coloca a prévia e **não** vai ao ar.
- `Shift+Enter` chama `goToVerse(..., autoPresent = true)`: apresenta o
  versículo.
- `Jo 3` → livro João, capítulo 3, versículo 1 selecionado.
- `Jo 3.16` e `João 3 16` → livro João, capítulo 3, versículo 16 selecionado.
- O parser atual já cobre esses formatos; entram testes unitários para travar a
  regressão.

### 6.7 Importação e gerenciamento de versões

Cabeçalho da Bíblia:

- O botão "Importar" e o ícone de lixeira saem.
- Entra um botão "…" (`MoreHorizontal`) com:
  - "Importar Bíblia…" — seletor nativo com `multiple: true`, filtros
    `.sqlite`, `.db`, `.json`.
  - "Gerenciar versões…" — abre o modal.
- O seletor de versão ativa permanece no cabeçalho.

Modal "Gerenciar versões":

- Lista as versões instaladas com nome, id/abreviação e badge "Ativa".
- Cada linha tem ação de excluir, com confirmação explícita.
- Excluir a versão ativa seleciona a próxima disponível; se não houver, limpa a
  leitura.
- Botão "Adicionar versões" abre o mesmo seletor múltiplo.
- Estado vazio com o botão de adicionar.
- Durante a importação, mostra progresso ("Importando 2 de 3…") e mantém o
  modal aberto.
- Ao final, mostra um resumo: versões importadas e erros por arquivo. Um único
  toast de resumo, em vez de um toast por arquivo.
- Versões com o mesmo id continuam substituindo o arquivo existente; o modal
  pode indicar "substituída" no resumo.

Store:

- `importBibleFiles(paths, options)` importa em sequência, chama
  `onProgress(done, total, file)` a cada arquivo, atualiza a lista uma vez,
  seleciona a primeira versão importada se não houver ativa e devolve
  `{ imported, errors: { file, error }[] }`.
- `importBibleFile` individual continua existindo para usos pontuais e aceita
  `silent` para não emitir toast por arquivo.
- O modal usa `onProgress` para a mensagem "Importando 2 de 3…" e o resumo final
  usa `errors` com o nome do arquivo.

### 6.8 Painéis redimensionáveis

Layout da aba Apresentação:

- Programação (esquerda): largura controlada por `setlistWidth`.
- Letra/versículos (centro): largura controlada por `slidesWidth`.
- Monitores (direita): `flex-1`, ocupa o restante.
- Trilho de temas: largura fixa, como hoje.

Divisores:

- Componente `ResizeHandle` com `pointerdown`/`pointermove`/`pointerup`,
  `setPointerCapture`, cursor `col-resize` e área de acerto de 6 px.
- Arrastar para a esquerda/direita ajusta a largura da coluna anterior.
- Limites: programação 240–480 px; letra/versículos 280–640 px.
- Duplo clique restaura o padrão (320/384).
- Setas do teclado ajustam 16 px quando o divisor está focado (acessibilidade).
- Quando a programação está recolhida, o divisor dela não aparece e a coluna usa
  a largura do trilho recolhido.

Persistência:

- `usePanelLayoutStore` salva larguras e visibilidade em `localStorage`.
- Ao carregar, valores são limitados às faixas.
- Em janelas menores, as larguras são limitadas para não esmagar o painel de
  monitores; o centro pode encolher até o mínimo.

### 6.9 Ocultar o painel de monitores

- Botão "Monitores" na barra superior, visível apenas na aba Apresentação, com
  ícone de painel aberto/fechado e estado ativo.
- `monitorsVisible = false` remove o `<section>` do `LivePreview` e o divisor
  correspondente.
- A coluna de letra/versículos passa a `flex-1`, ocupando o espaço liberado.
- O estado é persistido; ao reabrir o app, o painel continua oculto se foi
  ocultado.
- Os estados individuais de Prévia/Ao Vivo/Retorno e o zoom não são alterados.

## 7. Ordem de entrega

A ordem segue a dor do operador: primeiro o que resolve o improviso, depois o
que mostra o resultado, depois a Bíblia e por fim o layout.

1. **F1 — Slides vazios e controle de texto**
   Parser, serialização, opção global, slide inicial, `textHidden` e a separação
   "ocultar texto" / "só fundo".
2. **F2 — Previews em slides e livros em cards**
   `SlideThumbnail`, alternadores do setlist e da Bíblia, cards de livros.
3. **F3 — Bíblia: paleta e versões**
   Digitação abre a paleta, precedência de atalhos, importação múltipla e modal
   de gerenciamento.
4. **F4 — Layout**
   Painéis redimensionáveis e ocultação do painel de monitores.

Cada fase deve passar `npm run typecheck`, os testes existentes e
`cargo check -p open-presenter` quando mexer no Rust. As fases são independentes
o suficiente para entrar em commits separados.

## 8. Critérios de aceite

### Slides e texto

- [ ] `A\n\nB` gera dois slides; `A\n\n\nB` gera três, com o do meio vazio.
- [ ] Três ou mais linhas em branco continuam gerando um único slide vazio.
- [ ] Linhas em branco no início/fim não geram slides.
- [ ] Músicas existentes com uma linha em branco continuam iguais.
- [ ] Salvar e reabrir uma música com slide vazio preserva o slide.
- [ ] A opção "Adicionar slide vazio no início" aparece em Configurações →
      Músicas, fica salva e vale para músicas antigas.
- [ ] O slide inicial aparece no setlist, no runner e no controle remoto, mas
      não no editor de texto.
- [ ] Rótulo/dividir/reordenar não deslocam por causa do slide inicial.
- [ ] O slide vazio não mostra título nem prévia do próximo; mantém só o fundo e
      os elementos do tema.
- [ ] Alternar a opção com música ao vivo não troca o slide no ar; próximo e
      anterior continuam corretos.
- [ ] `C` oculta só o texto; o fundo do tema permanece.
- [ ] `F` mostra o papel de parede; sem papel de parede, o fundo do tema.
- [ ] `C` e `F` têm estados visuais distintos e são mutuamente exclusivos.
- [ ] O palco continua vendo a letra com `textHidden`.
- [ ] `StreamView` também oculta o texto; o palco não.
- [ ] Com foco na coluna de letras e Refrão configurado em `C`, `C` pula para o
      refrão; com foco fora da coluna, `C` oculta o texto.
- [ ] Com foco na coluna de letras e música sem grupo `C`, `C` oculta o texto.

### Previews e Bíblia

- [ ] O painel de letra do setlist alterna lista/slides e lembra a escolha.
- [ ] O painel de versículo do setlist alterna lista/slides e lembra a escolha.
- [ ] As miniaturas usam o tema do evento/vínculo público e atualizam quando o
      tema muda.
- [ ] Clique, duplo clique, arrastar e menu de contexto continuam funcionando
      no modo slides.
- [ ] A Bíblia alterna versículos entre lista/slides e lembra a escolha.
- [ ] Os livros alternam lista/cards e lembram a escolha.
- [ ] Filtrar por AT/NT e por texto funciona nos dois modos.
- [ ] Digitar `Jo 3` na Bíblia abre a paleta, seleciona o capítulo 3/versículo 1
      e não apresenta.
- [ ] `Shift+Enter` apresenta o versículo selecionado.
- [ ] `jo 3.16` e `João 3 16` selecionam o versículo 16.
- [ ] `B/C/F` só disparam com apresentação ativa; sem apresentação, digitar
      abre a paleta.
- [ ] O menu "…" tem importar e gerenciar versões; a lixeira sumiu.
- [ ] É possível selecionar e importar vários arquivos de uma vez.
- [ ] O modal lista, exclui e adiciona versões; excluir a ativa escolhe outra.
- [ ] Durante o lote, o modal mostra "Importando 2 de 3…".
- [ ] Falha em um arquivo não impede os demais; o resumo mostra o nome do
      arquivo e o erro.

### Layout

- [ ] Arrastar os divisores redimensiona programação, letra/versículos e
      monitores.
- [ ] Duplo clique restaura as larguras padrão.
- [ ] As larguras sobrevivem a recarregar o app.
- [ ] O botão "Monitores" oculta o painel por completo.
- [ ] Ao ocultar, a coluna de letra/versículos ocupa o espaço liberado.
- [ ] O estado oculto sobrevive a recarregar o app.
- [ ] Os controles internos de monitor (Prévia/Ao Vivo/Retorno/zoom) continuam
      funcionando quando o painel volta.

## 9. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| O parser novo quebrar músicas existentes | Testes de round-trip e de regressão para uma linha em branco; a regra só muda com duas ou mais. |
| O slide sintético deslocar índices de edição | `sectionIndex` separado de `index`; ações desabilitadas quando `null`; testes no painel. |
| `textHidden` dessincronizar Rust/TS | Campo com `serde(default)`; testes de serialização; atualizar todos os construtores de `LiveSlide`. |
| Miniaturas de tema pesarem no setlist | `React.memo`, `content-visibility: auto` e limite de resolução do card. |
| Resolução de tema duplicada em três lugares | Extrair hook compartilhado a partir de `LivePreview` e reutilizar. |
| Conflito entre digitação, grupos e atalhos globais | Regra "foco manda": grupos só interceptam com foco na coluna de letras; B/C/F globais com apresentação ativa; demais teclas abrem a paleta na Bíblia. |
| Importação parcial de versões | Importação sequencial com progresso e resumo por arquivo; falhas não interrompem o lote. |
| Painéis esmagarem em telas pequenas | Limites mínimos/máximos e clamp ao carregar; monitores podem ser ocultados. |

## 10. Testes previstos

- Rust: `parse_sections` com uma, duas, três ou mais linhas em branco,
  comentários, round-trip de `sections_to_text`, `split_sections` com seção
  vazia.
- TS: `buildSongSlides` com e sem slide inicial; `sectionIndex` correto;
  `computeSlideGroups` separando slides vazios; `assignSectionLabel` com slides
  vazios.
- TS: `parseBibleReference` para `Jo 3`, `Jo 3.16`, `João 3 16`, `1 Jo 1:9`,
  referências inválidas.
- TS: serialização de `LiveSlide` com `textHidden` (se houver teste de contrato
  compartilhado).
- Manual/integração: alternadores de visualização, redimensionamento, ocultação
  do painel, importação múltipla e apresentação com texto oculto.

## 11. Perguntas em aberto

Nenhuma pergunta bloqueante. A única decisão de produto em aberto era a
precedência dos atalhos `C`/`B`/`F`; você escolheu **foco manda**. As demais
lacunas foram fechadas como decisões de construção e estão marcadas na seção 4.
As decisões de padrão (opção desligada, lista como modo inicial, larguras
padrão) podem ser revistas na aprovação.
