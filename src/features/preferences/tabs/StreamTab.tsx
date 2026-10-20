import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  Palette,
  Pencil,
  Plus,
  Radio,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSlideThemesStore } from "@/features/slide-themes/store";
import { useOutputManagerStore } from "@/features/output-manager/store";
import { outputHttpUrl } from "@/core/config/app";
import { toast } from "sonner";
import { DEFAULT_STREAM_THEME, DEFAULT_STREAM_THEME_GUID } from "@/features/slide-themes/seedThemes";
import { cloneTheme } from "@/features/slide-themes/pages";
import { getNdiStatus } from "@/core/ipc/commands";
import type { NdiStatus } from "@/core/types";
import { cn } from "@/core/lib/utils";

export function StreamTab() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [ndiStatus, setNdiStatus] = useState<NdiStatus | null>(null);

  const host = useOutputManagerStore((s) => s.host);
  const port = useOutputManagerStore((s) => s.server.port);

  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const setBinding = useSlideThemesStore((s) => s.setBinding);
  const saveTheme = useSlideThemesStore((s) => s.save);

  useEffect(() => {
    void getNdiStatus().then((status) => {
      if (status) setNdiStatus(status);
    });
  }, []);

  // Tema atualmente vinculado à transmissão para louvor/letras
  const currentStreamThemeGuid = useMemo(() => {
    const b =
      bindings.find((x) => x.target === "stream" && x.asset === "lyric") ??
      bindings.find((x) => x.target === "stream");
    return b?.themeGuid ?? DEFAULT_STREAM_THEME_GUID;
  }, [bindings]);

  // Lista de temas elegíveis (temas públicos/transmissão, excluindo palcos)
  const availableThemes = useMemo(() => {
    return themes.filter(
      (t) => t.category !== "stage" && t.category !== "presentation",
    );
  }, [themes]);

  const resolvedTheme = useMemo(() => {
    return (
      themes.find((t) => t.guid === currentStreamThemeGuid) ??
      themes.find((t) => t.guid === DEFAULT_STREAM_THEME_GUID) ??
      themes[0]
    );
  }, [themes, currentStreamThemeGuid]);

  const streamUrl = outputHttpUrl(host, port, "/stream");

  function handleCopyUrl() {
    void navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    toast.success("URL para o OBS copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleThemeChange(guid: string) {
    if (!guid) return;
    setBinding("stream", "lyric", guid);
    setBinding("stream", "scripture", guid);
    setBinding("stream", "custom", guid);
    toast.success("Tema da transmissão atualizado!");
  }

  async function handleCreateStreamTheme() {
    const theme = cloneTheme(
      DEFAULT_STREAM_THEME,
      `Novo Tema de Transmissão ${availableThemes.length + 1}`,
    );
    theme.category = "stream";
    await saveTheme(theme);
    setBinding("stream", "lyric", theme.guid);
    setBinding("stream", "scripture", theme.guid);
    setBinding("stream", "custom", theme.guid);
    navigate(`/theme-editor?guid=${theme.guid}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Grid: Tema e Integração OBS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Coluna Esquerda: Tema e Configurações */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* Seletor de Tema da Transmissão */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Palette className="size-3.5 text-primary" />
                Tema da Transmissão (Lower Third / Tarja)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-xs cursor-pointer"
                  onClick={handleCreateStreamTheme}
                  title="Criar novo tema formatado para transmissão"
                >
                  <Plus className="size-3" />
                  Novo Tema OBS
                </Button>
                {resolvedTheme && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary cursor-pointer"
                    onClick={() =>
                      navigate(`/theme-editor?guid=${resolvedTheme.guid}`)
                    }
                  >
                    <Pencil className="size-3" />
                    Editar no Editor
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={resolvedTheme?.guid ?? ""}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {availableThemes.map((t) => (
                  <option key={t.guid} value={t.guid}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Define o estilo visual das letras, versículos bíblicos e comunicados
              exibidos na transmissão ao vivo. O tema padrão é formatado em{" "}
              <strong>Lower Third (tarja inferior)</strong> com fundo transparente.
            </p>
          </div>

          {/* Como usar no OBS Studio */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Video className="size-3.5 text-primary" />
              Como usar no OBS Studio / vMix
            </span>

            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              <li>
                No OBS Studio, vá até a caixa de <strong>Fontes (Sources)</strong> e
                clique em <strong>+ &gt; Navegador (Browser)</strong>.
              </li>
              <li>
                Cole a URL da Transmissão no campo <strong>URL</strong>:
              </li>
            </ol>

            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 p-2">
              <code className="flex-1 font-mono text-[11px] text-foreground select-all overflow-hidden text-ellipsis whitespace-nowrap">
                {streamUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs cursor-pointer shrink-0"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs cursor-pointer shrink-0"
                onClick={() => window.open(streamUrl, "_blank")}
                title="Abrir no navegador"
              >
                <ExternalLink className="size-3" />
              </Button>
            </div>

            <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground">
              <li>
                Defina a <strong>Largura (Width)</strong> para{" "}
                <span className="font-mono text-foreground font-semibold">1920</span> e a{" "}
                <strong>Altura (Height)</strong> para{" "}
                <span className="font-mono text-foreground font-semibold">1080</span>.
              </li>
              <li>
                O fundo é <strong>100% transparente</strong> por padrão no OBS,
                permitindo sobrepor o texto perfeitamente sobre a câmera do culto.
              </li>
              <li>
                Você também pode usar a URL curta{" "}
                <code className="text-foreground font-mono">
                  http://localhost:{port}/output/stream
                </code>
                .
              </li>
            </ul>
          </div>
        </div>

        {/* Coluna Direita: NDI e Status da Rede */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* Card: Saída NDI */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Radio className="size-3.5 text-purple-400" />
                Transmissão via NDI
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/30">
                Em desenvolvimento
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O protocolo <strong>NDI® (Network Device Interface)</strong> transmite vídeo com transparência pela rede local.
              Para o OBS Studio, a integração recomendada e oficial hoje é via <strong>Fonte de Navegador (Browser Source)</strong> com a URL ao lado.
            </p>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      ndiStatus?.available
                        ? "bg-amber-400"
                        : "bg-muted-foreground",
                    )}
                  />
                  <span className="text-xs font-medium text-foreground">
                    Status do Driver NDI:
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {ndiStatus?.available ? "Runtime Detectado" : "Não instalado"}
                </span>
              </div>
              <code className="text-[11px] font-mono text-purple-300 font-semibold pl-4">
                {ndiStatus?.streamName ?? "Open Presenter — Transmissão"}
              </code>
              {ndiStatus?.runtimePath && (
                <span
                  className="text-[10px] font-mono text-muted-foreground/70 pl-4 truncate"
                  title={ndiStatus.runtimePath}
                >
                  Biblioteca: {ndiStatus.runtimePath}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Para usar no OBS Studio ou vMix agora, adicione a fonte <strong>Navegador (Browser)</strong> apontando para a URL da transmissão.
            </p>
          </div>

          {/* Dica do Editor */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            <Info className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Para personalizar o posicionamento, faixas decorativas ou logotipo da igreja na
              transmissão, abra o <strong>Editor de Temas</strong> e ajuste as camadas
              com auxílio do grid quadriculado de transparência.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
