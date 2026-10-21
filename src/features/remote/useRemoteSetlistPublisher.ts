import { useEffect } from "react";
import { setRemoteSetlist } from "@/core/ipc/commands";
import { isTauri, listenCommand } from "@/core/ipc/tauri";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useSongDefaultsStore } from "@/core/store/songDefaultsStore";
import { useSongGroupsStore } from "@/features/songs/songGroupsStore";
import { useRemoteStore } from "./store";
import { buildRemoteSetlist } from "./remoteSetlist";

const PUBLISH_DEBOUNCE_MS = 400;

/**
 * Mantém no servidor uma cópia do setlist ativo para o controle remoto.
 * A cópia inclui os slides de músicas e mídias, já resolvidos no admin.
 */
export function useRemoteSetlistPublisher(): void {
  const event = useSetlistStore((s) => s.event);
  const songsCache = useSetlistStore((s) => s.songsCache);
  const dirty = useSetlistStore((s) => s.dirty);
  const songGroups = useSongGroupsStore((s) => s.groups);
  const addEmptySlideAtStart = useSongDefaultsStore(
    (s) => s.addEmptySlideAtStart,
  );
  const ensureToken = useRemoteStore((s) => s.ensureToken);
  const appendImprevistoSong = useSetlistStore((s) => s.appendImprevistoSong);

  useEffect(() => {
    if (!isTauri()) return;
    void ensureToken();
  }, [ensureToken]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    void listenCommand<string>("remote://imprevisto", (songId) => {
      if (songId) {
        void appendImprevistoSong(songId);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [appendImprevistoSong]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const snapshot = event
            ? await buildRemoteSetlist(
                event,
                songsCache,
                songGroups,
                addEmptySlideAtStart,
              )
            : null;
          if (!cancelled) {
            await setRemoteSetlist(snapshot);
          }
        } catch {
          // O controle remoto continua com o último snapshot válido.
        }
      })();
    }, PUBLISH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [event, songsCache, dirty, songGroups, addEmptySlideAtStart]);
}
