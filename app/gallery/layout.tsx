import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Galerie des Idées — SDFtoMillionaire',
  description: 'Découvrez les idées soumises par la communauté, évaluées par 6 agents IA. Votez pour l\'idée que vous voulez voir construite.',
  openGraph: {
    title: 'Galerie des Idées — SDFtoMillionaire',
    description: 'Découvrez les idées soumises par la communauté, évaluées par 6 agents IA. Votez pour l\'idée que vous voulez voir construite.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galerie des Idées — SDFtoMillionaire',
    description: 'Découvrez les idées évaluées par 6 agents IA. Votez pour votre préférée !',
  },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
