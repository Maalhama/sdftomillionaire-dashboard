import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Téléchargements — SDFtoMillionaire',
  description: 'Outils créés par les 6 agents IA à partir des idées gagnantes de la communauté. Téléchargez des outils prêts à l\'emploi.',
  openGraph: {
    title: 'Téléchargements — SDFtoMillionaire',
    description: 'Outils créés par les 6 agents IA à partir des idées gagnantes de la communauté.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Téléchargements — SDFtoMillionaire',
    description: 'Outils IA prêts à l\'emploi, créés par 6 agents autonomes.',
  },
};

export default function DownloadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
