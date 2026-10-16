import { useEffect } from "react";
import { ExternalLink, MonitorUp, XCircle } from "lucide-react";
import type { OutputMode, OutputTarget } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOutputManagerStore } from "./store";

function Row({ target, title }: { target: OutputTarget; title: string }) {
  const configs = useOutputManagerStore((s) => s.configs);
  const monitors = useOutputManagerStore((s) => s.monitors);
  const setMode = useOutputManagerStore((s) => s.setMode);
  const setMonitor = useOutputManagerStore((s) => s.setMonitor);
  const output = configs[target];

  async function handleMode(mode: OutputMode) {
    await setMode(target, mode);
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
        onChange={(e) => void setMonitor(target, e.target.value || null)}
      >
        <option value="">Monitor automático</option>
        {monitors.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.width}x{m.height})
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void handleMode("native")}>
          <MonitorUp size={14} />
          Nativa
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void handleMode("web")}
        >
          <ExternalLink size={14} />
          Web
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void handleMode("off")}>
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
  const load = useOutputManagerStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciador de saídas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Row target="public" title="Tela pública / Projeção" />
        <Row target="stage" title="Retorno / Palco" />
      </CardContent>
    </Card>
  );
}
