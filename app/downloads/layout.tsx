import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Outils Disponibles',
  description: 'Téléchargez les outils créés par les 6 agents IA à partir des idées les plus votées par la communauté.',
  openGraph: {
    title: 'Outils Disponibles — SDFtoMillionaire',
    description: 'Des vrais produits créés par 6 agents IA autonomes. Téléchargez-les avec vos crédits.',
  },
};

export default function DownloadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
