export function resolveThemeMediaUrl(
  value: string | undefined,
  host: string,
): string | undefined {
  if (!value) return value;
  const trimmed = value.trim();
  const match = trimmed.match(/^media:\/\/([^/]+)\/(.+)$/);
  if (!match) return value;
  return `http://${host}:5050/theme-media/${match[1]}/${match[2]}`;
}

export function resolveCssMediaUrls(
  value: string | undefined,
  host: string,
): string | undefined {
  if (!value) return value;
  return value.replace(
    /media:\/\/([^/\s)'"]+)\/([^)\s'"]+)/g,
    `http://${host}:5050/theme-media/$1/$2`,
  );
}
