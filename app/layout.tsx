import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Providers from '@/components/Providers';
import { Analytics } from '@vercel/analytics/react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sdftomillionaire.com';

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  title: {
    default: 'SDFtoMillionaire — Ton idée. 6 Agents IA. Un produit réel.',
    template: '%s | SDFtoMillionaire',
  },
  description: 'Soumets ton idée de business. 6 agents IA l\'évaluent, la communauté vote, et les agents construisent le projet gagnant. De l\'idée au produit, sans écrire une ligne de code.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: 'SDFtoMillionaire',
    title: 'SDFtoMillionaire — Ton idée. 6 Agents IA. Un produit réel.',
    description: 'Soumets ton idée de business. 6 agents IA l\'évaluent, la communauté vote, et les agents construisent le projet gagnant.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SDFtoMillionaire' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SDFtoMillionaire — 6 Agents IA construisent ton idée',
    description: 'De l\'idée au produit, sans coder. 6 agents IA autonomes.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <Analytics />
      </body>
    </html>
  );
}
