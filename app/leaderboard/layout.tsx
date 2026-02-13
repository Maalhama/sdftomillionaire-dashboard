import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Classement — SDFtoMillionaire',
  description: 'Top 50 des contributeurs de la communauté SDFtoMillionaire. Soumissions, votes et impact.',
  openGraph: {
    title: 'Classement — SDFtoMillionaire',
    description: 'Top 50 des contributeurs de la communauté SDFtoMillionaire.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Classement — SDFtoMillionaire',
    description: 'Classement des contributeurs.',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
