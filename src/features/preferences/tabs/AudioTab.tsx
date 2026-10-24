import { useEffect, useState } from "react";
import { Check, Info, Play, RefreshCw, Speaker, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAudioSettingsStore } from "@/core/store/audioSettingsStore";

export function AudioTab() {
  const selectedDeviceId = useAudioSettingsStore((s) => s.selectedDeviceId);
  const masterVolume = useAudioSettingsStore((s) => s.masterVolume);
  const devices = useAudioSettingsStore((s) => s.devices);
  const refreshDevices = useAudioSettingsStore((s) => s.refreshDevices);
  const setSelectedDevice = useAudioSettingsStore((s) => s.setSelectedDevice);
  const setMasterVolume = useAudioSettingsStore((s) => s.setMasterVolume);

  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  const handleTestSound = async () => {
    setTesting(true);
    try {
      // Cria um tom harmônico de teste de 440Hz com Web Audio API
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        toast.error("Web Audio não suportado.");
        return;
      }
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3); // G5

      gain.gain.setValueAtTime(0.3 * masterVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Se sinkId for suportado no AudioContext
      if (selectedDeviceId && typeof (ctx as any).setSinkId === "function") {
        try {
          await (ctx as any).setSinkId(selectedDeviceId);
        } catch {
          // fallback
        }
      }

      osc.start();
      osc.stop(ctx.currentTime + 0.65);
      toast.success("Tom de teste reproduzido!");
    } catch (err) {
      toast.error(`Falha ao testar som: ${String(err)}`);
    } finally {
      setTimeout(() => setTesting(false), 700);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Saída de Áudio
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure a placa ou dispositivo de som padrão para músicas, fundos musicais e vinhetas.
        </p>
      </div>

      {/* Info Card: Sem projeção no público */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-foreground">
            Áudio Independente do Telão
          </span>
          <p className="text-muted-foreground leading-relaxed">
            Arquivos de áudio da biblioteca são executados diretamente através do dispositivo configurado aqui (fone do operador, mesa de som ou fone de retorno), sem criar slides ou alterar a projeção do telão de público.
          </p>
        </div>
      </div>

      {/* Seletor de Dispositivo de Saída */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-2">
            <Speaker className="size-4 text-primary" />
            Dispositivo de Saída de Áudio
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refreshDevices()}
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className="size-3" />
            <span>Atualizar lista</span>
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Dispositivo Padrão do Sistema Operacional</p>
            <p className="mt-1 text-[11px]">
              O sistema utilizará a saída de áudio definida pelo SO. Para habilitar a seleção manual de dispositivos de saída avançados, conceda permissão de mídia ao aplicativo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Opção Padrão do Sistema */}
            <button
              type="button"
              onClick={() => void setSelectedDevice("")}
              className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all cursor-pointer ${
                !selectedDeviceId
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border bg-card/60 hover:border-primary/40"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">
                  Padrão do Sistema Operacional
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Segue automaticamente a saída principal configurada no computador
                </span>
              </div>
              {!selectedDeviceId && <Check className="size-4 text-primary" />}
            </button>

            {/* Lista de Dispositivos Detectados */}
            {devices.map((device, idx) => {
              const isSelected = selectedDeviceId === device.deviceId;
              return (
                <button
                  key={device.deviceId || idx}
                  type="button"
                  onClick={() => void setSelectedDevice(device.deviceId)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card/60 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        {device.label || `Saída de Áudio ${idx + 1}`}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {device.deviceId ? `ID: ${device.deviceId.slice(0, 16)}…` : "Dispositivo de Áudio"}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Volume Geral e Botão de Teste */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {masterVolume === 0 ? (
              <VolumeX className="size-4 text-muted-foreground" />
            ) : (
              <Volume2 className="size-4 text-primary" />
            )}
            <span className="text-xs font-semibold text-foreground">
              Volume Geral de Reprodução
            </span>
          </div>
          <span className="font-mono text-xs text-foreground font-semibold">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => void setMasterVolume(parseFloat(e.target.value))}
          className="w-full accent-primary h-2 cursor-pointer"
        />

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <span className="text-[11px] text-muted-foreground">
            Teste a saída de áudio para garantir que o som chegue à mesa/caixas:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestSound}
            disabled={testing}
            className="h-8 gap-1.5 text-xs cursor-pointer"
          >
            <Play className={`size-3.5 ${testing ? "text-primary animate-spin" : ""}`} />
            <span>{testing ? "Reproduzindo…" : "Testar Som"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
