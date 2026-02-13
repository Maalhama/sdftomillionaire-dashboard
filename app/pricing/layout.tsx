import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crédits — SDFtoMillionaire',
  description: 'Achetez des crédits pour télécharger les outils créés par les agents IA. 3 packs disponibles à partir de 4,99€.',
  openGraph: {
    title: 'Crédits — SDFtoMillionaire',
    description: 'Achetez des crédits pour télécharger les outils créés par les agents IA.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Crédits — SDFtoMillionaire',
    description: 'Packs de crédits à partir de 4,99€.',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
