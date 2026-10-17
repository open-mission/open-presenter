import { useState } from "react";
import { Plus, RotateCw, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ColorStop {
  id: string;
  color: string;
  pos: number; // 0 to 100
}

const GRADIENT_PRESETS = [
  {
    name: "Azul Noturno",
    value: "linear-gradient(180deg, #0b1e3a 0%, #000000 100%)",
  },
  {
    name: "Pôr do Sol",
    value: "linear-gradient(135deg, #7c2d12 0%, #1e1b4b 100%)",
  },
  {
    name: "Vinho Real",
    value: "radial-gradient(circle at 50% 30%, #4c0519 0%, #000000 100%)",
  },
  {
    name: "Esmeralda",
    value: "linear-gradient(135deg, #064e3b 0%, #022c22 60%, #000000 100%)",
  },
  {
    name: "Aurora Boreal",
    value: "linear-gradient(120deg, #0f172a 0%, #115e59 40%, #0e7490 70%, #020617 100%)",
  },
  {
    name: "Roxo Cósmico",
    value: "radial-gradient(circle at 50% 50%, #3b0764 0%, #0f172a 70%, #000000 100%)",
  },
  {
    name: "Chama Dourada",
    value: "linear-gradient(180deg, #78350f 0%, #451a03 50%, #000000 100%)",
  },
  {
    name: "Cinza Studio",
    value: "linear-gradient(180deg, #27272a 0%, #09090b 100%)",
  },
];

interface GradientBuilderProps {
  value: string;
  onChange: (gradientCss: string) => void;
}

export function GradientBuilder({ value, onChange }: GradientBuilderProps) {
  const [type, setType] = useState<"linear" | "radial">(() =>
    value.includes("radial-gradient") ? "radial" : "linear",
  );
  const [angle, setAngle] = useState<number>(() => {
    const match = value.match(/(\d+)deg/);
    return match ? Number(match[1]) : 180;
  });

  const [stops, setStops] = useState<ColorStop[]>(() => {
    // Tenta extrair paradas de cor existentes do CSS
    const extracted: ColorStop[] = [];
    const stopMatches = value.matchAll(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+(\d+)%/g);
    let id = 1;
    for (const match of stopMatches) {
      extracted.push({
        id: `stop-${id++}`,
        color: match[1],
        pos: Number(match[2]),
      });
    }
    if (extracted.length >= 2) return extracted;
    return [
      { id: "stop-1", color: "#1e3a8a", pos: 0 },
      { id: "stop-2", color: "#000000", pos: 100 },
    ];
  });

  function emitGradient(
    newType = type,
    newAngle = angle,
    newStops = stops,
  ) {
    const sortedStops = [...newStops].sort((a, b) => a.pos - b.pos);
    const stopsStr = sortedStops
      .map((s) => `${s.color} ${s.pos}%`)
      .join(", ");

    let css = "";
    if (newType === "linear") {
      css = `linear-gradient(${newAngle}deg, ${stopsStr})`;
    } else {
      css = `radial-gradient(circle at 50% 50%, ${stopsStr})`;
    }
    onChange(css);
  }

  function handleTypeChange(newType: "linear" | "radial") {
    setType(newType);
    emitGradient(newType, angle, stops);
  }

  function handleAngleChange(newAngle: number) {
    setAngle(newAngle);
    emitGradient(type, newAngle, stops);
  }

  function handleStopColorChange(id: string, color: string) {
    const next = stops.map((s) => (s.id === id ? { ...s, color } : s));
    setStops(next);
    emitGradient(type, angle, next);
  }

  function handleStopPosChange(id: string, pos: number) {
    const next = stops.map((s) => (s.id === id ? { ...s, pos } : s));
    setStops(next);
    emitGradient(type, angle, next);
  }

  function addStop() {
    const maxPos = Math.max(...stops.map((s) => s.pos), 0);
    const newPos = Math.min(100, Math.round(maxPos / 2) || 50);
    const newStop: ColorStop = {
      id: `stop-${Date.now()}`,
      color: "#3b82f6",
      pos: newPos,
    };
    const next = [...stops, newStop];
    setStops(next);
    emitGradient(type, angle, next);
  }

  function removeStop(id: string) {
    if (stops.length <= 2) return;
    const next = stops.filter((s) => s.id !== id);
    setStops(next);
    emitGradient(type, angle, next);
  }

  function applyPreset(presetValue: string) {
    onChange(presetValue);
    setType(presetValue.includes("radial") ? "radial" : "linear");
    const angleMatch = presetValue.match(/(\d+)deg/);
    if (angleMatch) setAngle(Number(angleMatch[1]));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/60 p-3">
      {/* Live Preview Bar */}
      <div
        className="h-10 w-full rounded-md border border-border/80 shadow-inner"
        style={{ background: value }}
      />

      {/* Tipo de Gradiente */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-foreground">
          Tipo de Gradiente
        </span>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/70 bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => handleTypeChange("linear")}
            className={`rounded-md py-1 text-xs font-medium transition-all cursor-pointer ${
              type === "linear"
                ? "bg-background text-primary font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Linear
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("radial")}
            className={`rounded-md py-1 text-xs font-medium transition-all cursor-pointer ${
              type === "radial"
                ? "bg-background text-primary font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Radial
          </button>
        </div>
      </div>

      {/* Ângulo (apenas para linear) */}
      {type === "linear" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <RotateCw className="size-3 text-muted-foreground" />
              Ângulo: {angle}°
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: "0°", deg: 0 },
                { label: "90°", deg: 90 },
                { label: "135°", deg: 135 },
                { label: "180°", deg: 180 },
              ].map((b) => (
                <button
                  key={b.deg}
                  type="button"
                  onClick={() => handleAngleChange(b.deg)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors cursor-pointer border ${
                    angle === b.deg
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border/60 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={angle}
            onChange={(e) => handleAngleChange(Number(e.target.value))}
            className="h-2 w-full accent-primary cursor-pointer"
          />
        </div>
      )}

      {/* Paradas de Cor (Color Stops) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">
            Paradas de Cor ({stops.length})
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addStop}
            className="h-6 gap-1 px-2 text-[11px] text-primary cursor-pointer"
          >
            <Plus className="size-3" />
            Adicionar Cor
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {stops.map((stop, idx) => (
            <div
              key={stop.id}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-background/50 p-1.5"
            >
              <span className="font-mono text-[10px] text-muted-foreground w-4 text-center">
                {idx + 1}
              </span>
              <input
                type="color"
                value={stop.color.startsWith("#") ? stop.color : "#3b82f6"}
                onChange={(e) => handleStopColorChange(stop.id, e.target.value)}
                className="size-6 rounded border border-border/60 cursor-pointer p-0 shrink-0"
              />
              <Input
                value={stop.color}
                onChange={(e) => handleStopColorChange(stop.id, e.target.value)}
                className="h-7 w-20 font-mono text-[11px] px-1.5"
              />
              <div className="flex flex-1 items-center gap-1.5 min-w-0">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={stop.pos}
                  onChange={(e) =>
                    handleStopPosChange(stop.id, Number(e.target.value))
                  }
                  className="h-2 flex-1 accent-primary cursor-pointer min-w-12"
                />
                <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                  {stop.pos}%
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={stops.length <= 2}
                onClick={() => removeStop(stop.id)}
                className="size-6 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                title={
                  stops.length <= 2
                    ? "Mínimo de 2 cores necessárias"
                    : "Remover cor"
                }
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Galeria de Presets */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Sparkles className="size-3 text-amber-500" />
          Modelos Prontos
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {GRADIENT_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p.value)}
              className="flex items-center gap-2 rounded-md border border-border/60 p-1.5 text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <div
                className="size-5 rounded border border-white/20 shrink-0 shadow-2xs"
                style={{ background: p.value }}
              />
              <span className="text-[11px] font-medium truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
