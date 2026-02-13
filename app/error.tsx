'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-grid min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="font-mono text-hacker-red text-6xl mb-4">{'>'}_</div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Erreur système
        </h2>
        <p className="text-sm text-hacker-muted-light mb-2">
          {error.message || 'Une erreur inattendue est survenue.'}
        </p>
        {error.digest && (
          <p className="text-xs text-hacker-muted font-mono mb-6">
            digest: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
          <Link href="/" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
