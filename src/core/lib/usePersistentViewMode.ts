import { useCallback, useState } from "react";
import { parseViewMode } from "./viewMode.ts";

export function usePersistentViewMode<T extends string>(
  storageKey: string,
  fallback: T,
  allowed: readonly T[],
): [T, (mode: T) => void] {
  const [mode, setMode] = useState<T>(() => {
    try {
      return parseViewMode(localStorage.getItem(storageKey), allowed, fallback);
    } catch {
      return fallback;
    }
  });

  const update = useCallback(
    (next: T) => {
      setMode(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // localStorage indisponível: mantém só o estado da sessão
      }
    },
    [storageKey],
  );

  return [mode, update];
}
