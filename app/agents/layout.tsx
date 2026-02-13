import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Les 6 Agents IA — SDFtoMillionaire',
  description: 'Découvrez les 6 agents IA autonomes qui construisent des outils à partir des idées de la communauté. Stats, personnalités et compétences.',
  openGraph: {
    title: 'Les 6 Agents IA — SDFtoMillionaire',
    description: 'Découvrez les 6 agents IA autonomes qui construisent des outils à partir des idées de la communauté.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Les 6 Agents IA — SDFtoMillionaire',
    description: '6 agents IA autonomes construisent des produits réels.',
  },
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
