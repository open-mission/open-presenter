export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;

  const hex = trimmed.slice(1).toLowerCase();
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((character) => character + character)
      .join("")}`;
  }

  return `#${hex}`;
}

export function hexToRgb(value: string): RgbColor | null {
  const normalized = normalizeHex(value);
  if (!normalized) return null;

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => clampChannel(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function mixHex(from: string, to: string, weight: number): string {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);
  if (!fromRgb || !toRgb) return normalizeHex(from) ?? "#000000";

  const amount = Math.min(1, Math.max(0, weight));
  return rgbToHex(
    fromRgb.r + (toRgb.r - fromRgb.r) * amount,
    fromRgb.g + (toRgb.g - fromRgb.g) * amount,
    fromRgb.b + (toRgb.b - fromRgb.b) * amount,
  );
}

function toLinearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(value: string): number {
  const rgb = hexToRgb(value);
  if (!rgb) return 0;

  return (
    0.2126 * toLinearChannel(rgb.r) +
    0.7152 * toLinearChannel(rgb.g) +
    0.0722 * toLinearChannel(rgb.b)
  );
}

export function contrastColor(
  value: string,
  dark = "#111318",
  light = "#ffffff",
): string {
  return relativeLuminance(value) > 0.5 ? dark : light;
}

export function cssColorToHex(
  value: string,
  backdrop = "#ffffff",
): string | null {
  const direct = normalizeHex(value);
  if (direct) return direct;

  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = normalizeHex(backdrop) ?? "#ffffff";
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);

  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return rgbToHex(r, g, b);
}
