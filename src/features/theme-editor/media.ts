import { isMediaServerRunning, resolveMediaPort } from "@/core/config/mediaPort";
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
  port?: number,
): string | undefined {
  if (!value) return value;
  const { url, fit } = parseMediaWithFit(value);
  const hasExplicitFit = value.includes("fit=");
  const trimmed = url.trim();
  const match = trimmed.match(/^media:\/\/([^/]+)\/(.+)$/);
  if (!match) return value;

  const category = match[1];
  const filename = match[2];

  // Apenas se o servidor HTTP local estiver explicitamente parado no desktop
  // tentamos o protocolo customizado media://. Caso contrário, usamos a porta HTTP
  // resolvida (embutida) que suporta CORS e Range headers no WebKit e Chromium.
  if (isTauri() && isMediaServerRunning() === false) {
    return hasExplicitFit ? `${trimmed}#fit=${fit}` : trimmed;
  }

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

  const actualPort = resolveMediaPort(port);
  const encodedPath = filename.split("/").map(encodeURIComponent).join("/");
  const resolved = `http://${actualHost}:${actualPort}/theme-media/${category}/${encodedPath}`;

  return hasExplicitFit ? `${resolved}#fit=${fit}` : resolved;
}

/**
 * Resolve um caminho `media://...` para a URL servida pelo app.
 * - Desktop com servidor ativo: HTTP em 127.0.0.1 na porta configurada.
 * - Desktop sem servidor: mantém o protocolo customizado `media://`.
 * - Navegador/remoto: caminho relativo, preservando host e porta de origem.
 */
export function resolveMediaLibraryUrl(value: string, serverBase?: string): string {
  const match = value.match(/^media:\/\/([^/]+)\/(.+)$/);
  if (!match) return value;

  if (serverBase === "media://") return value;

  const relative = `${match[1]}/${match[2]}`;
  const base =
    serverBase && serverBase.startsWith("http")
      ? serverBase.replace(/\/$/, "")
      : isTauri()
        ? `http://127.0.0.1:${resolveMediaPort()}`
        : "";

  return `${base}/theme-media/${relative}`;
}

export function resolveCssMediaUrls(
  value: string | undefined,
  host?: string,
  port?: number,
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

