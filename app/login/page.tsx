'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Github, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, signInWithGithub, signInWithGoogle, signInWithMagicLink } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  if (user) {
    router.push('/gallery');
    return null;
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setMagicLinkLoading(true);
    setError(null);

    const { error } = await signInWithMagicLink(email.trim());
    if (error) {
      setError(error);
    } else {
      setMagicLinkSent(true);
    }
    setMagicLinkLoading(false);
  };

  return (
    <div className="bg-grid min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* ASCII Header */}
        <div className="text-center mb-8">
          <pre className="text-hacker-green text-xs font-mono leading-tight inline-block text-left">
{`  ___  ___  ___
 / __|/ _ \\/ __|
 \\__ \\  __/\\__ \\
 |___/\\___||___/ .login`}
          </pre>
          <p className="text-hacker-muted-light text-sm mt-4">
            Connecte-toi pour voter, soumettre des idées et suivre tes projets.
          </p>
        </div>

        <div className="card p-6 space-y-5">
          {/* Terminal prompt */}
          <div className="font-mono text-xs text-hacker-green">
            <span className="text-hacker-muted">$</span> auth --method=
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              onClick={signInWithGithub}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded border border-hacker-border bg-hacker-terminal hover:border-hacker-green/50 hover:bg-hacker-green/5 transition-all text-sm font-medium text-white group"
            >
              <Github className="w-5 h-5 text-hacker-muted-light group-hover:text-white transition-colors" />
              Continuer avec GitHub
            </button>

            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded border border-hacker-border bg-hacker-terminal hover:border-hacker-cyan/50 hover:bg-hacker-cyan/5 transition-all text-sm font-medium text-white group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuer avec Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-hacker-border" />
            <span className="text-xs text-hacker-muted font-mono">ou</span>
            <div className="flex-1 border-t border-hacker-border" />
          </div>

          {/* Magic Link */}
          {magicLinkSent ? (
            <div className="text-center py-4">
              <Mail className="w-8 h-8 text-hacker-green mx-auto mb-3" />
              <p className="text-sm text-hacker-green font-mono mb-1">Lien envoyé !</p>
              <p className="text-xs text-hacker-muted-light">
                Vérifie ta boîte mail <span className="text-white">{email}</span>
              </p>
              <button
                onClick={() => { setMagicLinkSent(false); setEmail(''); }}
                className="text-xs text-hacker-muted hover:text-hacker-green mt-3 font-mono"
              >
                ← Utiliser un autre email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <label className="text-xs text-hacker-muted font-mono block mb-1.5">
                  email (magic link)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  className="w-full px-3 py-2.5 bg-hacker-terminal border border-hacker-border rounded text-sm text-white placeholder-hacker-muted font-mono focus:border-hacker-green/50 focus:outline-none focus:ring-1 focus:ring-hacker-green/20 transition-all"
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-hacker-red font-mono">{error}</p>
              )}
              <button
                type="submit"
                disabled={magicLinkLoading}
                className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
              >
                {magicLinkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Recevoir un lien de connexion
              </button>
            </form>
          )}

          {/* Info */}
          <p className="text-[11px] text-hacker-muted text-center font-mono leading-relaxed">
            Pas de mot de passe. Pas de spam. Juste un accès à la plateforme.
          </p>
        </div>

        {/* Back */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-hacker-muted hover:text-hacker-green font-mono inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
