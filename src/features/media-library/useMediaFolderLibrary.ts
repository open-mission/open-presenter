import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  createMediaFolder,
  importMediaFiles,
  listAudioLibrary,
  listBackgroundsLibrary,
  listImageLibrary,
  listVideoLibrary,
  openLibraryFolder,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import type { ImageTreeNode } from "@/core/types";

export type MediaLibraryKind = "images" | "backgrounds" | "videos" | "audios";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv", "ogg"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "flac", "ogg", "wma", "aiff"];

export interface MediaFolderLibraryApi {
  tree: ImageTreeNode[];
  loading: boolean;
  error: string | null;
  load(): Promise<void>;
  createFolder(parentPath: string, name: string): Promise<string | null>;
  importFiles(subfolder?: string | null): Promise<number>;
  openInFinder(): Promise<void>;
}

export function useMediaFolderLibrary(kind: MediaLibraryKind): MediaFolderLibraryApi {
  const [tree, setTree] = useState<ImageTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (kind === "backgrounds") {
        setTree(await listBackgroundsLibrary());
      } else if (kind === "videos") {
        setTree(await listVideoLibrary());
      } else if (kind === "audios") {
        setTree(await listAudioLibrary());
      } else {
        setTree(await listImageLibrary());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const createFolder = useCallback(
    async (parentPath: string, name: string): Promise<string | null> => {
      const cleanName = name.trim();
      if (!cleanName) {
        toast.error("Nome da pasta não pode ser vazio.");
        return null;
      }
      try {
        const created = await createMediaFolder(kind, parentPath, cleanName);
        await load();
        toast.success(`Pasta "${cleanName}" criada com sucesso.`);
        return created;
      } catch (err) {
        toast.error(
          `Falha ao criar pasta: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    },
    [kind, load],
  );

  const importFiles = useCallback(
    async (subfolder?: string | null): Promise<number> => {
      if (!isTauri()) {
        toast.error("Importação disponível apenas no aplicativo desktop.");
        return 0;
      }

      const extensions =
        kind === "videos"
          ? VIDEO_EXTENSIONS
          : kind === "audios"
          ? AUDIO_EXTENSIONS
          : IMAGE_EXTENSIONS;
      const title =
        kind === "videos" ? "Vídeos" : kind === "audios" ? "Áudios" : "Imagens";

      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{ name: title, extensions }],
      });

      const paths =
        typeof selected === "string"
          ? [selected]
          : Array.isArray(selected)
          ? selected
          : [];

      if (paths.length === 0) return 0;

      try {
        const imported = await importMediaFiles(kind, subfolder ?? null, paths);
        await load();
        if (imported.length > 0) {
          toast.success(
            `${imported.length} ${
              imported.length === 1 ? "arquivo importado" : "arquivos importados"
            }.`,
          );
        }
        return imported.length;
      } catch (err) {
        toast.error(
          `Falha ao importar arquivos: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return 0;
      }
    },
    [kind, load],
  );

  const openInFinder = useCallback(async () => {
    try {
      await openLibraryFolder(kind);
    } catch (err) {
      toast.error(
        `Falha ao abrir pasta: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [kind]);

  return {
    tree,
    loading,
    error,
    load,
    createFolder,
    importFiles,
    openInFinder,
  };
}
