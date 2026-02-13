import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Suivi des Idées',
  description: 'Suivez le parcours de chaque idée soumise : évaluation, votes, construction par les agents IA.',
  openGraph: {
    title: 'Suivi des Idées — SDFtoMillionaire',
    description: 'Pipeline en temps réel : de la soumission à la construction par les agents IA.',
  },
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
