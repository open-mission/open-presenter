import { useEffect } from "react";
import { usePresentationStore } from "@/features/presentation/store";
import { useBibleStore } from "./store";

/**
 * Mantém a Bíblia do painel alinhada ao versículo que está no ar, inclusive
 * quando a apresentação começou pela programação (setlist).
 */
export function useBibleLiveSync(): void {
  const scripture = usePresentationStore((s) =>
    s.live.content.kind === "scripture" &&
    !s.live.cleared &&
    !s.live.blackout
      ? (s.live.content.scripture ?? null)
      : null,
  );

  const key = scripture
    ? `${scripture.versionId}|${scripture.bookId}|${scripture.chapter}|${scripture.verse}|${scripture.part}`
    : null;

  useEffect(() => {
    if (!scripture) return;
    void useBibleStore.getState().syncLiveScripture(scripture);
    // A referência é comparada por chave para não recarregar o capítulo a
    // cada atualização do slide ao vivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
