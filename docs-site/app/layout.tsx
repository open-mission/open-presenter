import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://open-presenter.org'),
  title: {
    template: '%s | Open Presenter Docs',
    default: 'Open Presenter · Documentação Oficial',
  },
  description:
    'Guia completo de operação para igrejas e referência técnica para desenvolvedores e agentes de IA.',
  applicationName: 'Open Presenter Docs',
  icons: {
    icon: '/brand/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Open Presenter Docs',
    title: 'Open Presenter · Documentação Oficial',
    description:
      'Setlists, Bíblia, temas e saídas sincronizadas. Operação ao vivo e arquitetura do Open Presenter.',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider
          i18n={{
            locale: 'pt-BR',
            translations: {
              'Ask AI(AI chat button)': 'Perguntar à IA',
              'Back to Home(404 not found page)': 'Voltar ao início',
              'Choose a language(language switcher)': 'Escolher um idioma',
              'Choose a language(language switcher)(aria-label)': 'Escolher um idioma',
              'Close Banner(banner)(aria-label)': 'Fechar aviso',
              'Close Search(search dialog)(aria-label)': 'Fechar busca',
              'Close Sidebar(aria-label)': 'Fechar barra lateral',
              'Close Sidebar(sidebar)(aria-label)': 'Fechar barra lateral',
              'Close(image zoom)(aria-label)': 'Fechar',
              'Collapse Sidebar(sidebar)(aria-label)': 'Recolher barra lateral',
              'Copied Anchor Link(heading anchor)(aria-label)': 'Link da seção copiado',
              'Copied Link(accordion)(aria-label)': 'Link copiado',
              'Copied Markdown(page actions)': 'Markdown copiado',
              'Copied Text(code block)(aria-label)': 'Texto copiado',
              'Copy Anchor Link(heading anchor)(aria-label)': 'Copiar link da seção',
              'Copy Link(accordion)(aria-label)': 'Copiar link',
              'Copy Markdown(page actions)': 'Copiar Markdown',
              'Copy Text(code block)(aria-label)': 'Copiar texto',
              'Dark(theme switcher)(aria-label)': 'Escuro',
              'Default(type table)': 'Padrão',
              'Edit on GitHub(edit page)': 'Editar no GitHub',
              'Hide Sidebar(sidebar)': 'Ocultar barra lateral',
              'Image Viewer(image zoom)(aria-label)': 'Visualizador de imagem',
              'Language(language switcher)': 'Idioma',
              'Last updated on(page footer)': 'Atualizado em',
              'Layout Tab(layout tab trigger)': 'Aba de layout',
              'Light(theme switcher)(aria-label)': 'Claro',
              'Next Image(image zoom)(aria-label)': 'Próxima imagem',
              'Next Page(pagination)': 'Próxima página',
              'No Headings(table of contents)': 'Sem títulos',
              'No results found(search dialog)': 'Nenhum resultado encontrado',
              'On this page(table of contents)': 'Nesta página',
              'Open Search(search trigger)(aria-label)': 'Abrir busca',
              'Open Sidebar(aria-label)': 'Abrir barra lateral',
              'Open Sidebar(sidebar)(aria-label)': 'Abrir barra lateral',
              'Open in ChatGPT(page actions)': 'Abrir no ChatGPT',
              'Open in Claude(page actions)': 'Abrir no Claude',
              'Open in Cursor(page actions)': 'Abrir no Cursor',
              'Open in GitHub(page actions)': 'Abrir no GitHub',
              'Open in Scira AI(page actions)': 'Abrir no Scira AI',
              'Open(page actions)': 'Abrir',
              'Options(aria-label)': 'Opções',
              'Page Not Found(404 not found page)': 'Página não encontrada',
              'Parameters(type table)': 'Parâmetros',
              'Previous Image(image zoom)(aria-label)': 'Imagem anterior',
              'Previous Page(pagination)': 'Página anterior',
              'Prop(type table)': 'Propriedade',
              'Read {url}, I want to ask questions about it.(page actions)':
                'Leia {url}, quero fazer perguntas sobre isso.',
              'Returns(type table)': 'Retorna',
              'Search failed(search dialog)': 'A busca falhou',
              'Search failed, showing results for {query}(search dialog)':
                'A busca falhou; mostrando resultados para {query}',
              'Search(search dialog)': 'Buscar',
              'Search(search trigger)': 'Buscar',
              'Show Sidebar(sidebar)': 'Mostrar barra lateral',
              'System(theme switcher)(aria-label)': 'Sistema',
              'Table of Contents(inline table of contents)': 'Sumário',
              'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 not found page)':
                'A página que você procura pode ter sido removida, renomeada ou está temporariamente indisponível.',
              'Theme(site menu)': 'Tema',
              'Toggle Menu(home layout header)(aria-label)': 'Abrir menu',
              'Toggle Theme(theme switcher)(aria-label)': 'Alternar tema',
              'Type(type table)': 'Tipo',
              'View as Markdown(page actions)': 'Ver como Markdown',
              Search: 'Buscar',
              'On this page': 'Nesta página',
              'Copy Markdown': 'Copiar Markdown',
              'Copied Markdown': 'Markdown copiado',
              Open: 'Abrir',
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
