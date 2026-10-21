# Editor de temas alinhado ao ProPresenter — design

**Data:** 2026-10-20
**Status:** proposta para revisão
**Fonte:** análise estática do ProPresenter 21.4 com REA (binário principal, ProCore e Interface Builder) e dos temas de exemplo embutidos no app.

## Intenção e porquê

O nosso editor de temas funciona bem para o que existe hoje, mas o modelo é mais rígido que o do ProPresenter:

- quatro tipos de elemento (`TEXT`, `IMAGE`, `VIDEO`, `RECTANGLE`);
- fundo como propriedade CSS especial (`theme.css.background`);
- uma página por contexto (`music`, `bible`, `text`, `rest`);
- sem máscaras;
- sem camada de mensagens para o público;
- sem compositor de camadas por saída.

O ProPresenter trata **texto, imagem, vídeo, forma e fundo como o mesmo tipo gráfico**, coloca tudo em uma pilha e compõe a saída em camadas separadas. O objetivo é evoluir o nosso modelo sem quebrar os temas v1/v2 nem o fluxo atual do Studio.

## O que foi observado

### Tema

Um tema do ProPresenter é um `Template.Document`:

```text
Template.Document
  application_info
  slides: Template.Slide[]
    name
    base_slide: Slide
    actions
```

`Slide` contém:

```text
elements: Slide.Element[]
element_build_order
guidelines
draws_background_color
background_color
size
uuid
```

`Slide.Element` embrulha um `Graphics.Element`:

```text
uuid, name
bounds, rotation, opacity
locked, aspect_ratio_locked
path (retângulo, elipse, triângulo, estrela, polígono, seta, bezier)
fill (cor, gradiente, mídia, background effect)
stroke, shadow, feather
text (atributos tipográficos)
text_line_mask
flipMode, hidden
```

Nos temas analisados, elementos de texto têm `info = 3` (`template + texto`) e formas/fundos têm `info = 1`.

### Fundo

Há três níveis:

1. `Presentation.background` — cor ou gradiente da apresentação.
2. `Slide.draws_background_color` + `background_color` — override do slide.
3. Elemento full-bleed na pilha — mídia, cor ou gradiente.

Mídia pode ser disparada para `Background`, `Foreground`, `Fill` ou `Video Input`. O fill `Background Effect` aplica blur/invert e escolhe a camada de origem (`Media` ou `Video Input`).

A ordem do array de elementos parece ser **frente → fundo**: nos temas analisados, o fundo full-bleed é o último elemento. O nosso renderer usa o contrário (primeiro = fundo).

### Camadas de saída

Cada `ProScreenLook` tem toggles independentes:

```text
presentation_background_enabled
presentation_foreground_enabled
announcements_enabled
props_layer_enabled
messages_layer_enabled
live_video_enabled
mask_uuid
template_document_file_path
template_slide_uuid
```

A API expõe as camadas `video_input`, `media`, `slide`, `announcements`, `props`, `messages`, `audio`. O modelo `Layer` tem 27 blend modes, opacidade, matte alpha/luma/white, effects, transition e hotkey.

### Máscaras

Máscara é um documento separado:

```text
Mask
  uuid, name, color
  mode: OVERLAY | KEYHOLE
  shapes: Graphics.Element[]
```

É aplicada por screen look via `mask_uuid`. O editor tem uma seção **Masks** no outline e um inspetor próprio.

### Messages

Mensagem é um documento separado:

```text
Message
  uuid, title, message_text
  tokens (text | timer | clock)
  token_values
  template (TemplateIdentification: theme slide)
  clear_type (manual | after time | after timers)
  visible_on_network
```

A mensagem usa um theme slide como layout e entra na camada **Messages**, com toggle por tela. É diferente de `DataLink.StageMessage`, que é a mensagem de palco.

### Editor

O editor do ProPresenter tem outline de camadas, canvas com régua/grid/guias e inspetor contextual:

```text
Theme Slide  → Background, Size
Presentation → Slide, Shape, Text, Build
Mask
Prop
Layout
```

Recursos avançados de texto: gradiente, cut-out, media fill, background blur/invert, scrolling e builds por bullet/underline.

## Decisões de arquitetura

1. **Modelo gráfico unificado, sem quebrar o legado.**
   Todo elemento passa a ter um núcleo gráfico comum (`bounds`, `rotation`, `opacity`, `fill`, `shape`, `stroke`, `shadow`, `feather`). Os campos antigos (`type`, `css`, `src`, `fill` string) continuam válidos e são normalizados na leitura.

2. **CSS como escape hatch.**
   O modelo estruturado é a fonte da verdade para as operações do editor; `css` continua existindo para propriedades avançadas e para temas antigos.

3. **Fundo como camada.**
   O fundo do tema vira um elemento/grupo travado no fim da pilha. `theme.css.background` continua como fallback e é migrado na primeira edição.

4. **Múltiplos slides nomeados por tema.**
   `ThemePage` evolui para aceitar mais de um slide por contexto, com `name` e `role` (`title`, `lyrics`, `scripture`, `lower-third`, `message`). A UI ganha uma barra de slides, não só slots fixos por contexto.

5. **Máscaras como documento próprio.**
   `Mask` não entra no tema; é um documento separado, aplicado por target/saída.

6. **Messages como documento próprio.**
   `Message` não entra no tema; referencia um theme slide como template e é renderizada em uma camada própria.

7. **Compositor de camadas por saída.**
   O vínculo atual “tema por target/asset” continua, mas a saída passa a ter um `OutputLook` com toggles de camadas e máscara.

8. **Compatibilidade.**
   Temas v1/v2 continuam abrindo. A migração para v3 é preguiçosa e reversível; export/import preserva o formato antigo quando não há recursos novos.

9. **Sem novas dependências.**
   Nada de fabric.js, Konva, Three.js ou similares. Formas e máscaras usam SVG/CSS; o que precisar de canvas continua no código atual.

10. **Assets fora do JSON.**
    Evitar data URLs grandes (noise, imagens) no `definition` do SQLite. O Studio deve listar temas por um resumo leve e carregar o tema completo só ao editar.

## Modelo alvo (TypeScript)

```ts
type Fill =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; css: string }
  | { kind: "media"; src: string; fit: "cover" | "contain" | "stretch"; align?: string; crop?: Insets }
  | { kind: "backdrop"; blur: number; saturation: number; invert?: boolean };

interface GraphicElement {
  id: string;
  name?: string;
  kind: "text" | "image" | "video" | "shape";
  shape?: "rect" | "rounded" | "ellipse" | "triangle" | "star" | "polygon" | "arrow";
  bounds: { left: number; top: number; width: number; height: number };
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  aspectLocked?: boolean;
  hidden?: boolean;
  fill?: Fill;
  stroke?: Stroke;
  shadow?: Shadow;
  feather?: number;
  text?: TextSpec;
  css?: Record<string, string>;
}
```

`ThemeSlide`:

```ts
interface ThemeSlide {
  id: string;
  name: string;
  role: "title" | "lyrics" | "scripture" | "lower-third" | "message" | "generic";
  context?: ThemeContext;
  css: Record<string, string>;
  elements: ThemeElement[];
}
```

`Mask`:

```ts
interface Mask {
  id: string;
  name: string;
  color: string;
  mode: "overlay" | "keyhole";
  shapes: ThemeElement[];
}
```

`Message`:

```ts
interface Message {
  id: string;
  title: string;
  text: string;
  tokens: MessageToken[];
  templateThemeGuid: string | null;
  templateSlideId: string | null;
  clearType: "manual" | "after-time" | "after-timers";
  timeToRemove?: number;
  visibleOnNetwork: boolean;
}
```

`OutputLook`:

```ts
interface OutputLook {
  id: string;
  target: OutputTarget;
  background: boolean;
  foreground: boolean;
  announcements: boolean;
  props: boolean;
  messages: boolean;
  liveVideo: boolean;
  maskId: string | null;
}
```

## Fases

- **Fase 0 — Performance e resposta do editor.** Memoização, coalescência de pointermove, fit sem posição, snap cacheado, previews preguiçosos no Studio. Sem mudança de modelo.
- **Fase 1 — Fundação gráfica.** Fill estruturado, formas, rotação/aspect lock, fundo como camada, múltiplos slides nomeados, schema v3 e migração.
- **Fase 2 — Máscaras.** Documento, editor, renderer SVG overlay/keyhole e vínculo por saída.
- **Fase 3 — Messages e looks.** Documento de mensagem, tokens, camada, compositor de saída e toggles por tela.
- **Fase 4 — Avançado.** Builds, text cut-out/media fill, scrolling, data links e importação de temas do ProPresenter.

## Fora de escopo

- Copiar os 27 blend modes, mattes alpha/luma/white e os ~37 data links de uma vez.
- RTF: continuamos com HTML/CSS.
- Background blur com seleção de uma camada específica no DOM; `backdrop-filter` é uma aproximação.
- Edição de vídeo/áudio e transport properties.
- Importação de temas do ProPresenter nesta primeira entrega.

## Critérios de sucesso

- Arrastar um tema com 10+ elementos não remede textos não afetados.
- Studio com 50+ temas não monta previews fora da viewport.
- `npm run typecheck` e `npm test` passam.
- Temas v1/v2 existentes abrem sem alteração visual.
- Nenhuma dependência nova é necessária para as fases 0–2.

## Restrições do workspace

- Disco com ~2 GiB livres no momento da criação.
- Worktree em `~/.local/share/opencode/worktree/f31e20/theme-editor-propresenter` (~6,3 MB).
- `node_modules` compartilhado por symlink com o checkout principal.
- `src-tauri/target` **não** é duplicado; usar `CARGO_TARGET_DIR` apontando para o target existente quando precisar compilar Rust.
- Evitar `npm install` e builds Tauri completos dentro do worktree.
