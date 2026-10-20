import type { ReactNode } from "react";
import {
  AlignLeft,
  BookOpen,
  FolderOpen,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Images,
  Music,
  Plus,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VisualMediaKind } from "./MediaDialog";

export interface AddItemMenuHandlers {
  addMusic(): void;
  searchOnline(): void;
  newSong(): void;
  addScripture(): void;
  addText(): void;
  addMedia(kind: VisualMediaKind): void;
  addSection?(): void;
  insertStudio(): void;
  createStudio(): void;
  openMediaLibrary(): void;
  save?(): void;
  dirty?: boolean;
}

const MEDIA_OPTIONS: Array<{
  kind: VisualMediaKind;
  label: string;
  icon: typeof ImageIcon;
}> = [
  { kind: "image", label: "Adicionar Imagem", icon: ImageIcon },
  { kind: "folder", label: "Adicionar Pasta de Imagens", icon: Images },
  { kind: "video", label: "Adicionar Vídeo", icon: Video },
];

export function AddItemDropdown({
  handlers,
  trigger,
  align = "end",
  contentClassName = "w-56",
}: {
  handlers: AddItemMenuHandlers;
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  contentClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={contentClassName}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs cursor-pointer font-medium">
            <Music className="size-3.5 mr-2 text-primary" />
            Músicas
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuItem
              onSelect={handlers.addMusic}
              className="text-xs cursor-pointer"
            >
              <Music className="size-3.5 mr-2 text-primary" />
              Adicionar Música
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handlers.searchOnline}
              className="text-xs cursor-pointer"
            >
              <Globe className="size-3.5 mr-2 text-sky-500" />
              Buscar música na internet…
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handlers.newSong}
              className="text-xs cursor-pointer"
            >
              <Plus className="size-3.5 mr-2 text-primary" />
              Nova Música
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs cursor-pointer font-medium">
            <BookOpen className="size-3.5 mr-2 text-emerald-500" />
            Bíblia
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuItem
              onSelect={handlers.addScripture}
              className="text-xs cursor-pointer"
            >
              <BookOpen className="size-3.5 mr-2 text-emerald-500" />
              Adicionar Versículo…
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs cursor-pointer font-medium">
            <ImageIcon className="size-3.5 mr-2 text-sky-500" />
            Mídias
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuItem
              onSelect={handlers.addText}
              className="text-xs cursor-pointer"
            >
              <AlignLeft className="size-3.5 mr-2 text-sky-500" />
              Adicionar Texto
            </DropdownMenuItem>
            {MEDIA_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.kind}
                  onSelect={() => handlers.addMedia(option.kind)}
                  className="text-xs cursor-pointer"
                >
                  <Icon className="size-3.5 mr-2 text-sky-500" />
                  {option.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handlers.openMediaLibrary}
              className="text-xs cursor-pointer"
            >
              <FolderOpen className="size-3.5 mr-2 text-muted-foreground" />
              Abrir Pasta de Mídias
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs cursor-pointer font-medium">
            <Sparkles className="size-3.5 mr-2 text-amber-500" />
            Studio
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuItem
              onSelect={handlers.insertStudio}
              className="text-xs cursor-pointer"
            >
              <Search className="size-3.5 mr-2 text-amber-500" />
              Inserir Salva da Biblioteca…
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handlers.createStudio}
              className="text-xs cursor-pointer"
            >
              <Plus className="size-3.5 mr-2 text-primary" />
              Criar Nova no Studio…
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {(handlers.addSection ||
          (handlers.dirty && handlers.save)) && <DropdownMenuSeparator />}

        {handlers.addSection && (
          <DropdownMenuItem
            onSelect={handlers.addSection}
            className="text-xs cursor-pointer"
          >
            <FolderPlus className="size-3.5 mr-2 text-primary" />
            Adicionar Seção
          </DropdownMenuItem>
        )}

        {handlers.dirty && handlers.save && (
          <DropdownMenuItem
            onSelect={handlers.save}
            className="text-xs cursor-pointer font-semibold text-primary"
          >
            Salvar Programação
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AddItemContextItems({
  handlers,
}: {
  handlers: AddItemMenuHandlers;
}) {
  return (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger className="text-xs cursor-pointer font-medium">
          <Music className="size-3.5 mr-2 text-primary" />
          Músicas
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          <ContextMenuItem
            onClick={handlers.addMusic}
            className="text-xs cursor-pointer"
          >
            <Music className="size-3.5 mr-2 text-primary" />
            Adicionar Música
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlers.searchOnline}
            className="text-xs cursor-pointer"
          >
            <Globe className="size-3.5 mr-2 text-sky-500" />
            Buscar música na internet…
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlers.newSong}
            className="text-xs cursor-pointer"
          >
            <Plus className="size-3.5 mr-2 text-primary" />
            Nova Música
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="text-xs cursor-pointer font-medium">
          <BookOpen className="size-3.5 mr-2 text-emerald-500" />
          Bíblia
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          <ContextMenuItem
            onClick={handlers.addScripture}
            className="text-xs cursor-pointer"
          >
            <BookOpen className="size-3.5 mr-2 text-emerald-500" />
            Adicionar Versículo…
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="text-xs cursor-pointer font-medium">
          <ImageIcon className="size-3.5 mr-2 text-sky-500" />
          Mídias
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          <ContextMenuItem
            onClick={handlers.addText}
            className="text-xs cursor-pointer"
          >
            <AlignLeft className="size-3.5 mr-2 text-sky-500" />
            Adicionar Texto
          </ContextMenuItem>
          {MEDIA_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <ContextMenuItem
                key={option.kind}
                onClick={() => handlers.addMedia(option.kind)}
                className="text-xs cursor-pointer"
              >
                <Icon className="size-3.5 mr-2 text-sky-500" />
                {option.label}
              </ContextMenuItem>
            );
          })}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handlers.openMediaLibrary}
            className="text-xs cursor-pointer"
          >
            <FolderOpen className="size-3.5 mr-2 text-muted-foreground" />
            Abrir Pasta de Mídias
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="text-xs cursor-pointer font-medium">
          <Sparkles className="size-3.5 mr-2 text-amber-500" />
          Studio
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-60">
          <ContextMenuItem
            onClick={handlers.insertStudio}
            className="text-xs cursor-pointer"
          >
            <Search className="size-3.5 mr-2 text-amber-500" />
            Inserir Salva da Biblioteca…
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlers.createStudio}
            className="text-xs cursor-pointer"
          >
            <Plus className="size-3.5 mr-2 text-primary" />
            Criar Nova no Studio…
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      {(handlers.addSection ||
        (handlers.dirty && handlers.save)) && <ContextMenuSeparator />}

      {handlers.addSection && (
        <ContextMenuItem
          onClick={handlers.addSection}
          className="text-xs cursor-pointer"
        >
          <FolderPlus className="size-3.5 mr-2 text-primary" />
          Adicionar Seção
        </ContextMenuItem>
      )}

      {handlers.dirty && handlers.save && (
        <ContextMenuItem
          onClick={handlers.save}
          className="text-xs cursor-pointer font-semibold text-primary"
        >
          Salvar Programação
        </ContextMenuItem>
      )}
    </>
  );
}
