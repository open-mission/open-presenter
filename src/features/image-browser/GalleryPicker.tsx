import { useEffect, useMemo, useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Images,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tree, type TreeDataItem } from "@/components/ui/tree";
import { cn } from "@/core/lib/utils";
import type { ImageTreeNode } from "@/core/types";
import { useMediaBaseUrl } from "@/features/presentation/useMediaBaseUrl";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import {
  countImages,
  findImageNode,
  findImageParent,
  flattenImages,
  toTreeItems,
} from "./imageTree";
import { useImageLibrary } from "./useImageLibrary";

interface GalleryPickerProps {
  mode: "image" | "folder";
  selectedImagePath?: string | null;
  selectedFolderPath?: string | null;
  onSelectImage: (image: ImageTreeNode) => void;
  onSelectFolder: (folder: ImageTreeNode) => void;
}

export function GalleryPicker({
  mode,
  selectedImagePath,
  selectedFolderPath,
  onSelectImage,
  onSelectFolder,
}: GalleryPickerProps) {
  const { tree, loading, error, load, importImages, importFolder, openFolder } =
    useImageLibrary();
  const base = useMediaBaseUrl();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(
    null,
  );
  const [pendingFolderSelect, setPendingFolderSelect] = useState<string | null>(
    null,
  );

  const treeItems = useMemo(() => toTreeItems(tree), [tree]);

  const currentFolder = useMemo(() => {
    if (!currentFolderPath) return null;
    const node = findImageNode(tree, currentFolderPath);
    return node?.kind === "folder" ? node : null;
  }, [tree, currentFolderPath]);

  const currentFolders = useMemo(
    () =>
      (currentFolder ? currentFolder.children ?? [] : tree).filter(
        (node) => node.kind === "folder",
      ),
    [currentFolder, tree],
  );

  const currentImages = useMemo(
    () =>
      (currentFolder ? currentFolder.children ?? [] : tree).filter(
        (node) => node.kind === "image",
      ),
    [currentFolder, tree],
  );

  const totalImages = useMemo(
    () =>
      currentFolder
        ? countImages(currentFolder)
        : tree.reduce((total, node) => total + countImages(node), 0),
    [currentFolder, tree],
  );

  useEffect(() => {
    if (tree.length === 0) return;
    setExpanded((previous) => {
      if (previous.size > 0) return previous;
      return new Set(
        tree.filter((node) => node.kind === "folder").map((node) => node.path),
      );
    });
  }, [tree]);

  function withAncestors(previous: Set<string>, path: string): Set<string> {
    const next = new Set(previous);
    const parts = path.split("/").filter(Boolean);
    for (let index = 1; index <= parts.length; index += 1) {
      next.add(parts.slice(0, index).join("/"));
    }
    return next;
  }

  useEffect(() => {
    if (mode === "folder" && selectedFolderPath) {
      const node = findImageNode(tree, selectedFolderPath);
      if (node?.kind === "folder") {
        setCurrentFolderPath(node.path);
        setExpanded((previous) => withAncestors(previous, node.path));
      }
      return;
    }

    if (mode === "image" && selectedImagePath) {
      const parent = findImageParent(tree, selectedImagePath);
      setCurrentFolderPath(parent?.path ?? null);
      if (parent) {
        setExpanded((previous) => withAncestors(previous, parent.path));
      }
    }
  }, [mode, selectedFolderPath, selectedImagePath, tree]);

  useEffect(() => {
    if (!pendingFolderSelect) return;
    const node = findImageNode(tree, pendingFolderSelect);
    if (node?.kind !== "folder") return;

    setCurrentFolderPath(node.path);
    setExpanded((previous) => withAncestors(previous, node.path));
    if (mode === "folder") onSelectFolder(node);
    setPendingFolderSelect(null);
  }, [tree, pendingFolderSelect, mode, onSelectFolder]);

  function expandFolder(path: string) {
    setExpanded((previous) => withAncestors(previous, path));
  }

  function toggleFolder(path: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectFolder(folder: ImageTreeNode) {
    setCurrentFolderPath(folder.path);
    expandFolder(folder.path);
    if (mode === "folder") {
      onSelectFolder(folder);
    }
  }

  function handleSelectTreeItem(item: TreeDataItem) {
    if (item.kind === "folder") {
      const node = findImageNode(tree, item.id);
      if (node?.kind === "folder") selectFolder(node);
      return;
    }

    const node = findImageNode(tree, item.id);
    if (!node || node.kind !== "image") return;

    if (mode === "image") {
      onSelectImage(node);
      return;
    }

    const parent = findImageParent(tree, node.path);
    if (parent) selectFolder(parent);
  }

  async function handleImportImages() {
    const count = await importImages();
    if (count > 0) setCurrentFolderPath(null);
  }

  async function handleImportFolder() {
    const folder = await importFolder();
    if (folder) {
      setCurrentFolderPath(folder);
      expandFolder(folder);
      setPendingFolderSelect(folder);
    }
  }

  const selectedId =
    mode === "folder"
      ? selectedFolderPath ?? currentFolderPath
      : selectedImagePath ?? currentFolderPath;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs font-medium text-foreground">
          Imagens da galeria
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
            onClick={() => void handleImportImages()}
          >
            <Upload className="size-3" />
            Importar imagens
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
            onClick={() => void handleImportFolder()}
          >
            <FolderPlus className="size-3" />
            Importar pasta
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer text-muted-foreground"
            onClick={() => void openFolder()}
          >
            <FolderOpen className="size-3" />
            Abrir pasta
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 cursor-pointer text-muted-foreground"
            onClick={() => void load()}
            title="Atualizar galeria"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex h-[360px] overflow-hidden rounded-lg border border-border/70 bg-background">
        <aside className="flex w-52 shrink-0 flex-col border-r border-border/60 bg-muted/10">
          <div className="border-b border-border/60 p-1.5">
            <button
              type="button"
              onClick={() => setCurrentFolderPath(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors cursor-pointer",
                currentFolderPath === null
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <FolderOpen className="size-3.5 text-sky-500" />
              <span className="font-medium">Biblioteca</span>
            </button>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-1.5">
              {loading && tree.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : (
                <Tree
                  items={treeItems}
                  expandedIds={expanded}
                  selectedId={selectedId}
                  onToggle={toggleFolder}
                  onSelect={handleSelectTreeItem}
                  renderIcon={(item, isExpanded) =>
                    item.kind === "folder" ? (
                      isExpanded ? (
                        <FolderOpen className="size-3.5 text-amber-500" />
                      ) : (
                        <Folder className="size-3.5 text-amber-500" />
                      )
                    ) : (
                      <ImageIcon className="size-3.5 text-sky-500" />
                    )
                  }
                  emptyLabel="Nenhuma imagem na galeria."
                />
              )}
            </div>
          </ScrollArea>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">
                {currentFolder?.name ?? "Biblioteca"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                OpenPresenter/images
                {currentFolder ? `/${currentFolder.path}` : ""}
                <span className="ml-2 tabular-nums">· {totalImages}</span>
              </p>
            </div>
            {mode === "folder" && currentFolder && (
              <Button
                type="button"
                size="sm"
                className="h-7 shrink-0 text-[11px] cursor-pointer"
                onClick={() => onSelectFolder(currentFolder)}
              >
                Selecionar esta pasta
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 p-3">
              {error !== null && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                  {error}
                </div>
              )}

              {currentFolders.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {currentFolders.map((folder) => {
                    const preview = flattenImages(folder).slice(0, 3);
                    const isSelected =
                      mode === "folder" && selectedFolderPath === folder.path;
                    return (
                      <button
                        key={folder.path}
                        type="button"
                        onClick={() => selectFolder(folder)}
                        className={cn(
                          "group flex flex-col gap-1.5 rounded-lg border bg-card p-2 text-left transition-colors cursor-pointer",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border/70 hover:border-primary/50 hover:bg-accent/30",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Folder className="size-4 shrink-0 text-amber-500" />
                          <span className="truncate text-[11px] font-semibold text-foreground">
                            {folder.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="ml-auto h-4 px-1 text-[9px]"
                          >
                            {countImages(folder)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-0.5">
                          {preview.map((image) => (
                            <img
                              key={image.path}
                              src={
                                image.url
                                  ? resolveMediaLibraryUrl(image.url, base)
                                  : undefined
                              }
                              alt={image.name}
                              className="aspect-square h-auto w-full rounded-sm object-cover"
                            />
                          ))}
                          {preview.length === 0 && (
                            <div className="col-span-3 flex h-8 items-center justify-center rounded-sm bg-muted/40 text-[9px] text-muted-foreground">
                              Pasta vazia
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentImages.length === 0 ? (
                <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/70 p-4 text-center">
                  <Images className="size-6 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">
                    Nenhuma imagem nesta pasta.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {currentImages.map((image) => {
                    const isSelected =
                      mode === "image" && selectedImagePath === image.path;
                    return (
                      <button
                        key={image.path}
                        type="button"
                        onClick={() => {
                          if (mode === "image") onSelectImage(image);
                          else if (currentFolder) onSelectFolder(currentFolder);
                        }}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-lg border bg-black transition-all cursor-pointer",
                          isSelected
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border/70 hover:border-primary/50",
                        )}
                        title={image.name}
                      >
                        {image.url && (
                          <img
                            src={resolveMediaLibraryUrl(image.url, base)}
                            alt={image.name}
                            draggable={false}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 py-1 text-[9px] font-medium text-white">
                          {image.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
