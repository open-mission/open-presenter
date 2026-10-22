import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { BookOpen, Code2, MonitorPlay } from 'lucide-react';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  const options = baseOptions();
  const links = options.links?.filter((link) => link.type !== 'main');

  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...options}
      links={links}
      tabMode="top"
      tabs={[
        {
          title: 'Visão geral',
          url: '/docs',
          icon: <BookOpen className="size-4" />,
        },
        {
          title: 'Operação',
          url: '/docs/operacao',
          icon: <MonitorPlay className="size-4" />,
        },
        {
          title: 'Desenvolvimento',
          url: '/docs/desenvolvimento',
          icon: <Code2 className="size-4" />,
        },
      ]}
      sidebar={{
        defaultOpenLevel: 2,
      }}
    >
      {children}
    </DocsLayout>
  );
}
