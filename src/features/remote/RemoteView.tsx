import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  EyeOff,
  Image,
  Loader2,
  Moon,
  Music,
  Radio,
  SkipBack,
  SkipForward,
  Smartphone,
  Square,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isTauri } from "@/core/ipc/tauri";
import { cn } from "@/core/lib/utils";
import {
  buildBiblePresentationPayload,
  stepBibleVerse,
} from "@/core/lib/biblePresentation";
import type {
  BibleVerse,
  LiveSlide,
  RemoteItem,
  RemoteSetlist,
  SlideContent,
} from "@/core/types";
import {
  parseMediaWithFit,
  resolveMediaLibraryUrl,
} from "@/features/theme-editor/media";
import { RemoteSongsTab } from "./RemoteSongsTab";
import { RemoteImagesTab } from "./RemoteImagesTab";
import { RemoteBibleTab } from "./RemoteBibleTab";

const TOKEN_KEY = "open_presenter_remote_token";
const WS_CHANNEL_SLIDE = "presentation://slide";
const WS_CHANNEL_SETLIST = "remote://setlist";
const WS_CHANNEL_WALLPAPER = "presentation://wallpaper";

function tokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "");
  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0) return "";
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return params.get("token") ?? "";
}

function initialToken(): string {
  const fromUrl = tokenFromUrl();
  if (fromUrl) {
    try {
      localStorage.setItem(TOKEN_KEY, fromUrl);
    } catch {}
    return fromUrl;
  }
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function mediaImageUrl(content: SlideContent): string | null {
  const media = content.media;
  if (!media?.path || media.kind === "video") return null;
  return resolveMediaLibraryUrl(media.path, "");
}

function wallpaperImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  const { url } = parseMediaWithFit(raw);
  if (!url || url.startsWith("#") || url.startsWith("rgb")) return null;
  return resolveMediaLibraryUrl(url, "");
}

function eventDateLabel(value: string): string {
  if (!value) return "";
  const start = value.split("/")[0];
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function responseError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (response.status === 401) {
    return "Token inválido ou revogado. Gere um novo token no painel Controle Remoto.";
  }
  if (response.status === 403) {
    return "Controle remoto desativado no Open Presenter. Ative nas Configurações.";
  }
  if (response.status === 404) {
    return text || "Item não encontrado.";
  }
  return text || `Falha na conexão (${response.status}).`;
}

function mediaLabel(item: RemoteItem): string {
  if (item.kind === "song") return "Música";
  if (item.kind === "scripture") return "Bíblia";
  return "Mídia";
}

async function fetchBibleChapter(
  token: string,
  versionId: string,
  bookId: number,
  chapter: number,
): Promise<BibleVerse[]> {
  const response = await fetch(
    `/api/v1/bible/chapter?version=${encodeURIComponent(versionId)}&book=${bookId}&chapter=${chapter}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("Falha ao carregar o capítulo bíblico.");
  return (await response.json()) as BibleVerse[];
}

export default function RemoteView() {
  const [token, setToken] = useState(initialToken);
  const [tokenDraft, setTokenDraft] = useState(token);
  const [authFailed, setAuthFailed] = useState(false);
  const [connectNonce, setConnectNonce] = useState(0);
  const [setlist, setSetlist] = useState<RemoteSetlist | null>(null);
  const [live, setLive] = useState<LiveSlide | null>(null);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem("open_presenter_remote_preview_collapsed") ===
        "true"
      );
    } catch {
      return false;
    }
  });
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "open" | "closed" | "error"
  >("closed");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<
    "programacao" | "musicas" | "biblia" | "imagens"
  >("programacao");

  function togglePreview() {
    setPreviewCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(
          "open_presenter_remote_preview_collapsed",
          String(next),
        );
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    if (!meta) return;
    const previous = meta.getAttribute("content");
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
    );
    return () => {
      if (previous !== null) meta.setAttribute("content", previous);
    };
  }, []);

  const fetchRemoteState = useCallback(async (value: string) => {
    const [setlistResponse, wallpaperResponse] = await Promise.all([
      fetch("/api/v1/setlist", {
        headers: { Authorization: `Bearer ${value}` },
      }),
      fetch("/api/v1/wallpaper", {
        headers: { Authorization: `Bearer ${value}` },
      }).catch(() => null),
    ]);

    if (!setlistResponse.ok) {
      if (setlistResponse.status === 401 || setlistResponse.status === 403) {
        setAuthFailed(true);
      }
      throw new Error(await responseError(setlistResponse));
    }
    const data = (await setlistResponse.json()) as RemoteSetlist | null;
    setSetlist(data);

    if (wallpaperResponse && wallpaperResponse.ok) {
      const wpData = (await wallpaperResponse.json().catch(() => null)) as {
        wallpaper?: string | null;
      } | null;
      if (wpData && "wallpaper" in wpData) {
        setWallpaper(wpData.wallpaper ?? null);
      }
    }
  }, []);

  useEffect(() => {
    if (!token || isTauri()) return;

    let alive = true;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!alive) return;
      setWsStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(
        `${protocol}://${window.location.host}/api/v1/ws?token=${encodeURIComponent(token)}`,
      );

      socket.onopen = () => {
        if (!alive) return;
        setWsStatus("open");
        setError(null);
        setAuthFailed(false);
      };

      socket.onmessage = (event) => {
        try {
          const envelope = JSON.parse(String(event.data)) as {
            channel?: string;
            payload?: unknown;
          };
          if (envelope.channel === WS_CHANNEL_SLIDE) {
            setLive(envelope.payload as LiveSlide);
          } else if (envelope.channel === WS_CHANNEL_SETLIST) {
            setSetlist(envelope.payload as RemoteSetlist | null);
          } else if (envelope.channel === WS_CHANNEL_WALLPAPER) {
            setWallpaper((envelope.payload as string | null) ?? null);
          }
        } catch {
          // ignora mensagens inválidas
        }
      };

      socket.onerror = () => {
        if (alive) setWsStatus("error");
      };

      socket.onclose = () => {
        if (!alive) return;
        setWsStatus("closed");
        reconnect = setTimeout(connect, 2000);
      };
    };

    connect();
    void fetchRemoteState(token).catch((err: unknown) => {
      if (!alive) return;
      setError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      alive = false;
      if (reconnect) clearTimeout(reconnect);
      socket?.close();
    };
  }, [token, fetchRemoteState, connectNonce]);

  useEffect(() => {
    if (!live || !setlist) return;
    const item = setlist.parts
      .flatMap((part) => part.items)
      .find((candidate) =>
        candidate.slides.some(
          (slide) => slide.content.id === live.content.id,
        ),
      );
    if (!item) return;
    setExpanded((previous) =>
      previous[item.id] ? previous : { ...previous, [item.id]: true },
    );
  }, [live, setlist]);

  const flatSlides = useMemo(() => {
    if (!setlist) return [];
    return setlist.parts.flatMap((part) =>
      part.items.flatMap((item) =>
        item.slides.map((slide) => ({
          itemId: item.id,
          index: slide.index,
          content: slide.content,
        })),
      ),
    );
  }, [setlist]);

  const liveIndex = live
    ? flatSlides.findIndex((entry) => entry.content.id === live.content.id)
    : -1;

  const nextSlide =
    flatSlides.length > 0
      ? liveIndex >= 0
        ? flatSlides[liveIndex + 1]
        : flatSlides[0]
      : undefined;
  const previousSlide =
    flatSlides.length > 0
      ? liveIndex > 0
        ? flatSlides[liveIndex - 1]
        : flatSlides[0]
      : undefined;

  const liveItem = live
    ? setlist?.parts
        .flatMap((part) => part.items)
        .find((item) =>
          item.slides.some((slide) => slide.content.id === live.content.id),
        )
    : undefined;

  const post = useCallback(
    async (path: string, body?: unknown): Promise<boolean> => {
      if (!token) return false;
      setBusy(true);
      setError(null);
      try {
        const cleanPath = path.replace(/^\/?(api\/v1\/)?/, "");
        const response = await fetch(`/api/v1/${cleanPath}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok) {
          const message = await responseError(response);
          if (response.status === 401 || response.status === 403) {
            setAuthFailed(true);
          }
          setError(message);
          return false;
        }
        const data = (await response.json().catch(() => null)) as
          | LiveSlide
          | null;
        if (data && typeof data === "object" && "content" in data) {
          setLive(data);
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  const present = useCallback(
    async (itemId: string, index: number) => {
      await post("present", { itemId, index });
    },
    [post],
  );

  const stepBible = useCallback(
    async (direction: 1 | -1) => {
      const ref = live?.content.scripture;
      if (!ref) return;
      setBusy(true);
      setError(null);
      try {
        const verses = await fetchBibleChapter(
          token,
          ref.versionId,
          ref.bookId,
          ref.chapter,
        );
        const target = stepBibleVerse(
          verses,
          ref.verse,
          ref.part,
          direction,
        );
        if (!target) return;
        const payload = buildBiblePresentationPayload({
          versionId: ref.versionId,
          bookId: ref.bookId,
          bookName: ref.bookName,
          chapter: ref.chapter,
          verses,
          verseNum: target.verse.verse,
          partIndex: target.partIndex,
        });
        if (!payload) return;
        await post("present-bible", payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [live, token, post],
  );

  const isBibleLive = Boolean(
    live?.content.kind === "scripture" && live.content.scripture,
  );
  const canGoPrevious = isBibleLive
    ? !busy
    : Boolean(previousSlide) && !busy;
  const canGoNext = isBibleLive ? !busy : Boolean(nextSlide) && !busy;

  function connectWithToken() {
    const next = tokenDraft.trim();
    if (!next) {
      setError("Informe o token de acesso.");
      return;
    }
    try {
      localStorage.setItem(TOKEN_KEY, next);
    } catch {}
    setAuthFailed(false);
    setError(null);
    setToken(next);
    setConnectNonce((current) => current + 1);
  }

  function disconnect() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken("");
    setTokenDraft("");
    setAuthFailed(false);
    setError(null);
    setSetlist(null);
    setLive(null);
    setWallpaper(null);
  }

  if (isTauri()) {
    return (
      <div className="remote-view flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-md space-y-2 text-center">
          <Smartphone className="mx-auto size-10 text-primary" />
          <h1 className="text-lg font-semibold">Controle Remoto Web</h1>
          <p className="text-xs text-muted-foreground">
            Abra este link no celular ou em um navegador na mesma rede do
            computador.
          </p>
        </div>
      </div>
    );
  }

  if (!token || authFailed) {
    return (
      <div className="remote-view flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="size-5" />
            </span>
            <div>
              <h1 className="flex items-center gap-1.5 text-base font-semibold">
                <BrandMark className="size-3.5 text-primary" />
                Open Presenter Remote
              </h1>
              <p className="text-xs text-muted-foreground">
                Controle a programação e o telão pelo celular.
              </p>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Token de acesso
            </span>
            <Input
              type="password"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
              placeholder="Cole o token exibido em Configurações > Controle Remoto"
              className="font-mono text-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter") connectWithToken();
              }}
            />
          </label>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No Open Presenter, abra <strong>Configurações &gt; Controle Remoto</strong>, ative o
            recurso e copie o link ou o token. O celular precisa estar na mesma
            rede Wi-Fi.
          </p>

          <Button
            type="button"
            className="w-full cursor-pointer"
            onClick={connectWithToken}
          >
            Conectar
          </Button>
        </div>
      </div>
    );
  }

  const statusLabel =
    wsStatus === "open"
      ? "conectado"
      : wsStatus === "connecting"
      ? "conectando…"
      : wsStatus === "error"
      ? "erro"
      : "offline";

  const liveImage = live ? mediaImageUrl(live.content) : null;
  const isLiveEmpty = !live || live.content.kind === "blank";
  const wpUrl = useMemo(() => wallpaperImageUrl(wallpaper), [wallpaper]);
  const isShowingWallpaper = Boolean(
    (live?.cleared || isLiveEmpty) && !live?.blackout && wpUrl,
  );
  const totalItems =
    setlist?.parts.reduce((total, part) => total + part.items.length, 0) ?? 0;

  return (
    <div className="remote-view min-h-screen bg-background pb-12 text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="size-4" />
            </span>
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold">
                <BrandMark className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">Open Presenter Remote</span>
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {setlist?.title ?? "Controle Remoto"}
                {setlist?.eventDate
                  ? ` · ${eventDateLabel(setlist.eventDate)}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "size-2 rounded-full",
                  wsStatus === "open"
                    ? "bg-emerald-500"
                    : wsStatus === "connecting"
                    ? "bg-amber-500"
                    : "bg-destructive",
                )}
              />
              {statusLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={disconnect}
              title="Desconectar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        {error && !authFailed && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Card Ao Vivo */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge className="h-5 shrink-0 gap-1 bg-emerald-600 px-1.5 text-[10px] font-semibold text-white hover:bg-emerald-600">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                Ao vivo
              </Badge>
              <span className="truncate text-xs font-semibold text-foreground">
                {live?.blackout
                  ? "Tela preta"
                  : isShowingWallpaper
                  ? "Papel de parede"
                  : live?.cleared
                  ? "Sem texto"
                  : live?.content.title || "Nenhum slide"}
              </span>
              {live?.content.section && (
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 px-1 font-mono text-[9px] uppercase text-muted-foreground"
                >
                  {live.content.section}
                </Badge>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6.5 shrink-0 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 cursor-pointer"
                onClick={() => void post("clear")}
                disabled={busy || Boolean(live?.cleared)}
                title="Encerrar a apresentação e liberar o telão"
              >
                <Square className="size-3 fill-current" />
                <span className="hidden sm:inline">Encerrar</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6.5 shrink-0 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                onClick={togglePreview}
                title={previewCollapsed ? "Expandir prévia" : "Recolher prévia"}
              >
                {previewCollapsed ? (
                  <>
                    <ChevronDown className="size-3.5" />
                    <span>Expandir</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="size-3.5" />
                    <span>Recolher</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Canvas visual ou resumo compacto colapsado */}
          {previewCollapsed ? (
            <div className="flex items-center justify-between gap-2 bg-zinc-950 px-3 py-2 text-xs">
              <span className="truncate text-zinc-300">
                {live?.blackout
                  ? "Tela preta ativa"
                  : isShowingWallpaper
                  ? "Papel de parede no telão"
                  : live?.cleared
                  ? "Sem texto (telão desocupado)"
                  : liveImage
                  ? `[Imagem] ${live?.content.title}`
                  : live?.content.lines.join(" · ") ||
                    live?.content.title ||
                    "Nenhum slide ao vivo"}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-500 font-mono">
                {live?.content.section || ""}
              </span>
            </div>
          ) : (
            <div className="relative flex min-h-28 items-center justify-center bg-black p-3">
              {live?.blackout ? (
                <div className="flex flex-col items-center gap-1.5 py-4 text-zinc-500">
                  <Moon className="size-6 text-zinc-600" />
                  <p className="text-xs font-medium">Tela preta ativa</p>
                </div>
              ) : isShowingWallpaper && wpUrl ? (
                <div className="relative flex max-h-52 w-full items-center justify-center overflow-hidden rounded-lg">
                  <img
                    src={wpUrl}
                    alt="Papel de parede"
                    className="max-h-52 w-full object-contain"
                  />
                  <span className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-medium text-zinc-200 backdrop-blur-xs border border-white/10 flex items-center gap-1">
                    <Image className="size-3" />
                    Papel de parede ativo
                  </span>
                </div>
              ) : live?.cleared || isLiveEmpty ? (
                <div className="flex flex-col items-center gap-1 py-4 text-zinc-500">
                  <EyeOff className="size-5 text-zinc-600" />
                  <p className="text-xs font-medium">Telão livre / Sem texto</p>
                </div>
              ) : liveImage ? (
                <img
                  src={liveImage}
                  alt={live?.content.title}
                  className="max-h-52 w-full object-contain"
                />
              ) : (
                <p className="max-h-52 overflow-hidden whitespace-pre-line text-center text-sm font-semibold leading-snug text-white">
                  {live?.content.lines.join("\n") || live?.content.title}
                </p>
              )}
            </div>
          )}

          {/* Barra de ações rápida */}
          <div className="grid grid-cols-2 gap-1.5 border-t border-border/60 p-2 sm:grid-cols-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs cursor-pointer"
              disabled={!canGoPrevious}
              onClick={() => {
                if (isBibleLive) {
                  void stepBible(-1);
                } else if (previousSlide) {
                  void present(previousSlide.itemId, previousSlide.index);
                }
              }}
            >
              <SkipBack className="size-3.5" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs cursor-pointer"
              disabled={!canGoNext}
              onClick={() => {
                if (isBibleLive) {
                  void stepBible(1);
                } else if (nextSlide) {
                  void present(nextSlide.itemId, nextSlide.index);
                }
              }}
            >
              Próximo
              <SkipForward className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant={
                live?.cleared && !live?.blackout ? "secondary" : "outline"
              }
              size="sm"
              className={cn(
                "h-9 gap-1.5 text-xs cursor-pointer",
                live?.cleared &&
                  !live?.blackout &&
                  "border-primary/40 font-semibold",
              )}
              disabled={busy}
              onClick={() => void post("clear")}
              title="Ocultar texto mantendo plano de fundo"
            >
              <EyeOff className="size-3.5" />
              Sem texto
            </Button>
            <Button
              type="button"
              variant={isShowingWallpaper ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-9 gap-1.5 text-xs cursor-pointer",
                isShowingWallpaper && "border-primary/40 font-semibold",
              )}
              disabled={busy}
              onClick={() => void post("wallpaper")}
              title="Exibir papel de parede / logo"
            >
              <Image className="size-3.5" />
              Papel de parede
            </Button>
            <Button
              type="button"
              variant={live?.blackout ? "destructive" : "outline"}
              size="sm"
              className={cn(
                "h-9 gap-1.5 text-xs cursor-pointer col-span-2 sm:col-span-1",
                live?.blackout &&
                  "bg-destructive text-white border-destructive font-semibold",
              )}
              disabled={busy}
              onClick={() =>
                void post("blackout", { blackout: !live?.blackout })
              }
              title="Escurecer todas as saídas (Blackout)"
            >
              <Moon className="size-3.5" />
              Tela preta
            </Button>
          </div>
        </section>

        {/* Rail de Navegação */}
        <nav
          aria-label="Abas do controle remoto"
          className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1 text-xs"
        >
          <button
            type="button"
            onClick={() => setActiveTab("programacao")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors cursor-pointer",
              activeTab === "programacao"
                ? "bg-background text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Radio className="size-3.5" />
            <span className="truncate">Culto</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("musicas")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors cursor-pointer",
              activeTab === "musicas"
                ? "bg-background text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Music className="size-3.5" />
            <span className="truncate">Músicas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("biblia")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors cursor-pointer",
              activeTab === "biblia"
                ? "bg-background text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="size-3.5" />
            <span className="truncate">Bíblia</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("imagens")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors cursor-pointer",
              activeTab === "imagens"
                ? "bg-background text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Image className="size-3.5" />
            <span className="truncate">Imagens</span>
          </button>
        </nav>

        {/* Programação Destilada */}
        {activeTab === "programacao" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Programação
              </h2>
              <Badge
                variant="secondary"
                className="h-4.5 px-1.5 text-[10px] font-mono"
              >
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </Badge>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              {wsStatus === "open" ? (
                <>
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Ao vivo</span>
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  <span>Offline</span>
                </>
              )}
            </span>
          </div>

          {!setlist ? (
            <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span>Carregando programação…</span>
            </div>
          ) : setlist.parts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
              Nenhuma programação ativa no momento.
            </div>
          ) : (
            setlist.parts.map((part) => {
              const isSinglePart = setlist.parts.length === 1;
              const titleLower = part.title
                ? part.title.trim().toLowerCase()
                : "";
              const isDefaultTitle =
                titleLower === "programação" ||
                titleLower === "programacao" ||
                !titleLower;
              const showPartHeader = !isSinglePart && !isDefaultTitle;

              return (
                <div key={part.id} className="space-y-2">
                  {showPartHeader && (
                    <div className="flex items-center gap-2 pt-2">
                      <span className="h-px flex-1 bg-border/60" />
                      <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
                        {part.title}
                      </span>
                      <span className="h-px flex-1 bg-border/60" />
                    </div>
                  )}

                  <div className="space-y-2">
                    {part.items.map((item) => {
                      const isItemLive = liveItem?.id === item.id;
                      const isOpen = expanded[item.id] ?? false;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "overflow-hidden rounded-xl border bg-card transition-all shadow-2xs",
                            isItemLive
                              ? "border-emerald-500/60 ring-1 ring-emerald-500/25"
                              : "border-border/70 hover:border-border",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((previous) => ({
                                ...previous,
                                [item.id]: !isOpen,
                              }))
                            }
                            className="flex w-full items-center gap-2 p-3 text-left cursor-pointer"
                          >
                            {isOpen ? (
                              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {item.title}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {item.subtitle || mediaLabel(item)}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="h-4 shrink-0 px-1.5 text-[10px]"
                            >
                              {item.slides.length}
                            </Badge>
                            {isItemLive && (
                              <Badge className="h-4 shrink-0 gap-1 bg-emerald-600 px-1.5 text-[9px] font-semibold text-white hover:bg-emerald-600">
                                <Radio className="size-2" />
                                No ar
                              </Badge>
                            )}
                          </button>

                          {isOpen && (
                            <div className="grid gap-2 border-t border-border/60 p-2 sm:grid-cols-2">
                              {item.slides.length === 0 ? (
                                <p className="col-span-full px-2 py-3 text-center text-[11px] text-muted-foreground">
                                  Este item não possui slides.
                                </p>
                              ) : (
                                item.slides.map((slide) => {
                                  const isSlideLive =
                                    live?.content.id === slide.content.id;
                                  const imageUrl = mediaImageUrl(slide.content);
                                  return (
                                    <button
                                      key={slide.index}
                                      type="button"
                                      onClick={() =>
                                        present(item.id, slide.index)
                                      }
                                      disabled={busy}
                                      className={cn(
                                        "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors cursor-pointer disabled:opacity-60",
                                        isSlideLive
                                          ? "border-emerald-500 bg-emerald-500/10"
                                          : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-accent/40",
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          {slide.label ??
                                            `Slide ${slide.index + 1}`}
                                        </span>
                                        {isSlideLive && (
                                          <Badge className="h-4 shrink-0 bg-emerald-600 px-1.5 text-[9px] text-white hover:bg-emerald-600">
                                            No ar
                                          </Badge>
                                        )}
                                      </div>

                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt=""
                                          className="aspect-video w-full rounded object-cover"
                                        />
                                      ) : (
                                        <p className="line-clamp-3 whitespace-pre-line text-xs leading-snug text-foreground/90">
                                          {slide.content.lines.join("\n") ||
                                            slide.content.title ||
                                            "(sem conteúdo)"}
                                        </p>
                                      )}

                                      <span className="text-[10px] font-medium text-primary">
                                        Apresentar
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

        {/* Aba Músicas */}
        {activeTab === "musicas" && (
          <RemoteSongsTab token={token} live={live} onPost={post} />
        )}

        {/* Aba Bíblia */}
        {activeTab === "biblia" && (
          <RemoteBibleTab token={token} live={live} onPost={post} />
        )}

        {/* Aba Imagens */}
        {activeTab === "imagens" && (
          <RemoteImagesTab token={token} live={live} onPost={post} />
        )}
      </main>
    </div>
  );
}
