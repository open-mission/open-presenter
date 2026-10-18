import { useEffect, useState } from "react";
import { Images, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { importMediaFile } from "@/core/ipc/commands";
import { isTauri } from "@/core/ipc/tauri";
import { mediaKindLabel } from "@/core/lib/media";
import type { MediaItem } from "@/core/types";
import { GalleryPicker } from "@/features/image-browser/GalleryPicker";
import {
  flattenImages,
  mediaPathToImageRelative,
} from "@/features/image-browser/imageTree";
import { useMediaBaseUrl } from "@/features/presentation/useMediaBaseUrl";
import { resolveMediaLibraryUrl } from "@/features/theme-editor/media";
import { findEventItem, useSetlistStore } from "./store";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv", "ogg"];

export type VisualMediaKind = "image" | "folder" | "video";

const KIND_OPTIONS: Array<{
  kind: VisualMediaKind;
  label: string;
  icon: typeof ImageIcon;
}> = [
  { kind: "image", label: "Imagem", icon: ImageIcon },
  { kind: "folder", label: "Pasta de imagens", icon: Images },
  { kind: "video", label: "Vídeo", icon: Video },
];

interface MediaDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  partId: string;
  itemId?: string | null;
  initialKind?: VisualMediaKind;
}

function stripExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(0, index) : name;
}

export function MediaDialog({
  open: isOpen,
  onOpenChange,
  partId,
  itemId,
  initialKind,
}: MediaDialogProps) {
  const addMedia = useSetlistStore((s) => s.addMedia);
  const updateMedia = useSetlistStore((s) => s.updateMedia);
  const save = useSetlistStore((s) => s.save);
  const selectItem = useSetlistStore((s) => s.selectItem);

  const base = useMediaBaseUrl();
  const [kind, setKind] = useState<VisualMediaKind>(initialKind ?? "image");
  const [title, setTitle] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [fit, setFit] = useState<NonNullable<MediaItem["fit"]>>("contain");
  const [importedName, setImportedName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const currentEvent = useSetlistStore.getState().event;
    const item = itemId ? findEventItem(currentEvent, itemId) : undefined;
    const media = item?.media ?? null;
    if (media && media.kind !== "text") {
      setKind(media.kind);
      setTitle(media.title);
      setPath(media.path ?? null);
      setFiles(media.files ?? []);
      setFit(media.fit ?? "contain");
      setImportedName(
        media.kind === "folder"
          ? `${media.files?.length ?? 0} imagens`
          : media.title,
      );
    } else {
      setKind(initialKind ?? "image");
      setTitle("");
      setPath(null);
      setFiles([]);
      setFit("contain");
      setImportedName(null);
    }
    setError(null);
  }, [isOpen, itemId, initialKind]);

  function resetFileState() {
    setPath(null);
    setFiles([]);
    setImportedName(null);
    setError(null);
  }

  async function handleChooseVideo() {
    if (!isTauri()) {
      setError("A seleção de arquivos está disponível no aplicativo desktop.");
      return;
    }

    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Vídeos", extensions: VIDEO_EXTENSIONS }],
    });
    if (typeof selected !== "string") return;

    setBusy(true);
    setError(null);
    try {
      const imported = await importMediaFile(selected, "video");
      setPath(imported.path);
      setFiles([]);
      setImportedName(imported.name);
      if (title.trim() === "") setTitle(stripExtension(imported.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleKindChange(next: VisualMediaKind) {
    if (next === kind) return;
    setKind(next);
    resetFileState();
  }

  const requiresFile = kind === "image" || kind === "video";
  const requiresFolder = kind === "folder";
  const canSave =
    !busy &&
    title.trim().length > 0 &&
    (!requiresFile || path !== null) &&
    (!requiresFolder || files.length > 0);

  async function handleSave() {
    if (!canSave) return;
    const media: MediaItem = {
      kind,
      title: title.trim(),
      fit,
      ...(kind === "image" || kind === "video"
        ? { path: path ?? undefined }
        : {}),
      ...(kind === "folder" ? { path: path ?? undefined, files } : {}),
    };

    try {
      let nextItemId: string | null = null;
      if (itemId) {
        updateMedia(itemId, media);
        nextItemId = itemId;
      } else {
        nextItemId = addMedia(partId, media);
      }
      await save();
      const state = useSetlistStore.getState();
      if (state.error !== null || state.dirty) {
        setError(state.error ?? "Não foi possível salvar a mídia.");
        return;
      }
      if (nextItemId) selectItem(nextItemId);
      onOpenChange(false);
      toast.success(
        itemId
          ? "Mídia atualizada."
          : `${mediaKindLabel(kind)} ${
              kind === "folder" ? "adicionada" : "adicionado"
            } à programação.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const videoPreviewUrl =
    kind === "video" && path ? resolveMediaLibraryUrl(path, base) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          kind === "video"
            ? "sm:max-w-xl"
            : "sm:max-w-4xl max-h-[90vh] overflow-y-auto"
        }
      >
        <DialogHeader>
          <DialogTitle>
            {itemId ? "Editar mídia" : "Adicionar mídia"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="grid grid-cols-3 gap-1.5">
            {KIND_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = option.kind === kind;
              return (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => handleKindChange(option.kind)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-[10px] font-medium transition-colors cursor-pointer ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="text-center leading-tight">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Título</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Avisos da Igreja"
              autoFocus
            />
          </label>

          {(kind === "image" || kind === "folder") && (
            <div className="flex flex-col gap-2">
              <GalleryPicker
                mode={kind}
                selectedImagePath={
                  kind === "image" ? mediaPathToImageRelative(path) : null
                }
                selectedFolderPath={
                  kind === "folder" ? mediaPathToImageRelative(path) : null
                }
                onSelectImage={(image) => {
                  if (!image.url) return;
                  setPath(image.url);
                  setFiles([]);
                  setImportedName(image.name);
                  if (title.trim() === "") {
                    setTitle(stripExtension(image.name));
                  }
                  setError(null);
                }}
                onSelectFolder={(folder) => {
                  const images = flattenImages(folder).filter(
                    (image) => image.url,
                  );
                  setPath(`media://library/images/${folder.path}`);
                  setFiles(images.map((image) => image.url!));
                  setImportedName(`${images.length} imagens`);
                  if (title.trim() === "") setTitle(folder.name);
                  setError(
                    images.length === 0
                      ? "Esta pasta não contém imagens."
                      : null,
                  );
                }}
              />
              <p className="truncate text-[11px] text-muted-foreground">
                {importedName
                  ? `Selecionado: ${importedName}`
                  : "Selecione uma imagem ou pasta da galeria."}
              </p>
            </div>
          )}

          {kind === "video" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-foreground">
                Arquivo de vídeo
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                  onClick={() => void handleChooseVideo()}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Video className="size-3.5" />
                  )}
                  Escolher vídeo…
                </Button>
              </div>
              {importedName && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {importedName}
                </p>
              )}
              {videoPreviewUrl && (
                <div className="relative mt-1 aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                  <video
                    src={videoPreviewUrl}
                    className="absolute inset-0 h-full w-full object-contain"
                    controls
                    muted
                    playsInline
                  />
                </div>
              )}
            </div>
          )}

          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-foreground">
              Enquadramento
            </span>
            <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
              {(
                [
                  { value: "contain", label: "Conter" },
                  { value: "cover", label: "Preencher" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFit(option.value)}
                  className={`px-2.5 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
                    fit === option.value
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </label>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            {itemId ? "Salvar mídia" : "Adicionar mídia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
