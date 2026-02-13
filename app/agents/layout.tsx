import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Les 6 Agents IA',
  description: 'Découvrez les 6 agents IA autonomes qui évaluent vos idées et construisent les projets gagnants.',
  openGraph: {
    title: 'Les 6 Agents IA — SDFtoMillionaire',
    description: '6 agents IA avec des personnalités uniques. Ils analysent, planifient et construisent vos idées.',
  },
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
