import { useState } from "react";
import {
  Baby,
  Car,
  Megaphone,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCommunicationStore } from "@/features/communication/store";
import type { CommunicationLevel, CommunicationTarget } from "@/features/communication/types";

export function AlertsAdjustmentTab() {
  const activeAlert = useCommunicationStore((s) => s.activeAlert);
  const sendAlert = useCommunicationStore((s) => s.sendAlert);
  const clearAlert = useCommunicationStore((s) => s.clearAlert);
  const setLevel = useCommunicationStore((s) => s.setLevel);
  const setDisplayMode = useCommunicationStore((s) => s.setDisplayMode);
  const setTargets = useCommunicationStore((s) => s.setTargets);
  const setAutoDismissSeconds = useCommunicationStore((s) => s.setAutoDismissSeconds);

  const [message, setMessage] = useState("");
  const [level] = useState<CommunicationLevel>("info");
  const [targetType, setTargetType] = useState<"all" | "stage" | "public">("all");
  const [childNumber, setChildNumber] = useState("");
  const [carPlate, setCarPlate] = useState("");

  const resolveTargets = (t: "all" | "stage" | "public"): CommunicationTarget[] => {
    if (t === "all") return ["stage", "public"];
    return [t];
  };

  const handleSendCustom = async () => {
    if (!message.trim()) {
      toast.error("Digite o texto do aviso.");
      return;
    }
    setLevel(level);
    setDisplayMode(targetType === "public" ? "banner_bottom" : "banner_top");
    setTargets(resolveTargets(targetType));
    setAutoDismissSeconds(30);
    await sendAlert(message.trim());
    setMessage("");
    toast.success("Aviso enviado com sucesso!");
  };

  const handleSendNursery = async () => {
    if (!childNumber.trim()) {
      toast.error("Informe o número da criança.");
      return;
    }
    setLevel("warning");
    setDisplayMode("banner_bottom");
    setTargets(["stage", "public"]);
    setAutoDismissSeconds(40);
    await sendAlert(`PAIS DA CRIANÇA Nº ${childNumber.trim()} FAVOR COMPARECER AO BERÇÁRIO`);
    setChildNumber("");
    toast.success("Aviso de berçário enviado!");
  };

  const handleSendCar = async () => {
    if (!carPlate.trim()) {
      toast.error("Informe a placa do veículo.");
      return;
    }
    setLevel("warning");
    setDisplayMode("banner_bottom");
    setTargets(["stage", "public"]);
    setAutoDismissSeconds(40);
    await sendAlert(`VEÍCULO PLACA ${carPlate.trim().toUpperCase()} BLOQUEANDO A PASSAGEM`);
    setCarPlate("");
    toast.success("Aviso de veículo enviado!");
  };

  const handleSendPreacher = async (mins: number) => {
    setLevel(mins === 0 ? "urgent" : "warning");
    setDisplayMode("banner_top");
    setTargets(["stage"]);
    setAutoDismissSeconds(30);
    await sendAlert(mins === 0 ? "ENCERRAR MINISTRAÇÃO" : `TEMPO: RESTAM ${mins} MINUTOS`);
    toast.success("Aviso enviado ao palco!");
  };

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-2.5 text-xs select-none">
      {/* Active Alert Banner */}
      {activeAlert && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <Megaphone className="size-4 shrink-0 text-amber-400 animate-pulse" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-[11px] block truncate">
                {activeAlert.text}
              </span>
              <span className="text-[10px] text-amber-300/70">
                Alvo: {activeAlert.targets.join(", ")}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => void clearAlert()}
            className="h-6 gap-1 px-2 text-[10px] cursor-pointer shrink-0"
          >
            <X className="size-3" />
            <span>Remover</span>
          </Button>
        </div>
      )}

      {/* Quick Presets Section */}
      <div className="grid grid-cols-2 gap-2">
        {/* Nursery Quick Alert */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/60 p-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Baby className="size-3.5 text-pink-400" />
            <span className="text-[11px] font-semibold text-foreground">Berçário</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={childNumber}
              onChange={(e) => setChildNumber(e.target.value)}
              placeholder="Nº da criança (ex: 12)"
              className="h-7 text-xs bg-muted/40"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSendNursery();
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSendNursery()}
              className="h-7 px-2 text-[11px] shrink-0 cursor-pointer"
            >
              <Send className="size-3" />
            </Button>
          </div>
        </div>

        {/* Car / Parking Alert */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/60 p-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Car className="size-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-foreground">Estacionamento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={carPlate}
              onChange={(e) => setCarPlate(e.target.value)}
              placeholder="Placa (ex: ABC-1234)"
              className="h-7 text-xs bg-muted/40 uppercase"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSendCar();
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSendCar()}
              className="h-7 px-2 text-[11px] shrink-0 cursor-pointer"
            >
              <Send className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Preacher Alert Shortcuts */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/60 p-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
          Aviso Palco:
        </span>
        <button
          type="button"
          onClick={() => void handleSendPreacher(10)}
          className="rounded bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          10 min
        </button>
        <button
          type="button"
          onClick={() => void handleSendPreacher(5)}
          className="rounded bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          5 min
        </button>
        <button
          type="button"
          onClick={() => void handleSendPreacher(2)}
          className="rounded bg-muted px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-accent transition-colors cursor-pointer"
        >
          2 min
        </button>
        <button
          type="button"
          onClick={() => void handleSendPreacher(0)}
          className="rounded bg-destructive/15 text-destructive px-2 py-1 text-[11px] font-semibold hover:bg-destructive/25 transition-colors cursor-pointer"
        >
          Encerrar
        </button>
      </div>

      {/* Custom Message Box */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/60 p-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground">Mensagem Personalizada</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTargetType("all")}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer ${
                targetType === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTargetType("stage")}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer ${
                targetType === "stage" ? "bg-sky-500 text-white font-semibold" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Palco
            </button>
            <button
              type="button"
              onClick={() => setTargetType("public")}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer ${
                targetType === "public" ? "bg-emerald-500 text-white font-semibold" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Telão
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite o aviso para enviar na hora…"
            className="h-8 text-xs bg-muted/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSendCustom();
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSendCustom()}
            className="h-8 gap-1 px-3 text-xs font-semibold shrink-0 cursor-pointer"
          >
            <Send className="size-3.5" />
            <span>Enviar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
