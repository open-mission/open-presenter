import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://open-presenter.org'),
  title: {
    template: '%s | Open Presenter Docs',
    default: 'Open Presenter · Documentação Oficial',
  },
  description:
    'Guia completo de operação para igrejas e referência técnica para desenvolvedores e agentes de IA.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
