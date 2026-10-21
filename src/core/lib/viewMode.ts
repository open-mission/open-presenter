export type ViewMode = "list" | "slides" | "text" | "table";

export const BOOKS_VIEW_MODES = ["list", "table"] as const;
export const BOOKS_VIEW_DEFAULT = "table";

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
