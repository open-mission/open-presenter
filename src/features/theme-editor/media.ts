export function resolveThemeMediaUrl(
  value: string | undefined,
  host: string = "localhost",
  port: number = 5050,
): string | undefined {
  if (!value) return value;
  const trimmed = value.trim();
  const match = trimmed.match(/^media:\/\/([^/]+)\/(.+)$/);
  if (!match) return value;
  const actualHost =
    !host || host === "tauri.localhost" || host === "localhost"
      ? "127.0.0.1"
      : host;
  return `http://${actualHost}:${port}/theme-media/${match[1]}/${match[2]}`;
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

