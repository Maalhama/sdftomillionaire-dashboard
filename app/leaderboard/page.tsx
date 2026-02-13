'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Shield,
  Hash,
  Cpu,
  Braces,
  ChevronUp,
  Zap,
} from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  prompts_count: number;
  votes_count: number;
  downloads_count: number;
  created_at: string;
}

type Tab = 'global' | 'submissions' | 'votes';

const TABS: { value: Tab; label: string; icon: typeof Zap }[] = [
  { value: 'global', label: 'Global', icon: Zap },
  { value: 'submissions', label: 'Soumissions', icon: Braces },
  { value: 'votes', label: 'Votes', icon: ChevronUp },
];

function getRankIcon(rank: number) {
  if (rank === 1) return <Cpu className="w-5 h-5 text-hacker-amber" />;
  if (rank === 2) return <Shield className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Shield className="w-5 h-5 text-amber-700" />;
  return <span className="w-5 text-center text-xs text-hacker-muted font-mono">{rank}</span>;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('global');

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, prompts_count, votes_count, downloads_count, created_at')
        .or('prompts_count.gt.0,votes_count.gt.0')
        .limit(50);

      if (data) setEntries(data);
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  const sorted = [...entries].sort((a, b) => {
    switch (tab) {
      case 'submissions':
        return b.prompts_count - a.prompts_count;
      case 'votes':
        return b.votes_count - a.votes_count;
      default:
        // Global: weighted score
        return (b.prompts_count * 3 + b.votes_count + b.downloads_count * 2) -
               (a.prompts_count * 3 + a.votes_count + a.downloads_count * 2);
    }
  });

  const getScore = (entry: LeaderboardEntry) => {
    switch (tab) {
      case 'submissions': return entry.prompts_count;
      case 'votes': return entry.votes_count;
      default: return entry.prompts_count * 3 + entry.votes_count + entry.downloads_count * 2;
    }
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    return entry.display_name || entry.username || 'Anonyme';
  };

  return (
    <div className="bg-grid min-h-screen">
      {/* HEADER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// les plus actifs de la communauté</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Top Contributeurs
          </h1>
          <Hash className="w-8 h-8 text-hacker-amber" />
        </div>
        <p className="text-hacker-muted-light">
          Les 50 membres les plus actifs. Soumets des idées et vote pour monter dans le classement.
        </p>
      </section>

      {/* TABS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex items-center gap-1 font-mono text-sm">
          <span className="text-hacker-green mr-2">$ sort --by=</span>
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all ${
                  tab === t.value
                    ? 'bg-hacker-green/10 text-hacker-green border border-hacker-green/30'
                    : 'text-hacker-muted-light border border-transparent hover:text-hacker-text hover:border-hacker-border'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* LEADERBOARD TABLE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {loading ? (
          <div className="text-center py-12 font-mono text-hacker-muted">
            <span className="animate-blink">_</span> Chargement...
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Hash className="w-12 h-12 text-hacker-muted mx-auto mb-4" />
            <p className="text-hacker-muted font-mono">// aucun contributeur pour le moment</p>
            <p className="text-sm text-hacker-muted-light mt-2 mb-6">
              Soumets une idée ou vote pour apparaître ici.
            </p>
            <Link href="/gallery" className="btn-primary inline-flex items-center gap-2">
              <Braces className="w-4 h-4" />
              Voir les idées
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[40px_1fr_80px_80px_80px_80px] gap-2 px-4 py-3 border-b border-hacker-border text-[11px] text-hacker-muted uppercase tracking-wider font-mono">
              <div>#</div>
              <div>Contributeur</div>
              <div className="text-right">Idées</div>
              <div className="text-right">Votes</div>
              <div className="text-right">DL</div>
              <div className="text-right">Score</div>
            </div>

            {/* Rows */}
            {sorted.map((entry, i) => {
              const rank = i + 1;
              const isTop3 = rank <= 3;

              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-[40px_1fr_80px_80px_80px_80px] gap-2 px-4 py-3 items-center transition-colors ${
                    isTop3
                      ? 'bg-hacker-green/5 border-b border-hacker-border'
                      : 'border-b border-hacker-border/50 hover:bg-hacker-card-hover'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {getRankIcon(rank)}
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-6 h-6 rounded-full border border-hacker-border shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-hacker-green/10 border border-hacker-green/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-hacker-green font-bold">
                          {getDisplayName(entry)[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className={`text-sm font-mono truncate ${isTop3 ? 'text-white font-bold' : 'text-hacker-text'}`}>
                      {getDisplayName(entry)}
                    </span>
                  </div>

                  <div className="text-right text-sm font-mono text-hacker-cyan">
                    {entry.prompts_count}
                  </div>
                  <div className="text-right text-sm font-mono text-hacker-green">
                    {entry.votes_count}
                  </div>
                  <div className="text-right text-sm font-mono text-hacker-amber">
                    {entry.downloads_count}
                  </div>
                  <div className={`text-right text-sm font-mono font-bold ${isTop3 ? 'text-hacker-green' : 'text-hacker-muted-light'}`}>
                    {getScore(entry)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
