import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { OutputManagerPanel } from "@/features/output-manager/OutputManagerPanel";
import { SetlistPanel } from "@/features/events-setlists/SetlistPanel";
import { LiveControls } from "@/features/presentation/LiveControls";
import { LivePreview } from "@/features/presentation/LivePreview";
import { BackgroundPicker } from "@/features/media-shaders/BackgroundPicker";
import { SongsPanel } from "@/features/songs/SongsPanel";
import { ScripturesPanel } from "@/features/scriptures/ScripturesPanel";

export default function AdminView() {
  usePresentationSync();

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-bold tracking-tight">Open Presenter</h1>
        <p className="text-sm text-zinc-400">Painel do operador</p>
      </header>
      <main className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <LivePreview />
          <LiveControls />
          <SetlistPanel />
        </div>
        <div className="flex flex-col gap-4">
          <OutputManagerPanel />
          <BackgroundPicker />
          <SongsPanel />
          <ScripturesPanel />
        </div>
      </main>
    </div>
  );
}
