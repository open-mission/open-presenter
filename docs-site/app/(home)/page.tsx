import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Braces,
  CalendarClock,
  Code2,
  GitBranch,
  Keyboard,
  Layers,
  MonitorPlay,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wand2,
} from 'lucide-react';
import { BrandMark } from '@/components/brand';
import { HeroShot } from '@/components/home/hero-shot';
import { Screenshot } from '@/components/screenshot';

const stats = [
  { value: '3', label: 'saídas simultâneas' },
  { value: '<1s', label: 'do clique ao telão' },
  { value: '100%', label: 'offline no culto' },
  { value: 'MIT', label: 'código aberto' },
];

const operatorBullets = [
  { icon: Keyboard, text: 'Atalhos, blackout e plano de fundo com uma tecla' },
  { icon: CalendarClock, text: 'Cronômetro e próximo slide no retorno de palco' },
  { icon: MonitorPlay, text: 'Público, palco e transmissão no mesmo frame' },
];

const bibleBullets = [
  { icon: BookOpen, text: 'Busca por livro, capítulo, versículo ou palavra' },
  { icon: Layers, text: 'Comparação entre traduções instaladas' },
  { icon: Radio, text: 'Projeção imediata, com versículos longos divididos' },
];

const themeBullets = [
  { icon: Wand2, text: 'Temas por contexto: louvor, pregação, avisos e descanso' },
  { icon: Layers, text: 'Editor visual de camadas, mídia, relógio e widgets' },
  { icon: Sparkles, text: 'Fundos com imagem, vídeo, CSS e shaders ISF' },
];

const audiences = [
  {
    href: '/docs/operacao',
    icon: MonitorPlay,
    eyebrow: 'Para quem opera',
    title: 'Guia do operador',
    description:
      'Setlists, Bíblia, saídas, temas e atalhos. Tudo o que a equipe de mídia precisa para conduzir o culto sem sustos.',
    meta: '10 capítulos · do primeiro slide ao encerramento',
  },
  {
    href: '/docs/desenvolvimento',
    icon: Code2,
    eyebrow: 'Para quem constrói',
    title: 'Arquitetura técnica',
    description:
      'Tauri v2, Rust, syncBus, WebSocket, SQLite e o motor de temas. O mapa completo do código para evoluir o app.',
    meta: 'Stack, IPC, banco, temas e testes',
  },
  {
    href: '/docs/desenvolvimento/governanca-agents',
    icon: Terminal,
    eyebrow: 'Para agentes de IA',
    title: 'Governança & AGENTS.md',
    description:
      'Regras de contribuição, versões pinadas, limites de camada e convenções para colaborar sem quebrar a arquitetura.',
    meta: 'Regras obrigatórias para humanos e agentes',
  },
];

export default function HomePage() {
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-aurora" />
          <div className="hero-grid" />
          <div className="hero-vignette" />
        </div>

        <div className="hero-inner">
          <Link href="/docs" className="hero-badge">
            <span className="hero-badge-dot" aria-hidden="true" />
            Documentação oficial
            <span className="hero-badge-sep" aria-hidden="true" />
            <span className="hero-badge-muted">v0.3.8 · MIT</span>
          </Link>

          <h1 className="hero-title">
            Projete o culto.
            <br />
            <span className="text-gradient">Sem sustos.</span>
          </h1>

          <p className="hero-lead">
            Setlists, Bíblia, temas e saídas sincronizadas — a documentação oficial do
            <strong> Open Presenter</strong>, do primeiro slide ao código.
          </p>

          <div className="hero-actions">
            <Link href="/docs/operacao" className="btn btn-primary">
              Começar a operar
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/docs/desenvolvimento" className="btn btn-ghost">
              <Braces className="size-4" />
              Ver a arquitetura
            </Link>
          </div>

          <div className="hero-meta">
            <span>
              <ShieldCheck className="size-3.5" /> Offline por padrão
            </span>
            <span>
              <MonitorPlay className="size-3.5" /> Windows · macOS · Linux
            </span>
            <span>
              <GitBranch className="size-3.5" /> Código aberto
            </span>
          </div>
        </div>

        <div className="hero-stage">
          <HeroShot />
        </div>
      </section>

      <section className="stats-strip" aria-label="Números do Open Presenter">
        {stats.map((stat) => (
          <div key={stat.label} className="stat">
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="section" id="ao-vivo">
        <div className="section-head">
          <span className="section-kicker">
            <span className="kicker-line" aria-hidden="true" /> Fluxo ao vivo
          </span>
          <h2>Prévia, Enter, telão. Simples assim.</h2>
          <p>
            O operador sempre vê o próximo slide antes de projetar. Quando o momento chega,
            um clique manda a mesma imagem para o público, o palco e a transmissão.
          </p>
        </div>

        <div className="feature feature-right">
          <div className="feature-copy">
            <span className="feature-number">01</span>
            <h3>Decida com calma. Projete na hora.</h3>
            <p>
              A prévia carrega o slide sem tocar no telão. O Enter confirma. Se o pregador
              mudar de direção, o blackout e o plano de fundo estão a uma tecla de distância.
            </p>
            <ul className="bullet-list">
              {operatorBullets.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span className="bullet-icon">
                    <Icon className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/docs/operacao" className="text-link">
              Abrir o guia do operador <ArrowRight className="size-4" />
            </Link>
          </div>
          <Screenshot
            src="/screenshots/main.webp"
            alt="Tela principal com setlist, slides e monitores de prévia, ao vivo e stage"
            caption="Painel do operador: prévia, ao vivo e stage no mesmo lugar."
            className="feature-shot"
          />
        </div>
      </section>

      <section className="section section-alt" id="biblia">
        <div className="feature feature-left">
          <Screenshot
            src="/screenshots/bible.webp"
            alt="Módulo Bíblia com livros, capítulos, versículos e botão de projetar"
            caption="Bíblia: do livro ao versículo em poucos segundos."
            width={1680}
            height={1038}
            className="feature-shot"
          />
          <div className="feature-copy">
            <span className="feature-number">02</span>
            <h3>O versículo certo, antes do amém.</h3>
            <p>
              Encontre qualquer passagem em segundos, compare traduções e projete sem sair
              do fluxo. Versículos longos são divididos automaticamente para caber na tela.
            </p>
            <ul className="bullet-list">
              {bibleBullets.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span className="bullet-icon">
                    <Icon className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/docs/operacao/biblia" className="text-link">
              Ver a documentação da Bíblia <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="temas">
        <div className="theme-head">
          <div className="feature-copy">
            <span className="feature-number">03</span>
            <h3>Cada momento com a sua cara.</h3>
            <p>
              Louvor, pregação, avisos e descanso podem ter identidades diferentes — sem
              mexer na interface do operador. O editor visual cuida das camadas, e o fundo
              pode ser imagem, vídeo, CSS ou shader.
            </p>
          </div>
          <div className="theme-aside">
            <ul className="bullet-list">
              {themeBullets.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span className="bullet-icon">
                    <Icon className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/docs/operacao/temas-e-estilos" className="text-link">
              Explorar temas e estilos <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="theme-gallery">
          <Screenshot
            src="/screenshots/appearance.webp"
            alt="Preferências de aparência com presets de paleta e modo escuro"
            caption="Aparência do operador independente dos temas de projeção."
            width={1680}
            height={1285}
            className="feature-shot"
          />
          <Screenshot
            src="/screenshots/appearance-editor.webp"
            alt="Editor de temas com cores, arredondamento e prévia ao vivo"
            caption="Todos os tokens editáveis, com prévia ao vivo."
            width={1680}
            height={1285}
            className="feature-shot"
          />
        </div>
      </section>

      <section className="audience-section">
        <div className="section-head">
          <span className="section-kicker">
            <span className="kicker-line" aria-hidden="true" /> Escolha o seu caminho
          </span>
          <h2>Do operador ao código.</h2>
          <p>
            Três entradas, um só produto. A documentação fala com quem está no culto, com
            quem mantém o código e com agentes que colaboram na evolução.
          </p>
        </div>

        <div className="audience-grid">
          {audiences.map(({ href, icon: Icon, eyebrow, title, description, meta }) => (
            <Link key={href} href={href} className="audience-card">
              <span className="audience-icon">
                <Icon className="size-5" />
              </span>
              <span className="audience-eyebrow">{eyebrow}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="audience-meta">{meta}</span>
              <span className="audience-arrow">
                <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="quickstart">
        <div className="quickstart-glow" aria-hidden="true" />
        <div className="quickstart-inner">
          <div className="quickstart-copy">
            <span className="section-kicker quickstart-kicker">
              <span className="kicker-line" aria-hidden="true" /> Comece agora
            </span>
            <h2>Do clone ao primeiro slide.</h2>
            <p>
              O app roda com Tauri v2 e Rust. A documentação roda com Next.js e Fumadocs.
              Os dois ficam prontos em poucos comandos.
            </p>
            <div className="quickstart-links">
              <Link href="/docs#como-iniciar" className="text-link">
                Passo a passo completo <ArrowRight className="size-4" />
              </Link>
              <a
                href="https://github.com/open-mission/open-presenter/releases/latest"
                className="text-link"
                target="_blank"
                rel="noreferrer"
              >
                Baixar a última release <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

          <div className="terminal-card">
            <div className="terminal-bar">
              <span className="terminal-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>terminal</span>
            </div>
            <pre className="terminal-body">
              <code>
                <span className="t-comment"># aplicativo desktop</span>
                {'\n'}
                <span className="t-prompt">$</span> git clone https://github.com/open-mission/open-presenter.git
                {'\n'}
                <span className="t-prompt">$</span> cd open-presenter
                {'\n'}
                <span className="t-prompt">$</span> npm install
                {'\n'}
                <span className="t-prompt">$</span> npm run tauri:dev
                {'\n\n'}
                <span className="t-comment"># documentação</span>
                {'\n'}
                <span className="t-prompt">$</span> npm run docs:dev
              </code>
            </pre>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-main">
          <div className="site-footer-brand">
            <BrandMark className="size-8" />
            <div>
              <strong>Open Presenter</strong>
              <p>Software livre para projeção em igrejas e eventos.</p>
            </div>
          </div>
          <div className="site-footer-links">
            <Link href="/docs">Documentação</Link>
            <a href="https://github.com/open-mission/open-presenter" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a
              href="https://github.com/open-mission/open-presenter/releases"
              target="_blank"
              rel="noreferrer"
            >
              Releases
            </a>
            <Link href="/docs/desenvolvimento/governanca-agents">Contribuir</Link>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>Documentação oficial · Open Presenter</span>
          <span>
            Feito com <span className="footer-heart">♥</span> para quem serve no palco e na
            mesa de som.
          </span>
        </div>
      </footer>
    </main>
  );
}
