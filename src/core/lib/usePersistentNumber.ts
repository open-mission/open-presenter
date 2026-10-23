import { useCallback, useState } from "react";

export function parsePersistentNumber(
  raw: string | null,
  fallback: number,
  minLevel: number,
  maxLevel: number,
): number {
  if (raw === null) return fallback;
  const level = Number(raw);
  if (!Number.isFinite(level)) return fallback;
  return Math.min(maxLevel, Math.max(minLevel, Math.round(level)));
}

export function usePersistentNumber(
  storageKey: string,
  fallback: number,
  minLevel: number,
  maxLevel: number,
): [number, (next: number) => void] {
  const [level, setLevel] = useState<number>(() => {
    try {
      return parsePersistentNumber(localStorage.getItem(storageKey), fallback, minLevel, maxLevel);
    } catch {
      return fallback;
    }
  });

  const update = useCallback(
    (next: number) => {
      const clamped = parsePersistentNumber(String(next), fallback, minLevel, maxLevel);
      setLevel(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        // localStorage indisponível: mantém só o estado da sessão
      }
    },
    [storageKey, fallback, minLevel, maxLevel],
  );

  return [level, update];
}
