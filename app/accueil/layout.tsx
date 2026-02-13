import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Questions fréquentes sur SDFtoMillionaire : comment soumettre une idée, le vote, les agents IA, les crédits.',
  openGraph: {
    title: 'FAQ — SDFtoMillionaire',
    description: 'Tout ce que tu dois savoir sur SDFtoMillionaire et les 6 agents IA.',
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
