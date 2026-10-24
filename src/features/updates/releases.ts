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
    version: "0.5.0",
    date: "2026-10-24",
    title: "Multiview, Paleta Global e Drag & Drop",
    summary:
      "Uma repaginação completa do layout com grid multiview configurável de monitores, paleta de comandos global (Cmd+K), novos controles de mídia integrados, abas de avisos e cronômetros, e arrastar e soltar universal para a programação.",
    highlights: [
      {
        icon: "monitor",
        title: "Previews Multiview",
        description:
          "Grade configurável (2x2, 3x3, 4x4) sem bordas para monitorar o slide ao vivo e todas as saídas ao mesmo tempo com clique com botão direito.",
      },
      {
        icon: "palette",
        title: "Paleta Global (Cmd+K)",
        description:
          "Busca unificada para músicas, versículos bíblicos, mídias e comandos. Enter para navegar, Shift+Enter para projetar ao vivo.",
      },
      {
        icon: "book",
        title: "Bíblia e Drag & Drop",
        description:
          "Aba da Bíblia integrada com busca por referência e versão, seleção múltipla e arrasto direto de mídias e versículos para a programação.",
      },
    ],
    sections: [
      {
        title: "Multiview e Layout",
        items: [
          "Grade de monitores personalizável e redimensionável.",
          "Controles de mídia integrados abaixo dos previews.",
          "Abas de Avisos e Cronômetros/Timers de palco no painel inferior.",
          "Menu nativo Exibir para alternar abas e janelas.",
        ],
      },
      {
        title: "Paleta de Comandos e Atalhos",
        items: [
          "Abertura global via Cmd+K / Ctrl+K.",
          "Busca em todo o acervo com ações de navegação e projeção.",
        ],
      },
      {
        title: "Programação e Mídia",
        items: [
          "Arrastar e soltar mídias, temas, músicas e passagens bíblicas para a programação.",
          "Menu de contexto com opção de adicionar à programação.",
          "Agenda de eventos em janela própria destacada.",
        ],
      },
    ],
    fixes: [
      "Arrastar e soltar corrigido para todas as seções e áreas vazias da programação.",
      "Identificação limpa de versões da Bíblia sem prefixos técnicos.",
      "Previews estáticos em shaders WebGL para máxima performance.",
    ],
    changelogUrl: `${CHANGELOG_URL}#050---2026-10-24`,
  },
  {
    version: "0.4.2",
    date: "2026-10-23",
    title: "Telão com papel de parede de volta",
    summary:
      "A camada Entrada de Vídeo escurecia a saída inteira quando não havia sinal NDI — o telão ficava preto e o papel de parede parecia não existir. Agora ele volta a aparecer com a tela livre, com prioridade sobre o placeholder da saída.",
    highlights: [
      {
        icon: "monitor",
        title: "Telão livre mostra o papel de parede",
        description:
          "Com nada no ar, o papel de parede do culto aparece no telão, na web e nos previews. O placeholder da saída só entra quando não há wallpaper definido.",
      },
      {
        icon: "refresh",
        title: "Entrada de vídeo sem escurecer",
        description:
          "A camada NDI só cobre a tela quando há frames. Sem sinal, o fundo do tema ou o papel de parede permanece visível — inclusive no Lower Third, que mantém a transparência.",
      },
      {
        icon: "palette",
        title: "Imagem do placeholder no navegador",
        description:
          "O placeholder resolve o caminho pelo servidor embutido, então a imagem volta a carregar em saída html aberta no navegador, sem o erro \"URL incompatível\".",
      },
    ],
    sections: [
      {
        title: "Entrada de Vídeo",
        items: [
          "Fundo preto removido: a camada não cobre mais o telão sem sinal.",
          "Vale para público, stage e transmissão (que preserva o alpha).",
        ],
      },
      {
        title: "Papel de Parede e Placeholder",
        items: [
          "Papel de parede tem prioridade sobre o placeholder com a tela livre.",
          "Placeholder resolve media:// para a URL do servidor.",
          "Mídia não aponta mais para a porta padrão antes da porta real chegar.",
        ],
      },
    ],
    fixes: [
      "O telão não fica mais preto com a entrada de vídeo ligada e sem sinal.",
      "O papel de parede do culto volta a aparecer no telão, na web e nos previews.",
      "O placeholder da saída html volta a carregar a imagem no navegador.",
    ],
    changelogUrl: `${CHANGELOG_URL}#042---2026-10-23`,
  },
  {
    version: "0.4.1",
    date: "2026-10-23",
    title: "Correções de mídia e monitores",
    summary:
      "Ajustes reportados no Windows: o plano de fundo não aparecia mais como \"arquivo não encontrado\" e as telas não se perdem nem se duplicam ao abrir a Configuração de tela.",
    highlights: [
      {
        icon: "monitor",
        title: "Monitores estáveis",
        description:
          "As telas são identificadas pelo nome/resolução em vez do índice, então a atribuição não se perde. Abrir a Configuração de tela não relança nem rouba o foco das saídas.",
      },
      {
        icon: "refresh",
        title: "Fundo voltando a aparecer",
        description:
          "A mídia revalida a porta do servidor e cai para o protocolo interno quando o HTTP não responde, evitando o falso \"arquivo não encontrado\".",
      },
    ],
    sections: [
      {
        title: "Mídia",
        items: [
          "Porta de mídia revalidada quando o servidor sobe, para ou troca de porta.",
          "Fallback para media:// no desktop sem servidor HTTP.",
          "A janela do evento mostra a URL quando o plano de fundo falha.",
        ],
      },
      {
        title: "Monitores",
        items: [
          "Identidade de monitor estável por nome + resolução.",
          "Reconciliação das atribuições salvas ao carregar.",
          "Fallback e novas saídas preferem monitor não-principal.",
        ],
      },
    ],
    fixes: [
      "Abrir a Configuração de tela não reabre nem foca as saídas.",
      "Janela nativa existente só é reposicionada se o monitor mudou.",
      "Plano de fundo do evento e do telão voltam a carregar no Windows.",
    ],
    changelogUrl: `${CHANGELOG_URL}#041---2026-10-23`,
  },
  {
    version: "0.4.0",
    date: "2026-10-23",
    title: "Camadas, Looks e Entrada de Vídeo NDI",
    summary:
      "As camadas mestras agora renderizam de verdade: Props e Anúncios em overlays, Máscara em todas as saídas e Stage respeitando o Look. Chega também a Entrada de Vídeo NDI, com descoberta de fontes e feed ao vivo nas saídas.",
    highlights: [
      {
        icon: "layers",
        title: "Props e Anúncios Renderizados",
        description:
          "Mova um elemento para Props ou Anúncios no editor e ele aparece acima do Slide, abaixo dos alertas. Desligar a camada no Look esconde o overlay só naquela saída.",
      },
      {
        icon: "monitor",
        title: "Máscara e Stage em Camadas",
        description:
          "Escolha cantos arredondados, elipse, faixas ou laterais para recortar a saída. O Stage passa a respeitar Slide, Props, Anúncios e Máscara.",
      },
      {
        icon: "refresh",
        title: "Entrada de Vídeo NDI",
        description:
          "Descubra fontes NDI na aba Camadas e ligue a camada Entrada de Vídeo. O feed aparece abaixo do Slide no público, no Lower Third e no Stage.",
      },
      {
        icon: "palette",
        title: "Painel de Mídia",
        description:
          "Painel inferior com Temas, Fundos, Lower e Shaders, altura redimensionável e arraste para os previews de saída.",
      },
    ],
    sections: [
      {
        title: "Camadas & Looks",
        items: [
          "8 camadas mestras com visibilidade/bloqueio e Mover para camada.",
          "Look por saída com toggles de camada e tema padrão.",
          "Plano de render por saída com precedência ao vivo > evento > padrão.",
          "Máscara configurável (forma, margem, raio e cor).",
        ],
      },
      {
        title: "Entrada de Vídeo",
        items: [
          "Descoberta de fontes NDI e seleção no Look.",
          "Feed MJPEG servido pelo servidor embutido.",
          "Camada videoInput abaixo do Slide no público, Lower e Stage.",
          "Status com fonte ativa, resolução e erro.",
        ],
      },
      {
        title: "Painel de Mídia",
        items: [
          "Abas verticais e altura redimensionável persistida.",
          "Arraste de temas e fundos para cada saída.",
          "Aplicar, editar tema e limpar ação ao vivo.",
        ],
      },
    ],
    fixes: [
      "Tela cheia volta a funcionar nas janelas nativas do macOS.",
      "Messages desligada esconde os alertas só naquela saída.",
      "Arrastar fundo para a letra/prévia aplica o override na saída.",
    ],
    changelogUrl: `${CHANGELOG_URL}#040---2026-10-23`,
  },
  {
    version: "0.3.9",
    date: "2026-10-23",
    title: "Camadas, Looks por Saída e Painel de Mídia",
    summary:
      "O editor de temas agora organiza os elementos nas camadas mestras (Máscara, Mensagens, Props, Anúncios, Slide, Mídia, Vídeo e Cor da Tela). Cada saída ganha um Look próprio, decide o que aparece e recebe temas/fundos arrastados do novo painel inferior. O ThemeRail sai de cena.",
    highlights: [
      {
        icon: "layers",
        title: "Camadas Mestras no Editor",
        description:
          "A árvore do editor agrupa os elementos nas 8 camadas de saída. Todo texto nasce em Slide; imagens, formas e props podem ser movidos de camada com um clique.",
      },
      {
        icon: "monitor",
        title: "Look por Saída",
        description:
          "Cada tela liga e desliga camadas de verdade: desligar Mensagens esconde os avisos só naquela saída; desligar Slide esconde o texto e mantém a cor da tela.",
      },
      {
        icon: "palette",
        title: "Painel de Mídia com Arraste",
        description:
          "Painel inferior com abas Temas, Fundos, Lower e Shaders. Arraste um tema ou fundo para o preview de uma saída e ele muda só ali, mantendo o texto e as demais telas.",
      },
      {
        icon: "refresh",
        title: "Tela Cheia Confiável",
        description:
          "Novo atalho Janela → Tela Cheia (Ctrl+Cmd+F no Mac, F11 nos demais) e janelas de saída que voltam ao fullscreen depois de sair.",
      },
    ],
    sections: [
      {
        title: "Editor de Temas",
        items: [
          "As 8 camadas mestras com contador, olho de edição e cadeado.",
          "Ação Mover para camada em elementos e grupos.",
          "Temas antigos continuam abrindo; elementos sem camada viram Slide.",
        ],
      },
      {
        title: "Saídas & Sincronização",
        items: [
          "Plano de render por saída (tema, Look, fundo e cor da tela).",
          "Precedência única: ao vivo > evento > padrão da saída.",
          "Cor da tela e Look chegam às saídas web/OBS pelo snapshot inicial.",
          "Seletor de tema mostra todos os temas e explica os incompatíveis.",
        ],
      },
      {
        title: "Painel de Mídia",
        items: [
          "Abas verticais, altura redimensionável e estado persistido.",
          "Arraste de temas e fundos para os previews de saída.",
          "Lower Third só aceita cor/transparente ou tema de transmissão.",
          "Ações aplicar, editar tema e limpar ação ao vivo.",
        ],
      },
    ],
    fixes: [
      "O tema padrão configurado na tela não é mais sobreposto por vínculos globais.",
      "Mensagens desligadas em uma saída deixam de renderizar alertas nela.",
      "Arrastar fundo para a letra/prévia agora aplica o override na saída.",
      "O divisor do painel de mídia não inverte mais a direção ao arrastar.",
    ],
    changelogUrl: `${CHANGELOG_URL}#039---2026-10-23`,
  },
  {
    version: "0.3.8",
    date: "2026-10-20",
    title: "Auto-scale Preciso e Atalhos de Seção Sincronizados",
    summary:
      "Release de correção do motor de texto dos temas e dos atalhos de seção. O auto-scale agora mede as linhas reais do texto e respeita mínimo e máximo de fonte, com PNG fiel ao palco. Os atalhos de seção atualizam na hora ao serem alterados nas Preferências e têm prioridade sobre B/C/F no painel de letras.",
    highlights: [
      {
        icon: "palette",
        title: "Auto-scale com Mínimo e Máximo",
        description:
          "O texto passa a ser medido pelas linhas reais (Range.getClientRects) e ajustado por busca binária inteira entre minFontSize e maxFontSize. Letras curtas e longas encontram o maior tamanho que cabe, sem colapsar para o mínimo.",
      },
      {
        icon: "refresh",
        title: "Atalhos de Seção em Tempo Real",
        description:
          "Mudar o atalho de um grupo nas Preferências atualiza imediatamente os badges da letra na janela principal. A sincronização usa evento Tauri, BroadcastChannel e storage, sem reiniciar o aplicativo.",
      },
      {
        icon: "monitor",
        title: "PNG Fiel ao Palco",
        description:
          "O export passou a usar o mesmo resolvedor de tamanho do palco, com padding, line-height e clipping da caixa. O tamanho efetivo da fonte no PNG é o mesmo visto na projeção.",
      },
    ],
    sections: [
      {
        title: "Editor de Temas & Auto-scale",
        items: [
          "Medição por linhas reais do texto em elemento oculto, com cache e espera de fontes.",
          "Limites explícitos de fonte: mínimo, máximo e modo Fixo / Reduzir / Preencher.",
          "Correção do teste de largura que forçava todo texto multilinha ao tamanho mínimo.",
          "Export PNG com o mesmo tamanho efetivo, padding e clipping do palco.",
        ],
      },
      {
        title: "Atalhos de Seção & Programação",
        items: [
          "Sincronização dos grupos de música entre a janela principal e a de Preferências.",
          "Atalhos de seção têm prioridade sobre B/C/F enquanto há uma música no painel de letras.",
          "Aviso nas Preferências quando um atalho de grupo conflita com um atalho global.",
          "Documentação dos atalhos F (plano de fundo) e da prioridade contextual.",
        ],
      },
    ],
    fixes: [
      "Frases longas de hinos e versículos não são mais reduzidas ao mínimo nem cortadas.",
      "Alterar o atalho de um grupo não exige mais reiniciar o aplicativo para refletir na letra.",
      "Pressionar C para ir ao Refrão não dispara mais o comando global de limpar texto.",
      "O tamanho da fonte no PNG exportado agora corresponde ao da projeção.",
    ],
    changelogUrl: `${CHANGELOG_URL}#038---2026-10-20`,
  },
  {
    version: "0.3.7",
    date: "2026-10-20",
    title: "Agrupamento de Camadas em Temas e Correção de Auto-shrink",
    summary:
      "Release de correção trazendo suporte completo a agrupamento e renomeação de camadas no Editor de Temas, movimentação conjunta no Canvas, novo motor de auto-shrink/auto-fit de texto por tamanho de fonte sem corte de palavras e unificação visual de estrofes na programação do culto.",
    highlights: [
      {
        icon: "layers",
        title: "Agrupamento de Camadas",
        description:
          "Selecione múltiplas camadas no painel para agrupá-las com um clique. Renomeie o grupo, alterne visibilidade ou bloqueio em lote e mova todos os elementos juntos diretamente no Canvas.",
      },
      {
        icon: "palette",
        title: "Auto-shrink de Texto Preciso",
        description:
          "Refatoração completa do motor de redimensionamento para calibrar o tamanho da fonte (fontSize) e altura de linha diretamente, garantindo que frases longas de hinos e versículos nunca sejam cortadas.",
      },
      {
        icon: "book",
        title: "Cards Unificados na Programação",
        description:
          "Estrofes e seções com múltiplos slides agora aparecem envolvidas em um único card com cabeçalho compartilhado e contador, eliminando bordas e rótulos duplicados.",
      },
    ],
    sections: [
      {
        title: "Editor de Temas & Camadas",
        items: [
          "Seleção múltipla de camadas via Ctrl/Cmd + clique ou Shift + clique.",
          "Criação e desmanche de grupos através dos botões Agrupar e Desagrupar.",
          "Renomeação inline rápida com duplo-clique sobre o nome do grupo.",
          "Controles em lote no cabeçalho do grupo para visibilidade, bloqueio, reordenação e exclusão.",
          "Arrastar qualquer elemento agrupado no Canvas move todos os membros do grupo simultaneamente em tempo real.",
        ],
      },
      {
        title: "Motor de Renderização",
        items: [
          "Substituição de CSS transform scale por busca binária iterativa em fontSize e lineHeight.",
          "Quebra de linha natural mantendo conformidade estrita com a largura e altura do container.",
          "Suporte aprimorado tanto para textos multilinhas quanto linha única com respeito a minFontSize.",
        ],
      },
    ],
    fixes: [
      "Eliminado o corte vertical e horizontal em frases longas ao usar Reduzir para Caber ou Preencher Caixa.",
      "Corrigida a repetição de rótulos e bordas individuais em múltiplos slides pertencentes à mesma estrofe na lista do culto.",
    ],
    changelogUrl: `${CHANGELOG_URL}#037---2026-10-20`,
  },
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
