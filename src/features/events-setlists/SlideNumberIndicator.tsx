export function SlideNumberIndicator({ buffer }: { buffer: string }) {
  if (buffer.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-3 py-1.5 shadow-lg">
      <span className="text-xs text-muted-foreground">→</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {buffer}
      </span>
    </div>
  );
}
