export type ViewMode = "list" | "slides" | "cards";

export function parseViewMode<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value !== null && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}
