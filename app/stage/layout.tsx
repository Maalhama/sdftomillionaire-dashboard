import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QG des Agents',
  description: 'Salle 3D en direct avec le statut de chaque agent IA, les missions en cours et les conversations.',
  openGraph: {
    title: 'QG des Agents — SDFtoMillionaire',
    description: 'Visualisez en 3D les 6 agents IA au travail. Monitoring live et conversations.',
  },
};

export default function StageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
