# Editor de Temas — Design

**Origem:** prints do Editor de Temas do Spresenter 0.3.50 (10 telas, fornecidas pelo usuário em 2026-10-16) + schema REA já implementado (`SlideTheme`/`ThemeElement`, evidências `ev_fa317e93…`, `ev_e6a71c15…`).
**Objetivo:** editor visual original, com as mesmas capacidades do referência, lendo/escrevendo nosso formato `SlideTheme` (sem copiar código, strings ou layout pixel-a-pixel do Spresenter).

## 1. Inventário do referência (o que as telas mostram)

Janela dedicada "Editor de Temas", título do tema ao centro, estado "Salvo" + menu ⋮ à direita.

- **Toolbar:** novo, selecionar (cursor), desfazer, refazer | adicionar Texto, Cor sólida (retângulo), Imagem, Vídeo, Web (globo), QR Code. (Ícone de "elo/corrente" entre retângulo e imagem — função desconhecida; fora do escopo.)
- **Seletor de saída:** "Principal (1920 x 1080)" — canvas sempre 16:9.
- **Ajudas de canvas:** Snap, Limite (moldura de área segura), Grid (tamanho 50), Réguas (px, ocultar/mostrar). Fundo xadrez = transparência.
- **Canvas:** clique seleciona (8 alças, contorno azul), renderização ao vivo do conteúdo de exemplo.
- **Camadas:** lista com ícone por tipo (T texto, globo web), clique seleciona. (Visibilidade/lock/reordem não visíveis nos prints — ver §3.)
- **PROPRIEDADES do elemento texto:** NOME; LAYOUT (X, Y px; L, A com alternador px/%; ALINHAR À TELA 6 botões; SCALE %; MARGEM T/R/B/L); TEXTO (Conteúdo textarea + botão `{·}` de variáveis; Fonte dropdown; TAM px; PESO dropdown; ALT. LIN px; ESPAÇ px; Cor picker; Horizontal 4; Vertical 3; Case 4 — Aa/AA/aa/Ab; Ajuste do texto dropdown "Quebra do texto"; Auto-escala checkbox); EFEITOS (+ Adicionar efeito); PREENCHIMENTO (+ Adicionar preenchimento); APARÊNCIA (Opacidade slider, BORDA px); ANIMAÇÃO (colapsada); TIMER (Visibilidade "Sempre"); VISIBILIDADE (colapsada); CSS AVANÇADO (pares chave/valor + Nova propriedade).
- **FUNDO PADRÃO** (sem seleção): "Nenhum fundo definido" + texto explicativo — imagem/vídeo do tema projetado na camada de fundo quando a estrofe não tem fundo próprio.

## 2. Mapeamento para nosso schema (tudo já existe no `ThemeElement`)

| Controle do referência | Nosso campo |
|---|---|
| NOME | `id` |
| X/Y/L/A, px/% | `x`, `y`, `css` (`left/top/width/height` com unidade) |
| ALINHAR À TELA, SCALE, MARGEM | DERIVADO (calcula `css`, não persiste; decisão minha) |
| Conteúdo, `{·}` | `text` (+ lista de variáveis por asset em `samples.ts`) |
| Fonte/TAM/PESO/ALT.LIN/ESPAÇ/Cor/H/V/Case/Ajuste | `css` (`font-family/size/weight/line-height/letter-spacing/color/text-align/justify-content/text-transform/white-space`) — Auto-escala OMITIDO V1 (renderer não implementa; prop morta seria enganosa) |
| Fonte/TAM/PESO/ALT.LIN/ESPAÇ/Cor/H/V/Case/Ajuste/Auto-escala | `css` (`font-family/size/weight/line-height/letter-spacing/color/text-align/justify-content/text-transform/white-space/textFit/autoScale`) |
| EFEITOS | `css.textShadow` (+ presets Sombra/Contorno/Brilho; decisão minha) |
| PREENCHIMENTO | `fill` + `background`/`url` (sólido/imagem; vídeo/web V2) |
| APARÊNCIA opacidade/borda | `css.opacity`, `css.border`/`borderRadius` |
| ANIMAÇÃO | `enterAnim`/`exitAnim` (select: Nenhuma/BLUR/…; timeline V2) |
| TIMER Visibilidade | `timerVisibility` (Sempre/Acima/Abaixo) + `timerThresholdSec` |
| VISIBILIDADE | `assetTypeVisibility[]` (music/bible/text) |
| CSS AVANÇADO | `css` cru (adicionar/remover pares) |
| FUNDO PADRÃO | `theme.css.background` (cor/gradiente/URL imagem; vídeo V2) |
| Camadas: visível/lock/excluir/reordenar | `visible`, `locked`, ordem do array = ordem de pintura, `remove` |

## 3. Decisões (minhas, para revisão)

1. **Onde vive:** janela Tauri dedicada `/#/theme-editor?guid=…` (comando `open_theme_editor`), espelhando a arquitetura do referência (janela própria). Não é aba das Preferências — canvas 1920×1080 precisa de espaço.
2. **Edição de geometria:** clique-seleciona + arrastar-move + alças de resize no canvas (proporcional com Shift); campos numéricos como alternativa exata. Réguas V2; Snap/Limite/Grid entram V1 (só CSS + toggles).
3. **Undo/redo:** pilha em memória de snapshots do JSON (limite 50). Barato e o referência tem.
4. **Save manual:** botão "Salvar" + badge "Salvo"/"Não salvo" (dirty tracking), chamando `store.save()`. Sem autosave (evita writes no SQLite a cada keystroke).
5. **Elo/corrente da toolbar:** função desconhecida → omitido; toolbar V1 = Texto, Cor sólida, Imagem, Vídeo, Web, QR Code.
6. **Fontes:** campo editável + presets (system stack + Google Fonts já usadas no app). Sem browser de fontes do SO em V1.
7. **Preview:** `ThemeRenderer` existente com seletor de amostra music/bible/text (igual à galeria). Zoom-to-fit no canvas, não `zoom:0.45` fixo.
8. **Fora V1 (futuro):** timeline/keyframes, stagger, textBackgroundMode, verseNumber styling, vídeo como fundo, régua, `slide`/`nextSlide` como src de IMAGE/VIDEO, presets de layout.

## 4. Não-metas / anti-metas

- Não clonar código, strings literais ou medidas exatas do Spresenter — implementação e textos originais, mesmo idioma.
- Não mexer na verificação de licença/integridade do Spresenter (fora de questão; nosso editor só lê/escreve `SlideTheme`).
- Não quebrar fallback: tema sem fundo/elemento continua projetando como hoje.
- Fracasso = editor que exige entender CSS para trocar fonte e fundo (o caso de uso primário tem que ser 3 cliques).

## 5. Fluxo principal (caso de uso âncora)

Usuário abre galeria → "Editar" num tema → janela do editor com canvas + camadas + propriedades → troca Fonte/TAM/Cor do `letra`, define FUNDO PADRÃO (cor ou imagem) → badge "Não salvo" → Salvar → volta à galeria, preview atualizado, telão usa novo visual via binding existente.

## 6. Aberto ao builder

Faixa estreita à direita do `AdminView` (4ª coluna) com miniaturas dos temas (mesmo `ThemeRenderer` + amostras da galeria, chaveado pelo kind ao vivo).
- Duplo-clique: vincula o tema ao kind público ao vivo (`setBinding("public", liveKind ?? "lyric", guid)`) — o telão troca na hora, pois `PublicView` resolve o tema a cada render.
- Botão direito: menu de contexto próprio (sem dep nova) com **Editar** (abre `openThemeEditor(guid)` / `window.open` no web), **Aplicar** (= duplo-clique) e **Remover** (confirmação em dois cliques).
- Colapsável (toggle persistido em localStorage); `load()` no mount; estado vazio com texto curto.

Componentes internos (hooks, subpastas), e estética exata dos painéis (seguir shadcn/dark do app). Contrato de rota IPC já existe (`saveTheme`); novo comando Tauri `open_theme_editor` segue o padrão de `open_output_window`, com semântica focar-existente (uma janela de editor por sessão; abrir outro tema carrega o guid nela).

## 7. Respostas da revisão técnica (consolidadas)

- **Geometria canônica:** espaço lógico 1920×1080. `x`/`y` = px; `css` espelha `left/top/width/height` (px por padrão; alternador L/A converte px↔% na escrita). Drag/resize/ALINHAR/MARGEM/SCALE escrevem nos dois; nada disso persiste além de `x/y/css`.
- **Variáveis `{·}`:** listas autoritativas = chaves de `buildProps` por asset (music, bible, text) + `HH:MM`. Amostras de preview centralizadas em `slide-themes/samples.ts` (extrair de `ThemesTab`, que passa a importar).
- **Ciclo de vida:** título editável no topbar do editor; criar/duplicar/excluir ficam na galeria. Menu ⋮ do editor: "Duplicar tema" (V2).
- **Mídia (imagem/vídeo/fundo):** upload copiado para app-data `theme-media/<guid>/arquivo`; referência persistida como `media://<guid>/arquivo` e resolvida no render para `http://<host>:5050/theme-media/…` (mesmo padrão do `/thumbnails/` existente; funciona offline e no navegador externo). Novo comando Rust `save_theme_media` (detalhes no plano).
- **ANIMAÇÃO / TIMER / auto-escala / tipos Web-QR:** exigem extensão de schema (Rust+TS+renderer) — **confirmado V2** pelo usuário em 2026-10-16. V1 = texto, formas, imagem, vídeo, fundo e visibilidade por tipo.

## 8. Trilho de temas (quick-switch, estilo Holyrics)

Faixa estreita à direita do `AdminView` (4ª coluna) com miniaturas dos temas (mesmo `ThemeRenderer` + amostras da galeria, chaveado pelo kind ao vivo).
- Duplo-clique: vincula o tema ao kind público ao vivo (`setBinding("public", liveKind ?? "lyric", guid)`) — o telão troca na hora, pois `PublicView` resolve o tema a cada render.
- Botão direito: menu de contexto próprio (sem dep nova) com **Editar** (abre `openThemeEditor(guid)` / `window.open` no web), **Aplicar** (= duplo-clique) e **Remover** (confirmação em dois cliques).
- Colapsável (toggle persistido em localStorage); `load()` no mount; estado vazio com texto curto.
