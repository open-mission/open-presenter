import {
  Globe,
  Monitor,
  MoreVertical,
  Plus,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDisplaysStore } from "../store";
import type { OutputCategory, OutputType } from "@/core/types";
import { CATEGORY_LABELS, TYPE_LABELS } from "../types";
import { cn } from "@/core/lib/utils";

export function DisplaysSidebar() {
  const outputs = useDisplaysStore((s) => s.outputs);
  const selectedOutputId = useDisplaysStore((s) => s.selectedOutputId);
  const identifyActive = useDisplaysStore((s) => s.identifyActive);
  const selectOutput = useDisplaysStore((s) => s.selectOutput);
  const addOutput = useDisplaysStore((s) => s.addOutput);
  const toggleOutput = useDisplaysStore((s) => s.toggleOutput);
  const setIdentifyActive = useDisplaysStore((s) => s.setIdentifyActive);
  const removeOutput = useDisplaysStore((s) => s.removeOutput);
  const duplicateOutput = useDisplaysStore((s) => s.duplicateOutput);

  const categories: OutputCategory[] = ["public", "stage", "lower"];

  function getTypeIcon(type: OutputType) {
    switch (type) {
      case "monitor":
        return <Monitor className="size-3.5" />;
      case "html":
        return <Globe className="size-3.5" />;
      case "ndi":
      case "virtual":
        return <Tv className="size-3.5" />;
    }
  }

  return (
    <aside className="w-64 sm:w-72 border-r border-zinc-800 bg-zinc-950/70 flex flex-col shrink-0 min-h-0 select-none">
      {/* Category Groups List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 [scrollbar-gutter:stable]">
        {categories.map((cat) => {
          const groupOutputs = outputs.filter((o) => o.category === cat);

          return (
            <div key={cat} className="space-y-1.5">
              {/* Category Header: Title (count) + Add Button */}
              <div className="flex items-center justify-between px-1 py-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-zinc-200">
                    {CATEGORY_LABELS[cat].title}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    ({groupOutputs.length})
                  </span>
                </div>

                {/* Add Output Button with Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-zinc-400 hover:text-white hover:bg-zinc-800"
                      title={`Adicionar saída em ${CATEGORY_LABELS[cat].title}`}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-zinc-900 border-zinc-800 text-zinc-200">
                    <DropdownMenuLabel className="text-xs text-zinc-400">
                      Adicionar Saída ({CATEGORY_LABELS[cat].title})
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DropdownMenuItem
                      onClick={() => void addOutput(cat, "monitor")}
                      className="text-xs cursor-pointer gap-2 hover:bg-zinc-800 focus:bg-zinc-800"
                    >
                      <Monitor className="size-3.5 text-blue-400" />
                      <span>Monitor Físico</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void addOutput(cat, "html")}
                      className="text-xs cursor-pointer gap-2 hover:bg-zinc-800 focus:bg-zinc-800"
                    >
                      <Globe className="size-3.5 text-emerald-400" />
                      <span>Saída Web (HTML)</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Outputs List in Category */}
              <div className="space-y-1">
                {groupOutputs.length === 0 ? (
                  <div className="px-2.5 py-3 text-center border border-dashed border-zinc-800/80 rounded-md bg-zinc-900/30">
                    <p className="text-[11px] text-zinc-500">
                      Nenhuma saída de {CATEGORY_LABELS[cat].title.toLowerCase()}.
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      Clique no botão <span className="font-semibold text-zinc-400">+</span> para adicionar.
                    </p>
                  </div>
                ) : (
                  groupOutputs.map((out) => {
                    const isSelected = selectedOutputId === out.id;

                    return (
                      <div
                        key={out.id}
                        onClick={() => selectOutput(out.id)}
                        className={cn(
                          "group relative flex items-center justify-between rounded-md px-3 py-2.5 text-xs transition-colors cursor-pointer border",
                          isSelected
                            ? "bg-zinc-800/90 border-zinc-700 text-white shadow-sm"
                            : "bg-zinc-900/40 border-transparent hover:bg-zinc-850 hover:border-zinc-800 text-zinc-300",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Color Swatch or Type Icon */}
                          <div
                            className={cn(
                              "size-5 rounded flex items-center justify-center shrink-0 border border-zinc-700/60",
                              out.type === "monitor" && "text-blue-400 bg-blue-500/10",
                              out.type === "html" && "text-emerald-400 bg-emerald-500/10",
                              out.type === "ndi" && "text-purple-400 bg-purple-500/10",
                              out.type === "virtual" && "text-amber-400 bg-amber-500/10",
                            )}
                            title={TYPE_LABELS[out.type]?.name}
                          >
                            {getTypeIcon(out.type)}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <div className="font-medium truncate text-zinc-200">
                              {out.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              {out.resolution.width} x {out.resolution.height}
                            </div>
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Active / Enabled Toggle */}
                          <Switch
                            checked={out.enabled}
                            onCheckedChange={() => void toggleOutput(out.id)}
                            className="scale-[0.65] data-[state=checked]:bg-emerald-500"
                            onClick={(e) => e.stopPropagation()}
                            title={out.enabled ? "Saída ativada" : "Saída desativada"}
                          />

                          {/* Context Menu / Options */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-5 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-zinc-900 border-zinc-800 text-zinc-200 text-xs">
                              <DropdownMenuItem
                                onClick={() => void duplicateOutput(out.id)}
                                className="cursor-pointer hover:bg-zinc-800"
                              >
                                Duplicar saída
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-zinc-800" />
                              <DropdownMenuItem
                                onClick={() => void removeOutput(out.id)}
                                className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                Excluir saída
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer Controls (Identificar telas) */}
      <div className="border-t border-zinc-800/80 p-3 bg-zinc-950/90">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-zinc-300">Identificar telas</span>
          <Switch
            checked={identifyActive}
            onCheckedChange={(checked) => void setIdentifyActive(checked)}
            className="scale-75 data-[state=checked]:bg-indigo-500"
            title="Exibe uma identificação visual com número e resolução em cada tela"
          />
        </div>
      </div>
    </aside>
  );
}
