import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Layers,
  Monitor,
  MonitorPlay,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_VERSION } from "@/core/config/version";
import { openExternal } from "@/core/lib/openExternal";
import {
  CURRENT_RELEASE,
  getReleaseNotes,
  type ReleaseHighlightIcon,
} from "./releases";
import { markVersionSeen, useUpdatesStore } from "./store";

const HIGHLIGHT_ICONS: Record<ReleaseHighlightIcon, typeof BookOpen> = {
  book: BookOpen,
  layers: Layers,
  monitor: MonitorPlay,
  refresh: RefreshCw,
  tray: Monitor,
};

export function WhatsNewDialog() {
  const isOpen = useUpdatesStore((s) => s.whatsNewOpen);
  const closeWhatsNew = useUpdatesStore((s) => s.closeWhatsNew);
  const release = getReleaseNotes(APP_VERSION) ?? CURRENT_RELEASE;

  function handleOpenChange(open: boolean) {
    if (open) return;
    markVersionSeen(APP_VERSION);
    closeWhatsNew();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border/70 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </div>
            <Badge variant="secondary" className="font-mono text-[11px]">
              Versão {release.version}
            </Badge>
          </div>
          <DialogHeader className="gap-1.5">
            <DialogTitle className="text-xl">{release.title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {release.summary}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[56vh]">
          <div className="space-y-6 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {release.highlights.map((highlight) => {
                const Icon = HIGHLIGHT_ICONS[highlight.icon];
                return (
                  <div
                    key={highlight.title}
                    className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {highlight.title}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {highlight.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {release.sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {section.title}
                </h3>
                <ul className="space-y-1.5">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {release.fixes.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  O que corrigimos
                </h3>
                <ul className="space-y-1.5">
                  {release.fixes.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => void openExternal(release.changelogUrl)}
          >
            <ExternalLink className="size-3.5" />
            Changelog completo no GitHub
          </Button>
          <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
            Começar a usar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
