'use client';

import { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

type MermaidTheme = {
  dark: boolean;
};

const sharedVariables = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '14px',
};

const themeVariables = {
  light: {
    ...sharedVariables,
    background: '#ffffff',
    primaryColor: '#f4f2fb',
    primaryTextColor: '#14121a',
    primaryBorderColor: '#8b5cf6',
    secondaryColor: '#faf9fd',
    tertiaryColor: '#f6f5fa',
    lineColor: '#8b5cf6',
    textColor: '#2c2936',
    mainBkg: '#f4f2fb',
    nodeBorder: '#8b5cf6',
    nodeTextColor: '#14121a',
    clusterBkg: '#faf9fd',
    clusterBorder: 'rgba(124, 58, 237, 0.28)',
    edgeLabelBackground: '#ffffff',
    titleColor: '#14121a',
    actorBkg: '#f4f2fb',
    actorBorder: '#8b5cf6',
    actorTextColor: '#14121a',
    actorLineColor: 'rgba(20, 18, 26, 0.24)',
    signalColor: '#4b4760',
    signalTextColor: '#2c2936',
    labelBoxBkgColor: '#f4f2fb',
    labelBoxBorderColor: '#8b5cf6',
    labelTextColor: '#14121a',
    loopTextColor: '#2c2936',
    noteBkgColor: '#faf5ff',
    noteBorderColor: '#c4b5fd',
    noteTextColor: '#2c2936',
    activationBkgColor: '#ede9fe',
    activationBorderColor: '#8b5cf6',
    sequenceNumberColor: '#ffffff',
  },
  dark: {
    ...sharedVariables,
    background: '#0b0b0f',
    primaryColor: '#17151f',
    primaryTextColor: '#f4f2f8',
    primaryBorderColor: '#a78bfa',
    secondaryColor: '#121018',
    tertiaryColor: '#0e0d13',
    lineColor: '#a78bfa',
    textColor: '#d8d4e4',
    mainBkg: '#17151f',
    nodeBorder: '#a78bfa',
    nodeTextColor: '#f4f2f8',
    clusterBkg: '#121018',
    clusterBorder: 'rgba(167, 139, 250, 0.3)',
    edgeLabelBackground: '#0b0b0f',
    titleColor: '#f4f2f8',
    actorBkg: '#17151f',
    actorBorder: '#a78bfa',
    actorTextColor: '#f4f2f8',
    actorLineColor: 'rgba(244, 242, 248, 0.22)',
    signalColor: '#b8b3c9',
    signalTextColor: '#d8d4e4',
    labelBoxBkgColor: '#17151f',
    labelBoxBorderColor: '#a78bfa',
    labelTextColor: '#f4f2f8',
    loopTextColor: '#d8d4e4',
    noteBkgColor: '#1b1626',
    noteBorderColor: 'rgba(167, 139, 250, 0.5)',
    noteTextColor: '#e9e5f5',
    activationBkgColor: '#2a2140',
    activationBorderColor: '#a78bfa',
    sequenceNumberColor: '#0b0b0f',
  },
} satisfies Record<'light' | 'dark', Record<string, string>>;

const themeCSS = `
  .node rect,
  .node polygon,
  .node circle,
  .node ellipse,
  .node path {
    rx: 10px;
    ry: 10px;
  }
  .cluster rect {
    rx: 14px;
    ry: 14px;
  }
  .edgeLabel p {
    padding: 2px 6px;
    border-radius: 6px;
  }
  .labelBkg {
    background-color: transparent;
  }
  .actor {
    rx: 8px;
    ry: 8px;
  }
  .messageText,
  .loopText,
  .noteText,
  .actor {
    font-family: inherit !important;
  }
`;

function buildConfig(dark: boolean) {
  return {
    startOnLoad: false,
    securityLevel: 'loose' as const,
    theme: 'base' as const,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    themeVariables: themeVariables[dark ? 'dark' : 'light'],
    themeCSS,
    flowchart: {
      curve: 'basis' as const,
      htmlLabels: true,
      padding: 14,
      nodeSpacing: 44,
      rankSpacing: 52,
    },
    sequence: {
      useMaxWidth: true,
      wrap: true,
      diagramMarginX: 16,
      diagramMarginY: 12,
    },
  };
}

const diagramCache = new Map<string, string>();

export function Mermaid({ chart, className }: { chart: string; className?: string }) {
  const reactId = useId();
  const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const cacheKey = `${isDark ? 'dark' : 'light'}:${chart}`;
  const [svg, setSvg] = useState<string | null>(() => diagramCache.get(cacheKey) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = diagramCache.get(cacheKey);

    if (cached) {
      setSvg(cached);
      setFailed(false);
      return;
    }

    setSvg(null);
    setFailed(false);

    async function render() {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize(buildConfig(isDark));
        const { svg: output } = await mermaid.render(id, chart);
        diagramCache.set(cacheKey, output);
        if (active) setSvg(output);
      } catch {
        if (active) setFailed(true);
      }
    }

    void render();

    return () => {
      active = false;
    };
  }, [cacheKey, chart, id, isDark]);

  if (failed) {
    return (
      <figure className="mermaid-figure" data-state="error" aria-label="Diagrama Mermaid">
        <figcaption className="mermaid-caption">
          <span>Diagrama</span>
          <span className="mermaid-status">não foi possível renderizar</span>
        </figcaption>
        <pre className="mermaid-source">{chart}</pre>
      </figure>
    );
  }

  return (
    <figure className={className ? `mermaid-figure ${className}` : 'mermaid-figure'} data-state={svg ? 'ready' : 'loading'}>
      <figcaption className="mermaid-caption" aria-hidden="true">
        <span>Diagrama</span>
        <span className="mermaid-status">{svg ? 'Mermaid' : 'renderizando…'}</span>
      </figcaption>
      {svg ? (
        <div
          className="mermaid-canvas"
          role="img"
          aria-label="Diagrama Mermaid"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="mermaid-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </figure>
  );
}
