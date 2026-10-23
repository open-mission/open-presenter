import type { OutputCategory, OutputType } from "@/core/types";

export interface ResolutionPreset {
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
}

export const COMMON_RESOLUTIONS: ResolutionPreset[] = [
  { label: "1080p (Full HD) — 1920 x 1080", width: 1920, height: 1080, aspectRatio: "16:9" },
  { label: "1050p (Mac Retina / Widescreen) — 1680 x 1050", width: 1680, height: 1050, aspectRatio: "16:10" },
  { label: "720p (HD) — 1280 x 720", width: 1280, height: 720, aspectRatio: "16:9" },
  { label: "1440p (2K Quad HD) — 2560 x 1440", width: 2560, height: 1440, aspectRatio: "16:9" },
  { label: "4K (Ultra HD) — 3840 x 2160", width: 3840, height: 2160, aspectRatio: "16:9" },
  { label: "XGA (Projetor 4:3) — 1024 x 768", width: 1024, height: 768, aspectRatio: "4:3" },
  { label: "SXGA (Projetor 4:3) — 1400 x 1050", width: 1400, height: 1050, aspectRatio: "4:3" },
  { label: "Personalizado...", width: 1920, height: 1080, aspectRatio: "custom" },
];

export const CATEGORY_LABELS: Record<OutputCategory, { title: string; desc: string }> = {
  public: {
    title: "Público",
    desc: "Projeção principal voltada para a congregação / audiência.",
  },
  stage: {
    title: "Palco",
    desc: "Monitor de retorno para cantores, músicos e palestrantes.",
  },
  lower: {
    title: "Lower Third",
    desc: "Legendas e terços inferiores para OBS, vMix e transmissão.",
  },
};

export const TYPE_LABELS: Record<OutputType, { name: string; short: string; badge: string }> = {
  monitor: { name: "Monitor Físico", short: "Monitor", badge: "Display" },
  html: { name: "Saída Web (HTML)", short: "HTML", badge: "Web" },
  ndi: { name: "Stream NDI (Rede)", short: "NDI", badge: "NDI" },
  virtual: { name: "Monitor Virtual", short: "Virtual", badge: "Em breve" },
};

export type TestPatternType =
  | "smpte"
  | "grid"
  | "white"
  | "black"
  | "grayscale"
  | "circle";

export interface TestPatternInfo {
  id: TestPatternType;
  title: string;
  description: string;
}

export const TEST_PATTERNS: TestPatternInfo[] = [
  { id: "smpte", title: "Barras de Cores SMPTE", description: "Padrão industrial para calibração de cor, brilho e contraste." },
  { id: "grid", title: "Grade de Alinhamento", description: "Linhas quadriculadas para verificar keystone e geometria do projetor." },
  { id: "circle", title: "Círculo de Proporção", description: "Verifica se a tela está esticada ou com distorção de aspecto." },
  { id: "grayscale", title: "Degradê de Cinza (10 Passos)", description: "Calibração de escala de cinza e curva de gama." },
  { id: "white", title: "Branco 100%", description: "Teste de uniformidade de luz e detecção de pixels mortos." },
  { id: "black", title: "Preto 100%", description: "Teste de nível de preto e vazamento de backlight." },
];
