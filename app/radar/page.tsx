'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ThumbsUp, Copy, ExternalLink, ArrowLeft, Rocket, Eye, FlaskConical, Package, Terminal, DollarSign, TrendingUp, ArrowRight, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { supabase, AGENTS } from '@/lib/supabase';

interface RevenueEntry {
  id: string;
  amount: number;
  currency: string;
  source: string;
  description: string;
  attributed_agent: string;
  created_at: string;
}

interface UserPrompt {
  id: string;
  content: string;
  author_name: string;
  status: string;
  votes_count: number;
  ai_plan: {
    verdict?: string;
    feasibility_score?: number;
    estimated_revenue_potential?: string;
  } | null;
  created_at: string;
}

interface AgentEvent {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  summary: string;
  created_at: string;
}

const sourceColors: Record<string, string> = {
  polymarket: '#f59e0b',
  freelance: '#8b5cf6',
  saas: '#22c55e',
  content: '#ec4899',
  other: '#3b82f6',
};

const successStories = [
  {
    title: 'Bot Polymarket Sniper',
    description: 'Trading automatisé sur les marchés BTC 15-min avec Golden Strategy v5',
    status: 'LIVE',
    url: '#',
    cloneUrl: '#'
  },
  {
    title: 'Dashboard SDFtoMillionaire',
    description: 'Dashboard public montrant les activités des agents en temps réel',
    status: 'LIVE',
    url: '#',
    cloneUrl: '#'
  },
  {
    title: 'Tracker de Revenus',
    description: "Suivi de la progression vers l'objectif 5k\u20AC/mois avec attribution par agent",
    status: 'LIVE',
    url: '#',
    cloneUrl: '#'
  }
];

const agentDisplayNames: Record<string, { name: string; avatar: string }> = {
  opus: { name: 'CEO', avatar: '/agents/opus.png' },
  brain: { name: 'KIRA', avatar: '/agents/brain.png' },
  growth: { name: 'MADARA', avatar: '/agents/growth.png' },
  creator: { name: 'STARK', avatar: '/agents/creator.jpg' },
  'twitter-alt': { name: 'L', avatar: '/agents/twitter-alt.png' },
  'company-observer': { name: 'USOPP', avatar: '/agents/company-observer.jpg' },
  system: { name: 'SYSTEM', avatar: '/agents/opus.png' },
};

function AsciiProgressBar({ progress, width = 20 }: { progress: number; width?: number }) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return (
    <span className="text-xs font-mono">
      <span className="text-hacker-green">{'█'.repeat(filled)}</span>
      <span className="text-hacker-muted">{'░'.repeat(empty)}</span>
      <span className="text-hacker-muted-light ml-2">{progress}%</span>
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function RadarPage() {
  const [filter, setFilter] = useState('all');
  const [ideas, setIdeas] = useState<UserPrompt[]>([]);
  const [activity, setActivity] = useState<AgentEvent[]>([]);
  const [revenue, setRevenue] = useState<RevenueEntry[]>([]);
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [pipelineCounts, setPipelineCounts] = useState({ pending: 0, evaluating: 0, evaluated: 0, shipped: 3 });

  useEffect(() => {
    async function fetchAll() {
      // Fetch user prompts (live ideas)
      const { data: prompts } = await supabase
        .from('user_prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (prompts) {
        setIdeas(prompts);
        setPipelineCounts({
          pending: prompts.filter(p => p.status === 'pending').length,
          evaluating: prompts.filter(p => p.status === 'evaluating').length,
          evaluated: prompts.filter(p => p.status === 'evaluated').length,
          shipped: 3,
        });
      }

      // Fetch recent agent events for activity feed
      const { data: events } = await supabase
        .from('ops_agent_events')
        .select('id, agent_id, kind, title, summary, created_at')
        .order('created_at', { ascending: false })
        .limit(8);
      if (events) setActivity(events);

      // Fetch revenue
      const { data: rev } = await supabase
        .from('ops_revenue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (rev) {
        setRevenue(rev);
        setRevenueTotal(rev.reduce((sum, r) => sum + Number(r.amount), 0));
      }
    }
    fetchAll();

    // Realtime for revenue + prompts
    const channel = supabase
      .channel('radar-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_revenue' }, (payload) => {
        setRevenue(prev => [payload.new as RevenueEntry, ...prev.slice(0, 19)]);
        setRevenueTotal(prev => prev + Number((payload.new as RevenueEntry).amount));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_prompts' }, () => {
        // Refetch on any change
        supabase.from('user_prompts').select('*').order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => {
            if (data) {
              setIdeas(data);
              setPipelineCounts({
                pending: data.filter(p => p.status === 'pending').length,
                evaluating: data.filter(p => p.status === 'evaluating').length,
                evaluated: data.filter(p => p.status === 'evaluated').length,
                shipped: 3,
              });
            }
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Map prompt status to radar status
  const getRadarStatus = (status: string, verdict?: string) => {
    if (status === 'pending') return 'watching';
    if (status === 'evaluating') return 'validating';
    if (status === 'evaluated' && verdict === 'promising') return 'building';
    if (status === 'evaluated') return 'validating';
    return 'watching';
  };

  const getProgress = (status: string, score?: number) => {
    if (status === 'pending') return 10;
    if (status === 'evaluating') return 40;
    if (status === 'evaluated') return score ? Math.min(score, 100) : 60;
    return 5;
  };

  const filteredIdeas = ideas.filter(idea => {
    if (filter === 'all') return true;
    return getRadarStatus(idea.status, idea.ai_plan?.verdict) === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'building': return 'badge badge-live';
      case 'validating': return 'badge badge-amber';
      case 'watching': return 'badge badge-muted';
      case 'shipped': return 'badge badge-cyan';
      default: return 'badge badge-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'building': return 'PROMISING';
      case 'validating': return 'EVALUATING';
      case 'watching': return 'PENDING';
      case 'shipped': return 'SHIPPED';
      default: return status.toUpperCase();
    }
  };

  const pipelineStats = [
    { label: 'En attente', count: pipelineCounts.pending, sub: 'Idées soumises', icon: Eye },
    { label: 'Évaluation', count: pipelineCounts.evaluating, sub: 'Analyse IA', icon: FlaskConical },
    { label: 'Prometteuses', count: pipelineCounts.evaluated, sub: 'Plan généré', icon: Rocket },
    { label: 'Livré', count: pipelineCounts.shipped, sub: 'Produits live', icon: Package },
  ];

  const statColors = [
    'text-hacker-muted-light',
    'text-hacker-amber text-glow-amber',
    'text-hacker-cyan text-glow-cyan',
    'text-hacker-green text-glow',
  ];

  const filters = [
    { value: 'all', label: `all (${ideas.length})` },
    { value: 'watching', label: `pending (${pipelineCounts.pending})` },
    { value: 'validating', label: `evaluating (${pipelineCounts.evaluating})` },
    { value: 'building', label: `promising (${pipelineCounts.evaluated})` },
  ];

  return (
    <div className="bg-grid min-h-screen">
      {/* ═══ HEADER ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// demand radar</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Radar de Demande
          </h1>
          <span className="badge badge-live">live</span>
        </div>
        <p className="text-hacker-muted-light">
          Idées soumises par la communauté, évaluées par nos agents IA.{' '}
          <Link href="/gallery" className="text-hacker-cyan hover:text-hacker-green transition-colors">
            Voir les plans détaillés →
          </Link>
        </p>
      </section>

      {/* ═══ PIPELINE STATS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="card p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {pipelineStats.map((stat, i) => (
              <div key={i} className="text-center">
                <stat.icon className={`w-5 h-5 mx-auto mb-2 ${statColors[i]}`} />
                <div className={`text-3xl font-bold ${statColors[i]}`}>{stat.count}</div>
                <div className="text-sm text-hacker-text font-medium mt-1">{stat.label}</div>
                <div className="text-xs text-hacker-muted">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* ASCII Pipeline */}
          <div className="text-center font-mono text-sm py-4 border-t border-hacker-border overflow-x-auto whitespace-nowrap">
            <span className="text-hacker-muted-light">[</span>
            <span className="text-hacker-muted-light">PENDING</span>
            <span className="text-hacker-muted-light">]</span>
            <span className="text-hacker-muted"> ━━━━ </span>
            <span className="text-hacker-amber">[</span>
            <span className="text-hacker-amber">EVAL</span>
            <span className="text-hacker-amber">]</span>
            <span className="text-hacker-muted"> ━━━━ </span>
            <span className="text-hacker-cyan">[</span>
            <span className="text-hacker-cyan">PLAN</span>
            <span className="text-hacker-cyan">]</span>
            <span className="text-hacker-muted"> ━━━━ </span>
            <span className="text-hacker-green">[</span>
            <span className="text-hacker-green">SHIP</span>
            <span className="text-hacker-green">]</span>
            <span className="text-hacker-green"> ✓</span>
          </div>
          <p className="text-center text-xs text-hacker-muted mt-2">
            Les idées avancent de gauche à droite →
          </p>
        </div>
      </section>

      {/* ═══ SUCCESS STORIES ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-hacker-green" />
            <h2 className="text-xl font-bold text-white">Succès</h2>
          </div>
          <span className="text-sm text-hacker-muted-light">{successStories.length} déployés</span>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {successStories.map((story, i) => (
            <div key={i} className="card-terminal p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="badge badge-live">{story.status}</span>
              </div>
              <h3 className="text-white font-semibold mb-2">{story.title}</h3>
              <p className="text-sm text-hacker-muted-light mb-4">{story.description}</p>
              <div className="flex items-center gap-4">
                <a href={story.url} className="flex items-center gap-1.5 text-sm text-hacker-cyan hover:text-glow-cyan transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> Visiter
                </a>
                <a href={story.cloneUrl} className="flex items-center gap-1.5 text-sm text-hacker-muted-light hover:text-hacker-text transition-colors">
                  <Copy className="w-3.5 h-3.5" /> Cloner
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FILTER TABS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex items-center gap-1 font-mono text-sm">
          <span className="text-hacker-green mr-2">$ filter --status=</span>
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                filter === f.value
                  ? 'bg-hacker-green/10 text-hacker-green border border-hacker-green/30'
                  : 'text-hacker-muted-light border border-transparent hover:text-hacker-text hover:border-hacker-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ IDEAS PIPELINE (LIVE) ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-hacker-amber" />
            <h2 className="text-xl font-bold text-white">Pipeline d&apos;Idées</h2>
            <span className="badge badge-live text-[10px]">live</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-hacker-muted-light">{filteredIdeas.length} total</span>
            <Link href="/gallery" className="text-xs text-hacker-cyan hover:text-hacker-green transition-colors flex items-center gap-1">
              plans détaillés <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {filteredIdeas.length === 0 ? (
          <div className="card p-8 text-center">
            <Lightbulb className="w-8 h-8 text-hacker-muted mx-auto mb-3" />
            <p className="text-hacker-muted font-mono text-sm">// aucune idée dans ce filtre</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIdeas.map((idea) => {
              const radarStatus = getRadarStatus(idea.status, idea.ai_plan?.verdict);
              const progress = getProgress(idea.status, idea.ai_plan?.feasibility_score);

              return (
                <Link key={idea.id} href="/gallery" className="card p-5 relative group hover:border-hacker-green/20 transition-all">
                  {idea.ai_plan?.verdict && (
                    <div className="absolute top-3 right-3">
                      <span className="text-xs text-hacker-amber border border-hacker-amber/30 bg-hacker-amber/10 px-2 py-0.5 rounded font-mono">
                        {idea.ai_plan.verdict.toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <span className={getStatusBadge(radarStatus)}>
                      {getStatusLabel(radarStatus)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <AsciiProgressBar progress={progress} />
                  </div>

                  <p className="text-white text-sm mb-2 line-clamp-2">&ldquo;{idea.content}&rdquo;</p>

                  <div className="flex items-center gap-2 mb-3 text-xs text-hacker-muted-light font-mono">
                    <span className="text-hacker-cyan">par.</span>
                    <span>{idea.author_name || 'Anonyme'}</span>
                    <span className="text-hacker-muted">// {timeAgo(idea.created_at)}</span>
                  </div>

                  {idea.ai_plan?.estimated_revenue_potential && (
                    <div className="text-xs text-hacker-green font-mono mb-3">
                      💰 {idea.ai_plan.estimated_revenue_potential}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono btn-secondary !py-1.5 !px-3 !text-xs">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {idea.votes_count || 0}
                    </span>
                    {idea.ai_plan && (
                      <span className="text-xs text-hacker-muted-light font-mono">
                        score: {idea.ai_plan.feasibility_score || '?'}/100
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ RADAR ACTIVITY (LIVE) ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <Terminal className="w-5 h-5 text-hacker-green" />
          <h2 className="text-xl font-bold text-white">Activité Radar</h2>
          <span className="badge badge-live text-[10px]">live</span>
        </div>

        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="text-xs text-hacker-muted-light ml-2 font-mono">ops_events.log</span>
          </div>
          <div className="terminal-body space-y-3">
            {activity.length === 0 ? (
              <p className="text-hacker-muted text-sm font-mono text-center py-4">
                // en attente d&apos;activité...
              </p>
            ) : (
              activity.map((event) => {
                const agent = agentDisplayNames[event.agent_id] || agentDisplayNames.system;
                return (
                  <div key={event.id} className="flex items-start gap-3 font-mono text-sm">
                    <span className="text-hacker-muted text-xs whitespace-nowrap">{timeAgo(event.created_at)}</span>
                    <span className="text-hacker-green">$</span>
                    <Image src={agent.avatar} alt={agent.name} width={20} height={20} className="w-5 h-5 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-hacker-cyan">{agent.name}</span>
                      <span className="text-hacker-muted"> : </span>
                      <span className="text-hacker-text truncate">{event.title || event.summary}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div className="flex items-center gap-2 text-sm font-mono mt-2">
              <span className="text-hacker-green">$</span>
              <span className="text-hacker-muted cursor-blink">_</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ REVENUE TRACKER ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-hacker-green" />
            <h2 className="text-xl font-bold text-white">Revenus</h2>
            <span className="badge badge-live">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-hacker-green" />
            <span className="text-lg font-bold text-hacker-green font-mono">
              {revenueTotal.toFixed(2)}€
            </span>
          </div>
        </div>

        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="text-xs text-hacker-muted-light ml-2 font-mono">ops_revenue.log</span>
          </div>
          <div className="terminal-body space-y-2">
            {revenue.length === 0 ? (
              <p className="text-hacker-muted text-sm font-mono text-center py-6">
                // aucun revenu enregistré
              </p>
            ) : (
              revenue.map((r) => {
                const agentInfo = r.attributed_agent ? AGENTS[r.attributed_agent as keyof typeof AGENTS] : null;
                const srcColor = sourceColors[r.source] || '#888';
                return (
                  <div key={r.id} className="flex items-center gap-3 font-mono text-sm">
                    <span className="text-hacker-muted text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className="text-hacker-green font-bold whitespace-nowrap">
                      +{Number(r.amount).toFixed(2)}€
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                      style={{ color: srcColor, borderColor: `${srcColor}40`, backgroundColor: `${srcColor}10` }}
                    >
                      {r.source}
                    </span>
                    {agentInfo && (
                      <Image src={agentInfo.avatar} alt={agentInfo.name} width={16} height={16} className="w-4 h-4 rounded-full object-cover" />
                    )}
                    <span className="text-hacker-text text-xs truncate flex-1">{r.description}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ═══ BACK ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Link href="/" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
      </section>
    </div>
  );
}
