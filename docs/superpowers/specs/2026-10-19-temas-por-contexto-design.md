# Temas por contexto (páginas) — desenho

Data: 2026-10-19
Status: aprovado

## Intenção e porquê

Hoje um tema atende uma única área: letra, Bíblia ou texto. Para manter a mesma
identidade visual num culto inteiro, o operador cria um tema para a letra e
quase-iguala outros para Bíblia e texto. Cada festividade gera uma pilha de
temas parecidos, difícil de achar e de manter, e não fica claro o que cada tema
cobre.

A mudança transforma o tema num contêiner com **páginas por contexto**. Um único
tema pode ter uma página para Música, uma para Bíblia e uma para Texto, cada uma
com fundo e camadas próprios. O tema é escolhido uma vez (no evento) e o programa
usa a página do tipo de mídia que está sendo exibido. Se a página não existir,
cai no tema definido nas configurações para aquela área.

## Escopo desta entrega

- Páginas por contexto nos temas públicos: `music` (letra), `bible`, `text`.
- Barra de páginas colapsável no editor, com slots fixos por contexto.
- Criar página copiando a atual ou em branco.
- Renomear camadas.
- Tema padrão por evento, aplicado quando o evento está ativo.
- Fallback para o vínculo das configurações.
- Exportar/importar tema no formato v2 (com páginas), mantendo importação de
  arquivos v1.
- Badge de versão no editor e atualização de tema v1 para v2.
- Atualizar a skill `.agents/skills/open-presenter-theme-creator` para o formato
  v2.

## Fora de escopo

- Mais de uma página por contexto.
- Agenda (ou outros tipos futuros) como contexto — o modelo deve permitir
  adicionar depois.
- Monitor de palco e tela de descanso como páginas do tema do evento. Continuam
  sendo temas próprios, escolhidos separadamente.
- Apresentações do Studio: continuam artes autocontidas, com o tema embutido.
- Escolha de tema pelo controle remoto.
- Migração automática dos temas antigos (o autor vai apagar os temas atuais e
  recriar no formato novo).

## Decisões tomadas pelo autor

- A barra usa **slots fixos por contexto**, sempre visíveis: os contextos que
  ainda não existem aparecem tracejados com "+". Bate o olho e se sabe o que o
  tema cobre.
- "Nova página" copia fundo e camadas da página atual; um menu ao lado oferece
  "Página em branco".
- Os contextos iniciais são Bíblia, Música (letra) e Texto. O modelo deve
  aceitar novos contextos no futuro.
- O tema padrão é definido **no evento**; quando o evento está ativo, sua
  identidade vale para o que for apresentado.
- Se o tema selecionado não tiver a página do contexto exibido, usar o tema
  definido nas configurações.
- Apresentações do Studio não seguem o tema cadastrado; usam o design da própria
  apresentação.
- O export/import precisa acompanhar o novo padrão.

## Modelo de dados

### Tema

```ts
type ThemeContext = "music" | "bible" | "text";

interface ThemePage {
  id: string;
  context: ThemeContext;
  css: Record<string, string>; // inclui o background da página
  elements: ThemeElement[];
}

interface SlideTheme {
  guid: string;
  title: string;
  category: "theme" | "stage" | "presentation" | string;
  css: Record<string, string>; // usado por temas de página única (stage/presentation)
  elements: ThemeElement[]; // idem
  pages?: ThemePage[]; // presente em temas públicos multi-contexto
  createdAt?: string;
  updatedAt?: string;
}
```

- Tema público novo nasce com `pages` (no mínimo uma página) e pertence à
  categoria `theme`.
- Tema de retorno/descanso passa a usar `category: "stage"` e layout único no
  topo (`css`/`elements`), sem páginas.
- Apresentação continua `category: "presentation"` e layout único.
- `ThemeElement` ganha `name?: string` para o nome editável da camada. O nome é
  cosmético; `id` continua sendo a chave.
- A página tem um `context` único por tema. Não pode haver duas páginas do mesmo
  contexto.

### Evento

- `ServiceEvent` e `EventSummary` ganham `themeGuid?: string | null`.
- O valor é persistido no JSON do setlist (`StoredEvent.themeGuid`), sem
  migração de banco.
- `null`/ausente = usar os vínculos das configurações.

## Comportamento ao vivo

Ponto único de decisão: `useLiveThemesPublisher` (janela admin), que publica o
tema resolvido para todas as saídas via `setLiveThemes`.

Ordem de resolução para o telão público:

1. Slide de apresentação (mídia com `media.themeId`): usa o tema embutido da
   apresentação. Nada muda.
2. Conteúdo de contexto (`lyric`, `scripture`, `custom`):
   a. Se há evento ativo com `themeGuid` e o tema tem a página do contexto, usa
      essa página.
   b. Senão, usa o tema vinculado nas configurações para a área; se ele tiver a
      página do contexto, usa essa página.
   c. Senão, usa o tema padrão embutido daquele contexto.
3. `media` sem `themeId` e `blank`: o resolvedor devolve `null` — nenhum
   tema é aplicado; vale o fundo publicado (`live.background`) e a cadeia das
   saídas (`broadcastTheme ?? localTheme`) precisa aceitar `null` sem quebrar.
4. `media.themeId` apontando para um tema com páginas (ex.: aviso de texto):
   usa a página do contexto correspondente (`custom` → Texto). Apontando para
   uma apresentação (layout único), usa o layout do topo, como hoje.

O tema resolvido é materializado como um `SlideTheme` efêmero
(`{ ...tema, css: page.css, elements: page.elements }`), de modo que renderer,
transições e saídas continuem consumindo o mesmo formato de hoje.

Tema público v1 (sem `pages`) é universal: quando vinculado nas configurações
ou definido num evento, aplica-se a qualquer contexto, preservando o
comportamento antigo. O seletor de evento lista apenas temas com páginas, mas
vínculos antigos de v1 continuam funcionando até serem atualizados ou
substituídos.

O monitor de palco continua usando `resolveStageTheme()` e o evento não
interfere nele. Como os temas públicos passam a ter páginas, o palco ganha
salvaguardas: os seletores de retorno/descanso listam temas
`category: "stage"` e temas de layout único antigos (sem `pages`); o fallback
de `resolveStageTheme()` nunca devolve um tema só-com-páginas (que renderizaria
vazio). O menu de criação de temas ganha "Tema de Retorno (Stage)", que cria um
tema de layout único na categoria `stage`.

O tema do evento entra em vigor sempre que o evento está **selecionado** —
inclusive quando o app abre e seleciona automaticamente o próximo evento da
agenda, e quando o operador cria um evento. Ao trocar para a lista temporária ou
selecionar outro evento, o vínculo muda junto. Se o evento ativo for excluído, o
app seleciona o próximo (ou cai na lista temporária) e o tema acompanha.

## Editor de temas

### Modo com páginas (categoria `theme`)

- Barra inferior colapsável, no estilo da referência do Canva.
- Slots fixos, na ordem: Música (Letra), Bíblia, Texto.
- Slot com página: miniatura viva da página (renderer reduzido com os dados de
  exemplo do contexto), nome do contexto e destaque na página ativa.
- Slot vazio: contorno tracejado com "+" e o nome do contexto.
- Clicar num slot vazio abre um menu com "Duplicar página atual" (copia fundo e
  camadas, gera novos ids de elemento) e "Página em branco" (sem elementos,
  fundo preto).
- Clicar num slot preenchido troca a página ativa; o canvas, as propriedades e o
  preview passam a refletir aquela página.
- Menu "…" na miniatura permite remover a página (a última não pode ser
  removida).
- O seletor de amostra existente (Música/Bíblia/Texto) deixa de ser manual: o
  contexto da página ativa define a amostra. No modo de página única
  (stage/presentation), o seletor continua como hoje.
- O chevron colapsa a barra para uma faixa fina; o estado é persistido em
  `localStorage`.

### Camadas

- Duplo clique no nome da camada, no painel de camadas, entra em edição inline.
- O nome aparece na lista; sem nome, usa o rótulo derivado do tipo/id como hoje.
- Renomear não altera o conteúdo nem o comportamento da camada.

### Versão do tema e atualização

- O cabeçalho do editor mostra um badge com a versão do tema:
  - **v2** (verde): tema público com `pages`;
  - **v1** (âmbar): tema público de layout único, sem `pages`;
  - **Layout único** (neutro): tema de retorno ou apresentação, que não passa
    por páginas.
- A versão é inferida da presença de `pages`; não é um campo novo no schema.
- Tema v1 mostra o botão **"Atualizar para v2"**: pede o contexto
  (Música/Bíblia/Texto), move `css`/`elements` do topo para uma página nova
  desse contexto e passa a exibir a barra de páginas. O visual não muda.
- Arquivos v1 importados entram como tema v1, com o badge e a opção de
  atualizar; a importação não força a escolha de contexto.

### Lista de temas e seleção

- Cada card de tema público mostra quais contextos cobre (ex.: "Letra · Bíblia"
  ou "3 contextos").
- Os vínculos das configurações continuam por área e passam a aceitar apenas
  temas públicos.
- O seletor de tema do evento lista apenas temas públicos com páginas e inclui a
  opção "Usar configurações".

## Evento

- Campo "Tema do evento" nos diálogos de criar/editar/ver evento da Agenda.
- O seletor mostra título e cobertura de contextos.
- Ao selecionar o evento, inclusive na seleção automática da abertura, o tema
  escolhido passa a valer para a projeção pública.
- O evento pode ter tema mesmo sem páginas para todos os contextos; a ausência
  aciona o fallback das configurações.
- O tema é apenas uma referência: excluir o evento não exclui o tema. O diálogo
  de exclusão ganha um checkbox "Excluir também o tema vinculado", desmarcado
  por padrão.
- Sem nenhum evento, o app vai para a lista temporária; deixa de criar o
  "Culto de Domingo" automático.

## Exportar / importar

### Formato v2

```json
{
  "format": "open-presenter-theme",
  "version": 2,
  "exportedAt": "2026-10-19T00:00:00.000Z",
  "theme": {
    "title": "Festividade das Irmãs",
    "category": "theme",
    "pages": [
      { "id": "...", "context": "music", "css": {}, "elements": [] },
      { "id": "...", "context": "bible", "css": {}, "elements": [] }
    ]
  }
}
```

- Exportar sempre em v2, com `name` das camadas.
- Temas de layout único (retorno e apresentações) exportam em v2 sem `pages`,
  mantendo `css`/`elements` no topo — o formato v2 aceita os dois modos.
- Tema público v1 também exporta sem `pages`; ao reimportar, volta como v1 e
  pode ser atualizado no editor.
- Importar v2: valida formato, contextos válidos/únicos, elementos e gera novo
  GUID.
- Importar v1 (arquivo antigo, sem `pages`): entra como tema v1 (ou layout
  único, se for retorno/apresentação), sem forçar escolha de contexto. O badge
  v1 e o botão "Atualizar para v2" aparecem no editor.
- Backup em lote (`exportThemesBackup`) também passa a v2.

### Skill de temas

Atualizar `.agents/skills/open-presenter-theme-creator`:

- `references/theme-schema.json` para v2/pages.
- Exemplos para v2 com páginas.
- Instruções (`SKILL.md`, prompt para outras IAs) explicando contextos e
  fallback.
- `scripts/validate-theme.mjs` validando v2 e reconhecendo v1.

## Padrões embutidos (seed)

- Um único tema público padrão multi-contexto ("Tema Padrão") com páginas de
  Música, Bíblia e Texto, substituindo os três padrões separados.
- Temas padrão de retorno e descanso permanecem, agora com `category: "stage"`.
- Os vínculos iniciais de letra, Bíblia e texto apontam para o tema padrão.
- Temas antigos que sobrarem não são migrados; continuam abrindo em modo de
  página única com badge v1 e podem ser atualizados para v2 ou apagados.

## Mudanças técnicas

### Rust

- `SlideTheme`: `pages: Option<Vec<ThemePage>>`; `ThemePage { id, context, css,
  elements }`; `ThemeElement.name: Option<String>`.
- Validação em `save_theme`:
  - com `pages`: ao menos uma página, contextos válidos e únicos; página em
    branco permitida (sem elementos);
  - sem `pages`: mantém a exigência atual de ao menos um elemento.
- `ServiceEvent`/`EventSummary`: `themeGuid`; `StoredEvent` e `serialize_setlist`
  / carga de eventos atualizados; consulta de resumo com `json_extract`.
- Testes unitários de validação e serialização.

### Frontend

- Tipos sincronizados em `src/core/types`.
- `resolveTheme` passa a considerar páginas + tema do evento; a lógica pura vai
  para um módulo testável (ex.: `themeResolution.ts`).
- `ThemeEditorView` ganha o modo páginas e a barra; `LayersPanel` ganha rename.
- `ThemesTab` ganha badges de cobertura, criação por contexto e import v1/v2.
- `useLiveThemesPublisher` resolve e publica a página efetiva.
- Store de temas ganha o GUID do tema do evento ativo, alimentado pela seleção
  de evento.

### Testes

- `node --test` para resolução (evento → vínculo → padrão) e para parse/export
  v1/v2.
- `cargo test` para validação de tema e serialização de evento.
- `npm run typecheck` e `cargo check -p open-presenter`.
- Verificação manual: tema com 3 páginas, evento com tema, projeção de música,
  versículo e texto; remoção de página; fallback; round-trip de export/import.

## Critérios de aceite

1. Um tema público pode ter páginas independentes de Música, Bíblia e Texto.
2. A barra de páginas mostra slots fixos, permite criar copiando ou em branco,
   alternar, colapsar e remover (menos a última).
3. Camadas podem ser renomeadas e o nome persiste.
4. Um evento pode definir um tema; ao ativá-lo, a projeção pública usa a página
   do contexto exibido.
5. Contexto ausente no tema do evento cai no tema das configurações; ausente
   também lá, cai no padrão embutido.
6. Apresentações continuam usando o próprio design; palco/descanso continuam
   independentes.
7. Exportar/importar v2 preserva páginas, fundos, camadas e nomes; v1 importa
   como tema v1 e oferece atualização para v2.
8. O editor mostra o badge de versão (v1, v2 ou Layout único) e permite
   atualizar tema v1 para v2 escolhendo o contexto.
9. Skill de temas atualizada para v2.

## Chamadas do construtor (para conferir na leitura)

- Categoria `stage` para separar retorno/descanso dos temas públicos; criação
  "Tema de Retorno (Stage)" no menu; seletores de palco filtram por
  `stage` ou layout único antigo; fallback do palco nunca cai num tema
  só-com-páginas.
- Página em branco com fundo preto e zero elementos; salvar é permitido.
- Seletor de evento lista somente temas públicos com `pages`.
- Tema do evento ativo vale também para itens avulsos apresentados enquanto o
  evento está selecionado.
- A seleção automática do próximo evento na abertura do app ativa o tema do
  evento.
- Import v1 preserva o tema como v1, sem seletor de contexto; a conversão
  acontece pelo botão do editor, que pergunta o contexto.
- Badge de versão no cabeçalho do editor; "Atualizar para v2" disponível para
  tema público sem `pages`; retorno e apresentações mostram "Layout único".
- v2 aceita tema de layout único (sem `pages`) para retorno e apresentações.
- `media` sem `themeId` e `blank` resolvem `null` (nenhum tema aplicado).
- `media.themeId` de um tema com páginas usa a página do contexto do item.
- Seed de um único tema público padrão com três páginas.
- Miniaturas são renderizações vivas reduzidas, não imagens estáticas.
- Em modo web sem publisher Tauri, o tema do evento não é sincronizado para
  saídas abertas em outro navegador; o vínculo por configurações continua
  valendo.
