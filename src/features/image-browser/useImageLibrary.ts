import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  importImagesFolder,
  importMediaFile,
  listImageLibrary,
  openImagesFolder,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import type { ImageTreeNode } from "@/core/types";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"];

export interface ImageLibraryApi {
  tree: ImageTreeNode[];
  loading: boolean;
  error: string | null;
  load(): Promise<void>;
  importImages(): Promise<number>;
  importFolder(): Promise<string | null>;
  openFolder(): Promise<void>;
}

export function useImageLibrary(): ImageLibraryApi {
  const [tree, setTree] = useState<ImageTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTree(await listImageLibrary());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const importImages = useCallback(async (): Promise<number> => {
    if (!isTauri()) {
      toast.error("Importação disponível apenas no aplicativo desktop.");
      return 0;
    }

    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "Imagens", extensions: IMAGE_EXTENSIONS }],
    });
    const paths =
      typeof selected === "string"
        ? [selected]
        : Array.isArray(selected)
        ? selected
        : [];
    if (paths.length === 0) return 0;

    let imported = 0;
    for (const path of paths) {
      try {
        await importMediaFile(path, "image");
        imported += 1;
      } catch {
        // segue com os demais arquivos
      }
    }

    await load();
    if (imported > 0) {
      toast.success(
        `${imported} ${imported === 1 ? "imagem importada" : "imagens importadas"}.`,
      );
    } else {
      toast.error("Não foi possível importar as imagens selecionadas.");
    }
    return imported;
  }, [load]);

  const importFolder = useCallback(async (): Promise<string | null> => {
    if (!isTauri()) {
      toast.error("Importação disponível apenas no aplicativo desktop.");
      return null;
    }

    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return null;

    try {
      const folder = await importImagesFolder(selected);
      await load();
      toast.success("Pasta importada para a biblioteca.");
      return folder;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [load]);

  const openFolder = useCallback(async () => {
    try {
      await openImagesFolder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return {
    tree,
    loading,
    error,
    load,
    importImages,
    importFolder,
    openFolder,
  };
}
