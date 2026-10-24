import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Erro não capturado na renderização:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorageAndReload = () => {
    try {
      localStorage.removeItem("open_presenter_display_outputs");
      localStorage.removeItem("open_presenter_displays_settings");
      localStorage.removeItem("open_presenter_last_event_id");
    } catch {
      // Ignora erro de acesso ao localStorage
    }
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0a0a0a] p-6 text-[#fafafa]">
          <div className="flex max-w-lg flex-col items-center rounded-xl border border-neutral-800 bg-[#141414] p-8 text-center shadow-2xl">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle className="size-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight">
              {this.props.fallbackTitle ?? "Ocorreu um erro inesperado"}
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              O Open Presenter encontrou uma falha na interface gráfica. Você pode tentar
              recarregar ou reiniciar o estado da tela sem fechar o processo.
            </p>

            {this.state.error && (
              <pre className="mt-4 max-h-40 w-full overflow-auto rounded-lg bg-black/60 p-3 text-left font-mono text-xs text-red-400 border border-neutral-900 select-text">
                {this.state.error.name}: {this.state.error.message}
              </pre>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="default"
                size="sm"
                onClick={this.handleRetry}
                className="gap-2"
              >
                <RotateCcw className="size-4" />
                Tentar novamente
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReload}
                className="gap-2"
              >
                <RefreshCw className="size-4" />
                Recarregar janela
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={this.handleClearStorageAndReload}
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Restaurar cache local
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
