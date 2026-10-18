import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Images,
  Image as ImageIcon,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Square,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tree, type TreeDataItem } from "@/components/ui/tree";
import {
  importImagesFolder,
  importMediaFile,
  listImageLibrary,
  openImagesFolder,
} from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import { cn } from "@/core/lib/utils";
import type {
  ImageTreeNode,
  MediaItem,
  SlideContent,
} from "@/core/types";
import { useSetlistStore } from "@/features/events-setlists/store";
import { useMediaBaseUrl } from "@/features/presentation/useMediaBaseUrl";
import { usePresentationStore } from "@/features/presentation/store";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"];

interface SlideshowState {
  slides: SlideContent[];
  index: number;
  title: string;
}

function countImages(node: ImageTreeNode): number {
  if (node.kind === "image") return 1;
  return (node.children ?? []).reduce(
    (total, child) => total + countImages(child),
    0,
  );
}

function flattenImages(node: ImageTreeNode): ImageTreeNode[] {
  if (node.kind === "image") return [node];
  return (node.children ?? []).flatMap(flattenImages);
}

function findNode(nodes: ImageTreeNode[], path: string): ImageTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function findParent(nodes: ImageTreeNode[], path: string): ImageTreeNode | null {
  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    if ((node.children ?? []).some((child) => child.path === path)) {
      return node;
    }
    const found = findParent(node.children ?? [], path);
    if (found) return found;
  }
  return null;
}

function toTreeItems(nodes: ImageTreeNode[]): TreeDataItem[] {
  return nodes.map((node) => ({
    id: node.path,
    name: node.name,
    kind: node.kind === "folder" ? "folder" : "file",
    meta: node.kind === "folder" ? String(countImages(node)) : undefined,
    children: node.children ? toTreeItems(node.children) : undefined,
  }));
}

export function ImagesPage() {
  const [tree, setTree] = useState<ImageTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [slideshow, setSlideshow] = useState<SlideshowState | null>(null);
  const base = useMediaBaseUrl();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nodes = await listImageLibrary();
      setTree(nodes);
      setExpanded((previous) => {
        if (previous.size > 0) return previous;
        return new Set(
          nodes.filter((node) => node.kind === "folder").map((node) => node.path),
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const treeItems = useMemo(() => toTreeItems(tree), [tree]);
  const selectedNode = selectedPath ? findNode(tree, selectedPath) : null;

  const currentFolder = useMemo(() => {
    if (selectedNode?.kind === "folder") return selectedNode;
    if (selectedNode?.kind === "image") return findParent(tree, selectedNode.path);
    return null;
  }, [selectedNode, tree]);

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

  const slideshowImages = useMemo(
    () =>
      currentFolder
        ? flattenImages(currentFolder)
        : tree.flatMap((node) => flattenImages(node)),
    [currentFolder, tree],
  );

  const selectedImage = selectedNode?.kind === "image" ? selectedNode : null;
  const currentTitle = currentFolder?.name ?? "Biblioteca de Imagens";
  const currentPath = currentFolder
    ? `OpenPresenter/images/${currentFolder.path}`
    : "OpenPresenter/images";

  function toggleFolder(path: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectFolder(path: string) {
    setSelectedPath(path);
    setExpanded((previous) => {
      const next = new Set(previous);
      next.add(path);
      return next;
    });
  }

  function handleSelect(item: TreeDataItem) {
    setSelectedPath(item.id);
    if (item.kind === "folder") {
      setExpanded((previous) => {
        const next = new Set(previous);
        next.add(item.id);
        return next;
      });
    }
  }

  function startSlideshow(images: ImageTreeNode[], title: string) {
    const usable = images.filter(
      (image): image is ImageTreeNode & { url: string } => Boolean(image.url),
    );
    if (usable.length === 0) {
      toast.error("Nenhuma imagem para apresentar nesta pasta.");
      return;
    }

    const slides: SlideContent[] = usable.map((image, index) => ({
      id: `image-browser:${image.path}`,
      kind: "media",
      title,
      lines: [],
      section: `${index + 1}/${usable.length}`,
      media: {
        kind: "image",
        title: image.name,
        path: image.url,
        index,
        fit: "contain",
      },
    }));

    setSlideshow({ slides, index: 0, title });
    void usePresentationStore
      .getState()
      .publishLive(slides[0], slides[1] ?? null);
  }

  function goTo(index: number) {
    if (!slideshow) return;
    const nextIndex = Math.max(
      0,
      Math.min(slideshow.slides.length - 1, index),
    );
    if (nextIndex === slideshow.index) return;
    setSlideshow({ ...slideshow, index: nextIndex });
    void usePresentationStore
      .getState()
      .publishLive(
        slideshow.slides[nextIndex],
        slideshow.slides[nextIndex + 1] ?? null,
      );
  }

  function stopSlideshow() {
    setSlideshow(null);
    void usePresentationStore.getState().clearLive();
  }

  useEffect(() => {
    if (!slideshow) return;
    const current = slideshow;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.closest('[role="dialog"]')
      ) {
        return;
      }

      if (
        e.key === "ArrowRight" ||
        e.key === " " ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        goTo(current.index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(current.index - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        stopSlideshow();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slideshow]);

  async function handleImportImages() {
    if (!isTauri()) {
      toast.error("Importação disponível apenas no aplicativo desktop.");
      return;
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
    if (paths.length === 0) return;

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
      setSelectedPath(null);
      toast.success(
        `${imported} ${imported === 1 ? "imagem importada" : "imagens importadas"}.`,
      );
    } else {
      toast.error("Não foi possível importar as imagens selecionadas.");
    }
  }

  async function handleImportFolder() {
    if (!isTauri()) {
      toast.error("Importação disponível apenas no aplicativo desktop.");
      return;
    }
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;

    try {
      const folder = await importImagesFolder(selected);
      await load();
      if (folder) {
        setExpanded((previous) => {
          const next = new Set(previous);
          next.add(folder);
          return next;
        });
        setSelectedPath(folder);
      }
      toast.success("Pasta importada para a biblioteca.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenFolder() {
    try {
      await openImagesFolder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function targetPartId(): string | null {
    const event = useSetlistStore.getState().event;
    if (!event) return null;
    return (
      event.parts.find((part) => part.title.trim() === "")?.id ??
      event.parts[0]?.id ??
      ""
    );
  }

  async function addMediaToSetlist(media: MediaItem) {
    const partId = targetPartId();
    if (partId === null) {
      toast.error("Selecione um culto na programação para adicionar a mídia.");
      return;
    }
    const store = useSetlistStore.getState();
    store.addMedia(partId, media);
    await store.save();
    const after = useSetlistStore.getState();
    if (after.error !== null || after.dirty) {
      toast.error(after.error ?? "Não foi possível adicionar à programação.");
      return;
    }
    toast.success(`"${media.title}" adicionada à programação.`);
  }

  function handleAddImage(image: ImageTreeNode) {
    if (!image.url) return;
    void addMediaToSetlist({
      kind: "image",
      title: image.name,
      path: image.url,
      fit: "contain",
    });
  }

  function handleAddFolder(folder: ImageTreeNode) {
    const images = flattenImages(folder).filter(
      (image): image is ImageTreeNode & { url: string } => Boolean(image.url),
    );
    if (images.length === 0) {
      toast.error("Esta pasta não contém imagens.");
      return;
    }
    void addMediaToSetlist({
      kind: "folder",
      title: folder.name,
      path: `media://library/images/${folder.path}`,
      files: images.map((image) => image.url),
      fit: "contain",
    });
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/15">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
              <Images className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">Imagens</p>
              <p className="text-[10px] text-muted-foreground">
                Biblioteca de arquivos
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => void load()}
            title="Atualizar biblioteca"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>

        <div className="border-b border-border/60 p-2">
          <button
            type="button"
            onClick={() => setSelectedPath(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
              selectedPath === null
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <FolderOpen className="size-3.5 text-sky-500" />
            <span className="font-medium">Biblioteca</span>
          </button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {loading && tree.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <Tree
                items={treeItems}
                expandedIds={expanded}
                selectedId={selectedPath}
                onToggle={toggleFolder}
                onSelect={handleSelect}
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
                emptyLabel="Nenhuma imagem encontrada. Importe imagens ou abra a pasta."
              />
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground truncate">
          OpenPresenter/images
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground">
              {currentTitle}
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {currentPath}
              <span className="ml-2 tabular-nums">
                · {slideshowImages.length}{" "}
                {slideshowImages.length === 1 ? "imagem" : "imagens"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs cursor-pointer"
              disabled={slideshowImages.length === 0}
              onClick={() => startSlideshow(slideshowImages, currentTitle)}
            >
              <Play className="size-3.5 fill-current" />
              Apresentar pasta
            </Button>
            {currentFolder && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs cursor-pointer"
                onClick={() => handleAddFolder(currentFolder)}
              >
                <Plus className="size-3.5" />
                Adicionar à programação
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs cursor-pointer"
              onClick={() => void handleImportImages()}
            >
              <Upload className="size-3.5" />
              Importar imagens
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs cursor-pointer"
              onClick={() => void handleImportFolder()}
            >
              <FolderPlus className="size-3.5" />
              Importar pasta
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs cursor-pointer text-muted-foreground"
              onClick={() => void handleOpenFolder()}
            >
              <FolderOpen className="size-3.5" />
              Abrir pasta
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-5 p-4">
            {error !== null && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {slideshow && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge className="h-5 gap-1 bg-emerald-600 px-1.5 text-[10px] font-semibold text-white hover:bg-emerald-600">
                    <Play className="size-2.5 fill-current" />
                    Apresentando
                  </Badge>
                  <span className="truncate text-xs font-medium text-foreground">
                    {slideshow.title}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {slideshow.index + 1}/{slideshow.slides.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs cursor-pointer"
                    disabled={slideshow.index === 0}
                    onClick={() => goTo(slideshow.index - 1)}
                  >
                    <ChevronLeft className="size-3.5" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs cursor-pointer"
                    disabled={slideshow.index >= slideshow.slides.length - 1}
                    onClick={() => goTo(slideshow.index + 1)}
                  >
                    Próximo
                    <ChevronRight className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 gap-1 text-xs cursor-pointer"
                    onClick={stopSlideshow}
                  >
                    <Square className="size-3 fill-current" />
                    Parar
                  </Button>
                </div>
              </div>
            )}

            {selectedImage && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <div className="relative aspect-video self-start overflow-hidden rounded-lg border border-border/80 bg-black">
                    {selectedImage.url && (
                      <img
                        src={resolveMediaLibraryUrl(selectedImage.url, base)}
                        alt={selectedImage.name}
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selectedImage.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        OpenPresenter/images/{selectedImage.path}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 justify-start gap-1.5 text-xs cursor-pointer"
                        onClick={() =>
                          startSlideshow([selectedImage], selectedImage.name)
                        }
                      >
                        <Play className="size-3.5 fill-current" />
                        Apresentar imagem
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 justify-start gap-1.5 text-xs cursor-pointer"
                        onClick={() => handleAddImage(selectedImage)}
                      >
                        <Plus className="size-3.5" />
                        Adicionar à programação
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentFolders.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Folder className="size-4 text-amber-500" />
                  <h2 className="text-xs font-semibold text-foreground">
                    Pastas
                  </h2>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {currentFolders.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {currentFolders.map((folder) => {
                    const images = flattenImages(folder);
                    const preview = images.slice(0, 3);
                    const isSelected = selectedPath === folder.path;
                    return (
                      <button
                        key={folder.path}
                        type="button"
                        onClick={() => selectFolder(folder.path)}
                        onDoubleClick={() =>
                          startSlideshow(images, folder.name)
                        }
                        className={cn(
                          "group flex flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border/70 hover:border-primary/50 hover:bg-accent/30",
                        )}
                        title="Clique para abrir · duplo clique para apresentar"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                            <Folder className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {folder.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {images.length}{" "}
                              {images.length === 1 ? "imagem" : "imagens"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {preview.map((image) => (
                            <img
                              key={image.path}
                              src={
                                image.url
                                  ? resolveMediaLibraryUrl(image.url, base)
                                  : undefined
                              }
                              alt={image.name}
                              className="aspect-square h-auto w-full rounded object-cover"
                            />
                          ))}
                          {preview.length === 0 && (
                            <div className="col-span-3 flex h-14 items-center justify-center rounded bg-muted/40 text-[10px] text-muted-foreground">
                              Pasta vazia
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 text-sky-500" />
                <h2 className="text-xs font-semibold text-foreground">
                  Imagens
                </h2>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {currentImages.length}
                </Badge>
              </div>

              {currentImages.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center">
                  <Images className="size-8 text-muted-foreground/50" />
                  <p className="text-xs font-semibold text-foreground">
                    Nenhuma imagem nesta pasta
                  </p>
                  <p className="max-w-xs text-[11px] text-muted-foreground">
                    Use “Importar imagens” ou “Importar pasta” para adicionar
                    arquivos à biblioteca.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {currentImages.map((image) => {
                    const isSelected = selectedPath === image.path;
                    return (
                      <button
                        key={image.path}
                        type="button"
                        onClick={() => setSelectedPath(image.path)}
                        onDoubleClick={() =>
                          startSlideshow([image], image.name)
                        }
                        className={cn(
                          "group relative aspect-video overflow-hidden rounded-xl border bg-black text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border/70 hover:border-primary/50",
                        )}
                        title="Clique para visualizar · duplo clique para apresentar"
                      >
                        {image.url && (
                          <img
                            src={resolveMediaLibraryUrl(image.url, base)}
                            alt={image.name}
                            draggable={false}
                            className="absolute inset-0 h-full w-full object-contain"
                          />
                        )}
                        <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Play className="size-3.5 fill-current" />
                        </span>
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                          <span className="block truncate text-[11px] font-medium text-white">
                            {image.name}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}
