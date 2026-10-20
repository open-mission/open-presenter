# Auto-scale de fonte — diagnóstico e método híbrido (Holyrics + Web)

**Data:** 2026-10-20  
**Escopo:** `src/features/slide-themes/ThemeRenderer.tsx`, `src/features/theme-editor/exportImage.ts`, `src/features/theme-editor/PropertiesPanel.tsx`  
**Objetivo:** fazer o texto caber na caixa entre um tamanho mínimo e um máximo, com o mesmo resultado no editor, na saída ao vivo e no PNG exportado, usando a filosofia do Holyrics + medição de texto do browser.

## 0. Status de implementação (2026-10-20)

Implementado neste repositório:

- `src/features/slide-themes/fitText.ts` — modelo `fixed | shrink | fit`, bounds normalizados, busca lower-bound inteira, overflow explícito, padding.
- `src/features/slide-themes/textMeasure.ts` — medidor oculto persistente, `Range.getClientRects()` por linha, cache, `text-wrap`/`word-break`/`letter-spacing` fiéis, espera de fonte.
- `src/features/slide-themes/useAutoFit.ts` — hook com caixa determinística, `ResizeObserver` só no palco/container fixo, sem escrever no DOM visível, sem transição durante a medição.
- `ThemeRenderer.tsx` — removido o binário antigo e o `98%` de largura; o texto agora usa o resolvedor compartilhado.
- `exportImage.ts` — mesmo `fitFontSize` do palco, padding, line-height correto, clipping na caixa e fallback final pelo canvas.
- `PropertiesPanel.tsx` — `fitMode`, mínimo honesto (16 px), máximo no auto-fit.
- `theme-schema.json` — `fitMode`, `minFontSize`, `maxFontSize`.

Validação executada:

- `npm run typecheck` e `npm run build` sem erros.
- `npm test`: **133 testes, 133 passando**.
- Harness real de `ScaledStage` em Chrome headless (caixa 1680×580): curto **64**, 10 linhas **46**, `fit` com máximo 96 **96**, 20 linhas com mínimo 20 **20 + overflow**, altura automática estável.
- Harness de export PNG: texto de 10 linhas com base 64 produziu bbox de **555 px** (fonte 46), texto curto **47 px** (fonte 64) e caso de estouro **clipado em 190 px** dentro da caixa de 200.

As referências de linha das seções 1–5 descrevem o código anterior à correção; o status acima reflete os arquivos atuais.

Ainda em aberto (fora do escopo deste patch):

- Aviso visual de overflow no editor (hoje só `data-text-overflow`).
- Export em resoluções diferentes de 1920×1080 ainda não normaliza os px lógicos do palco.
- Export usa quebra própria no canvas; o tamanho é compartilhado, mas linhas podem diferir em 1 px de casos extremos.
- Modo "% da altura" (Holyrics) como entrada opcional.

---

## 1. Resumo executivo

O auto-scale atual **não está apenas impreciso: ele colapsa para o tamanho mínimo** em qualquer texto com quebra automática de linha.

Causa raiz, em uma linha:

```ts
// ThemeRenderer.tsx:266
const targetW = cw * 0.98;
// ThemeRenderer.tsx:283
content.scrollWidth <= targetW
```

O `content` tem `width: 100%` (`ThemeRenderer.tsx:455`), então `content.scrollWidth` é **sempre igual à largura do container** (`cw`). Como o alvo é `0.98 * cw`, a condição de largura é **sempre falsa** — mesmo para a palavra "Amém". O binário então desce até `minFont`. Só escapam:

- elementos `white-space: nowrap` (o `content` vira `max-content`, então `scrollWidth` é a largura natural);
- elementos com padding horizontal maior que ~2% da largura (o `content` fica mais estreito que `cw`).

Validação em DOM real (Chrome headless, réplica fiel do DOM/algoritmo atual):

| Caso | Caixa | Base | Resultado atual | Maior que cabe |
|---|---|---:|---:|---:|
| "Deus é amor" | 1680×580 | 64 px | **20 px** | 64 px |
| 4 linhas | 1680×580 | 64 px | **20 px** | 64 px |
| 10 linhas | 1680×580 | 64 px | **20 px** | 46 px |
| palavra longa | 400×100 | 64 px | **20 px** | 34 px |

Com `targetW = cw` (sem o falso 2%), os mesmos casos retornam 64 / 64 / 46 / 34 — exatamente o maior tamanho inteiro que cabe.

Uma auditoria independente do mesmo código (leitura estática + réplica em Chrome headless) chegou ao mesmo resultado com números do palco real: `cw=1574`, `scrollWidth=1574`, `targetW=1542.52`, falha de largura em **62/48/32/24/16 px**, com altura sempre OK. Ou seja: hoje o texto multilinha do louvor entrega **16 px** (o default interno), não o maior tamanho que cabe.

Além disso há três problemas de contrato que impedem "respeitar mínimo e máximo":

1. **Mínimo não é piso:** com `base < min`, o early-return devolve `base` (ex.: 12 px com mínimo 20 px).
2. **Máximo não é teto:** no modo `autoFit`, o loop pode devolver `maxFont + 1` (ex.: 51 px com máximo 50 px), porque não há guarda `low <= high`.
3. **Mínimo não tem política de estouro:** se nem o mínimo cabe, o texto é cortado por `overflow: hidden` sem aviso.

E há uma divergência grave entre editor/saída e export:

- Renderer: `autoShrink` **ligado por padrão** (`!== "false"`, linha 178).
- Export: `autoShrink` **só liga se for `"true"`** (`exportImage.ts:239`) e **nunca cresce** no `autoFit`; usa passo multiplicativo `0.92` e no máximo 25 tentativas.
- Editor: mostra placeholder 20 px e mínimo 8 px, mas o renderer usa **16 px** e clampa em **10 px** (`ThemeRenderer.tsx:269-270`).

Resultado: o PNG pode transbordar enquanto a prévia reduz (ou vice-versa), e o número que o usuário digita não é o número aplicado.

---

## 2. Como o Holyrics faz (REA)

**Alvo analisado:** `/Applications/Holyrics.app`  
**Artefato:** `Contents/Java/Holyrics.jar`  
**SHA-256:** `d58cb35b25a8ac0cf326b1a45c7f8041ed0ad0cc69cca06eb6222d2a8021c976`  
**Decompilador:** CFR 0.152 (Java 27)  
**Versão:** 2.20.0 (`Holyrics.cfg`)

> O MCP do REA não estava conectado nesta sessão. A rota usada foi análise estática do artefato empacotado (JAR → bytecode → CFR), com identidade e SHA registrados acima.

### 2.1 Tamanho é percentual da altura, não px

`com.limagiran.holyrics.model.theme.Theme`:

```java
public static final double SIZE_DEFAULT   = 0.1;   // 10% da altura
public static final double SIZE_MIN_VALUE = 0.0;   // 0%
public static final double SIZE_MAX_VALUE = 0.5;   // 50%

public Font getFont(int height, Graphics2D g) {
    if (this.size <= 0.0) return this.fonts[0].deriveFont(0.0f);
    return G2Utils.getBestFont((int) ((double) height * this.size), this.fonts[0], g);
}
```

O campo `size` é uma **fração da altura do slide** (0–50%). O usuário escolhe "10%" e o Holyrics calcula a fonte cujo `FontMetrics.getHeight()` chega mais perto de `10% × altura`. Ou seja: o controle representa **altura de linha relativa**, não "tamanho da letra" em px.

A UI confirma: `ThemeSettingsPanel` tem um combo com os valores
`2, 4, 6, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 45, 50` e um label fixo `"%"` (`createFontSizeComboBoxModel`, linha 1490; `jLabelFontSizePercent`).

### 2.2 O tamanho configurado é um teto; o texto só diminui

Cadeia de render de uma música (`PresentationSlideUtils`, linhas 477–535):

```java
Font font = th.getFont(d.height, g);        // fonte nominal a partir do % da altura
g.setFont(formatFont(font, p));
if (breakline) {
    array = breakLine(array, g, lineSpacing, rect.getSize(), p, th, ...);
} else {
    adjustText(array, g, lineSpacing, rect.getSize(), th);
}
```

`adjustText` (linha 1084) faz o fit final:

```java
new FontUtils.BestFont(g, g.getFont(), "", d.width, d.height, startSize = g.getFont().getSize(), lineSpacing, lines, largeLine, t) {
    @Override public int calcHeight(FontMetrics fm) {
        return (int) ((double) fm.getHeight() * lineSpacing * lines.length);
    }
    @Override public int calcWidth(FontMetrics fm) {
        return largeLine.width(fm);   // largura da MAIOR linha
    }
    @Override public FontMetrics getFontMetricsWidth(...) {
        return largeLine.isComment()
            ? FontMetricsCache.get(t.getCommentFont(f), g2)
            : fontMetricsHeight;
    }
}.getResult();
```

Pontos-chave:

- `startSize` = tamanho nominal em px. **O fit começa no tamanho escolhido e só desce** — nunca ultrapassa o valor configurado.
- A largura considerada é a da **maior linha**, não a soma nem a caixa.
- A altura é `lineHeight × lineSpacing × númeroDeLinhas`. `lineSpacing = theme.getLineSpacing() + 1.0` (`PresentationSlideUtils:138`), então o espaçamento é um multiplicador da altura da linha.
- Comentários usam métricas de fonte menores, e o fit considera isso.

### 2.3 O binário do Holyrics (com fallback linear)

`FontUtils.BestFont.getResult()`:

- `range = clamp(startSize, 1, 1000)`; procura tamanhos **inteiros**.
- Testa o meio; se couber, sobe; se não couber, desce.
- Quando o intervalo restante zera, faz **varredura linear** para achar o maior que cabe (descendo) ou o primeiro que não cabe (subindo).
- Piso absoluto: **1 px**.
- Não existe "mínimo configurável" no tema; o piso é 1 px.

Há também uma variante `G2Utils.getBestFont(maxWidth, maxHeight, text, font, g)` para cabeçalho/copyright da Bíblia, que cabe em **largura e altura de uma linha só** (usada em `BibleSlideUtils`).

### 2.4 Re-quebra de linha durante o shrink

`breakLine` (`PresentationSlideUtils:729-1048`) não só mede: ele **re-quebra o texto** para a largura da caixa enquanto reduz a fonte. O laço diminui o tamanho até que:

```java
fm.getHeight() * lineSpacing * linhas <= d.height
```

e nenhuma linha ultrapasse `d.width`. Depois chama `adjustText` para o ajuste fino.

Ou seja, o pipeline do Holyrics é:

1. tamanho nominal (percentual da altura);
2. quebra de linha na largura da caixa;
3. shrink inteiro até caber largura **e** altura;
4. desenho com a métrica final.

O editor usa o mesmo renderizador no preview (`ThemeItemEditRenderer` → `BackgroundThumbController`), então **não existe divergência entre preview e projeção**.

### 2.5 O que o Holyrics NÃO tem

- Não tem "preencher caixa" (crescer acima do configurado).
- Não tem mínimo por elemento; o piso é 1 px.
- Não tem `maxFontSize` explícito; o máximo é o próprio tamanho escolhido.

Isso é ótimo para o caso "letra de música", mas insuficiente para o editor do Open Presenter, que precisa de **mínimo e máximo explícitos** (o pedido do usuário) e de diagnóstico quando nem o mínimo cabe.

---

## 3. Como a web resolve (pesquisa)

### 3.1 O problema é intrinsecamente iterativo

Não dá para calcular em uma passada: **tamanho afeta a quebra, a quebra afeta a altura, e a altura decide se cabe**. A solução canônica é busca binária sobre tamanhos inteiros, re-quebrando e medindo a cada candidato ([Pretext.js — Fit Text to Container](https://pretextjs.dev/fit-text-to-container)):

```js
let lo = 6, hi = 200;
while (hi - lo > 1) {
  const mid = (lo + hi) >> 1;
  const { height } = layout(prepare(text, mid + 'px Arial'), boxWidth, mid * 1.2);
  if (height <= boxHeight) lo = mid; else hi = mid;
}
// lo = maior tamanho que cabe
```

CSS puro não resolve: `clamp()`, `vw`, `cqw` escalam com o **viewport/container**, não com o **conteúdo**. Texto longo continua estourando e texto curto deixa buraco.

### 3.2 Medição: elemento oculto persistente, não canvas

Para texto com HTML inline (`<b>`, `<i>`, `<br>`, spans), medir com `canvas.measureText` exige reimplementar quebra, kerning, espaçamento e alinhamento — frágil. A prática consolidada é um **elemento de medição oculto e persistente**, com o layout nativo do browser. É o que o tldraw faz ([Text measurement](https://raw.githubusercontent.com/tldraw/tldraw/2fabc3401df42ba1cd32aabc906eb9def1c1f7ac/apps/docs/content/sdk-features/text-measurement.mdx)):

- elemento `position:absolute`, invisível, anexado uma vez ao container;
- aplica estilos, lê dimensões, restaura estilos;
- `measureHtml` para conteúdo rico;
- **line-height resolvido em px inteiros** para que medição, render e export concordem entre browsers;
- **fontes carregadas antes de medir** (`FontManager`), senão a medição usa fallback e o layout "pula" quando a fonte real chega;
- cache por forma/props.

### 3.3 Armadilhas conhecidas

- **Reflow por candidato**: escrever estilo e ler `scrollHeight` força layout. Com 9 candidatos × N elementos, dá jank. Solução: medidor oculto, lote de medições, cache, e aplicar o resultado uma única vez.
- **ResizeObserver no elemento medido**: se você observa o conteúdo e o conteúdo muda de altura ao mudar a fonte, o observer realimenta o fit. Observe **só a caixa** (container) e ignore mudanças causadas pela própria aplicação (guarda de epsilon + último valor).
- **Transição de `font-size`**: medir durante a transição lê um estado intermediário e dispara novos resizes. Desligue a transição durante a medição e não a use no elemento que está sendo fitado.
- **`text-wrap: balance/pretty`**: muda a quebra de forma não determinística entre candidatos; para o fit, meça com `wrap` e só aplique `pretty` depois (ou desligue no palco lógico).
- **Piso maior que o necessário**: se o mínimo não cabe, o texto será cortado. Isso precisa ser um estado explícito (aviso/override), não um silêncio.

### 3.4 Bibliotecas existentes

`fitty`, `textfit`, `react-textfit` fazem o básico (binário/loop + DOM), mas nenhuma cobre o modelo do Open Presenter (caixa lógica 1920×1080, HTML inline, páginas, export canvas, mínimo/máximo por elemento). Vale usar as ideias, não a dependência.

---

## 4. Diagnóstico detalhado do Open Presenter

### 4.1 Pipeline atual

**Editor / saída ao vivo** (`ThemeRenderer.AutoScaledText`):

1. `baseFontSize = parseFloat(css.fontSize || "48")`.
2. `lineHeightRatio` derivado de `css.lineHeight` (px vira razão sobre a base).
3. `useLayoutEffect` mede `container.clientWidth/clientHeight`.
4. Se `css.height` ausente/`auto`, usa `ch = parentH - offsetTop - 5%` (hack).
5. `targetW = cw * 0.98`, `targetH = ch * 0.98`.
6. Binário de 7 iterações (`autoShrink`) ou 8 (`autoFit`), escrevendo `content.style.fontSize` e lendo `scrollHeight/scrollWidth`.
7. `setFittedFontSize` → re-render → aplica `fontSize`/`lineHeight` inline com transição de 80 ms.
8. `ResizeObserver` observa **container e content**.

**Export PNG** (`exportImage.drawTextElement`):

- `autoShrink = css.autoShrink === "true"`, `autoFit = css.autoFit === "true"`.
- Quebra por palavras com `ctx.measureText` (não usa o layout do browser).
- Loop multiplicativo `fontSize *= 0.92` até 25 tentativas, piso `minFontSize || 16`.
- `autoFit` **não cresce**: só entra no mesmo loop de shrink.
- Ignora HTML inline (desenha o markup como texto), `text-wrap`, `word-break`, `hyphens`, `letter-spacing`.

### 4.2 Bugs priorizados

| # | Sev. | Local | Sintoma | Correção |
|---|---|---|---|---|
| 1 | **P0** | `ThemeRenderer.tsx:266,283` + `:455` | Todo texto com `width:100%` falha no teste de largura e cai para `minFont` | Medir largura real do texto (`Range.getClientRects`) ou comparar com `cw` (sem 0.98), nunca `scrollWidth` de bloco 100% |
| 2 | **P0** | `exportImage.ts:239,269` | Export não reduz temas sem `autoShrink` explícito; live reduz | Normalizar `fitMode` antes de render/exportar (default único) |
| 3 | **P0** | `exportImage.ts:269-285` | Export nunca cresce no `autoFit` e usa passo 0.92 | Compartilhar o mesmo resolvedor de tamanho |
| 4 | **P1** | `ThemeRenderer.tsx:287-333` | `base < min` devolve `base`; `autoFit` pode devolver `max+1` | Normalizar `min = clamp(min, 1, max)` e usar lower-bound com `hi = max + 1` |
| 5 | **P1** | `ThemeRenderer.tsx:270` vs `PropertiesPanel.tsx:878` | UI diz 20/8, código usa 16/10 | Defaults e limites em uma única fonte (`fitDefaults`) |
| 6 | **P1** | `ThemeRenderer.tsx:350-357` | `ResizeObserver` no `content` + `setState` = loop/avisos e re-medições | Observar só o container; guardar último tamanho e epsilon |
| 7 | **P1** | `ThemeRenderer.tsx:471` | Transição de 80 ms durante medição/reaplicação | Sem transição no elemento fitado; animação só no slide de saída |
| 8 | **P2** | `ThemeRenderer.tsx:271-273` | Máximo arbitrário `base*2.5`/240 | `maxFontSize` explícito por elemento |
| 9 | **P2** | `ThemeRenderer.tsx:249-258` | Hack `parentH - offsetTop - 5%` ignora margem inferior e `height:auto` real | Caixa determinística a partir da geometria (1920×1080) |
| 10 | **P2** | `ThemeRenderer.tsx:344-348` | Só espera `document.fonts.ready`, não a fonte específica | `document.fonts.load(`${weight} ${size}px ${family}`)` antes de medir |
| 11 | **P2** | `ThemeRenderer.tsx:245-258` | Texto vazio/whitespace entra no fit | Early-return `base`/0 |
| 12 | **P3** | `exportImage.ts:242-265` | Quebra/medição diferentes do browser | Medir via DOM e passar tamanho + linhas para o canvas |
| 13 | **P3** | `ThemeRenderer.tsx:203` | `nowrap` funciona por acaso; largura natural não é medida explicitamente | Medir `max-content` no modo nowrap |
| 14 | **P2** | `ThemeRenderer.tsx:271-273` | Com base > 240, `maxFont = 240 < base`: o autoFit **encolhe** um texto que já cabia | `max = max(base, ...)` e `maxFontSize` explícito |
| 15 | **P2** | `exportImage.ts:220,292-293` | `lineHeight: "76px"` é lido como fator 76 no canvas (renderer lê como razão 76/base) | Normalizar line-height para px/razão uma única vez |
| 16 | **P2** | `exportImage.ts:194-209` | Canvas ignora padding/borda ao calcular a caixa | Usar o mesmo content box do renderer |
| 17 | **P2** | `ThemeRenderer.tsx:358-370` | Deps não incluem `top`/`y`, `padding*`, `fontWeight`, `fontFamily`; mover elemento de altura auto não re-mede | Incluir tipografia/geometria no hook de fit; RO no container + posição |
| 18 | **P2** | `exportImage.ts:551-607` | `exportElementAsImage` é legado e só pinta o fundo | Remover ou implementar de verdade |
| 19 | **P3** | `theme-schema.json:183-184` | Schema do criador de temas não declara `minFontSize` (nem máx.) | Atualizar schema + skill do criador |
| 20 | **P3** | `docs/superpowers/specs/2026-10-16-editor-de-temas-design.md:26-27` | Doc cita `textFit`/`autoScale` inexistentes e se contradiz | Corrigir doc após implementar |

### 4.3 Divergências de contrato (resumo)

```
autoShrink ausente:
  renderer  -> true   (reduz)
  export    -> false  (não reduz)
  editor    -> mostra "Reduzir para caber" (implícito)

minFontSize:
  UI        -> placeholder 20, min 8
  renderer  -> default 16, piso 10
  export    -> default 16, piso 16

maxFontSize:
  não existe; autoFit usa base*2.5 (cap 240)
  com base > 240 o "máximo" fica MENOR que a base

lineHeight:
  renderer  -> "76px" vira razão 76/base
  export    -> parseFloat("76px") = 76, usado como multiplicador

fontSize:
  renderer  -> parseFloat("50%") = 50 px
  export    -> parseDimension("50%", altura) = 50% da altura
```

---

## 5. Método híbrido proposto

### 5.1 Modelo de dados

Manter px no palco lógico 1920×1080 (não migrar para % agora), mas com semântica explícita:

```ts
// css do elemento
fitMode: "fixed" | "shrink" | "fit";   // default "shrink"
fontSize: "64px";                       // tamanho-base
minFontSize: "20px";                    // piso (default 16)
maxFontSize: "96px";                    // teto; só usado em "fit"
```

Regras de normalização (uma função pura, usada por editor, live e export):

```ts
function resolveFitBounds(css: Record<string, string>) {
  const mode = css.fitMode ?? legacyMode(css);          // autoFit/autoShrink -> fitMode
  const base = px(css.fontSize, 48);
  const min  = Math.max(1, Math.round(px(css.minFontSize, 16)));
  const max  = Math.max(min, Math.round(px(css.maxFontSize, mode === "fit" ? base * 1.5 : base)));
  const ceiling = mode === "fit" ? max : Math.min(base, max);
  return { mode, base, min, max: ceiling, start: clamp(base, min, ceiling) };
}
```

Compatibilidade:

- `autoFit === "true"` → `fitMode = "fit"`.
- `autoShrink === "false"` → `fitMode = "fixed"`.
- ausente → `fitMode = "shrink"` (mesmo default do renderer atual, agora explícito).
- `maxFontSize` ausente em `fit` → `base * 1.5` (ou o próprio `base`, se preferir fidelidade absoluta ao Holyrics; decisão de produto).

### 5.2 Algoritmo (lower-bound inteiro, com fallback)

```ts
export function fitFontSize(
  measure: (px: number) => { width: number; height: number },
  box: { width: number; height: number },
  bounds: { min: number; max: number },
  epsilon = 0.5,
): { size: number; overflow: boolean } {
  const lo0 = Math.max(1, Math.round(bounds.min));
  const hi0 = Math.max(lo0, Math.round(bounds.max));

  const fits = (px: number) => {
    const m = measure(px);
    return m.width <= box.width + epsilon && m.height <= box.height + epsilon;
  };

  if (!fits(lo0)) return { size: lo0, overflow: true };
  if (fits(hi0)) return { size: hi0, overflow: false };

  let lo = lo0;          // sabidamente cabe
  let hi = hi0 + 1;      // sabidamente NÃO cabe (sentinela)
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) lo = mid; else hi = mid;
  }

  // Holyrics faz fallback linear; aqui só precisamos verificar vizinhos
  // quando a quebra de linha cria platôs (texto com palavras longas).
  for (let px = lo + 1, n = 0; px <= hi0 && n < 4; px++, n++) {
    if (fits(px)) lo = px; else break;
  }
  return { size: lo, overflow: false };
}
```

Propriedades:

- Nunca ultrapassa `max` (o bug do 51 > 50 desaparece).
- Nunca abaixo de `min`; se `min` não cabe, retorna `min` + `overflow: true`.
- Retorna sempre o maior inteiro que cabe (dentro do fallback de 4 px).
- ~7–9 medições para um intervalo de 400 px.

### 5.3 Medição no browser (uma vez por candidato, sem reflow visível)

Criar `src/features/slide-themes/textMeasure.ts`:

```ts
// elemento persistente, oculto, anexado ao <body> ou ao palco
// position: absolute; left: -100000px; top: 0; visibility: hidden;
// pointer-events: none; contain: layout style; padding: 0; border: 0;

function measureHtml(html: string, style: FitTypography, width: number): { width: number; height: number } {
  const el = measurer;
  applyTypography(el, style);          // font-family, weight, style, letter-spacing, line-height...
  el.style.width = `${width}px`;
  el.style.whiteSpace = style.whiteSpace;   // pre-wrap | nowrap
  el.style.wordBreak = style.wordBreak;
  el.style.overflowWrap = style.overflowWrap;
  el.style.textWrap = "wrap";          // determinístico durante o fit
  el.innerHTML = html;

  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects());
  const textWidth = rects.reduce((max, r) => Math.max(max, r.width), 0);
  const box = el.getBoundingClientRect();
  return { width: textWidth, height: box.height };
}
```

Por quê `Range.getClientRects()`:

- Em bloco `width:100%`, `scrollWidth` é a largura do bloco (foi o bug).
- `Range` devolve um retângulo por **linha de texto**, então a largura é a da maior linha e a altura é a união das linhas.
- Funciona com `<br>`, `<b>`, `<i>`, spans e `nowrap` (uma linha natural).
- Não inclui padding/borda do bloco — exatamente o que queremos comparar com o **content box**.

Detalhes de implementação:

- **Uma única instância** do medidor por documento (evita layout de N elementos).
- **Cache** por chave: `html|width|height|fontFamily|weight|style|letterSpacing|lineHeightRatio|whiteSpace|wordBreak`.
- **Fontes**: `await document.fonts.load(`${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`)` (e `document.fonts.ready`) antes da primeira medição. Re-medir em `document.fonts` `loadingdone`.
- **Line-height**: resolver para px inteiro (`Math.round(px * ratio)`) tanto na medição quanto no render (tldraw faz isso para browser/export concordarem).
- **Aplicação**: o resultado vira uma CSS custom property no container (`--op-fit-size`), não `setState` por candidato. Um único `setState` no final, só para transição/aviso.
- **Quando medir**: `useLayoutEffect` em mudanças de `html`, `box`, tipografia, `fitMode`, min/max; `ResizeObserver` **só no container**; `requestAnimationFrame` para coalescer; guarda `lastApplied` + epsilon (0.5 px) para não reaplicar.
- **Não medir** durante transições de slide nem durante arraste/resize (o editor pode mostrar o valor anterior e recalcular no fim do gesto).

### 5.4 Caixa determinística (fim do hack de altura)

O fit precisa de uma caixa estável, independente do conteúdo. Calcular a partir da geometria do elemento no palco 1920×1080:

- `left/top` = css ou `x/y` em %.
- `width` = css ou default (ex.: 80%).
- `height` = css; se ausente/auto, `alturaDisponível = LOGICAL_H - top - margemInferiorPadrão` (ex.: 5% ou margem do tema). Esse valor é **fixo** e não depende do texto.
- Subtrair `padding` e `border` para obter o **content box**.
- O container do texto deve ser posicionado exatamente nessa caixa (`width`/`height` ou `max-height`), para que a medição e o desenho usem o mesmo referencial.

Isso remove a dependência de `parentElement.clientHeight`/`offsetTop` e faz o editor, o palco e o export concordarem.

### 5.5 Export PNG com o mesmo resultado

Duas opções, em ordem de custo:

**A. Curto prazo (recomendada):** antes de desenhar, rodar o mesmo `measureHtml` em um palco DOM oculto 1920×1080, elemento por elemento, e obter `{ size, lines? }`. Passar `size` para `drawTextElement` e uma função de quebra que replique `white-space`, `word-break`, `overflow-wrap` e `line-height`. Para fidelidade de linhas, usar os `rects` do `Range` para posicionar cada linha no canvas (as posições vêm do próprio browser).

**B. Longo prazo:** exportar via snapshot DOM (`foreignObject`/`html-to-image`/`modern-screenshot`) para fidelidade total de HTML inline, com fallback canvas para ambientes sem DOM. Exige avaliar dependência nova — o `AGENTS.md` pede cautela.

Regra de aceitação: para o mesmo tema/props, o `font-size` efetivo do PNG é **idêntico** ao do palco lógico.

### 5.6 UI do editor

Substituir o select atual por:

```
Auto-size:  [ Fixo ▾ ]
            Fixo | Reduzir para caber | Preencher caixa

Tamanho base: 64 px     (máximo no modo "Reduzir")
Mínimo:       20 px     [⚠ não cabe: aumente a caixa ou reduza o mínimo]
Máximo:       96 px     (habilitado só em "Preencher")
Efetivo:      45 px     (reduzido de 64)
```

Regras:

- `min` sempre `>= 1`; `max >= min`.
- Em `shrink`, `max` é read-only = `fontSize`.
- Em `fit`, `max >= fontSize` (ou o base vira o mínimo).
- Se `overflow`, mostrar badge âmbar no canvas e um botão "Reduzir mínimo até caber" (aplicar `min = size` calculado sem piso) ou "Ajustar caixa".
- Mostrar o valor efetivo (o usuário vê que 64 virou 45).
- Um botão "Re-medir" para forçar após trocar fonte.

### 5.7 Compatibilidade e migração

- Normalizar no load/save (`themePackage.normalizeElement` e `themeIo`), não no render.
- Escrever sempre `fitMode`, `minFontSize`, `maxFontSize`; manter leitura dos legados `autoShrink`/`autoFit` por pelo menos uma versão.
- Seed themes: não precisa reescrever todos; a normalização cobre.
- Documentar no schema (`docs/` e tipos `ThemeElement.css` como `Record<string,string>` — considerar um tipo `ThemeTextCss` para pegar erros de digitação).

---

## 6. Plano de implementação

### Fase 0 — Hotfix (1 PR pequeno)

1. `ThemeRenderer.tsx`: trocar o teste de largura para medir texto real e remover o `0.98` da largura.
2. Corrigir o binário: `hi = max + 1`, `while (hi - lo > 1)`, sem estourar `max`.
3. Normalizar `min/max` (mínimo como piso, máximo como teto) e remover o early-return que fura o mínimo.
4. Unificar defaults (`fitDefaults.ts`): `min=16`, piso 1, `max=base` em shrink.
5. `exportImage.ts`: usar os mesmos defaults e permitir crescimento em `fit`; corrigir `lineHeight` px e padding.
6. `PropertiesPanel.tsx`: mostrar 16 (não 20) e permitir 1–500.
7. Testes unitários do resolvedor de bounds.
8. Atualizar `theme-schema.json` (skill do criador de temas) com `fitMode`/`minFontSize`/`maxFontSize`.

**Critério de saída:** os quatro casos da tabela do §1 retornam 64/64/46/34; export e live iguais.

### Fase 1 — Núcleo compartilhado

1. `textMeasure.ts` (medidor oculto + cache + fontes).
2. `fitText.ts` (bounds + busca + overflow).
3. `useFitText.ts` (hook: caixa, medição, CSS var, RO no container, epsilon).
4. Substituir o `useLayoutEffect` gigante do `AutoScaledText`.
5. Adicionar `maxFontSize` ao schema/UI; migrar `autoShrink/autoFit` para `fitMode`.

### Fase 2 — Paridade de export

1. Medir no DOM antes de desenhar; passar tamanho/linhas.
2. Replicar quebra/line-height no canvas; testes de paridade.
3. (Opcional) export via snapshot DOM.

### Fase 3 — Polimento

1. Badge de overflow + ações rápidas.
2. Modo "% da altura" (Holyrics) como opção de entrada, convertendo para px no palco 1920×1080.
3. Telemetria local (console em dev) de medições por elemento para achar regressões.

---

## 7. Matriz de testes

### Unitários (puros, com `measure` fake)

| Caso | Esperado |
|---|---|
| base 64, min 20, max 64, cabe | 64 |
| base 64, min 20, max 64, não cabe | maior inteiro que cabe |
| base 12, min 20 | 20 (não 12) |
| base 64, fit, max 50, texto curto | 50 (não 51) |
| min 20, texto enorme | 20 + `overflow: true` |
| min > max | normaliza (max = min) |
| texto vazio | base (ou 0, sem medir) |
| nowrap | maior ≤ largura; altura de 1 linha |
| HTML `<b>/<i>/<br>` | mede com o layout nativo |

### Integração DOM (harness)

- Página de harness (ou Playwright, se aprovado) com caixas 1680×580, 400×100, 1680×200 e fixtures: curto, 4 linhas, 10 linhas, palavra longa, nowrap, HTML, vazio, fonte customizada.
- Comparar `fitFontSize` com força bruta 1..max; tolerância 0–4 px (fallback).
- Verificar que não há `ResizeObserver loop completed with undelivered notifications` no console.
- Medir tempo: ≤ 12 medições por elemento por mudança de caixa; sem reflow em frames de animação.

### Visual / export

- 6 fixtures × (editor, live, PNG) — mesmo `font-size` efetivo e mesmas quebras.
- Screenshots 1920×1080 para regressão.

> Hoje **nenhum** teste cobre `AutoScaledText`, `minFontSize` ou o fit do export; `exportImage.test.ts` só testa gradientes. A suíte nova precisa nascer junto com o hotfix, senão o bug volta.

### Aceitação

- "Amém" em 1680×580, base 64 → 64.
- 10 linhas em 1680×580, base 64, lh 1.25 → 46.
- 20 linhas, min 20 → 20 + aviso, sem corte silencioso.
- Uma palavra longa em 400×100 → 34 (com `overflow-wrap: break-word`).
- `fit` com max 96 e "Amém" → 96.
- Export PNG = live.

---

## 8. Decisões de produto (precisam de aval)

1. **Semântica de `fontSize`:** manter como "tamanho base" e tratar como teto no modo `shrink` (Holyrics). No modo `fit`, crescer até `maxFontSize` (default 1.5× base ou explícito).
2. **Default de `minFontSize`:** 16 px (atual do renderer) ou 20 px (mostrado na UI)? Recomendo 16 e UI honesta.
3. **Quando o mínimo não cabe:** (a) cortar e avisar; (b) ignorar o mínimo e reduzir até 1 px (Holyrics); (c) aumentar a caixa automaticamente. Recomendo (a) + botão "ignorar mínimo" por elemento.
4. **`text-wrap: pretty`:** desligar durante o fit e reaplicar depois? Recomendo sim para determinismo.
5. **Export:** paridade via DOM (Fase 2) ou manter canvas e aceitar pequenas diferenças? Recomendo paridade via DOM.

---

## 9. Referências

- Holyrics 2.20.0 — `Holyrics.jar` (SHA-256 acima): `Theme.getFont`, `Theme.SIZE_*`, `ThemeSettingsPanel`, `FontUtils$BestFont`, `G2Utils.getBestFont`, `PresentationSlideUtils.adjustText/breakLine`, `BibleSlideUtils`.
- CFR 0.152 — decompilação Java.
- [Pretext.js — Fit Text to Container](https://pretextjs.dev/fit-text-to-container): busca binária com re-quebra e medição sem reflow.
- [tldraw — Text measurement](https://raw.githubusercontent.com/tldraw/tldraw/2fabc3401df42ba1cd32aabc906eb9def1c1f7ac/apps/docs/content/sdk-features/text-measurement.mdx): medidor DOM oculto, `measureHtml`, line-height inteiro, fontes antes da medição, cache.
- [MDN — ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver): loop/limites e boas práticas.
- Código atual: `ThemeRenderer.tsx:236-370` (fit), `:455` (width 100%), `:266-283` (alvo 98%), `exportImage.ts:239-285` (export), `PropertiesPanel.tsx:826-885` (UI), `ScaledStage.tsx:67-75` (palco), `Canvas.tsx:146-147` (escala do editor).
