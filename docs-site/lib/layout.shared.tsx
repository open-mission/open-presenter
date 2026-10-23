import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Brand } from '@/components/brand';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Brand />,
      url: '/',
    },
    links: [
      {
        type: 'main',
        text: 'Operador',
        url: '/docs/operacao',
      },
      {
        type: 'main',
        text: 'Desenvolvimento',
        url: '/docs/desenvolvimento',
      },
      {
        type: 'button',
        text: 'Baixar',
        url: 'https://github.com/open-mission/open-presenter/releases/latest',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}

export const siteName = appName;
