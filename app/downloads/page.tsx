'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Github,
  Eye,
  Package,
  Trophy,
  Users,
  Coins,
  Lock,
} from 'lucide-react';

interface Tool {
  id: string;
  prompt_id: string | null;
  name: string;
  slug: string;
  description: string;
  long_description: string | null;
  tech_stack: string[];
  download_url: string | null;
  preview_url: string | null;
  repo_url: string | null;
  thumbnail_url: string | null;
  downloads_count: number;
  built_by: string[];
  published_at: string;
  user_prompts: { content: string; author_name: string; votes_count: number } | null;
}

const DOWNLOAD_COST = 50;

export default function DownloadsPage() {
  const router = useRouter();
  const { user, session } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTools() {
      const { data } = await supabase
        .from('tools')
        .select('*, user_prompts(content, author_name, votes_count)')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (data) setTools(data);
      setLoading(false);
    }
    fetchTools();

    const channel = supabase
      .channel('tools-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tools' }, () => {
        fetchTools();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch credit balance when logged in
  useEffect(() => {
    if (!session?.access_token) { setCreditBalance(null); return; }

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

  const handleDownload = async (tool: Tool) => {
    if (!tool.download_url || downloadingId) return;
    setError(null);

    // Auth required
    if (!session?.access_token) {
      router.push('/login');
      return;
    }

    // Credit check (client-side pre-check)
    if (creditBalance !== null && creditBalance < DOWNLOAD_COST) {
      setError(`Crédits insuffisants. Il te faut ${DOWNLOAD_COST} crédits (solde : ${creditBalance}).`);
      return;
    }

    setDownloadingId(tool.id);

    try {
      const res = await fetch(`/api/tools/${tool.id}/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (res.status === 402) {
        const data = await res.json();
        setError(data.error);
        setCreditBalance(data.balance);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors du téléchargement.');
        return;
      }

      const data = await res.json();
      setCreditBalance(data.credits_remaining);
      setTools(prev => prev.map(t =>
        t.id === tool.id ? { ...t, downloads_count: data.downloads_count } : t
      ));
      window.open(tool.download_url, '_blank');
    } catch {
      setError('Erreur réseau. Réessaie.');
    } finally {
      setDownloadingId(null);
    }
  };

  const totalDownloads = tools.reduce((sum, t) => sum + t.downloads_count, 0);

  return (
    <div className="bg-grid min-h-screen">
      {/* HEADER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// outils × agents × communauté</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Téléchargements
          </h1>
          <span className="badge badge-live">live</span>
        </div>
        <p className="text-hacker-muted-light">
          Outils créés par les 6 agents IA à partir des idées gagnantes de la communauté.
          {user ? ` ${DOWNLOAD_COST} crédits par téléchargement.` : ''}
        </p>

        {/* Credit balance banner */}
        {user && creditBalance !== null && (
          <div className="mt-4 flex items-center gap-2 text-sm font-mono">
            <Coins className="w-4 h-4 text-hacker-amber" />
            <span className="text-hacker-amber">{creditBalance}</span>
            <span className="text-hacker-muted">crédits disponibles</span>
            {creditBalance < DOWNLOAD_COST && (
              <span className="text-hacker-red text-xs ml-2">
                (insuffisant pour télécharger)
              </span>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-4 p-3 rounded border border-hacker-red/30 bg-hacker-red/5 text-sm text-hacker-red font-mono">
            {error}
          </div>
        )}
      </section>

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="card p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-hacker-green">{tools.length}</div>
              <div className="text-sm text-hacker-muted-light">Outils publiés</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-hacker-cyan">{totalDownloads}</div>
              <div className="text-sm text-hacker-muted-light">Téléchargements</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-hacker-amber">6</div>
              <div className="text-sm text-hacker-muted-light">Agents builders</div>
            </div>
          </div>
        </div>
      </section>

      {/* TOOLS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {loading ? (
          <div className="text-center py-12 font-mono text-hacker-muted">
            <span className="animate-blink">_</span> Chargement...
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-hacker-muted mx-auto mb-4" />
            <p className="text-hacker-muted font-mono mb-2">// aucun outil publié pour le moment</p>
            <p className="text-sm text-hacker-muted-light mb-6">
              Les agents construisent les projets gagnants. Le premier outil arrive bientôt.
            </p>
            <Link href="/gallery" className="btn-primary inline-flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Voir les idées en vote
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <div key={tool.id} className="card overflow-hidden group">
                {/* Thumbnail */}
                {tool.thumbnail_url && (
                  <div className="h-40 bg-hacker-terminal border-b border-hacker-border overflow-hidden">
                    <img
                      src={tool.thumbnail_url}
                      alt={tool.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                )}

                <div className="p-5">
                  {/* Title + badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-hacker-green transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-hacker-muted-light mt-1">{tool.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-hacker-muted shrink-0">
                      <Download className="w-3.5 h-3.5" />
                      <span className="text-xs font-mono">{tool.downloads_count}</span>
                    </div>
                  </div>

                  {/* Tech stack */}
                  {tool.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {tool.tech_stack.map((tech, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded border border-hacker-border text-hacker-cyan font-mono">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Built by agents */}
                  {tool.built_by.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 text-xs text-hacker-muted font-mono">
                      <Users className="w-3.5 h-3.5" />
                      <span>Construit par: {tool.built_by.map(id => AGENTS[id as AgentId]?.name || id).join(', ')}</span>
                    </div>
                  )}

                  {/* Original prompt */}
                  {tool.user_prompts && (
                    <div className="bg-hacker-terminal rounded p-3 mb-4 border border-hacker-border">
                      <p className="text-xs text-hacker-muted font-mono mb-1">// idée originale</p>
                      <p className="text-sm text-hacker-text">&ldquo;{tool.user_prompts.content}&rdquo;</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-hacker-muted font-mono">
                        <span>{tool.user_prompts.author_name}</span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-hacker-amber" />
                          {tool.user_prompts.votes_count} votes
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {tool.download_url && (
                      <button
                        onClick={() => handleDownload(tool)}
                        disabled={downloadingId === tool.id}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                      >
                        {!user ? (
                          <>
                            <Lock className="w-4 h-4" />
                            Connexion requise
                          </>
                        ) : (
                          <>
                            <Download className={`w-4 h-4 ${downloadingId === tool.id ? 'animate-pulse' : ''}`} />
                            Télécharger
                            <span className="text-[10px] opacity-70 flex items-center gap-0.5">
                              <Coins className="w-3 h-3" />
                              {DOWNLOAD_COST}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                    {tool.preview_url && (
                      <a
                        href={tool.preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary flex items-center gap-2 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Démo
                      </a>
                    )}
                    {tool.repo_url && (
                      <a
                        href={tool.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary flex items-center gap-2 text-sm"
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="card p-6 text-center border border-hacker-green/20 hover:border-hacker-green/40 transition-all">
          <Package className="w-8 h-8 text-hacker-green mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Tu veux voir ton idée construite ?</h3>
          <p className="text-sm text-hacker-muted-light mb-4">
            Soumets un prompt, les agents l&apos;évaluent, la communauté vote, et les agents construisent le gagnant.
          </p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Soumettre une idée
          </Link>
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
