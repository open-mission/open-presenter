import { useState } from "react";
import { useDisplaysStore } from "./store";
import { DisplaysSidebar } from "./components/DisplaysSidebar";
import { DisplaysCanvasPreview } from "./components/DisplaysCanvasPreview";
import { DisplaysTabsPanel } from "./components/DisplaysTabsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Projector,
  Trash2,
  Tv,
  Globe,
  Edit2,
  Check,
} from "lucide-react";
import { cn } from "@/core/lib/utils";

export function DisplaysManager() {
  const outputs = useDisplaysStore((s) => s.outputs);
  const selectedOutputId = useDisplaysStore((s) => s.selectedOutputId);
  const monitors = useDisplaysStore((s) => s.monitors);
  const updateOutput = useDisplaysStore((s) => s.updateOutput);
  const removeOutput = useDisplaysStore((s) => s.removeOutput);
  const addOutput = useDisplaysStore((s) => s.addOutput);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(240);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  function startResizing(e: React.MouseEvent) {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    function onMouseMove(moveEvent: MouseEvent) {
      const deltaY = startY - moveEvent.clientY;
      const nextHeight = Math.max(140, Math.min(520, startHeight + deltaY));
      setBottomPanelHeight(nextHeight);
    }

    function onMouseUp() {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const selectedOutput = outputs.find((o) => o.id === selectedOutputId) ?? outputs[0];

  function startEditingName() {
    if (!selectedOutput) return;
    setNameInput(selectedOutput.name);
    setIsEditingName(true);
  }

  function saveName() {
    if (!selectedOutput) return;
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== selectedOutput.name) {
      void updateOutput(selectedOutput.id, { name: trimmed });
    }
    setIsEditingName(false);
  }

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* Left Sidebar */}
      <DisplaysSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-900/50">
        {selectedOutput ? (
          <>
            {/* Top Toolbar of Selected Output */}
            <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0 bg-zinc-950/80">
              {/* Output Name & Resolution */}
              <div className="flex items-center gap-4 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") setIsEditingName(false);
                      }}
                      autoFocus
                      className="h-8 w-48 bg-zinc-900 border-zinc-700 text-sm font-semibold"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={saveName}
                      className="size-7 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Check className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex items-baseline gap-2.5 cursor-pointer group"
                    onClick={startEditingName}
                    title="Clique para renomear"
                  >
                    <h2 className="text-base font-semibold text-zinc-100 tracking-tight group-hover:text-white transition-colors">
                      {selectedOutput.name}
                    </h2>
                    <span className="text-xs text-zinc-500 font-mono">
                      {selectedOutput.resolution.width} x {selectedOutput.resolution.height}
                    </span>
                    <Edit2 className="size-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>

              {/* Right: Screen Color Switch + Color Picker + Delete */}
              <div className="flex items-center gap-4">
                {/* Cor da tela (matching ProPresenter switch + swatch) */}
                <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1 rounded-md">
                  <Switch
                    checked={selectedOutput.backgroundColorEnabled}
                    onCheckedChange={(checked) =>
                      void updateOutput(selectedOutput.id, {
                        backgroundColorEnabled: checked,
                      })
                    }
                    className="scale-75 data-[state=checked]:bg-zinc-300"
                    id="screen-color-toggle"
                  />
                  <label
                    htmlFor="screen-color-toggle"
                    className="text-xs font-medium text-zinc-300 cursor-pointer"
                  >
                    Cor da tela
                  </label>

                  {/* Color Swatch Chip */}
                  <div className="relative flex items-center">
                    <input
                      type="color"
                      value={
                        selectedOutput.backgroundColor.startsWith("#")
                          ? selectedOutput.backgroundColor
                          : "#000000"
                      }
                      onChange={(e) =>
                        void updateOutput(selectedOutput.id, {
                          backgroundColor: e.target.value,
                          backgroundColorEnabled: true,
                        })
                      }
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div
                      className="size-5 rounded border border-zinc-700 shadow-sm"
                      style={{
                        backgroundColor: selectedOutput.backgroundColorEnabled
                          ? selectedOutput.backgroundColor
                          : "transparent",
                      }}
                    />
                  </div>
                </div>

                {/* Delete Output Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void removeOutput(selectedOutput.id)}
                  className="size-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                  title="Excluir esta saída"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Middle: Visual Canvas Preview */}
            <DisplaysCanvasPreview output={selectedOutput} />

            {/* Drag Resizer Bar */}
            <div
              onMouseDown={startResizing}
              className={cn(
                "h-2 w-full cursor-row-resize flex items-center justify-center transition-colors bg-zinc-950 border-t border-zinc-800 hover:bg-indigo-500/20 group select-none shrink-0",
                isResizing && "bg-indigo-500/30",
              )}
              title="Arraste para cima/baixo para redimensionar o painel inferior"
            >
              <div className="h-1 w-12 rounded-full bg-zinc-700 group-hover:bg-indigo-400 transition-colors" />
            </div>

            {/* Bottom: Tabs Panel with Resizable Height */}
            <div style={{ height: `${bottomPanelHeight}px` }} className="flex flex-col shrink-0 overflow-hidden">
              <DisplaysTabsPanel
                output={selectedOutput}
                monitors={monitors}
                onUpdate={(patch) => updateOutput(selectedOutput.id, patch)}
              />
            </div>
          </>
        ) : (
          /* Empty State when no output is configured */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="size-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-400">
              <Projector className="size-8 text-zinc-500" />
            </div>

            <h3 className="text-lg font-semibold text-zinc-200">
              Nenhuma saída configurada
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mt-1 mb-6 leading-relaxed">
              Por padrão, o Open Presenter não possui saídas ativas. Adicione monitores físicos
              ou saídas web HTML para iniciar a projeção.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => void addOutput("public", "monitor")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 text-xs h-9"
              >
                <Projector className="size-3.5" />
                Adicionar Tela de Público
              </Button>

              <Button
                variant="outline"
                onClick={() => void addOutput("stage", "monitor")}
                className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-2 text-xs h-9"
              >
                <Tv className="size-3.5" />
                Adicionar Retorno de Palco
              </Button>

              <Button
                variant="outline"
                onClick={() => void addOutput("lower", "html")}
                className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-2 text-xs h-9"
              >
                <Globe className="size-3.5" />
                Adicionar Lower Third (HTML)
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
