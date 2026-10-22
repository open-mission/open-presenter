import Link from 'next/link';
import { BookOpen, Code2, Monitor, Sparkles, Terminal } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center max-w-5xl mx-auto">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-semibold">
        <Sparkles className="size-3.5" />
        <span>Documentação Oficial · Open Presenter</span>
      </div>

      {/* Main Title */}
      <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground mb-4">
        Open Presenter <span className="text-sky-500">Docs</span>
      </h1>

      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
        O guia completo para voluntários e operadores de culto, e a referência técnica
        definitiva para engenheiros de software e agentes de IA.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/20"
        >
          <BookOpen className="size-5" />
          <span>Explorar a Documentação</span>
        </Link>
        <Link
          href="/docs/desenvolvimento"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors"
        >
          <Code2 className="size-5" />
          <span>Guia para Desenvolvedores & IA</span>
        </Link>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
        <Link
          href="/docs/operacao"
          className="p-6 rounded-2xl border border-border bg-card/60 hover:border-sky-500/50 transition-all hover:shadow-md group"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 mb-4 group-hover:scale-110 transition-transform">
            <Monitor className="size-5" />
          </div>
          <h2 className="text-lg font-bold mb-1 text-foreground">Guia do Operador</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Como operar cultos, disparar slides ao vivo, projetar versículos bíblicos e controlar múltiplos monitores.
          </p>
        </Link>

        <Link
          href="/docs/desenvolvimento"
          className="p-6 rounded-2xl border border-border bg-card/60 hover:border-sky-500/50 transition-all hover:shadow-md group"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-4 group-hover:scale-110 transition-transform">
            <Code2 className="size-5" />
          </div>
          <h2 className="text-lg font-bold mb-1 text-foreground">Arquitetura Técnica</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tauri v2 com Rust, sincronização syncBus, WebSocket, SQLite, motor de temas e estado global Zustand.
          </p>
        </Link>

        <Link
          href="/docs/desenvolvimento/governanca-agents"
          className="p-6 rounded-2xl border border-border bg-card/60 hover:border-sky-500/50 transition-all hover:shadow-md group"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
            <Terminal className="size-5" />
          </div>
          <h2 className="text-lg font-bold mb-1 text-foreground">Agentes de IA</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Diretrizes do AGENTS.md, stack pinada, convenções de código, comandos IPC e fluxo de contribuição.
          </p>
        </Link>
      </div>
    </main>
  );
}
