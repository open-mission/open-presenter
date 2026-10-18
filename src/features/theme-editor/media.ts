import { isTauri } from "@/core/ipc/tauri";

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
  host?: string,
  port: number = 5050,
): string | undefined {
  if (!value) return value;
  const { url, fit } = parseMediaWithFit(value);
  const hasExplicitFit = value.includes("fit=");
  const trimmed = url.trim();
  const match = trimmed.match(/^media:\/\/([^/]+)\/(.+)$/);
  if (!match) return value;

  const category = match[1];
  const filename = match[2];

  // O servidor HTTP embutido (porta 5050) fornece rota /theme-media com CORS e Range headers.
  // Usar HTTP em vez de protocolo customizado (media://) evita que o WebKit (macOS) e Chromium
  // bloqueiem imagens em CSS background: url(...) ou causem erro de segurança de recurso local.
  let actualHost: string;
  if (isTauri()) {
    actualHost = "127.0.0.1";
  } else {
    const currentHost =
      typeof window !== "undefined" && window.location.hostname
        ? window.location.hostname
        : "127.0.0.1";
    actualHost =
      !host || host === "tauri.localhost" || host === "localhost"
        ? currentHost
        : host;
  }

  const currentPort =
    typeof window !== "undefined" && window.location.port
      ? Number(window.location.port) || port
      : port;
  const actualPort = port || currentPort;
  const resolved = `http://${actualHost}:${actualPort}/theme-media/${category}/${encodeURIComponent(filename)}`;

  return hasExplicitFit ? `${resolved}#fit=${fit}` : resolved;
}

/**
 * Resolve um caminho `media://...` para URL HTTP do servidor embutido.
 */
export function resolveMediaLibraryUrl(value: string, serverBase?: string): string {
  const match = value.match(/^media:\/\/([^/]+)\/(.+)$/);
  if (!match) return value;

  const relative = `${match[1]}/${match[2]}`;
  const base =
    serverBase && serverBase.startsWith("http")
      ? serverBase.replace(/\/$/, "")
      : "http://127.0.0.1:5050";

  return `${base}/theme-media/${relative}`;
}

export function resolveCssMediaUrls(
  value: string | undefined,
  host?: string,
  port: number = 5050,
): string | undefined {
  if (!value) return value;
  return value.replace(
    /media:\/\/([^/\s)'"]+)\/([^)\s'"]+)/g,
    (_full, category, file) => {
      const single = `media://${category}/${file}`;
      return resolveThemeMediaUrl(single, host, port) ?? single;
    },
  );
}

