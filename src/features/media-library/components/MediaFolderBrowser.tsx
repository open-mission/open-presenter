import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Folder,
  FolderOpen,
  FolderPlus,
  Play,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
  ChevronRight,
  ExternalLink,
  Eye,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ImageTreeNode } from "@/core/types";
import { useMediaBaseUrl } from "@/features/presentation/useMediaBaseUrl";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import { usePresentationStore } from "@/features/presentation/store";
import { clearAssetDragData, setAssetDragData } from "../dnd";
import type { BackgroundAsset } from "../types";
import type { MediaFolderLibraryApi, MediaLibraryKind } from "../useMediaFolderLibrary";
import { MediaPreviewDialog } from "./MediaPreviewDialog";

interface MediaFolderBrowserProps {
  kind: MediaLibraryKind;
  lib: MediaFolderLibraryApi;
  targetOutputName?: string;
  onApplyAsset: (asset: BackgroundAsset) => void;
  onPresentAsset?: (asset: BackgroundAsset) => void;
  onAddToSetlist?: (asset: BackgroundAsset) => void;
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

function flattenAllNodes(nodes: ImageTreeNode[]): ImageTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenAllNodes(node.children ?? [])]);
}

export function MediaFolderBrowser({
  kind,
  lib,
  targetOutputName,
  onApplyAsset,
  onPresentAsset,
  onAddToSetlist,
}: MediaFolderBrowserProps) {
  const base = useMediaBaseUrl();
  const [currentPath, setCurrentPath] = useState<string>("");
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedNode, setSelectedNode] = useState<ImageTreeNode | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const currentFolderNode = useMemo(() => {
    if (!currentPath) return null;
    return findNode(lib.tree, currentPath);
  }, [lib.tree, currentPath]);

  // Current items or search items
  const { folders, files } = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const all = flattenAllNodes(lib.tree);
      return {
        folders: all.filter((n) => n.kind === "folder" && n.name.toLowerCase().includes(q)),
        files: all.filter((n) => n.kind === "image" && n.name.toLowerCase().includes(q)),
      };
    }

    const items = currentFolderNode ? currentFolderNode.children ?? [] : lib.tree;
    return {
      folders: items.filter((n) => n.kind === "folder"),
      files: items.filter((n) => n.kind === "image"),
    };
  }, [lib.tree, currentFolderNode, search]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split("/").filter(Boolean);
    const crumbs: { name: string; path: string }[] = [];
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      crumbs.push({ name: part, path: acc });
    }
    return crumbs;
  }, [currentPath]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await lib.createFolder(currentPath, newFolderName.trim());
    setNewFolderName("");
    setCreateDialogOpen(false);
  };

  const handleImport = async () => {
    await lib.importFiles(currentPath || null);
  };

  // Atalho da barra de espaço para abrir o preview rápido (Quick Look)
  useEffect(() => {
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

      if (e.key === " " && selectedNode && !previewOpen) {
        e.preventDefault();
        setPreviewOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, previewOpen]);

  const handleSetPreview = (asset: BackgroundAsset) => {
    if (asset.kind === "image") {
      usePresentationStore.getState().setPreview({
        id: `img-preview-${Date.now()}`,
        kind: "media",
        title: asset.name,
        lines: [],
        media: {
          title: asset.name,
          kind: "image",
          path: asset.source,
          fit: "contain",
        },
      });
      toast.success(`"${asset.name}" carregada no monitor de Preview.`);
    } else if (asset.kind === "video") {
      usePresentationStore.getState().setPreview({
        id: `vid-preview-${Date.now()}`,
        kind: "blank",
        title: asset.name,
        lines: [],
      });
      void usePresentationStore.getState().setBackground({
        id: `bg-${Date.now()}`,
        kind: "video",
        value: asset.source,
      });
      toast.success(`"${asset.name}" exibindo 1º frame no monitor de Preview.`);
    } else {
      usePresentationStore.getState().setPreview({
        id: `aud-preview-${Date.now()}`,
        kind: "media",
        title: asset.name,
        lines: [],
        media: {
          title: asset.name,
          kind: "audio",
          path: asset.source,
        },
      });
      toast.success(`"${asset.name}" carregado no monitor de Preview.`);
    }
  };

  const toAsset = (node: ImageTreeNode): BackgroundAsset => {
    const isVid = kind === "videos" || (node.name.toLowerCase().match(/\.(mp4|webm|mov|mkv|avi|m4v)$/) !== null);
    const isAud = kind === "audios" || (node.name.toLowerCase().match(/\.(mp3|wav|m4a|aac|flac|ogg|wma)$/) !== null);
    return {
      id: `${isAud ? "aud" : isVid ? "vid" : "img"}:${node.path}`,
      name: node.name,
      kind: isAud ? "audio" : isVid ? "video" : "image",
      source: node.url ?? node.path,
      category: "public",
      tags: [node.path],
    };
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Barra de Ferramentas / Pastas / Ações */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Breadcrumb da pasta atual */}
          <button
            type="button"
            onClick={() => setCurrentPath("")}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
              !currentPath
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Folder className="size-3.5" />
            Início
          </button>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.path} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                <button
                  type="button"
                  onClick={() => setCurrentPath(crumb.path)}
                  className={`truncate rounded px-1.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                    isLast
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {crumb.name}
                </button>
              </div>
            );
          })}
        </div>

        {/* Ações: Nova Pasta, Importar, Abrir no Finder */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
            title="Criar nova pasta nesta localização"
          >
            <FolderPlus className="size-3.5" />
            <span>Nova Pasta</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImport}
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
            title="Importar arquivos para esta pasta"
          >
            <Upload className="size-3.5" />
            <span>Importar</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={lib.openInFinder}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Abrir pasta no Finder / Explorador"
          >
            <ExternalLink className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void lib.load()}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Recarregar arquivos"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Campo de Busca Rápida */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar em ${
            kind === "backgrounds"
              ? "fundos"
              : kind === "videos"
              ? "vídeos"
              : kind === "audios"
              ? "áudios"
              : "imagens"
          }…`}
          className="h-7 pl-8 pr-7 text-xs bg-muted/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Lista de Subpastas */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {folders.map((folder) => {
            const count = (folder.children ?? []).length;
            return (
              <button
                key={folder.path}
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPath(folder.path);
                }}
                className="group flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/30 hover:bg-accent/60 px-2 py-1 text-xs transition-colors cursor-pointer"
              >
                <FolderOpen className="size-3.5 text-amber-500/80 group-hover:text-amber-500 shrink-0" />
                <span className="font-medium text-foreground max-w-[150px] truncate">
                  {folder.name}
                </span>
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] font-mono text-muted-foreground"
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Grade de Arquivos de Mídia */}
      {files.length === 0 && folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <FolderOpen className="size-8 stroke-1 text-muted-foreground/40 mb-1" />
          <p className="text-xs font-medium">Nenhum arquivo nesta pasta</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Use o botão "Importar" acima para adicionar {kind === "videos" ? "vídeos" : kind === "audios" ? "áudios" : "imagens"}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {files.map((node) => {
            const asset = toAsset(node);
            const resolvedSrc = node.url ? resolveMediaLibraryUrl(node.url, base) : "";
            const isSelected = selectedNode?.path === node.path;

            return (
              <ContextMenu key={node.path}>
                <ContextMenuTrigger asChild>
                  <div
                    draggable
                    onDragStart={(event) =>
                      setAssetDragData(event, { type: "background", asset })
                    }
                    onDragEnd={() => clearAssetDragData()}
                    onClick={() => setSelectedNode(node)}
                    onDoubleClick={() => {
                      setSelectedNode(node);
                      setPreviewOpen(true);
                    }}
                    className={`group relative flex flex-col overflow-hidden rounded-lg border bg-card shadow-2xs transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 shadow-sm"
                        : "border-border hover:border-primary/50"
                    }`}
                    title="Clique para selecionar (Espaço para Visualizar / Arraste para o Setlist)"
                  >
                    {/* Visualizador de Imagem / Vídeo / Áudio */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                      {kind === "audios" ? (
                        <div className="relative size-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-black p-2">
                          <div className="rounded-full bg-primary/20 p-2 text-primary mb-1">
                            <Volume2 className="size-5" />
                          </div>
                          <div className="absolute top-1 left-1 rounded bg-black/70 px-1 py-0.2 text-[8px] font-mono text-zinc-300">
                            ÁUDIO
                          </div>
                        </div>
                      ) : kind === "videos" ? (
                        <div className="relative size-full flex items-center justify-center bg-zinc-950">
                          <video
                            src={resolvedSrc.includes("#t=") ? resolvedSrc : `${resolvedSrc}#t=0.001`}
                            muted
                            preload="metadata"
                            playsInline
                            className="size-full object-cover"
                            onLoadedMetadata={(e) => {
                              e.currentTarget.currentTime = 0.001;
                            }}
                            onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0.001;
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                            <div className="rounded-full bg-black/60 p-1.5 text-white/80">
                              <Play className="size-3 fill-white/80" />
                            </div>
                          </div>
                          <div className="absolute top-1 left-1 rounded bg-black/70 px-1 py-0.2 text-[8px] font-mono text-zinc-300">
                            VÍDEO
                          </div>
                        </div>
                      ) : (
                        <img
                          src={resolvedSrc}
                          alt={node.name}
                          loading="lazy"
                          className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}

                      {/* Overlay ao passar o mouse com Ações Rápidas */}
                      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity p-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(node);
                            setPreviewOpen(true);
                          }}
                          className="h-6 w-full text-[10px] font-medium px-1 cursor-pointer bg-white/90 text-black hover:bg-white"
                          title="Abrir visualizador em tela cheia (Espaço)"
                        >
                          <Eye className="size-3 mr-1" />
                          Visualizar
                        </Button>

                        {kind !== "audios" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onApplyAsset(asset);
                            }}
                            className="h-6 w-full text-[10px] font-medium px-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                            title={
                              targetOutputName
                                ? `Aplicar como fundo em ${targetOutputName}`
                                : "Aplicar como fundo"
                            }
                          >
                            Aplicar Fundo
                          </Button>
                        )}

                        {onPresentAsset && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPresentAsset(asset);
                            }}
                            className="h-6 w-full text-[10px] font-medium px-1 cursor-pointer"
                            title="Apresentar mídia ao vivo na tela"
                          >
                            Apresentar
                          </Button>
                        )}

                        {onAddToSetlist && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddToSetlist(asset);
                            }}
                            className="h-6 w-full text-[10px] font-medium px-1 cursor-pointer text-white border-white/30 hover:bg-white/10"
                            title="Adicionar à programação do culto"
                          >
                            + Programação
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Nome do Arquivo */}
                    <div className="p-1.5 flex items-center justify-between gap-1 bg-card">
                      <span
                        className="truncate text-[10px] font-medium text-foreground"
                        title={node.name}
                      >
                        {node.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                          setPreviewOpen(true);
                        }}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                        title="Visualizar mídia (Espaço)"
                      >
                        <Eye className="size-3" />
                      </button>
                    </div>
                  </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56 text-xs">
                  {onAddToSetlist && (
                    <ContextMenuItem onSelect={() => onAddToSetlist(asset)}>
                      <Plus className="size-3.5 mr-2 text-primary" />
                      <span>Adicionar à Programação</span>
                    </ContextMenuItem>
                  )}
                  {onPresentAsset && (
                    <ContextMenuItem onSelect={() => onPresentAsset(asset)}>
                      <Play className="size-3.5 mr-2 text-emerald-500" />
                      <span>Apresentar Ao Vivo</span>
                    </ContextMenuItem>
                  )}
                  {kind !== "audios" && (
                    <ContextMenuItem onSelect={() => onApplyAsset(asset)}>
                      <Check className="size-3.5 mr-2 text-primary" />
                      <span>Aplicar como Fundo</span>
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => {
                      setSelectedNode(node);
                      setPreviewOpen(true);
                    }}
                  >
                    <Eye className="size-3.5 mr-2 text-muted-foreground" />
                    <span>Visualizar (Espaço)</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      )}

      {/* Modal Quick Look / Preview Completo */}
      <MediaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        node={selectedNode}
        items={files}
        onNavigate={(newNode) => setSelectedNode(newNode)}
        kind={kind}
        targetOutputName={targetOutputName}
        onApplyAsset={onApplyAsset}
        onPresentAsset={onPresentAsset}
        onAddToSetlist={onAddToSetlist}
        onSetPreview={handleSetPreview}
      />

      {/* Modal Criar Nova Pasta */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Nova Pasta</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Digite o nome da pasta a ser criada em{" "}
              <span className="font-mono text-foreground">
                {currentPath ? `${kind}/${currentPath}` : kind}
              </span>
              :
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex.: Louvor Dinâmico"
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateFolder();
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateDialogOpen(false)}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreateFolder()}
              disabled={!newFolderName.trim()}
              className="text-xs cursor-pointer"
            >
              Criar Pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
