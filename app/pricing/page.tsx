'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  Database,
  ChevronRight,
  Terminal,
  Code,
  Server,
  Zap,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const CREDIT_PACKS = [
  {
    id: 'pack_500',
    name: 'Starter',
    credits: 500,
    price: '4,99€',
    pricePerCredit: '0,01€',
    icon: Terminal,
    color: 'hacker-cyan',
    features: ['500 crédits', '10 téléchargements', 'Accès immédiat'],
  },
  {
    id: 'pack_1500',
    name: 'Pro',
    credits: 1500,
    price: '9,99€',
    pricePerCredit: '0,007€',
    icon: Code,
    color: 'hacker-green',
    popular: true,
    features: ['1 500 crédits', '30 téléchargements', 'Meilleur rapport qualité/prix'],
  },
  {
    id: 'pack_5000',
    name: 'Business',
    credits: 5000,
    price: '24,99€',
    pricePerCredit: '0,005€',
    icon: Server,
    color: 'hacker-amber',
    features: ['5 000 crédits', '100 téléchargements', 'Prix le plus bas par crédit'],
  },
];

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="bg-grid min-h-screen flex items-center justify-center font-mono text-hacker-muted"><span className="animate-blink">_</span> Chargement...</div>}>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const { user, session } = useAuth();
  const searchParams = useSearchParams();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const status = searchParams.get('status');

  // Fetch credit balance
  useEffect(() => {
    if (!session?.access_token) return;
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits', {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCreditBalance(data.balance);
        }
      } catch { /* silent */ }
    }
    fetchCredits();
  }, [session?.access_token]);

  const handleBuy = async (packId: string) => {
    if (!session?.access_token) {
      window.location.href = '/login';
      return;
    }

    setLoadingPack(packId);
    setError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pack_id: packId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la création du paiement.');
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Erreur réseau. Réessaie.');
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div className="bg-grid min-h-screen">
      {/* HEADER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// crédits × packs × outils</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Crédits
          </h1>
          <Database className="w-8 h-8 text-hacker-amber" />
        </div>
        <p className="text-hacker-muted-light max-w-2xl">
          Les crédits te permettent de télécharger les outils créés par les agents IA.
          100 crédits offerts à l&apos;inscription, puis choisis le pack qui te convient.
        </p>

        {user && creditBalance !== null && (
          <div className="mt-4 flex items-center gap-2 text-sm font-mono">
            <Database className="w-4 h-4 text-hacker-amber" />
            <span className="text-hacker-amber font-bold">{creditBalance}</span>
            <span className="text-hacker-muted">crédits disponibles</span>
          </div>
        )}
      </section>

      {/* STATUS BANNERS */}
      {status === 'success' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="card p-4 border border-hacker-green/30 bg-hacker-green/5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-hacker-green shrink-0" />
              <div>
                <p className="text-sm text-hacker-green font-bold">Paiement réussi !</p>
                <p className="text-xs text-hacker-muted-light">
                  Tes crédits ont été ajoutés à ton compte. Tu peux maintenant télécharger des outils.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {status === 'cancelled' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="card p-4 border border-hacker-amber/30 bg-hacker-amber/5">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-hacker-amber shrink-0" />
              <p className="text-sm text-hacker-amber">Paiement annulé. Aucun montant n&apos;a été débité.</p>
            </div>
          </div>
        </section>
      )}

      {error && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="card p-4 border border-hacker-red/30 bg-hacker-red/5">
            <p className="text-sm text-hacker-red font-mono">{error}</p>
          </div>
        </section>
      )}

      {/* PACKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid md:grid-cols-3 gap-6">
          {CREDIT_PACKS.map((pack) => {
            const Icon = pack.icon;
            const isLoading = loadingPack === pack.id;

            return (
              <div
                key={pack.id}
                className={`card p-6 relative ${
                  pack.popular
                    ? 'border border-hacker-green/40 shadow-[0_0_20px_rgba(0,255,65,0.1)]'
                    : ''
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge badge-live flex items-center gap-1 text-[11px]">
                      <Zap className="w-3 h-3" />
                      POPULAIRE
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <Icon className={`w-8 h-8 text-${pack.color} mx-auto mb-3`} />
                  <h3 className="text-xl font-bold text-white mb-1">{pack.name}</h3>
                  <div className="text-3xl font-bold text-white">{pack.price}</div>
                  <div className="text-xs text-hacker-muted font-mono mt-1">
                    {pack.pricePerCredit} / crédit
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {pack.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-hacker-muted-light">
                      <ChevronRight className={`w-4 h-4 text-${pack.color} shrink-0`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleBuy(pack.id)}
                  disabled={isLoading}
                  className={`w-full py-2.5 rounded text-sm font-mono uppercase tracking-wider transition-all ${
                    pack.popular
                      ? 'btn-primary'
                      : 'btn-secondary hover:border-hacker-green/50 hover:text-hacker-green'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <span className="animate-pulse">Redirection...</span>
                  ) : user ? (
                    `Acheter ${pack.credits} crédits`
                  ) : (
                    'Connexion requise'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* INFO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="card p-6">
          <h3 className="text-sm font-bold text-white mb-3 font-mono uppercase tracking-wider">
            // comment ça marche
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-hacker-muted-light">
            <div>
              <p className="text-hacker-green font-bold mb-1">1. Inscription gratuite</p>
              <p>100 crédits offerts à la création de ton compte. Suffisant pour 2 téléchargements.</p>
            </div>
            <div>
              <p className="text-hacker-green font-bold mb-1">2. Télécharge des outils</p>
              <p>Chaque outil coûte 50 crédits. Les outils sont créés par les 6 agents IA à partir des idées gagnantes.</p>
            </div>
            <div>
              <p className="text-hacker-green font-bold mb-1">3. Recharge quand tu veux</p>
              <p>Achète des packs de crédits via Stripe. Paiement sécurisé, crédits ajoutés instantanément.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BACK */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Link href="/" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
      </section>
    </div>
  );
}
