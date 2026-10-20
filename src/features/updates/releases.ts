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
    version: "0.3.6",
    date: "2026-10-20",
    title: "Controle Remoto Moderno, Layout Responsivo e Melhorias em Temas",
    summary:
      "Novo controle remoto com toolbar de navegação rápida e drawer expandido, modo compacto sem quebra e visualização em duas colunas no tablet/computador. Além disso, o relógio agora pode piscar os dois pontos, o alinhamento de texto em widgets foi aprimorado e as referências bíblicas contam com variáveis limpas e independentes da versão.",
    highlights: [
      {
        icon: "monitor",
        title: "Controle Remoto em Duas Colunas",
        description:
          "Experiência aprimorada para tablets e desktops: o preview ao vivo e cronômetro ficam fixos na primeira coluna, enquanto a programação, músicas e Bíblia rolam livremente na segunda coluna.",
      },
      {
        icon: "refresh",
        title: "Toolbar & Drawer de Apresentação",
        description:
          "A barra inferior colapsada agora tem alça de puxar, resumo com seção e contador, e três botões diretos: Anterior, Sem texto (para ocultar a letra e deixar só o fundo) e Próximo. Ao expandir o drawer, navegue pelas seções coloridas da música e versículos.",
      },
      {
        icon: "palette",
        title: "Relógio Digital e Alinhamento Perfeito",
        description:
          "Widgets e relógios agora centralizam perfeitamente na caixa do elemento. Adicionada também a opção de fazer os dois pontos (:) piscarem a cada segundo como em um relógio digital real.",
      },
      {
        icon: "book",
        title: "Variáveis Bíblicas Limpas",
        description:
          "Nomes de arquivos SQLite foram eliminados da exibição. A referência agora é limpa ({reference}), com a versão separada ({version}) e opções completas ({reference_full}) e abreviadas ({reference_abbr}).",
      },
    ],
    sections: [
      {
        title: "Controle Remoto",
        items: [
          "Toolbar flutuante com alça de puxar e 3 botões ergonômicos: Anterior, Sem texto e Próximo.",
          "Drawer expandido com título, atalhos de navegação interna e lista completa de seções/versículos.",
          "Modo compacto do preview ao vivo em 1 única linha com ícones enquadrados.",
          "Layout responsivo automático em 2 colunas para computadores e tablets em modo paisagem.",
        ],
      },
      {
        title: "Editor de Temas e Widgets",
        items: [
          "Correção definitiva da centralização horizontal de widgets e elementos em linha única.",
          "Novo toggle 'Piscar dois pontos (:)' no painel de propriedades tipográficas.",
          "Relógio de retorno e palco configurado por padrão com centralização e dois pontos piscantes.",
        ],
      },
      {
        title: "Bíblia e Projeção",
        items: [
          "Variáveis bíblicas limpas: {reference}, {version}, {reference_full} e {reference_abbr}.",
          "Remoção automática de extensões de arquivo (.sqlite) nas saídas pública, retorno e transmissão.",
          "Correção no auto-shrink / auto-fit para textos e versículos longos sem cortes indevidos.",
        ],
      },
    ],
    fixes: [
      "Atalhos de copiar, colar e recortar (Cmd+C, Cmd+V, Cmd+X, Cmd+A) agora funcionam nativamente no macOS.",
      "Redução automática de texto não corta mais palavras e frases longas prematuramente.",
      "Identificação e compilação nativa para Macs com chips Apple Silicon (M1/M2/M3/M4) sem necessidade do Rosetta.",
    ],
    changelogUrl: `${GITHUB_REPO_URL}/releases/tag/v0.3.6`,
  },
  {
    version: "0.3.5",
    date: "2026-10-20",
    title: "Saída para OBS, Lower Thirds e Animações por Camada",
    summary:
      "Integre o Open Presenter diretamente ao OBS Studio com saída transparente para transmissões ao vivo. Crie Lower Thirds profissionais, controle transições por camada sem que o fundo pisque, use gradientes com texturas de ruído e adicione versículos bíblicos à programação.",
    highlights: [
      {
        icon: "monitor",
        title: "Transmissão para OBS (Lower Thirds)",
        description:
          "Nova saída transparente /stream para uso no OBS Studio, vMix ou Wirecast como Browser Source. O tema de transmissão fica posicionado na faixa inferior para sobrepor câmeras sem bloquear a cena.",
      },
      {
        icon: "layers",
        title: "Transições e Camadas Fixas",
        description:
          "Defina quais elementos permanecem fixos (como faixas e fundos) e configure efeitos de fade, subida ou descida individualmente por camada na troca de versos e slides.",
      },
      {
        icon: "palette",
        title: "Gradientes e Textura de Ruído",
        description:
          "Crie gradientes personalizados com controle visual de pontos de cor e adicione textura de granulação (noise) com 1 clique para dar profundidade estética aos seus temas.",
      },
      {
        icon: "book",
        title: "Bíblia na Programação e Controle",
        description:
          "Adicione versículos bíblicos diretamente na setlist do culto, acompanhe na coluna de slides e encerre a apresentação pelo controle remoto quando terminar.",
      },
    ],
    sections: [
      {
        title: "Transmissão e OBS",
        items: [
          "Aba Transmissão em Preferências com toggle de ativação e link rápido de Browser Source.",
          "Tema padrão de Lower Third com estilos próprios para louvores, leituras bíblicas e textos.",
          "Simulação de câmera com vídeo no Editor de Temas para calibrar o posicionamento antes de ir ao ar.",
        ],
      },
      {
        title: "Editor de Temas",
        items: [
          "Nova seção de Transição e Animação com opções de camada fixa e movimentos direcionais.",
          "Construtor visual de gradientes lineares com múltiplos seletores de cor e presets.",
          "Gerador procedural de texturas de ruído (noise) em SVG.",
          "No macOS, a tecla Backspace agora exclui o elemento selecionado em vez de fechar a janela.",
        ],
      },
      {
        title: "Culto e Controle",
        items: [
          "Versículos bíblicos integrados aos itens da setlist com escolha da seção.",
          "Botão Encerrar no controle remoto para liberar o telão com rapidez.",
          "Melhorias de navegação em partes de versículos bíblicos longos.",
        ],
      },
    ],
    fixes: [
      "No macOS, o uso de Backspace/Delete no editor de temas não fecha mais a janela.",
      "O fundo do palco e retângulos de temas permanecem fixos sem piscar durante a troca de estrofes.",
      "Ordenação cronológica correta dos eventos na programação.",
      "Prevenção de zoom acidental por pinça/duplo toque no controle remoto em celulares.",
    ],
    changelogUrl: `${GITHUB_REPO_URL}/releases/tag/v0.3.5`,
  },
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
