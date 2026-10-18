/**
 * Motor e especificação do Interactive Shader Format (ISF 2.0).
 * https://isf.video/using-isf/
 */

export interface ISFInput {
  NAME: string;
  TYPE: "float" | "color" | "bool" | "point2D";
  LABEL?: string;
  DEFAULT?: number | number[] | boolean;
  MIN?: number;
  MAX?: number;
}

export interface ISFMetadata {
  ISFVSN?: string;
  DESCRIPTION?: string;
  CREDIT?: string;
  CATEGORIES?: string[];
  INPUTS?: ISFInput[];
}

export interface ISFPreset {
  id: string;
  name: string;
  desc: string;
  category: string;
  code: string;
}

export interface ParsedISF {
  metadata: ISFMetadata;
  glslCode: string;
  fullSource: string;
  error?: string;
}

export const ISF_PRESETS: ISFPreset[] = [
  {
    id: "plasma",
    name: "Plasma Fluido",
    desc: "Fluxo líquido de cores dinâmicas e fluidas",
    category: "Líquido",
    code: `/*{
  "ISFVSN": "2.0",
  "DESCRIPTION": "Plasma fluido dinâmico com controle de cores e velocidade",
  "CATEGORIES": ["Generator", "Liquid"],
  "INPUTS": [
    {
      "NAME": "speed",
      "LABEL": "Velocidade",
      "TYPE": "float",
      "DEFAULT": 1.0,
      "MIN": 0.1,
      "MAX": 3.0
    },
    {
      "NAME": "scale",
      "LABEL": "Escala",
      "TYPE": "float",
      "DEFAULT": 1.0,
      "MIN": 0.2,
      "MAX": 3.0
    },
    {
      "NAME": "intensity",
      "LABEL": "Intensidade",
      "TYPE": "float",
      "DEFAULT": 0.65,
      "MIN": 0.1,
      "MAX": 1.0
    },
    {
      "NAME": "color1",
      "LABEL": "Cor Primária",
      "TYPE": "color",
      "DEFAULT": [0.08, 0.25, 0.85, 1.0]
    },
    {
      "NAME": "color2",
      "LABEL": "Cor Secundária",
      "TYPE": "color",
      "DEFAULT": [0.65, 0.1, 0.8, 1.0]
    }
  ]
}*/

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - RENDERSIZE) / min(RENDERSIZE.x, RENDERSIZE.y) * scale;
  float t = TIME * 0.35 * speed;
  float v1 = sin(p.x * 2.5 + t);
  float v2 = sin(p.y * 3.0 - t * 0.8);
  float v3 = sin((p.x + p.y) * 2.0 + t * 1.2);
  float v4 = sin(length(p) * 3.5 - t);
  float v = (v1 + v2 + v3 + v4) * 0.25;
  vec3 mixedCol = mix(color1.rgb, color2.rgb, 0.5 + 0.5 * sin(v * 4.0 + t));
  vec3 darkBase = vec3(0.015, 0.02, 0.05);
  vec3 col = mix(darkBase, mixedCol, intensity);
  gl_FragColor = vec4(col, 1.0);
}
`,
  },
  {
    id: "aurora",
    name: "Aurora Boreal",
    desc: "Ondulações atmosféricas de luz cósmica no horizonte",
    category: "Atmosfera",
    code: `/*{
  "ISFVSN": "2.0",
  "DESCRIPTION": "Ondulações atmosféricas de luz cósmica estilo Aurora Boreal",
  "CATEGORIES": ["Generator", "Atmosphere"],
  "INPUTS": [
    {
      "NAME": "speed",
      "LABEL": "Velocidade",
      "TYPE": "float",
      "DEFAULT": 1.0,
      "MIN": 0.1,
      "MAX": 3.0
    },
    {
      "NAME": "waveHeight",
      "LABEL": "Altura da Onda",
      "TYPE": "float",
      "DEFAULT": 0.2,
      "MIN": 0.05,
      "MAX": 0.5
    },
    {
      "NAME": "auroraColor",
      "LABEL": "Cor da Aurora",
      "TYPE": "color",
      "DEFAULT": [0.1, 0.85, 0.55, 1.0]
    },
    {
      "NAME": "skyColor",
      "LABEL": "Cor do Céu",
      "TYPE": "color",
      "DEFAULT": [0.35, 0.08, 0.65, 1.0]
    }
  ]
}*/

void main() {
  vec2 uv = gl_FragCoord.xy / RENDERSIZE;
  float t = TIME * 0.3 * speed;
  float wave1 = sin(uv.x * 4.0 + t) * waveHeight + 0.5;
  float wave2 = sin(uv.x * 6.5 - t * 0.7) * (waveHeight * 0.8) + 0.45;
  float dist1 = 1.0 - smoothstep(0.0, 0.25, abs(uv.y - wave1));
  float dist2 = 1.0 - smoothstep(0.0, 0.3, abs(uv.y - wave2));
  vec3 c1 = auroraColor.rgb * dist1;
  vec3 c2 = skyColor.rgb * dist2;
  vec3 base = vec3(0.015, 0.015, 0.04);
  gl_FragColor = vec4(base + c1 + c2, 1.0);
}
`,
  },
  {
    id: "particles",
    name: "Nebulosa Cósmica",
    desc: "Partículas luminosas flutuantes com brilho dinâmico",
    category: "Espaço",
    code: `/*{
  "ISFVSN": "2.0",
  "DESCRIPTION": "Partículas luminosas flutuantes com brilho dinâmico",
  "CATEGORIES": ["Generator", "Space"],
  "INPUTS": [
    {
      "NAME": "speed",
      "LABEL": "Velocidade",
      "TYPE": "float",
      "DEFAULT": 1.0,
      "MIN": 0.1,
      "MAX": 3.0
    },
    {
      "NAME": "glowSize",
      "LABEL": "Brilho / Glow",
      "TYPE": "float",
      "DEFAULT": 1.0,
      "MIN": 0.3,
      "MAX": 2.5
    },
    {
      "NAME": "particleColor",
      "LABEL": "Cor das Partículas",
      "TYPE": "color",
      "DEFAULT": [0.3, 0.65, 1.0, 1.0]
    }
  ]
}*/

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - RENDERSIZE) / min(RENDERSIZE.x, RENDERSIZE.y);
  float t = TIME * 0.25 * speed;
  vec3 col = vec3(0.01, 0.015, 0.035);
  for (float i = 0.0; i < 28.0; i++) {
    vec2 pos = vec2(sin(i * 1.5 + t * (0.3 + hash(vec2(i, 0.0)) * 0.3)), cos(i * 2.1 + t * 0.4)) * 0.85;
    float dist = length(uv - pos);
    float glow = (0.012 * glowSize) / (dist + 0.008);
    vec3 pcol = mix(particleColor.rgb, vec3(1.0, 0.6, 0.2), hash(vec2(i, 1.0)) * 0.5);
    col += pcol * glow * 0.35;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  },
  {
    id: "gradient-wave",
    name: "Ondas Modernas",
    desc: "Malha suave de gradientes líquidos ondulantes",
    category: "Minimalista",
    code: `/*{
  "ISFVSN": "2.0",
  "DESCRIPTION": "Malha suave de gradientes líquidos ondulantes",
  "CATEGORIES": ["Generator", "Minimal"],
  "INPUTS": [
    {
      "NAME": "speed",
      "LABEL": "Velocidade",
      "TYPE": "float",
      "DEFAULT": 1.0,
      "MIN": 0.1,
      "MAX": 3.0
    },
    {
      "NAME": "waveFreq",
      "LABEL": "Frequência",
      "TYPE": "float",
      "DEFAULT": 3.0,
      "MIN": 1.0,
      "MAX": 8.0
    },
    {
      "NAME": "colorA",
      "LABEL": "Cor de Início",
      "TYPE": "color",
      "DEFAULT": [0.15, 0.05, 0.35, 1.0]
    },
    {
      "NAME": "colorB",
      "LABEL": "Cor de Fim",
      "TYPE": "color",
      "DEFAULT": [0.03, 0.3, 0.45, 1.0]
    }
  ]
}*/

void main() {
  vec2 uv = gl_FragCoord.xy / RENDERSIZE;
  float t = TIME * 0.35 * speed;
  float c = sin(uv.x * waveFreq + t) + cos(uv.y * waveFreq - t * 0.6);
  vec3 col = mix(colorA.rgb, colorB.rgb, c * 0.5 + 0.5);
  col += vec3(0.08, 0.02, 0.12) * sin(uv.y * 6.0 + t);
  gl_FragColor = vec4(col, 1.0);
}
`,
  },
  {
    id: "worship-rays",
    name: "Raios de Luz",
    desc: "Raios volumétricos solenes para louvor e momentos sacros",
    category: "Adoração",
    code: `/*{
  "ISFVSN": "2.0",
  "DESCRIPTION": "Raios volumétricos de luz para adoração e fundos solenes",
  "CATEGORIES": ["Generator", "Worship"],
  "INPUTS": [
    {
      "NAME": "speed",
      "LABEL": "Velocidade",
      "TYPE": "float",
      "DEFAULT": 0.8,
      "MIN": 0.1,
      "MAX": 3.0
    },
    {
      "NAME": "rayCount",
      "LABEL": "Densidade dos Raios",
      "TYPE": "float",
      "DEFAULT": 12.0,
      "MIN": 4.0,
      "MAX": 24.0
    },
    {
      "NAME": "lightColor",
      "LABEL": "Cor dos Raios",
      "TYPE": "color",
      "DEFAULT": [0.95, 0.8, 0.45, 1.0]
    }
  ]
}*/

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - RENDERSIZE) / min(RENDERSIZE.x, RENDERSIZE.y);
  float angle = atan(uv.y + 0.6, uv.x);
  float dist = length(vec2(uv.x, uv.y + 0.6));
  float t = TIME * 0.25 * speed;
  float rays = sin(angle * rayCount + t) * 0.5 + 0.5;
  rays = pow(rays, 2.5);
  float falloff = 1.0 / (dist * 1.2 + 0.5);
  vec3 col = lightColor.rgb * rays * falloff * 0.7;
  vec3 ambient = vec3(0.02, 0.015, 0.04);
  gl_FragColor = vec4(ambient + col, 1.0);
}
`,
  },
];

/**
 * Faz o parse de um shader no formato ISF (extrai bloco JSON de cabeçalho e código GLSL).
 */
export function parseISF(source: string): ParsedISF {
  const match = source.match(/\/\*(\{[\s\S]*?\})\*\//);
  let metadata: ISFMetadata = {};
  let glslCode = source;

  if (match) {
    try {
      metadata = JSON.parse(match[1]);
      glslCode = source.replace(match[0], "").trim();
    } catch (e) {
      return {
        metadata: {},
        glslCode: source,
        fullSource: source,
        error: `Erro ao interpretar cabeçalho JSON do ISF: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  return {
    metadata,
    glslCode,
    fullSource: source,
  };
}

/**
 * Cria o código GLSL fragment compilável injetando os uniformes padrões do ISF (TIME, RENDERSIZE)
 * e os uniformes declarados em INPUTS se ainda não estiverem declarados explicitamente.
 */
export function buildISFFragmentSource(parsed: ParsedISF): string {
  const inputs = parsed.metadata.INPUTS ?? [];
  const lines: string[] = ["precision mediump float;"];

  // Variáveis built-in do padrão ISF
  lines.push("uniform float TIME;");
  lines.push("uniform vec2 RENDERSIZE;");
  lines.push("uniform float u_time;");
  lines.push("uniform vec2 u_resolution;");

  // Injeta uniformes para os inputs declarados
  for (const input of inputs) {
    const name = input.NAME.trim();
    if (!name) continue;

    const regex = new RegExp(`uniform\\s+\\w+\\s+${name}\\b`);
    if (regex.test(parsed.glslCode)) continue;

    switch (input.TYPE) {
      case "float":
        lines.push(`uniform float ${name};`);
        break;
      case "color":
        lines.push(`uniform vec4 ${name};`);
        break;
      case "bool":
        lines.push(`uniform bool ${name};`);
        break;
      case "point2D":
        lines.push(`uniform vec2 ${name};`);
        break;
    }
  }

  lines.push("");
  lines.push(parsed.glslCode);
  return lines.join("\n");
}

export interface ISFProgramBundle {
  program: WebGLProgram;
  positionLoc: number;
  timeLoc: WebGLUniformLocation | null;
  renderSizeLoc: WebGLUniformLocation | null;
  uTimeLoc: WebGLUniformLocation | null;
  uResLoc: WebGLUniformLocation | null;
  inputLocs: Record<string, WebGLUniformLocation>;
  metadata: ISFMetadata;
}

const VERTEX_SHADER_SRC = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * Compila e linka o shader ISF em um WebGLProgram.
 */
export function compileISF(
  gl: WebGLRenderingContext,
  source: string,
): { bundle?: ISFProgramBundle; error?: string } {
  const parsed = parseISF(source);
  if (parsed.error) return { error: parsed.error };

  const fragSource = buildISFFragmentSource(parsed);

  function createShader(type: number, src: string): { shader?: WebGLShader; error?: string } {
    const s = gl.createShader(type);
    if (!s) return { error: "Falha ao alocar WebGLShader" };
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s) ?? "Erro desconhecido de compilação";
      gl.deleteShader(s);
      return { error: info };
    }
    return { shader: s };
  }

  const vsRes = createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
  if (vsRes.error || !vsRes.shader) return { error: vsRes.error ?? "Erro no Vertex Shader" };

  const fsRes = createShader(gl.FRAGMENT_SHADER, fragSource);
  if (fsRes.error || !fsRes.shader) {
    gl.deleteShader(vsRes.shader);
    return { error: fsRes.error ?? "Erro no Fragment Shader" };
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vsRes.shader);
    gl.deleteShader(fsRes.shader);
    return { error: "Falha ao alocar WebGLProgram" };
  }

  gl.attachShader(program, vsRes.shader);
  gl.attachShader(program, fsRes.shader);
  gl.linkProgram(program);

  // Shaders já podem ser marcados para descarte após attach
  gl.deleteShader(vsRes.shader);
  gl.deleteShader(fsRes.shader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Erro ao linkar programa WebGL";
    gl.deleteProgram(program);
    return { error: info };
  }

  const positionLoc = gl.getAttribLocation(program, "position");
  const timeLoc = gl.getUniformLocation(program, "TIME");
  const renderSizeLoc = gl.getUniformLocation(program, "RENDERSIZE");
  const uTimeLoc = gl.getUniformLocation(program, "u_time");
  const uResLoc = gl.getUniformLocation(program, "u_resolution");

  const inputLocs: Record<string, WebGLUniformLocation> = {};
  for (const input of parsed.metadata.INPUTS ?? []) {
    const loc = gl.getUniformLocation(program, input.NAME);
    if (loc) inputLocs[input.NAME] = loc;
  }

  return {
    bundle: {
      program,
      positionLoc,
      timeLoc,
      renderSizeLoc,
      uTimeLoc,
      uResLoc,
      inputLocs,
      metadata: parsed.metadata,
    },
  };
}

/**
 * Aplica os valores dos inputs/uniformes na chamada de desenho.
 */
export function applyISFUniforms(
  gl: WebGLRenderingContext,
  bundle: ISFProgramBundle,
  values: Record<string, any>,
  timeSeconds: number,
  width: number,
  height: number,
) {
  if (bundle.timeLoc) gl.uniform1f(bundle.timeLoc, timeSeconds);
  if (bundle.uTimeLoc) gl.uniform1f(bundle.uTimeLoc, timeSeconds);

  if (bundle.renderSizeLoc) gl.uniform2f(bundle.renderSizeLoc, width, height);
  if (bundle.uResLoc) gl.uniform2f(bundle.uResLoc, width, height);

  const inputs = bundle.metadata.INPUTS ?? [];
  for (const input of inputs) {
    const loc = bundle.inputLocs[input.NAME];
    if (!loc) continue;

    const val = values[input.NAME] !== undefined ? values[input.NAME] : input.DEFAULT;

    switch (input.TYPE) {
      case "float":
        if (typeof val === "number") {
          gl.uniform1f(loc, val);
        } else if (typeof input.DEFAULT === "number") {
          gl.uniform1f(loc, input.DEFAULT);
        }
        break;

      case "color":
        if (Array.isArray(val) && val.length >= 3) {
          gl.uniform4f(
            loc,
            val[0] ?? 1,
            val[1] ?? 1,
            val[2] ?? 1,
            val[3] !== undefined ? val[3] : 1.0,
          );
        } else if (Array.isArray(input.DEFAULT) && input.DEFAULT.length >= 3) {
          gl.uniform4f(
            loc,
            input.DEFAULT[0] ?? 1,
            input.DEFAULT[1] ?? 1,
            input.DEFAULT[2] ?? 1,
            input.DEFAULT[3] !== undefined ? input.DEFAULT[3] : 1.0,
          );
        }
        break;

      case "bool":
        gl.uniform1i(loc, Boolean(val) ? 1 : 0);
        break;

      case "point2D":
        if (Array.isArray(val) && val.length >= 2) {
          gl.uniform2f(loc, val[0], val[1]);
        }
        break;
    }
  }
}

// ---------------------------------------------------------
// Utilitários de Serialização / Deserialização para Theme CSS
// ---------------------------------------------------------

export interface ISFBackgroundData {
  id?: string;
  code?: string;
  inputs?: Record<string, any>;
}

export function isIsfBackground(bg: string | undefined | null): boolean {
  if (!bg) return false;
  const s = bg.trim();
  return s.startsWith("isf:") || (s.includes("/*{") && s.includes("void main"));
}

export function parseISFBackground(bg: string | undefined | null): ISFBackgroundData {
  if (!bg) return { id: "plasma", inputs: {} };
  const s = bg.trim();
  if (s.startsWith("isf:")) {
    const payload = s.slice(4).trim();
    if (payload.startsWith("{")) {
      try {
        return JSON.parse(payload) as ISFBackgroundData;
      } catch {
        // fallback
      }
    }
    return { id: payload || "plasma", inputs: {} };
  }
  if (s.includes("/*{")) {
    return { code: s, inputs: {} };
  }
  return { id: "plasma", inputs: {} };
}

export function serializeISFBackground(data: ISFBackgroundData): string {
  return `isf:${JSON.stringify(data)}`;
}

/**
 * Retorna o código GLSL completo de um ISFBackgroundData.
 */
export function resolveISFSource(data: ISFBackgroundData): string {
  if (data.code && data.code.trim()) {
    return data.code;
  }
  const preset = ISF_PRESETS.find((p) => p.id === data.id) ?? ISF_PRESETS[0];
  return preset.code;
}
