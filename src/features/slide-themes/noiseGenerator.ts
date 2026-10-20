export interface NoiseOptions {
  opacity?: number; // 0.02 to 0.6 (default: 0.15)
  grainSize?: number; // 1 (fine), 2 (medium), 3 (coarse)
  monochrome?: boolean; // true for grayscale, false for chromatic noise
  width?: number; // default: 128
  height?: number; // default: 128
}

export interface NoisePreset {
  id: string;
  name: string;
  desc: string;
  options: NoiseOptions;
}

export const NOISE_PRESETS: NoisePreset[] = [
  {
    id: "fine-cinema",
    name: "Grão Fino Cinematográfico",
    desc: "Textura sutil para eliminar banding de gradientes",
    options: { opacity: 0.12, grainSize: 1, monochrome: true },
  },
  {
    id: "analog-paper",
    name: "Textura Analógica",
    desc: "Sensação orgânica de filme e papel texturizado",
    options: { opacity: 0.22, grainSize: 2, monochrome: true },
  },
  {
    id: "coarse-grain",
    name: "Granulação Marcante",
    desc: "Estilo retrô e fosco de alto contraste",
    options: { opacity: 0.35, grainSize: 2, monochrome: true },
  },
  {
    id: "subtle-clean",
    name: "Ruído Suave (Anti-Banding)",
    desc: "Quase imperceptível, apenas para suavizar cores",
    options: { opacity: 0.07, grainSize: 1, monochrome: true },
  },
  {
    id: "color-grain",
    name: "Ruído Cromático RGB",
    desc: "Micro-partículas coloridas sutis",
    options: { opacity: 0.16, grainSize: 1, monochrome: false },
  },
];

/**
 * Gera um SVG procedural com filtro feTurbulence codificado como Data URL.
 * Funciona de forma idêntica no navegador, no Node.js e no WebKit.
 */
export function generateSvgNoiseDataUrl(options: NoiseOptions = {}): string {
  const opacity = options.opacity ?? 0.15;
  const grainSize = options.grainSize ?? 1;
  const freq = grainSize === 3 ? 0.45 : grainSize === 2 ? 0.65 : 0.85;
  const sat = options.monochrome === false ? "1" : "0";

  const svg = `<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='${sat}'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='${opacity}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Gera um PNG em memória via Canvas (se disponível) ou recorre ao SVG Data URL.
 * Produz um padrão contínuo sem emendas (seamless tiling).
 */
export function generateNoiseDataUrl(options: NoiseOptions = {}): string {
  if (typeof document === "undefined") {
    return generateSvgNoiseDataUrl(options);
  }

  try {
    const w = options.width ?? 128;
    const h = options.height ?? 128;
    const opacity = options.opacity ?? 0.15;
    const grainSize = options.grainSize ?? 1;
    const monochrome = options.monochrome ?? true;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return generateSvgNoiseDataUrl(options);

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y += grainSize) {
      for (let x = 0; x < w; x += grainSize) {
        let r = 0;
        let g = 0;
        let b = 0;
        if (monochrome) {
          const val = Math.floor(Math.random() * 256);
          r = val;
          g = val;
          b = val;
        } else {
          r = Math.floor(Math.random() * 256);
          g = Math.floor(Math.random() * 256);
          b = Math.floor(Math.random() * 256);
        }
        const a = Math.floor(Math.random() * 256 * opacity);

        for (let dy = 0; dy < grainSize && y + dy < h; dy++) {
          for (let dx = 0; dx < grainSize && x + dx < w; dx++) {
            const idx = ((y + dy) * w + (x + dx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return `url("${canvas.toDataURL("image/png")}")`;
  } catch {
    return generateSvgNoiseDataUrl(options);
  }
}

/**
 * Verifica se uma string de background CSS já contém uma camada de ruído Data URL.
 */
export function hasNoiseLayer(background: string | undefined | null): boolean {
  if (!background) return false;
  return background.includes("data:image/png;base64") || background.includes("data:image/svg+xml");
}

/**
 * Aplica ou substitui a camada de ruído sobre o plano de fundo atual.
 * Se o fundo já tiver gradiente ou cor, coloca o ruído como primeira camada:
 * `url(data:image/...), <fundo_original>`
 */
export function applyNoiseToBackground(currentBg: string | undefined | null, noiseUrl: string): string {
  const cleanBase = removeNoiseFromBackground(currentBg);
  const base = cleanBase.trim() || "#000000";
  return `${noiseUrl}, ${base}`;
}

/**
 * Remove a camada de ruído de um plano de fundo composto, mantendo o gradiente ou cor de base.
 */
export function removeNoiseFromBackground(background: string | undefined | null): string {
  if (!background) return "";
  // Procura padrões de url("data:image/...") seguidos de vírgula
  const stripped = background
    .replace(/url\(\s*["']?data:image\/[^"'\)]+["']?\s*\)\s*,?\s*/gi, "")
    .trim();
  // Limpa vírgulas residuais no início ou fim
  return stripped.replace(/^,\s*/, "").replace(/,\s*$/, "");
}
