export const GITHUB_REPO_URL = "https://github.com/open-mission/open-presenter";
export const CHANGELOG_URL = `${GITHUB_REPO_URL}/blob/main/CHANGELOG.md`;
export const RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const LATEST_RELEASE_URL = `${GITHUB_REPO_URL}/releases/latest`;

export type ReleaseHighlightIcon =
  | "book"
  | "layers"
  | "monitor"
  | "refresh"
  | "tray"
  | "palette"
  | "download"
  | "brand";

export interface ReleaseHighlight {
  icon: ReleaseHighlightIcon;
  title: string;
  description: string;
}

export interface ReleaseSection {
  title: string;
  items: string[];
}

export interface ReleaseNotes {
  version: string;
  date: string;
  title: string;
  summary: string;
  highlights: ReleaseHighlight[];
  sections: ReleaseSection[];
  fixes: string[];
  changelogUrl: string;
}

export const RELEASES: ReleaseNotes[] = [
  {
    version: "0.3.1",
    date: "2026-10-19",
    title: "Uma nova identidade e temas do seu jeito",
    summary:
      "O Open Presenter ganhou uma identidade visual mais clara e um sistema de temas completo para a interface. Escolha um preset, ajuste cada cor e leve seu tema com você — sem mexer nos temas de projeção.",
    highlights: [
      {
        icon: "palette",
        title: "Sua interface, seu jeito",
        description:
          "Escolha entre presets inspirados no shadcn/ui e abra a seção recolhível para ajustar as cores da paleta clara e escura. O arredondamento dos componentes também é seu.",
      },
      {
        icon: "download",
        title: "Leve seu tema com você",
        description:
          "Exporte a interface em JSON ou CSS, compartilhe com a equipe e importe de volta quando quiser. Temas parciais completam o restante automaticamente.",
      },
      {
        icon: "brand",
        title: "Nova identidade visual",
        description:
          "Novo ícone do aplicativo, ícone da bandeja, favicon das páginas web e o wordmark oficial no README e nas configurações.",
      },
      {
        icon: "monitor",
        title: "Projeção intacta",
        description:
          "A aparência do operador mudou, mas os temas das telas de público e palco continuam independentes, com o mesmo controle de sempre.",
      },
    ],
    sections: [
      {
        title: "Aparência",
        items: [
          "Editor recolhível com presets para claro e escuro e edição de todos os tokens shadcn/ui.",
          "Ajuste de cor primária, superfícies, textos, bordas, anel de foco, gráficos e barra lateral.",
          "Controle de arredondamento dos componentes e prévia ao vivo na própria tela.",
          "Persistência automática e opção de restaurar o tema Open Presenter.",
        ],
      },
      {
        title: "Importação e exportação",
        items: [
          "Exportação da interface em JSON para backup ou compartilhamento.",
          "Exportação em CSS com blocos :root e .dark, pronta para reutilizar.",
          "Importação de JSON ou CSS, inclusive temas parciais ou gerados por ferramentas do ecossistema shadcn/ui.",
        ],
      },
      {
        title: "Identidade",
        items: [
          "Novos ícones SVG do aplicativo e da bandeja do sistema.",
          "Wordmark oficial no README e no aplicativo.",
          "Favicon e ícone de toque nas páginas web servidas pelo app.",
          "Ícone template na bandeja do macOS, adaptando-se ao modo claro e escuro.",
        ],
      },
    ],
    fixes: [
      "A versão exibida na janela de atalhos agora é a versão real do aplicativo.",
      "As barras de rolagem acompanham as cores do tema da interface.",
      "Pequenos ajustes de contraste e consistência visual nas configurações.",
    ],
    changelogUrl: CHANGELOG_URL,
  },
  {
    version: "0.3.0",
    date: "2026-10-19",
    title: "Bíblia integrada e temas por momento",
    summary:
      "Esta versão aproxima a Bíblia da projeção e deixa os temas acompanharem cada parte do culto — do louvor aos avisos, da pregação ao retorno do palco.",
    highlights: [
      {
        icon: "book",
        title: "Bíblia integrada",
        description:
          "Importe sua tradução, encontre versículos por livro, capítulo ou palavra e envie direto para o público ou para o palco.",
      },
      {
        icon: "layers",
        title: "Temas por momento",
        description:
          "Crie uma tela para cada contexto do culto. O Open Presenter escolhe o tema certo automaticamente e você pode trocar quando quiser.",
      },
      {
        icon: "monitor",
        title: "Projeção mais fluida",
        description:
          "Prévia do próximo slide, versículo anterior no palco e textos que se ajustam melhor ao espaço disponível.",
      },
      {
        icon: "refresh",
        title: "Atualizações pelo app",
        description:
          "Quando sair uma versão nova, o próprio Open Presenter avisa e instala a atualização sem você precisar baixar nada manualmente.",
      },
      {
        icon: "tray",
        title: "Sempre à mão na bandeja",
        description:
          "Ative a opção de manter na bandeja para fechar a janela sem perder o app de vista: o ícone abre os links, reinicia o servidor e encerra de verdade.",
      },
    ],
    sections: [
      {
        title: "Bandeja do sistema",
        items: [
          "Ícone permanente com status do servidor local.",
          "Acesso rápido aos links de público, palco e controle remoto quando estão ativos.",
          "Reinício do servidor e saída do aplicativo pelo próprio menu.",
          "Fechamento para a bandeja configurável em Preferências > Geral.",
        ],
      },
      {
        title: "Bíblia",
        items: [
          "Importação de versões da Bíblia para uso offline.",
          "Busca por livro, capítulo, versículo ou palavra.",
          "Comparação entre diferentes traduções.",
          "Envio de versículos para o público e para o palco.",
          "Aba da Bíblia no controle remoto para consultar e projetar pelo celular.",
        ],
      },
      {
        title: "Temas",
        items: [
          "Páginas de tema separadas para público e palco.",
          "Temas específicos para louvor, pregação, avisos e retorno do palco.",
          "Escolha do tema do evento e aplicação automática do tema mais adequado.",
          "Importação e exportação de temas em arquivo, com atualização de temas antigos.",
          "Renomeação de camadas e prévias atualizadas na galeria.",
        ],
      },
      {
        title: "Projeção e palco",
        items: [
          "Widget de prévia do próximo slide e do próximo versículo.",
          "Versículo anterior disponível na tela do palco.",
          "Ajuste automático do tamanho do texto para evitar cortes.",
        ],
      },
    ],
    fixes: [
      "A exclusão de um tema não deixa mais o diálogo em estado inconsistente.",
      "Ajustes internos de estabilidade no editor e na publicação de temas.",
    ],
    changelogUrl: CHANGELOG_URL,
  },
];

export function getReleaseNotes(version: string): ReleaseNotes | undefined {
  return RELEASES.find((release) => release.version === version);
}

export const CURRENT_RELEASE = RELEASES[0];
