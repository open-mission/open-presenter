export type MediaFit = "cover" | "contain" | "scale-down" | "fill";

export const FIT_CLASSES: Record<MediaFit, string> = {
  cover: "object-cover",
  contain: "object-contain",
  "scale-down": "object-scale-down",
  fill: "object-fill",
};

export function parseMediaWithFit(value: string | undefined | null): {
  url: string;
  fit: MediaFit;
} {
  if (!value) return { url: "", fit: "cover" };
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return { url: trimmed, fit: "cover" };
  }
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex !== -1) {
    const hashPart = trimmed.slice(hashIndex + 1);
    const match = hashPart.match(/fit=(cover|contain|scale-down|fill)/);
    if (match) {
      return {
        url: trimmed.slice(0, hashIndex).trim(),
        fit: match[1] as MediaFit,
      };
    }
  }
  return { url: trimmed, fit: "cover" };
}

export function resolveThemeMediaUrl(
  value: string | undefined,
  host: string = "localhost",
  port: number = 5050,
): string | undefined {
  if (!value) return value;
  const { url, fit } = parseMediaWithFit(value);
  const hasExplicitFit = value.includes("fit=");
  const trimmed = url.trim();
  const match = trimmed.match(/^media:\/\/([^/]+)\/(.+)$/);
  if (!match) return value;
  const actualHost =
    !host || host === "tauri.localhost" || host === "localhost"
      ? "127.0.0.1"
      : host;
  const resolved = `http://${actualHost}:${port}/theme-media/${match[1]}/${match[2]}`;
  return hasExplicitFit ? `${resolved}#fit=${fit}` : resolved;
}

export function resolveCssMediaUrls(
  value: string | undefined,
  host: string = "localhost",
  port: number = 5050,
): string | undefined {
  if (!value) return value;
  const actualHost =
    !host || host === "tauri.localhost" || host === "localhost"
      ? "127.0.0.1"
      : host;
  return value.replace(
    /media:\/\/([^/\s)'"]+)\/([^)\s'"]+)/g,
    `http://${actualHost}:${port}/theme-media/$1/$2`,
  );
}

