import { ArrowLeft, ArrowRight, EyeOff, Monitor, Moon } from "lucide-react";
import { publishSlide, setBlackout } from "@/core/ipc/commands";
import { Button } from "@/components/ui/button";
import { usePresentationStore } from "./store";
import { useSetlistStore } from "../events-setlists/store";

export function LiveControls() {
  const live = usePresentationStore((s) => s.live);
  const preview = usePresentationStore((s) => s.preview);
  const setBlackoutLocal = usePresentationStore((s) => s.setBlackout);
  const projectNext = useSetlistStore((s) => s.projectNext);
  const projectPrev = useSetlistStore((s) => s.projectPrev);

  async function goLive() {
    if (!preview) return;
    const slide = {
      ...live,
      content: preview,
      cleared: false,
      blackout: false,
      textHidden: false,
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
    useSetlistStore.setState({ runnerIndex: null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-xs">
      {preview && (
        <Button size="sm" onClick={goLive} className="h-8 gap-1.5 text-xs font-semibold">
          <Monitor className="size-3.5" />
          Projetar
        </Button>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 text-xs"
        onClick={() => void projectPrev()}
      >
        <ArrowLeft className="size-3.5" />
        Anterior
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 text-xs"
        onClick={() => void projectNext()}
      >
        Próximo
        <ArrowRight className="size-3.5" />
      </Button>

      <Button
        type="button"
        size="sm"
        variant={live.cleared && !live.blackout ? "secondary" : "outline"}
        onClick={clear}
        className="h-8 gap-1 text-xs"
      >
        <EyeOff className="size-3.5" />
        Limpar
      </Button>

      <Button
        type="button"
        size="sm"
        variant={live.blackout ? "default" : "outline"}
        onClick={toggleBlackout}
        className={`h-8 gap-1 text-xs ${
          live.blackout
            ? "bg-red-600 hover:bg-red-700 text-white border-red-700 font-semibold"
            : ""
        }`}
      >
        <Moon className="size-3.5" />
        Blackout
      </Button>
    </div>
  );
}
