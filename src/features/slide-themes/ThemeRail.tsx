import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, Zap } from "lucide-react";
import { kindToAsset } from "@/core/types";
import { isTauri } from "@/core/ipc/tauri";
import { openThemeEditor } from "@/core/ipc/commands";
import { usePresentationStore } from "@/features/presentation/store";
import { useSlideThemesStore } from "./store";
import { ThemeRenderer } from "./ThemeRenderer";
import { SAMPLES } from "./samples";

const RAIL_KEY = "open_presenter_theme_rail_open";

interface MenuState {
  guid: string;
  x: number;
  y: number;
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) !== "false";
  } catch {
    return true;
  }
}

export function ThemeRail() {
  const themes = useSlideThemesStore((s) => s.themes);
  const bindings = useSlideThemesStore((s) => s.bindings);
  const load = useSlideThemesStore((s) => s.load);
  const setBinding = useSlideThemesStore((s) => s.setBinding);
  const remove = useSlideThemesStore((s) => s.remove);
  const liveKind = usePresentationStore((s) => s.live.content.kind);

  const [open, setOpen] = useState(readOpen);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirmGuid, setConfirmGuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menu) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(null);
        setConfirmGuid(null);
      }
    }
    function onScroll() {
      setMenu(null);
      setConfirmGuid(null);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  function toggleOpen() {
    setOpen((v) => {
      try {
        localStorage.setItem(RAIL_KEY, String(!v));
      } catch {}
      return !v;
    });
  }

  const effectiveKind = liveKind === "blank" ? "lyric" : liveKind;
  const asset = kindToAsset(liveKind) ?? "music";
  const sample = SAMPLES[asset];
  const liveGuid =
    bindings.find((b) => b.target === "public" && b.asset === effectiveKind)
      ?.themeGuid ?? null;

  function apply(guid: string) {
    setBinding("public", effectiveKind, guid);
  }

  function edit(guid: string) {
    if (isTauri()) {
      void openThemeEditor(guid);
    } else {
      window.open(`/#/theme-editor?guid=${guid}`, "_blank");
    }
  }

  async function handleRemove(guid: string) {
    if (confirmGuid !== guid) {
      setConfirmGuid(guid);
      return;
    }
    setConfirmGuid(null);
    setMenu(null);
    setError(null);
    try {
      await remove(guid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao excluir tema");
    }
  }

  function closeMenu() {
    setMenu(null);
    setConfirmGuid(null);
  }

  if (!open) {
    return (
      <aside
        aria-label="Trilho de temas"
        className="flex w-10 shrink-0 flex-col items-center border-l border-border bg-card/40 py-2"
      >
        <button
          type="button"
          aria-label="Expandir trilho de temas"
          title="Temas"
          onClick={toggleOpen}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Trilho de temas"
      className="flex w-44 shrink-0 flex-col border-l border-border bg-card/40"
    >
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-[11px] font-semibold text-foreground">Temas</span>
        <button
          type="button"
          aria-label="Recolher trilho de temas"
          onClick={toggleOpen}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {error !== null && (
          <p className="mb-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        {themes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum tema. Crie um em Preferências &gt; Temas.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {themes.map((theme) => {
              const isLive = theme.guid === liveGuid;
              return (
                <li key={theme.guid}>
                  <button
                    type="button"
                    title={theme.title}
                    onDoubleClick={() => apply(theme.guid)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setConfirmGuid(null);
                      setMenu({ guid: theme.guid, x: e.clientX, y: e.clientY });
                    }}
                    className={`group flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left ${
                      isLive
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/60 hover:border-primary/50"
                    }`}
                  >
                    <span
                      className="relative block h-20 w-full overflow-hidden rounded-md"
                      style={theme.css as CSSProperties}
                    >
                      <span className="absolute inset-0" style={{ zoom: 0.25 }}>
                        <ThemeRenderer
                          theme={theme}
                          asset={asset}
                          props={sample.props}
                        />
                      </span>
                      {isLive && (
                        <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-primary px-1 py-px text-[9px] font-bold text-primary-foreground">
                          <Zap className="size-2.5" />
                          No ar
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {theme.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeMenu();
            }}
          />
          <div
            role="menu"
            className="fixed z-50 w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            style={{
              left: Math.min(menu.x, window.innerWidth - 184),
              top: Math.min(menu.y, window.innerHeight - 140),
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const guid = menu.guid;
                closeMenu();
                edit(guid);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil className="size-3.5" />
              Editar
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const guid = menu.guid;
                closeMenu();
                apply(guid);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Check className="size-3.5" />
              Aplicar
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleRemove(menu.guid)}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground ${
                confirmGuid === menu.guid
                  ? "text-destructive hover:text-destructive"
                  : ""
              }`}
            >
              <Trash2 className="size-3.5" />
              {confirmGuid === menu.guid
                ? "Clique para confirmar"
                : "Remover"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
