# Design — Operação ao vivo: Temporário, grupos, atalhos, importação e remote ampliado

- **Data:** 2026-10-18
- **Branch sugerida:** `feature/operacao-ao-vivo` (fases podem virar PRs separados)
- **Status:** aprovada em 2026-10-18
- **Referências:** spec v1 `2026-10-15-letras-e-setlist-design.md`; arquivos Holyrics de teste: `2026-10-18_00-17-04.json` (array com 3 músicas; `paragraphs[].description` vazia) e `A Boa Parte (…).json` (objeto único)

## 1. Intenção (o porquê)

No culto real, a operação raramente é só "seguir a programação no computador":

1. **O imprevisto** — alguém é chamado para cantar sem aviso. Quem opera a projeção está com o celular na mão (remote). Precisa achar a música na biblioteca **ou** buscar a letra na internet, salvar já no formato de projeção e apresentar — sem ir ao computador. E o registro do que foi cantado precisa ficar na programação do culto.
2. **Recados em imagem** — dados bancários, agenda da semana. Estão na biblioteca de imagens; o operador precisa achar e projetar do celular na hora.
3. **Lista avulsa** — nem toda projeção é um culto programado: ensaio, teste, "só quero projetar isso agora". Falta um **Temporário** sempre à mão, paralelo ao evento selecionado.
4. **Projetar com teclado** — número + Enter vai direto ao slide; letra do rótulo (V, C…) pula de grupo em grupo. Números valem também para textos e imagens.
5. **Ler a música no painel** — uma estrofe pode virar vários slides (ex.: 2 linhas por slide) e os slides seguintes ficam "soltos", sem indicação de que são a mesma estrofe. Precisa agrupar visualmente (caixa na cor do rótulo) e navegar por grupo.
6. **Importação Holyrics** — hoje: array importa (mas sem rótulos quando o export não traz `description`), **objeto único falha**, e a copy promete `.pro`/múltiplos arquivos que não existem.

## 2. Decisões do dono do produto (validadas nesta conversa)

- **Temporário é lista paralela, sempre disponível** — não é fallback "só quando não tem evento".
- **Remote não edita a programação**, com uma exceção deliberada: a música do imprevisto **entra na programação ativa** como registro do que foi cantado.
- **Sidebar no remote** com Programação / Músicas / Imagens.
- **Músicas no remote**: buscar na biblioteca **ou** pesquisar na internet (LRCLIB), **salvar já no padrão de linhas por slide** e apresentar.
- **Configuração nova**: padrão de **linhas por slide** das músicas (ex.: 1 ou 2).
- **Imagens no remote**: achar na biblioteca e projetar (aviso/agenda).
- **Número + Enter** para navegar nos slides; **atalho por rótulo** (verso/refrão…) para navegar por grupo; números também em **texto e imagem**.
- **Rótulo agrupa**: slides seguintes sem rótulo pertencem ao grupo até o próximo rótulo; o grupo fica **visível**.

## 3. Decisões do builder (ajustáveis — me diga se alguma incomoda)

| # | Decisão | Racional |
|---|---------|----------|
| D1 | Import: aceitar **objeto único e array**; seletor aceita **vários arquivos** no mesmo diálogo (relatório agregado) | exports variam; a copy já promete múltiplos (hoje mente); evita N diálogos |
| D2 | `.pro` **fora**; copy corrigida para `.json` e `.txt` | nunca funcionou; nenhum arquivo de teste em `.pro` |
| D3 | Import **não inventa rótulo**: `description` vazia → seção sem rótulo (como hoje); rotulagem é manual no editor | Holyrics exportou sem `description`; heurística ("repetido = Refrão") é adivinhação |
| D4 | **Linhas por slide** vira configuração global (Preferências → Músicas): `1` · `2` · `estrofe inteira`; **default 2**; aplicada ao **importar** e ao **salvar da internet** (não re-quebra músicas existentes) | é exatamente o pedido; "2" espelha as músicas do usuário nas capturas |
| D5 | Temporário = **evento reservado** (`id = __temporary__`) na mesma tabela, mesma estrutura (partes/itens) — sem migração de schema; filtrado das listas de eventos | reusa modelo, persistência e componentes |
| D6 | Grupo de slides = seção com rótulo + seções seguintes **sem rótulo** (derivado, **não persistido**); caixa visual na cor do rótulo; seção com rótulo sempre abre grupo novo (mesmo repetindo o tipo) | é literalmente a regra descrita; derivar evita sujar dados |
| D7 | Números: buffer de **1–3 dígitos** com indicador visível; **Enter** navega (projeta se a apresentação estiver ativa; senão prévia + scroll); **Backspace** apaga; **Esc**/clique limpa; atalhos de letra existentes permanecem | padrão de softwares de projeção; teclas distintas, sem conflito |
| D8 | O **servidor embutido ganha acesso ao SQLite** (`Arc<Db>` no `ServerState`) para **ler** (busca de músicas, slides) e **escrever músicas** (salvar do LRCLIB); **eventos nunca são escritos pelo servidor** | o celular só fala com o servidor; o banco de eventos continua com um único escritor (o desktop) |
| D9 | **Montagem de slides de música também no Rust** (`services/slide_builder`, espelho de `core/lib/lyrics.ts`: rótulo por grupo, numeração "Verso 1/2", refrão sem número) | o imprevisto não está no snapshot do evento; apresentar exige montar do banco |
| D10 | Registro do imprevisto: ao "apresentar", o servidor publica o slide e **pede o registro ao desktop** (evento Tauri com o `songId`); o desktop anexa o item à lista ativa e salva | escritor único do banco de eventos — sem corrida com edições não salvas do desktop (o `saveEvent` sobrescreve o documento inteiro) |
| D11 | Imagens no remote: **mesma árvore** da biblioteca (`theme-media/library`), miniaturas pela rota já existente `/theme-media/...`; apresentar direto por rota própria (`POST /api/v1/present-image`, caminho validado dentro da biblioteca); **sem registro automático** na programação | não é repertório; a infra de servir arquivos ao celular já existe |
| D12 | Sidebar do remote: **rail fixo** com 3 botões (ícone + rótulo); Programação = conteúdo atual; mobile-first | celular; mantém o que já funciona |
| D13 | Ao dividir uma seção em fragmentos (por `linhas por slide` ou pela ação manual "Dividir em 1/2 linhas"), **só o primeiro fragmento mantém o rótulo**; os demais viram seções sem rótulo e são absorvidos pelo grupo | sem isso, dividir uma estrofe viraria "Verso 1"/"Verso 2" para as duas metades da mesma estrofe |
| D14 | O remote **espelha a lista ativa** (evento ou Temporário) e o registro do imprevisto vai para essa **lista ativa** | o Temporário é lista de verdade ("sempre disponível"); evita estados especiais e mantém o histórico no lugar certo (ensaio no ensaio, culto no culto) |

## 4. Goals / Non-goals / Anti-goals

**Goals**
- G1 Grupos de slides (desktop, coluna de música): caixa visual agrupando rótulo + slides sem rótulo, na cor do rótulo; navegação por letra pula ao **início de cada grupo**; setas continuam slide a slide.
- G2 Atalhos numéricos com indicador; Enter navega/projeta; vale em música, **texto e imagem**; letras de rótulo permanecem na música.
- G3 Temporário: seletor de lista no SetlistSidebar ([evento] / [Temporário]), sempre presente, capacidades completas, apresentável, mover itens Temporário ↔ evento, persistido.
- G4 Importação: objeto único e array; múltiplos arquivos; copy correta; relatório agregado; testes com os dois formatos observados.
- G5 Config "linhas por slide" em Preferências → Músicas (persistida no Rust), aplicada ao importar e ao salvar da internet.
- G6 Remote: sidebar (Programação / Músicas / Imagens); Músicas (busca na biblioteca + busca online + salvar + apresentar + registrar); Imagens (árvore + apresentar).
- G7 Contratos: rotas novas em `/api/v1/*` com o mesmo token do remote; escritas do servidor (músicas salvas do LRCLIB) notificam o desktop para atualizar a lista; eventos seguem com escritor único (o desktop).

**Non-goals (v2)** — não construir agora: edição geral da programação pelo remote (criar/remover/reordenar); upload de arquivos pelo celular; `.pro`; auto-rotulagem heurística; histórico/relatório separado do culto (o registro na programação cobre); modo "avançar atravessando grupos" (setas seguem slide a slide); novo provedor de letras além do LRCLIB.

**Anti-goals** — sucesso não pode custar:
- A1 Quebrar contratos existentes: `HashRouter`, tipos Rust↔TS, porta 5050, rotas atuais, canal `presentation://slide`.
- A2 Espelhar a lógica de rótulos em TS e Rust de forma divergente — casos de teste idênticos nos dois lados.
- A3 Escrita arbitrária pelo remote: só as ações do fluxo, atrás do token; nada de endpoint de mutação genérico.
- A4 Servir caminho fora de `media_dir` (manter a validação existente).
- A5 Dependências novas (stack pinada; nenhuma dep nova prevista).

## 5. Constraints

- AGENTS.md: feature-based + SOLID; `core/` shared kernel; tipos Rust↔TS sincronizados; comandos IPC registrados com wrapper tipado em `src/core/ipc/commands.ts`; strings pt-BR; Conventional Commits; Gitflow.
- Stack pinada; sem infra de teste no front → unidade no Rust (`cargo test`); front validado por `npm run typecheck` + uso.
- Escritas no SQLite (desktop + servidor) são serializadas pelo mutex único do processo — nunca segurar o lock durante I/O de rede.

## 6. Como fica

### 6.1 Grupos de slides e "linhas por slide" (a espinha)

Modelo (tudo derivado, nada persistido):

- Slide de música nasce de uma seção de letra (como hoje). O `label` aparece só no **primeiro** slide do grupo.
- **Grupo** = seção com rótulo + todas as seções seguintes **sem rótulo**, até a próxima seção com rótulo. Seção com rótulo sempre abre grupo novo (mesmo repetindo o tipo).
- Numeração ("Verso 1", "Verso 2"; Refrão nunca numera) continua como hoje, por seção rotulada — `computeSectionLabels` não muda.
- **Visual** (`SongSlidesColumn`): um container por grupo com borda e fundo suaves na cor do rótulo (ex.: `border-[cor]/40` + `bg-[cor]/5`, cantos arredondados) envolvendo os slides do grupo; chip do rótulo no primeiro slide; os demais ficam sem chip, com separador discreto.
- **Navegação por letra**: alvos = início de grupo (efeito já válido hoje, pois slides sem rótulo não casam); documentar no `ShortcutsView`.
- **Linhas por slide** (D4/D13): ao importar ou salvar da internet, cada seção é quebrada em fragmentos de N linhas; só o primeiro fragmento mantém o `section_type`; os demais viram seções sem rótulo (absorvidas pelo grupo). A ação manual "Dividir em 1/2 linhas" segue a mesma regra.
- Músicas existentes ficam intocadas (o agrupamento é só exibição; a biblioteca atual já segue o padrão "seção rotulada + seção sem rótulo" na maioria dos casos).

### 6.2 Atalhos (desktop)

- **Números 0–9**: buffer de 1–3 dígitos com indicador flutuante (ex.: "→ 12"); **Enter** vai ao slide (apresentação ativa → projeta; senão → prévia + scroll); **Backspace** apaga o último dígito; **Esc**/clique fora limpa.
- Vale nas três colunas: `SongSlidesColumn`, `MediaSlidesColumn` (texto e imagem). Mesmas guardas atuais (ignora inputs/diálogos).
- **Letras de rótulo** permanecem na música (V, C, B…, configuráveis em Preferências → Músicas).
- `ShortcutsView` atualizado com os dois grupos.

### 6.3 Temporário (desktop)

- Registro reservado `__temporary__` (título "Temporário") em `service_events`, mesma `setlist_json`; get-or-create ao abrir o painel; `list_events` exclui o reservado.
- `SetlistSidebar`: **seletor de lista** no topo (evento ativo | Temporário), com o Temporário sempre visível; mesmas ações de hoje (adicionar música/texto/mídia, reordenar).
- Ação de item **"Mover para…"**: evento ↔ Temporário (append na última parte do destino; cria parte "Avulsas" se o destino não tiver partes).
- Apresentação do Temporário usa o fluxo atual do runner — nenhum caminho novo.
- No remote, o Temporário aparece quando estiver selecionado (espelho da lista ativa — D14).

### 6.4 Importação Holyrics (correções)

- `parse_json`: aceitar raiz **objeto** (1 música) **ou array** (N músicas) — hoje só array.
- Comando passa a aceitar **lista de arquivos** (`import_holyrics(paths)`), picker `multiple: true`, relatório **agregado** (importadas/puladas/erros por arquivo).
- Copy corrigida na aba Preferências → Músicas: ".json ou .txt", "Selecione um ou vários arquivos…"; remover `.pro`.
- `description` vazia → seção sem rótulo (comportamento atual mantido e documentado).
- Testes Rust com os dois formatos reais (fixtures: cópias dos dois arquivos reais, versionadas no repo) + caso multi-arquivo + título vazio.

### 6.5 Configuração "linhas por slide"

- Rust `settings`: chave `songs.lines_per_slide` ∈ `"1" | "2" | "keep"` — **default `"2"`**.
- Comandos IPC `get_song_defaults` / `set_song_defaults` com wrappers tipados.
- Aplicação: importação Holyrics e salvamento da internet (D4/D13); não re-quebra músicas existentes.
- UI: Preferências → Músicas, radios "1 linha por slide" · "2 linhas por slide" · "Estrofe inteira".

### 6.6 Remote — infraestrutura

- `ServerState` ganha `db: Arc<Db>`; biblioteca de imagens acessível por path (`list_images_at(dir)`, reusando `media_library`).
- Novo `services/slide_builder.rs`: monta slides (rótulo + conteúdo) a partir de um `Song` do banco — espelho de `buildSongSlides` (TS), com testes de espelho.
- Rotas novas (mesmo guard de token das atuais — Bearer, remote habilitado):
  - `GET /api/v1/songs?q=` → busca na biblioteca (id, título, artista)
  - `GET /api/v1/songs/{id}/slides` → slides montados (label + content)
  - `GET /api/v1/lyrics/search?q=` → LRCLIB
  - `POST /api/v1/lyrics/save` → busca letra, aplica linhas por slide, salva na biblioteca, devolve a música
  - `POST /api/v1/present-song` → apresenta (monta LiveSlide do banco) **e** pede o registro ao desktop (D10)
  - `POST /api/v1/present-image` → apresenta uma imagem da biblioteca (caminho validado dentro dela)
  - `GET /api/v1/images` → árvore da biblioteca
- Miniaturas e imagens cheias: rota existente `/theme-media/library/...`.
- **Registro na programação (D10)** — escritor único: o servidor emite um evento Tauri (`remote://imprevisto`, com `songId`); o desktop anexa o item ao fim da última parte da **lista ativa** (cria a parte "Avulsas" se ela não tiver partes), salva o documento e o publisher republica o snapshot com o debounce atual. Nenhuma escrita de evento no servidor.

### 6.7 Remote — UI

- **Rail** no topo (ícone + rótulo): Programação | Músicas | Imagens.
- **Programação**: o conteúdo atual (Ao vivo + Programação Destilada), sem mudanças de fluxo.
- **Músicas**: campo de busca (biblioteca) com resultados; botão "Pesquisar na internet" (LRCLIB) com resultados; escolher → salva (aplica linhas por slide) e abre a música; música aberta: slides com rótulo + **Apresentar** (que grava o registro).
- **Imagens**: árvore de pastas + grade de miniaturas; toque → apresenta.
- Estados de carregando/vazio/erro em pt-BR; reusa estilos atuais; sem upload no v2.

### 6.8 Testes / qualidade

- Rust: holyrics (objeto/array/vários), slide_builder (espelho dos rótulos), quebra por linhas, settings, biblioteca de imagens por path, rotas novas (smoke).
- Front: `npm run typecheck`; validação manual com os arquivos de exemplo; `ShortcutsView` atualizado; uso do remote no celular.
- Commits por fase, Conventional Commits, Gitflow.

## 7. O que fica para o builder

- Fases sugeridas (cada uma um PR pequeno):
  - **F1** Importação + config "linhas por slide" (independente)
  - **F2** Grupos de slides + atalhos numéricos (desktop)
  - **F3** Temporário (desktop)
  - **F4** Remote: infra do servidor + sidebar + Músicas
  - **F5** Remote: Imagens (reusa F4)
- Detalhes finos: layout do rail, microcopy, forma do indicador de números, intensidade da caixa de grupo, agressividade do debounce da republicação do snapshot.

## 8. Riscos conhecidos

- **Espelho TS↔Rust** da montagem de slides pode divergir — mitigar com casos de teste idênticos nos dois lados.
- **Escrita concorrente no SQLite**: buscar letra na internet **antes** de pegar o lock do banco; locks curtos.
- **Entrega do registro (D10)**: o pedido de registro chega ao desktop por evento; se o webview estiver ocupado (diálogo aberto), o item entra instantes depois — sem perda (a fila é do próprio webview).
- **LRCLIB fora/limitado**: mensagens de erro já existem no serviço; o remote deve exibi-las.
- **Rota nova sem token**: checklist de review — toda rota de mutação passa pelo guard existente.
