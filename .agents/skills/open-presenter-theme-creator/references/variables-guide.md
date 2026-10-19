# Guia Completo de Variáveis de Template do Open Presenter

Ao criar ou editar temas no Open Presenter, os elementos do tipo `TEXT` podem conter variáveis dinâmicas entre chaves `{nome_da_variavel}`. Essas variáveis são substituídas dinamicamente em tempo real de acordo com o conteúdo que está sendo projetado ou enviado para o retorno de palco.

O Open Presenter suporta tanto nomes em **inglês (canônicos)** quanto em **português (pt-BR)**.

---

## 1. Bíblia e Versículos (`scripture`)

Variáveis disponíveis quando um versículo da Bíblia está sendo apresentado:

| Variável (Inglês) | Variável (pt-BR) | Descrição | Exemplo de Saída |
| :--- | :--- | :--- | :--- |
| `{title}` | `{titulo}` | Referência bíblica completa formatada | `Gênesis 1:1 (NVI)` |
| `{verse}` | `{verso}`, `{texto}` | Texto do versículo atual (ou parte `1/2` se dividido) | `No princípio criou Deus os céus e a terra.` |
| `{book}` | `{livro}` | Nome do livro bíblico | `Gênesis` |
| `{chapter}` | `{capitulo}` | Número do capítulo | `1` |
| `{verse_number}` | `{versiculo}` | Número do versículo | `1` |
| `{version}` | `{versao}` | Sigla da versão/tradução | `NVI`, `ARA`, `NTLH` |
| `{next_preview}` | `{proximo_resumo}` | Primeira frase/trecho do próximo versículo com `...` | `E a terra era sem forma e vazia...` |
| `{next_line}` | `{proxima_linha}` | Primeira linha do próximo slide | `E a terra era sem forma e vazia...` |
| `{next_verse}` | `{next_up}` | Texto integral do próximo versículo | *(texto completo)* |

> [!TIP]
> **Dica para Pregações:** Usar `{next_preview}` em um elemento discreto (ex: canto inferior com opacidade de 60% e fonte menor) ajuda muito o pregador e a igreja a anteciparem o fluxo do texto sem poluir o visual.

---

## 2. Louvor e Música (`lyric`)

Variáveis disponíveis durante a projeção de canções:

| Variável (Inglês) | Variável (pt-BR) | Descrição | Exemplo de Saída |
| :--- | :--- | :--- | :--- |
| `{lyrics}` | `{letra}`, `{text}`, `{texto}` | Estrofe/letra do slide atual | *(linhas da canção)* |
| `{title}` | `{titulo}` | Título da música | `Porque Ele Vive` |
| `{artist}` | `{artista}` | Artista / Ministério | `Matt Maher` |
| `{section}` | `{secao}` | Seção atual (Refrão, Verso 1, Ponte, etc.) | `Refrão` |
| `{next_preview}` | `{proximo_resumo}` | Início da próxima estrofe com `...` | `Deus enviou Seu Filho amado...` |
| `{next_line}` | `{proxima_linha}` | Primeira linha exata da próxima estrofe | `Deus enviou Seu Filho amado` |
| `{next_verse}` | `{proximo_versiculo}` | Estrofe completa seguinte | *(todas as linhas)* |
| `{current_slide}` | `{currentIndex}` | Número ordinal do slide atual | `1` |
| `{total_slides}` | `{totalCount}` | Total de slides | `1` |

---

## 3. Retorno de Palco / Monitor de Stage (`stage`)

Para temas com categoria `"category": "stage"`, usados em monitores de chão ou TVs voltadas para o altar/músicos/pregador:

| Variável (Inglês) | Variável (pt-BR) | Descrição | Exemplo de Saída |
| :--- | :--- | :--- | :--- |
| `{clock}`, `{time}` | `{hora}` | Relógio atual do sistema (configurável 24h ou 12h) | `19:45` ou `19:45:30` |
| `{stopwatch}` | `{cronometro}` | Tempo decorrido de cronômetro | `05:22` |
| `{timer}`, `{countdown}`| `{timer}` | Tempo regressivo configurado ou tempo decorrido | `14:38` |
| `{lyrics}`, `{text}` | `{letra}`, `{verso}` | Letra ou versículo atual | *(conteúdo principal)* |
| `{title}` | `{titulo}` | Título da canção ou referência do versículo | `Salmos 23:1` |
| `{section}` | `{secao}` | Seção musical da canção | `Ponte` |
| `{next_preview}` | `{proximo_resumo}` | Trecho resumido da próxima estrofe com `...` | `O Senhor é o meu pastor...` |
| `{next_first_line}`| `{proxima_linha}` | Primeira linha da próxima estrofe | `O Senhor é o meu pastor` |
| `{next_verse}` | `{proximo_versiculo}`| Conteúdo do próximo slide | *(próximo conteúdo)* |
| `{next_title}` | `{proxima_referencia}`| Título do próximo item da playlist | `Próximo: Bondade de Deus` |
| `{prev_verse}` | `{versiculo_anterior}`| Slide anterior | *(slide que acabou de passar)* |
| `{prev_title}` | `{referencia_corrente}`| Título do slide anterior | `Salmos 22:31` |

---

## 4. Avisos e Slides Livres (`custom` / `text`)

| Variável (Inglês) | Variável (pt-BR) | Descrição |
| :--- | :--- | :--- |
| `{title}` | `{titulo}` | Título do anúncio/ministração |
| `{text}`, `{content}` | `{texto}`, `{letra}` | Corpo do texto |
| `{next_preview}` | `{proximo_resumo}` | Início do próximo slide |
