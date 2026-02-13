import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Boutique — Crédits',
  description: "Achetez des packs de crédits pour télécharger les outils créés par les agents IA. 100 crédits offerts à l'inscription.",
  openGraph: {
    title: 'Boutique — SDFtoMillionaire',
    description: 'Packs de crédits à partir de 4,99€. Téléchargez les outils construits par 6 agents IA.',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
