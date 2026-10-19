---
name: open-presenter-theme-creator
description: >-
  Guides the creation, design, validation, and JSON export of slide themes for Open Presenter.
  Use this skill whenever asked to create, design, customize, troubleshoot, or export themes for church projection,
  including worship lyrics (louvor), bible scripture (bíblia), stage return monitors (retorno/stage), lower thirds (OBS/transmissão),
  or general announcement/ministration slides.
---

# Open Presenter — Theme Creator Skill

This skill instructs agents and AI models on how to design, format, and generate 100% compliant `.openpresenter-theme.json` files for **Open Presenter**.

--------------------------------------------------------------------------------

## 1. Quick Overview & Architecture

Themes in Open Presenter are stored as JSON and rendered in a 16:9 canvas (scaled dynamically to any output display or window size).
They can be imported and exported via the Themes Gallery in **Preferências > Temas** or via the **Editor de Temas**.

### File Structure (.openpresenter-theme.json)

```json
{
  "$schema": "https://openpresenter.dev/schemas/theme-v1.json",
  "format": "open-presenter-theme",
  "version": 1,
  "exportedAt": "2026-10-19T13:30:00.000Z",
  "theme": {
    "guid": "optional-uuid-v4",
    "title": "Nome do Tema",
    "category": "theme",
    "css": {
      "background": "#000000"
    },
    "elements": [
      {
        "id": "texto-principal",
        "type": "TEXT",
        "x": 8,
        "y": 15,
        "visible": true,
        "locked": false,
        "text": "{verse}",
        "css": {
          "top": "15%",
          "left": "8%",
          "width": "84%",
          "height": "70%",
          "textAlign": "center",
          "fontSize": "52px",
          "fontWeight": "600",
          "lineHeight": "1.35",
          "color": "#ffffff",
          "textShadow": "0 2px 12px rgba(0,0,0,0.85)",
          "whiteSpace": "pre-wrap",
          "autoShrink": "true"
        }
      }
    ]
  }
}
```

--------------------------------------------------------------------------------

## 2. Element Types

| Element Type | Primary Properties | Usage |
| :--- | :--- | :--- |
| `TEXT` | `text`, `css` | Render lyrics, scripture, titles, clocks, or previews with template variables `{...}` |
| `RECTANGLE` | `fill`, `css` | Background boxes, badges, accent lines, lower-third containers |
| `IMAGE` | `src`, `css` | Static logos, watermarks, decorative icons |
| `VIDEO` | `src`, `css` | Video loop backgrounds or media panels |

--------------------------------------------------------------------------------

## 3. Dynamic Template Variables

Elements with `type: "TEXT"` parse placeholders `{variable}` dynamically during live presentation:

### Bíblia / Scripture (`scripture`)
- `{title}` ou `{titulo}`: Referência formatada (ex: `Gênesis 1:1 (NVI)`)
- `{verse}` ou `{verso}`: Texto do versículo (ou da parte `1/2` se versículo longo estiver dividido)
- `{book}` ou `{livro}`: Nome do livro bíblico
- `{chapter}` ou `{capitulo}`: Capítulo
- `{verse_number}` ou `{versiculo}`: Versículo
- `{version}` ou `{versao}`: Tradução bíblica (NVI, ARA, NTLH)
- `{next_preview}` ou `{proximo_resumo}`: Início do próximo versículo com `...` (ex: `E a terra era sem forma...`)
- `{next_verse}`: Conteúdo do próximo versículo

### Louvor / Música (`lyric`)
- `{lyrics}` ou `{letra}`: Estrofe atual
- `{title}` ou `{titulo}`: Título da música
- `{artist}` ou `{artista}`: Artista / Banda
- `{section}` ou `{secao}`: Identificador da seção (Verso 1, Refrão, Ponte)
- `{next_preview}` ou `{proximo_resumo}`: Início da próxima estrofe com `...`
- `{next_line}` ou `{proxima_linha}`: Primeira linha exata da próxima estrofe

### Monitor de Retorno / Stage (`stage`)
- `{clock}` ou `{hora}`: Relógio de parede do sistema (ex: `19:45`)
- `{stopwatch}` ou `{cronometro}`: Cronômetro progressivo (`MM:SS`)
- `{timer}` ou `{countdown}`: Cronômetro regressivo
- `{lyrics}` ou `{letra}`: Conteúdo principal atual
- `{next_verse}` ou `{proximo_versiculo}`: Conteúdo completo do próximo slide
- `{next_preview}`: Resumo inicial da próxima estrofe com `...`
- `{prev_verse}`: Conteúdo do slide anterior

*Para o catálogo detalhado, consulte [variables-guide.md](./references/variables-guide.md).*

--------------------------------------------------------------------------------

## 4. Design Guidelines for Church Projection

When creating themes, adhere to the following projection principles:

1. **Safe Margins:**
   - Always leave a safe margin of **6% to 10%** from canvas edges (`left: "8%"`, `width: "84%"`).
   - Prevents cut-offs on projectors, LED walls, and TVs with overscan.
2. **High Legibility & Contrast:**
   - Text color: `#ffffff` or light cream `#f8fafc`.
   - Text shadow: `textShadow: "0 2px 10px rgba(0,0,0,0.85)"` ensures readability over camera feeds or dynamic background loops.
3. **Auto-Scaling:**
   - Always include `"autoShrink": "true"` and `"whiteSpace": "pre-wrap"` on main lyric/verse elements so longer texts scale down without clipping.
4. **Visual Hierarchy:**
   - Reference / Title: `22px` - `32px`, `fontWeight: "600"` or `"700"`, `letterSpacing: "2px"` to `"4px"`, often `textTransform: "uppercase"`.
   - Body verse / lyric: `48px` - `64px`, `fontWeight: "600"` or `"700"`, `lineHeight: "1.25"` - `"1.35"`.
   - Next preview badge: `18px` - `22px`, muted color (`rgba(255,255,255,0.7)`), `fontStyle: "italic"` or subtle capsule container.

--------------------------------------------------------------------------------

## 5. Workflow: Generating and Validating a Theme

1. **Determine Category & Purpose:**
   - Telão / Projeção: `"category": "theme"`
   - Retorno de Palco: `"category": "stage"`
   - Lower Third (OBS): `"category": "theme"`, `"css": { "background": "transparent" }`
2. **Draft the JSON Package:**
   - Follow the schema in [theme-schema.json](./references/theme-schema.json).
   - Or start from one of the reference examples:
     - [Bíblia com Preview](./examples/biblia-moderna-com-preview.openpresenter-theme.json)
     - [Louvor Clean Minimal](./examples/louvor-clean-minimal.openpresenter-theme.json)
     - [Retorno de Palco Completo](./examples/stage-monitor-completo.openpresenter-theme.json)
     - [Lower Third Transmissão](./examples/lower-third-transmissao.openpresenter-theme.json)
3. **Validate:**
   - Run the validation script:
     ```bash
     node .agents/skills/open-presenter-theme-creator/scripts/validate-theme.mjs <caminho-do-arquivo.json>
     ```
4. **Instructing External AIs:**
   - If prompting ChatGPT, Claude, or other LLMs to design themes, use the prompt template in [prompt-for-other-ais.md](./references/prompt-for-other-ais.md).
