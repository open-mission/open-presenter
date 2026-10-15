import { ListMusic } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePresentationStore } from "../presentation/store";
import { useSetlistStore } from "./store";

export function SetlistPanel() {
  const events = useSetlistStore((s) => s.events);
  const activeEventId = useSetlistStore((s) => s.activeEventId);
  const selectItem = useSetlistStore((s) => s.selectItem);
  const setPreview = usePresentationStore((s) => s.setPreview);

  const active = events.find((e) => e.id === activeEventId) ?? events[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ordem do culto (Setlist)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!active && <p className="text-sm text-zinc-400">Nenhum evento.</p>}
        {active?.items.map((item) => (
          <Button
            key={item.id}
            variant="secondary"
            className="justify-start"
            onClick={() => {
              selectItem(active.id, item.id);
              setPreview(item.slide);
            }}
          >
            <ListMusic size={14} />
            {item.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
