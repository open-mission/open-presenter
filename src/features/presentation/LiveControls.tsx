import { Monitor, Moon, EyeOff } from "lucide-react";
import { publishSlide, setBlackout } from "@/core/ipc/commands";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePresentationStore } from "./store";

export function LiveControls() {
  const live = usePresentationStore((s) => s.live);
  const preview = usePresentationStore((s) => s.preview);
  const setBlackoutLocal = usePresentationStore((s) => s.setBlackout);

  async function goLive() {
    if (!preview) return;
    const slide = {
      ...live,
      content: preview,
      cleared: false,
      blackout: false,
      nextUp: undefined,
      updatedAt: new Date().toISOString(),
    };
    usePresentationStore.getState().applyRemote(slide);
    await publishSlide(slide);
  }

  async function toggleBlackout() {
    const next = !live.blackout;
    setBlackoutLocal(next);
    await setBlackout(next);
  }

  async function clear() {
    await usePresentationStore.getState().clearLive();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ao vivo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={goLive} disabled={!preview}>
          <Monitor size={16} />
          Ir ao ar
        </Button>
        <Button
          variant={live.blackout ? "danger" : "secondary"}
          onClick={toggleBlackout}
        >
          <Moon size={16} />
          Blackout
        </Button>
        <Button variant="outline" onClick={clear}>
          <EyeOff size={16} />
          Limpar
        </Button>
      </CardContent>
    </Card>
  );
}
