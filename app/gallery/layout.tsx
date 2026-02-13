import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Galerie des Idées',
  description: 'Parcourez les idées d\'apps, de sites et de business soumises par la communauté. Votez pour votre préférée — les agents IA construiront le gagnant.',
  openGraph: {
    title: 'Galerie des Idées — SDFtoMillionaire',
    description: 'Parcourez et votez pour les meilleures idées de business. 6 agents IA construisent le projet gagnant.',
  },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
