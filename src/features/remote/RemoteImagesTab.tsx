import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Folder,
  Home,
  ImageIcon,
  Loader2,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import type { LiveSlide, ImageTreeNode } from "@/core/types";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import {
  countImages,
  findImageNode,
  mediaPathToImageRelative,
} from "@/features/image-browser/imageTree";

interface RemoteImagesTabProps {
  token: string;
  live: LiveSlide | null;
  onPost: (path: string, body?: unknown) => Promise<boolean>;
}

export function RemoteImagesTab({ token, live, onPost }: RemoteImagesTabProps) {
  const [tree, setTree] = useState<ImageTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/images", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar imagens da biblioteca");
      const data = (await res.json()) as ImageTreeNode[];
      setTree(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchImages();
  }, [fetchImages]);

  // Encontra o nó da pasta atual ou usa a raiz
  const currentNode = useMemo(() => {
    if (!currentFolderPath) return null;
    return findImageNode(tree, currentFolderPath);
  }, [tree, currentFolderPath]);

  // Lista os itens a serem exibidos na visualização atual
  const currentItems = useMemo(() => {
    if (!currentFolderPath || !currentNode) {
      return tree;
    }
    return currentNode.children ?? [];
  }, [tree, currentFolderPath, currentNode]);

  const folders = useMemo(
    () => currentItems.filter((item) => item.kind === "folder"),
    [currentItems],
  );

  const images = useMemo(
    () => currentItems.filter((item) => item.kind === "image"),
    [currentItems],
  );

  const breadcrumbs = useMemo(() => {
    if (!currentFolderPath) return [];
    const segments = currentFolderPath.split("/");
    const crumbs: { name: string; path: string }[] = [];
    let acc = "";
    for (const segment of segments) {
      acc = acc ? `${acc}/${segment}` : segment;
      crumbs.push({ name: segment, path: acc });
    }
    return crumbs;
  }, [currentFolderPath]);

  const presentImage = useCallback(
    async (image: ImageTreeNode) => {
      await onPost("present-image", {
        path: image.path,
        title: image.name,
      });
    },
    [onPost],
  );

  const activeImagePath = useMemo(() => {
    return mediaPathToImageRelative(live?.content.media?.path ?? null);
  }, [live]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Navegação / Breadcrumb */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-2 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCurrentFolderPath(null)}
          className={cn(
            "h-7 gap-1 px-2 text-xs cursor-pointer",
            !currentFolderPath
              ? "font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Home className="size-3.5" />
          <span>Início</span>
        </Button>

        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <div key={crumb.path} className="flex items-center gap-1.5 shrink-0">
              <ChevronRight className="size-3 text-muted-foreground" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentFolderPath(crumb.path)}
                className={cn(
                  "h-7 px-2 text-xs cursor-pointer",
                  isLast
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {crumb.name}
              </Button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Subpastas */}
      {folders.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="px-1 text-xs font-semibold text-foreground">
            Pastas
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {folders.map((folder) => {
              const count = countImages(folder);
              return (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => setCurrentFolderPath(folder.path)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                      <Folder className="size-4" />
                    </span>
                    <p className="truncate text-xs font-medium text-foreground">
                      {folder.name}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {count} {count === 1 ? "imagem" : "imagens"}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Imagens da pasta atual */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-foreground">
            Imagens
          </span>
          <span className="text-[11px] text-muted-foreground">
            {images.length} {images.length === 1 ? "imagem" : "imagens"}
          </span>
        </div>

        {images.length === 0 && folders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            <ImageIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            Nenhuma imagem nesta pasta da biblioteca.
          </div>
        ) : images.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Esta pasta contém apenas subpastas.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => {
              const isLive = activeImagePath === image.path;
              const imageUrl = resolveMediaLibraryUrl(
                image.url || `media://library/images/${image.path}`,
                "",
              );

              return (
                <button
                  key={image.path}
                  type="button"
                  onClick={() => presentImage(image)}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all cursor-pointer",
                    isLive
                      ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/30",
                  )}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                    <img
                      src={imageUrl}
                      alt={image.name}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {isLive && (
                      <div className="absolute left-2 top-2">
                        <Badge className="bg-emerald-600 px-1.5 py-0 text-[10px] text-white hover:bg-emerald-600">
                          Ao vivo
                        </Badge>
                      </div>
                    )}
                    {!isLive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 text-[10px] font-medium text-primary-foreground shadow">
                          <Play className="size-3" />
                          Projetar
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {image.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
