import { ScrollArea } from "@/components/ui/scroll-area";

interface ReleaseNotesPreviewProps {
  body: string;
  className?: string;
}

export function ReleaseNotesPreview({ body, className }: ReleaseNotesPreviewProps) {
  const lines = body.split(/\r?\n/);

  return (
    <ScrollArea className={className}>
      <div className="space-y-2 pr-3 text-sm leading-relaxed text-muted-foreground">
        {lines.map((line, index) => {
          const trimmed = line.trim();

          if (!trimmed) {
            return <div key={index} className="h-1" />;
          }

          if (trimmed.startsWith("#")) {
            return (
              <p
                key={index}
                className="pt-2 text-xs font-semibold uppercase tracking-wide text-foreground"
              >
                {trimmed.replace(/^#+\s*/, "")}
              </p>
            );
          }

          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <div key={index} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{trimmed.slice(2)}</span>
              </div>
            );
          }

          return <p key={index}>{trimmed}</p>;
        })}
      </div>
    </ScrollArea>
  );
}
