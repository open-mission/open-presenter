const GRADIENT_PATTERN = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;

export function isCssGradient(value: string): boolean {
  return GRADIENT_PATTERN.test(value);
}

export function isCssColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("#") ||
    normalized.startsWith("rgb") ||
    normalized.startsWith("hsl") ||
    normalized === "transparent" ||
    normalized === "currentcolor"
  );
}

export function stripMediaFit(value: string): string {
  const trimmed = value.trim();
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex === -1) return trimmed;
  const hashPart = trimmed.slice(hashIndex + 1);
  if (/^fit=(cover|contain|scale-down|fill)$/.test(hashPart)) {
    return trimmed.slice(0, hashIndex).trim();
  }
  return trimmed;
}
