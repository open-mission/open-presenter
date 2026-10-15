import { useEffect } from "react";
import { ExternalLink, MonitorUp, XCircle } from "lucide-react";
import { outputHttpUrl } from "@/core/config/app";
import {
  closeOutputWindow,
  fetchServerHost,
  listMonitors,
  openOutputWindow,
} from "@/core/ipc/commands";
import type { OutputMode, OutputTarget } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOutputManagerStore } from "./store";

function Row({
  target,
  title,
  webPath,
}: {
  target: OutputTarget;
  title: string;
  webPath: "/public" | "/stage";
}) {
  const outputs = useOutputManagerStore((s) => s.outputs);
  const monitors = useOutputManagerStore((s) => s.monitors);
  const host = useOutputManagerStore((s) => s.host);
  const setOutput = useOutputManagerStore((s) => s.setOutput);
  const output = outputs[target];

  async function setMode(mode: OutputMode) {
    if (mode === "off") {
      await closeOutputWindow(target);
    } else if (mode === "native" || mode === "both") {
      await openOutputWindow(target, output.monitorId);
    }
    setOutput({
      ...output,
      mode,
      url: mode === "off" ? null : outputHttpUrl(host, webPath),
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs text-zinc-400">{output.mode}</span>
      </div>
      <select
        className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm"
        value={output.monitorId ?? ""}
        onChange={(e) =>
          setOutput({ ...output, monitorId: e.target.value || null })
        }
      >
        <option value="">Monitor automático</option>
        {monitors.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.width}x{m.height})
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void setMode("native")}>
          <MonitorUp size={14} />
          Nativa
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void setMode("web")}>
          <ExternalLink size={14} />
          Web
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void setMode("off")}>
          <XCircle size={14} />
          Off
        </Button>
      </div>
      {output.url && (
        <a
          className="truncate text-xs text-zinc-400 underline"
          href={output.url}
          target="_blank"
          rel="noreferrer"
        >
          {output.url}
        </a>
      )}
    </div>
  );
}

export function OutputManagerPanel() {
  const setMonitors = useOutputManagerStore((s) => s.setMonitors);
  const setHost = useOutputManagerStore((s) => s.setHost);

  useEffect(() => {
    void listMonitors().then(setMonitors);
    void fetchServerHost().then(setHost);
  }, [setHost, setMonitors]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciador de saídas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Row target="public" title="Tela pública / Projeção" webPath="/public" />
        <Row target="stage" title="Retorno / Palco" webPath="/stage" />
      </CardContent>
    </Card>
  );
}
