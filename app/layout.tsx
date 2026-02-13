import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Providers from '@/components/Providers';

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  title: 'SDFtoMillionaire — Ton idée. 6 Agents IA. Un produit réel.',
  description: 'Soumets ton idée de business. 6 agents IA l\'évaluent, la communauté vote, et les agents construisent le projet gagnant. De l\'idée au produit, sans écrire une ligne de code.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col bg-hacker-bg">
        <Providers>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
