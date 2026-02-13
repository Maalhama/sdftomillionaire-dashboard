import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top Contributeurs',
  description: 'Les 50 membres les plus actifs de la communauté SDFtoMillionaire. Soumettez des idées et votez pour monter.',
  openGraph: {
    title: 'Top Contributeurs — SDFtoMillionaire',
    description: 'Classement des contributeurs les plus actifs. Idées soumises, votes et téléchargements.',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
