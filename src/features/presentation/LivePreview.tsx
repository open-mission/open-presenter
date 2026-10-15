import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePresentationStore } from "./store";

export function LivePreview() {
  const live = usePresentationStore((s) => s.live);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Preview interno</CardTitle>
        {live.cleared ? (
          <Badge variant="secondary">Limpo</Badge>
        ) : (
          <Badge variant="live">No ar</Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          {live.blackout || live.cleared ? (
            <div className="flex h-full items-center justify-center bg-black text-zinc-600 text-sm">
              {live.blackout ? "Blackout" : "Saída limpa"}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-400">
                {live.content.title}
              </p>
              {live.content.lines.map((line) => (
                <p key={line} className="text-2xl font-bold leading-snug">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
