import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { StageAlerts } from "@/features/stage-display/StageAlerts";
import { StageClock } from "@/features/stage-display/StageClock";

export default function StageView() {
  usePresentationSync();
  const live = usePresentationStore((s) => s.live);
  const nextUp = usePresentationStore((s) => s.live.nextUp);

  return (
    <div className="flex min-h-full flex-col gap-6 bg-black p-6 text-white">
      <StageClock />
      <StageAlerts />
      <section className="flex-1">
        <p className="text-xs uppercase tracking-widest text-zinc-400">
          {live.blackout || live.cleared ? "Saída" : live.content.title}
        </p>
        {live.blackout || live.cleared ? (
          <p className="mt-2 text-5xl font-bold text-zinc-600">
            {live.blackout ? "Blackout" : "—"}
          </p>
        ) : (
          live.content.lines.map((line) => (
            <p key={line} className="mt-2 text-5xl font-bold leading-tight">
              {line}
            </p>
          ))
        )}
      </section>
      {nextUp && (
        <section className="border-t border-zinc-800 pt-4">
          <p className="text-xs uppercase tracking-widest text-zinc-400">
            Próximo · {nextUp.title}
          </p>
          {nextUp.lines.map((line) => (
            <p key={line} className="mt-1 text-2xl text-zinc-300">
              {line}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
