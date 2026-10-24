import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Layers,
  Sparkles,
  Trash2,
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
  ISF_PRESETS,
  ISF_STARTER_TEMPLATE,
  parseISF,
  type ISFInput,
} from "./isfEngine";
import { ShaderCanvas } from "./ShaderCanvas";
import { useMediaShadersStore, type CustomISFShader } from "./store";

interface ISFShaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shaderToEdit?: CustomISFShader | { id: string; name: string; code?: string } | null;
}

export function ISFShaderDialog({
  open,
  onOpenChange,
  shaderToEdit,
}: ISFShaderDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Líquido");
  const [code, setCode] = useState(ISF_STARTER_TEMPLATE);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});

  const saveCustomShader = useMediaShadersStore((s) => s.saveCustomShader);
  const deleteCustomShader = useMediaShadersStore((s) => s.deleteCustomShader);

  // Carrega shader a editar ou reseta para template inicial
  useEffect(() => {
    if (!open) return;

    if (shaderToEdit) {
      setName(shaderToEdit.name);
      setCategory(
        ("category" in shaderToEdit && shaderToEdit.category)
          ? shaderToEdit.category
          : "Geral",
      );

      // Se é um shader built-in ou customizado
      if ("code" in shaderToEdit && shaderToEdit.code) {
        setCode(shaderToEdit.code);
      } else {
        const found = ISF_PRESETS.find((p) => p.id === shaderToEdit.id);
        setCode(found ? found.code : ISF_STARTER_TEMPLATE);
      }
    } else {
      setName("Novo Shader");
      setCategory("Líquido");
      setCode(ISF_STARTER_TEMPLATE);
    }

    setCompileError(null);
    setInputValues({});
  }, [open, shaderToEdit]);

  // Extrai inputs declarados no cabeçalho ISF JSON
  const parsedInputs: ISFInput[] = useMemo(() => {
    const parsed = parseISF(code);
    return parsed.metadata.INPUTS ?? [];
  }, [code]);

  const handleInputChange = (inputName: string, val: any) => {
    setInputValues((prev) => ({
      ...prev,
      [inputName]: val,
    }));
  };

  const handleLoadTemplate = (templateId: string) => {
    if (templateId === "starter") {
      setCode(ISF_STARTER_TEMPLATE);
      setName("Shader Customizado");
      return;
    }
    const found = ISF_PRESETS.find((p) => p.id === templateId);
    if (found) {
      setCode(found.code);
      setName(`${found.name} (Cópia)`);
      setCategory(found.category);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome para o shader.");
      return;
    }

    const parsed = parseISF(code);
    if (parsed.error) {
      toast.error(`Cabeçalho ISF inválido: ${parsed.error}`);
      return;
    }

    if (compileError) {
      toast.error("O shader contém erros de compilação GLSL. Corrija-os antes de salvar.");
      return;
    }

    const id = shaderToEdit && "id" in shaderToEdit && shaderToEdit.id.startsWith("custom-")
      ? shaderToEdit.id.replace("custom-", "")
      : `shader_${Date.now()}`;

    await saveCustomShader({
      id,
      name: name.trim(),
      category: category.trim() || "Geral",
      desc: parsed.metadata.DESCRIPTION || "Shader interativo ISF 2.0",
      code,
    });

    toast.success(`Shader "${name.trim()}" salvo com sucesso!`);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!shaderToEdit || !shaderToEdit.id) return;
    const cleanId = shaderToEdit.id.replace("custom-", "");
    await deleteCustomShader(cleanId);
    toast.success("Shader removido com sucesso.");
    onOpenChange(false);
  };

  const isCustomShader = Boolean(shaderToEdit?.id && (shaderToEdit.id.startsWith("custom-") || shaderToEdit.id.startsWith("shader_")));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border">
        {/* Header do Editor */}
        <DialogHeader className="p-4 pb-3 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>{shaderToEdit ? "Editar Shader ISF" : "Novo Shader ISF (isf.video)"}</span>
                  <Badge variant="outline" className="text-[10px] font-mono font-normal">
                    ISF 2.0
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Shaders compatíveis com o padrão interativo ISF 2.0. Renderizados em tempo real via WebGL.
                </DialogDescription>
              </div>
            </div>

            {/* Template Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Exemplos:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) handleLoadTemplate(e.target.value);
                }}
                defaultValue=""
                className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground cursor-pointer"
              >
                <option value="" disabled>
                  Carregar Template…
                </option>
                <option value="starter">Template Básico</option>
                {ISF_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nome e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Nome do Shader:</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Aurora Cósmica"
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Categoria:</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex.: Líquido, Atmosfera, Adoração"
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Corpo do Editor: Split Screen (Preview WebGL à Esquerda, Código à Direita) */}
        <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-border">
          {/* Coluna Esquerda: Preview WebGL + Parâmetros Interativos */}
          <div className="flex w-1/2 flex-col min-h-0 overflow-y-auto bg-black/40">
            {/* Canvas WebGL */}
            <div className="relative aspect-video w-full shrink-0 bg-black overflow-hidden border-b border-border/80">
              <ShaderCanvas
                shader={code}
                inputs={inputValues}
                onError={(err) => setCompileError(err)}
              />

              {/* Status de Compilação */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                {compileError ? (
                  <div className="flex items-center gap-1.5 rounded bg-destructive/90 px-2 py-1 text-[11px] font-medium text-destructive-foreground shadow-md backdrop-blur-xs">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span className="truncate">{compileError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-medium text-emerald-400 shadow-md backdrop-blur-xs">
                    <CheckCircle2 className="size-3 shrink-0" />
                    <span>Compilado com sucesso (WebGL)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Controles de Parâmetros (INPUTS ISF) */}
            <div className="p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" />
                  Parâmetros Interativos ({parsedInputs.length})
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">ISF INPUTS</span>
              </div>

              {parsedInputs.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 italic py-2">
                  Nenhum parâmetro declarado no bloco JSON de INPUTS.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {parsedInputs.map((input) => {
                    const currentVal =
                      inputValues[input.NAME] !== undefined
                        ? inputValues[input.NAME]
                        : input.DEFAULT;

                    if (input.TYPE === "float") {
                      const min = input.MIN ?? 0.0;
                      const max = input.MAX ?? 3.0;
                      const numVal = typeof currentVal === "number" ? currentVal : (input.DEFAULT as number) ?? 1.0;

                      return (
                        <div key={input.NAME} className="flex flex-col gap-1 rounded border border-border/60 bg-muted/20 p-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{input.LABEL || input.NAME}</span>
                            <span className="font-mono text-[11px] text-primary">{numVal.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={0.05}
                            value={numVal}
                            onChange={(e) => handleInputChange(input.NAME, parseFloat(e.target.value))}
                            className="w-full accent-primary h-1.5 cursor-pointer"
                          />
                        </div>
                      );
                    }

                    if (input.TYPE === "color") {
                      const arr = Array.isArray(currentVal) ? currentVal : [0.5, 0.5, 0.5, 1.0];
                      // Converte float RGB [0..1] para Hex #RRGGBB
                      const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
                      const hexColor = `#${toHex(arr[0] ?? 0)}${toHex(arr[1] ?? 0)}${toHex(arr[2] ?? 0)}`;

                      return (
                        <div key={input.NAME} className="flex items-center justify-between rounded border border-border/60 bg-muted/20 p-2">
                          <span className="text-xs font-medium text-foreground">{input.LABEL || input.NAME}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={hexColor}
                              onChange={(e) => {
                                const hex = e.target.value;
                                const r = parseInt(hex.slice(1, 3), 16) / 255;
                                const g = parseInt(hex.slice(3, 5), 16) / 255;
                                const b = parseInt(hex.slice(5, 7), 16) / 255;
                                handleInputChange(input.NAME, [r, g, b, 1.0]);
                              }}
                              className="size-7 rounded cursor-pointer border border-border bg-transparent p-0"
                            />
                            <span className="text-[10px] font-mono text-muted-foreground">{hexColor.toUpperCase()}</span>
                          </div>
                        </div>
                      );
                    }

                    if (input.TYPE === "bool") {
                      const boolVal = Boolean(currentVal);
                      return (
                        <div key={input.NAME} className="flex items-center justify-between rounded border border-border/60 bg-muted/20 p-2">
                          <span className="text-xs font-medium text-foreground">{input.LABEL || input.NAME}</span>
                          <input
                            type="checkbox"
                            checked={boolVal}
                            onChange={(e) => handleInputChange(input.NAME, e.target.checked)}
                            className="size-4 accent-primary cursor-pointer"
                          />
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Editor de Código GLSL / ISF */}
          <div className="flex w-1/2 flex-col min-h-0 bg-background">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 shrink-0">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="size-3.5 text-primary" />
                Código-Fonte ISF / GLSL
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">/*&#123; JSON &#125;*/ void main()</span>
            </div>

            <div className="flex-1 min-h-0 relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="size-full resize-none p-3 font-mono text-xs leading-relaxed bg-[#0d1117] text-[#e6edf3] border-none outline-none focus:ring-0 selection:bg-primary/30"
                placeholder="/*{ ISF JSON Metadata }*/ void main() { ... }"
              />
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <DialogFooter className="p-3 border-t border-border bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
          <div>
            {isCustomShader && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDelete()}
                className="h-8 gap-1 text-xs cursor-pointer"
                title="Excluir este shader customizado"
              >
                <Trash2 className="size-3.5" />
                <span>Excluir</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              className="h-8 gap-1.5 text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              <Sparkles className="size-3.5" />
              <span>Salvar Shader</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
