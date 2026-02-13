'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  Braces,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Heart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Crosshair,
  CircuitBoard,
  Timer,
  Users,
  Shield,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import PromptComments from '@/components/PromptComments';

interface AiPlan {
  feasibility_score: number;
  summary: string;
  verdict: 'promising' | 'risky' | 'needs_work' | 'rejected';
  steps: { order: number; title: string; description: string; effort: string; duration_days: number }[];
  risks: { severity: string; description: string; mitigation: string }[];
  estimated_revenue_potential: string;
  required_skills: string[];
  required_investment: string;
  time_to_first_revenue: string;
  agents_recommendation: string;
}

interface UserPrompt {
  id: string;
  content: string;
  author_name: string;
  status: string;
  votes_count: number;
  comments_count: number;
  ai_plan: AiPlan | null;
  created_at: string;
  evaluated_at: string | null;
  voting_deadline: string | null;
}

const verdictConfig: Record<string, { label: string; color: string; badge: string; icon: typeof CheckCircle }> = {
  promising: { label: 'PROMISING', color: 'text-hacker-green', badge: 'badge badge-live', icon: CheckCircle },
  risky: { label: 'RISKY', color: 'text-hacker-amber', badge: 'badge badge-amber', icon: AlertTriangle },
  needs_work: { label: 'NEEDS WORK', color: 'text-hacker-amber', badge: 'badge badge-amber', icon: AlertTriangle },
  rejected: { label: 'REJECTED', color: 'text-hacker-red', badge: 'badge badge-muted', icon: XCircle },
};

const statusConfig: Record<string, { label: string; badge: string }> = {
  pending: { label: 'EN ATTENTE', badge: 'badge badge-muted' },
  evaluating: { label: 'ANALYSE...', badge: 'badge badge-amber' },
  evaluated: { label: 'VOTE OUVERT', badge: 'badge badge-live' },
  winner: { label: 'GAGNANT', badge: 'badge badge-live' },
  building: { label: 'EN CONSTRUCTION', badge: 'badge badge-amber' },
  closed: { label: 'CLOS', badge: 'badge badge-muted' },
};

const effortBadge: Record<string, string> = {
  low: 'text-hacker-green',
  medium: 'text-hacker-amber',
  high: 'text-hacker-red',
};

function ScoreBar({ score }: { score: number }) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const color = score >= 70 ? 'text-hacker-green' : score >= 40 ? 'text-hacker-amber' : 'text-hacker-red';
  return (
    <span className="font-mono text-xs">
      <span className={color}>{'█'.repeat(filled)}</span>
      <span className="text-hacker-muted">{'░'.repeat(width - filled)}</span>
      <span className={`ml-2 ${color}`}>{score}/100</span>
    </span>
  );
}

function TimeLeft({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Terminé'); return; }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  return <span>{timeLeft}</span>;
}

export default function GalleryPage() {
  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'evaluated' | 'pending' | 'winners'>('all');
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [votingId, setVotingId] = useState<string | null>(null);
  const { session } = useAuth();

  // Charger les votes depuis localStorage au mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sdf_voted_prompts');
      if (stored) setVotedIds(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  const handleVote = useCallback(async (promptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (votingId || votedIds.has(promptId)) return;

    setVotingId(promptId);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/prompts/${promptId}/vote`, { method: 'POST', headers });
      const data = await res.json();

      if (res.ok) {
        // Mise à jour optimiste du compteur
        setPrompts(prev => prev.map(p =>
          p.id === promptId ? { ...p, votes_count: data.votes_count } : p
        ));
        const newVoted = new Set(votedIds).add(promptId);
        setVotedIds(newVoted);
        localStorage.setItem('sdf_voted_prompts', JSON.stringify(Array.from(newVoted)));
      } else if (res.status === 409) {
        // Déjà voté — marquer silencieusement
        const newVoted = new Set(votedIds).add(promptId);
        setVotedIds(newVoted);
        localStorage.setItem('sdf_voted_prompts', JSON.stringify(Array.from(newVoted)));
      }
      // 410 (deadline passée) → le realtime mettra à jour
    } catch { /* erreur réseau — silent fail */ }
    setVotingId(null);
  }, [votingId, votedIds]);

  useEffect(() => {
    async function fetchPrompts() {
      try {
        const { data } = await supabase
          .from('user_prompts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) setPrompts(data);
      } catch (err) {
        console.error('Gallery fetchPrompts error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPrompts();

    // Safety timeout
    const timeout = setTimeout(() => setLoading(false), 8000);

    // Realtime updates
    const channel = supabase
      .channel('prompts-gallery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_prompts' }, () => {
        fetchPrompts();
      })
      .subscribe();

    return () => { clearTimeout(timeout); supabase.removeChannel(channel); };
  }, []);

  const filtered = prompts.filter(p => {
    if (filter === 'evaluated') return p.status === 'evaluated';
    if (filter === 'pending') return p.status === 'pending' || p.status === 'evaluating';
    if (filter === 'winners') return p.status === 'winner' || p.status === 'building';
    return true;
  });

  const evaluatedCount = prompts.filter(p => p.status === 'evaluated').length;
  const pendingCount = prompts.filter(p => p.status === 'pending' || p.status === 'evaluating').length;
  const winnersCount = prompts.filter(p => p.status === 'winner' || p.status === 'building').length;

  const filters = [
    { value: 'all' as const, label: `all (${prompts.length})` },
    { value: 'winners' as const, label: `gagnants (${winnersCount})` },
    { value: 'evaluated' as const, label: `votes (${evaluatedCount})` },
    { value: 'pending' as const, label: `pending (${pendingCount})` },
  ];

  return (
    <div className="bg-grid min-h-screen">
      {/* HEADER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// toutes les idées soumises</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            Galerie des Idées
          </h1>
          <span className="badge badge-live">live</span>
        </div>
        <p className="text-hacker-muted-light">
          Parcourez les idées d&apos;apps, de sites et de business soumises par la communauté.
          Votez pour votre préférée — l&apos;idée la plus populaire sera construite par les agents.
        </p>
      </section>

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="card p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-hacker-green">{prompts.length}</div>
              <div className="text-xs sm:text-sm text-hacker-muted-light">Idées soumises</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-hacker-cyan">{evaluatedCount}</div>
              <div className="text-xs sm:text-sm text-hacker-muted-light">Votes ouverts</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-hacker-amber">{winnersCount}</div>
              <div className="text-xs sm:text-sm text-hacker-muted-light">Gagnants</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-hacker-muted-light">{pendingCount}</div>
              <div className="text-xs sm:text-sm text-hacker-muted-light">En attente</div>
            </div>
          </div>
        </div>
      </section>

      {/* FILTERS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex flex-wrap items-center gap-1 font-mono text-xs sm:text-sm">
          <span className="text-hacker-green mr-2">$ filter --status=</span>
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm transition-all ${
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

      {/* PROMPTS LIST */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {loading ? (
          <div className="text-center py-12 font-mono text-hacker-muted">
            <span className="animate-blink">_</span> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Braces className="w-8 h-8 text-hacker-muted mx-auto mb-3" />
            <p className="text-hacker-muted font-mono">// aucune idée trouvée</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((prompt) => {
              const isExpanded = expandedId === prompt.id;
              const plan = prompt.ai_plan;
              const verdict = plan?.verdict ? verdictConfig[plan.verdict] : null;
              const statusCfg = statusConfig[prompt.status] || statusConfig.pending;

              return (
                <div key={prompt.id} className="card overflow-hidden">
                  {/* Header */}
                  <div
                    className="p-5 cursor-pointer hover:bg-hacker-card-hover transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : prompt.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={statusCfg.badge}>{statusCfg.label}</span>
                          {verdict && (
                            <span className={verdict.badge}>{verdict.label}</span>
                          )}
                          {prompt.voting_deadline && new Date(prompt.voting_deadline) > new Date() && (
                            <span className="flex items-center gap-1 text-xs text-hacker-cyan font-mono">
                              <Clock className="w-3 h-3" />
                              <TimeLeft deadline={prompt.voting_deadline} />
                            </span>
                          )}
                        </div>

                        <p className="text-white text-sm leading-relaxed mb-2">
                          &ldquo;{prompt.content}&rdquo;
                        </p>

                        <div className="flex items-center gap-4 text-xs text-hacker-muted font-mono">
                          <span>
                            <Users className="w-3 h-3 inline mr-1" />
                            {prompt.author_name || 'Anonyme'}
                          </span>
                          <span>
                            {new Date(prompt.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </span>
                          {prompt.comments_count > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {prompt.comments_count}
                            </span>
                          )}
                          {plan?.feasibility_score !== undefined && (
                            <ScoreBar score={plan.feasibility_score} />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {(() => {
                          const isWinner = prompt.status === 'winner' || prompt.status === 'building';
                          const isClosed = prompt.status === 'closed';
                          const deadlinePassed = prompt.voting_deadline ? new Date(prompt.voting_deadline) <= new Date() : false;
                          const hasVoted = votedIds.has(prompt.id);
                          const isVoting = votingId === prompt.id;
                          const canVote = !isClosed && !isWinner && !deadlinePassed && !hasVoted && !isVoting;

                          if (isWinner) {
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1.5 text-hacker-amber">
                                  <Shield className="w-5 h-5" />
                                  {prompt.status === 'building' && <Wrench className="w-4 h-4 animate-pulse" />}
                                </div>
                                <span className="text-sm font-mono font-bold text-hacker-amber">{prompt.votes_count}</span>
                              </div>
                            );
                          }

                          if (isClosed || deadlinePassed) {
                            return (
                              <div className="flex flex-col items-center gap-0.5 text-hacker-muted">
                                <Heart className="w-5 h-5" />
                                <span className="text-xs font-mono">{prompt.votes_count}</span>
                              </div>
                            );
                          }

                          return (
                            <button
                              onClick={(e) => canVote ? handleVote(prompt.id, e) : e.stopPropagation()}
                              disabled={!canVote}
                              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all ${
                                hasVoted
                                  ? 'text-hacker-green bg-hacker-green/10 border border-hacker-green/30 shadow-[0_0_10px_rgba(0,255,65,0.15)]'
                                  : canVote
                                    ? 'text-hacker-muted-light hover:text-hacker-green hover:bg-hacker-green/5 border border-hacker-border hover:border-hacker-green/30 hover:shadow-[0_0_10px_rgba(0,255,65,0.1)]'
                                    : 'text-hacker-muted border border-transparent'
                              }`}
                              title={hasVoted ? 'Déjà voté' : canVote ? 'Voter pour cette idée' : ''}
                            >
                              <Heart className={`w-5 h-5 ${isVoting ? 'animate-pulse' : ''} ${hasVoted ? 'fill-current' : ''}`} />
                              <span className="text-xs font-mono font-bold">{prompt.votes_count}</span>
                            </button>
                          );
                        })()}
                        {isExpanded
                          ? <ChevronUp className="w-5 h-5 text-hacker-muted" />
                          : <ChevronDown className="w-5 h-5 text-hacker-muted" />
                        }
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-hacker-border bg-hacker-terminal">
                      {/* AI Plan (if evaluated) */}
                      {plan && (
                        <>
                          {/* Summary + Key Stats */}
                          <div className="p-5 space-y-4">
                            <p className="text-hacker-text text-sm leading-relaxed">{plan.summary}</p>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <CircuitBoard className="w-3.5 h-3.5 text-hacker-green" />
                                <div>
                                  <div className="text-hacker-muted">Potentiel</div>
                                  <div className="text-hacker-green">{plan.estimated_revenue_potential}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <Timer className="w-3.5 h-3.5 text-hacker-cyan" />
                                <div>
                                  <div className="text-hacker-muted">Premier revenu</div>
                                  <div className="text-hacker-cyan">{plan.time_to_first_revenue}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <Zap className="w-3.5 h-3.5 text-hacker-amber" />
                                <div>
                                  <div className="text-hacker-muted">Investissement</div>
                                  <div className="text-hacker-amber">{plan.required_investment}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <Crosshair className="w-3.5 h-3.5 text-hacker-purple" />
                                <div>
                                  <div className="text-hacker-muted">Score</div>
                                  <div className={verdict?.color || 'text-white'}>{plan.feasibility_score}/100</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Steps */}
                          {plan.steps && plan.steps.length > 0 && (
                            <div className="border-t border-hacker-border p-5">
                              <h4 className="text-xs uppercase tracking-wider text-hacker-green mb-3 font-mono">
                                // étapes du plan
                              </h4>
                              <div className="space-y-2">
                                {plan.steps.map((step, i) => (
                                  <div key={i} className="flex items-start gap-3 text-sm font-mono">
                                    <span className="text-hacker-muted shrink-0">{String(step.order || i + 1).padStart(2, '0')}.</span>
                                    <div className="flex-1">
                                      <span className="text-white">{step.title}</span>
                                      <span className="text-hacker-muted"> — {step.description}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 text-xs">
                                      <span className={effortBadge[step.effort] || 'text-hacker-muted'}>
                                        {step.effort}
                                      </span>
                                      <span className="text-hacker-muted">{step.duration_days}j</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Risks */}
                          {plan.risks && plan.risks.length > 0 && (
                            <div className="border-t border-hacker-border p-5">
                              <h4 className="text-xs uppercase tracking-wider text-hacker-amber mb-3 font-mono">
                                // risques identifiés
                              </h4>
                              <div className="space-y-2">
                                {plan.risks.map((risk, i) => (
                                  <div key={i} className="text-sm font-mono">
                                    <span className={`text-xs mr-2 ${
                                      risk.severity === 'high' ? 'text-hacker-red' : risk.severity === 'medium' ? 'text-hacker-amber' : 'text-hacker-green'
                                    }`}>
                                      [{risk.severity.toUpperCase()}]
                                    </span>
                                    <span className="text-hacker-text">{risk.description}</span>
                                    <div className="ml-4 mt-1 text-xs text-hacker-muted">
                                      mitigation: {risk.mitigation}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Skills + Agent Recommendation */}
                          <div className="border-t border-hacker-border p-5">
                            <div className="grid md:grid-cols-2 gap-4">
                              {plan.required_skills && plan.required_skills.length > 0 && (
                                <div>
                                  <h4 className="text-xs uppercase tracking-wider text-hacker-cyan mb-2 font-mono">
                                    // compétences requises
                                  </h4>
                                  <div className="flex flex-wrap gap-1.5">
                                    {plan.required_skills.map((skill, i) => (
                                      <span key={i} className="text-[11px] px-2 py-0.5 rounded border border-hacker-border text-hacker-muted-light font-mono">
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {plan.agents_recommendation && (
                                <div>
                                  <h4 className="text-xs uppercase tracking-wider text-hacker-purple mb-2 font-mono">
                                    // avis des agents
                                  </h4>
                                  <p className="text-xs text-hacker-muted-light leading-relaxed">
                                    {plan.agents_recommendation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Pending status message */}
                      {!plan && (
                        <div className="p-5 text-center">
                          <p className="text-xs text-hacker-muted font-mono">
                            <span className="text-hacker-green">$</span> en attente d&apos;analyse par les agents<span className="inline-block w-1.5 h-3.5 bg-hacker-green animate-blink ml-0.5" />
                          </p>
                        </div>
                      )}

                      {/* Comments — always visible */}
                      <PromptComments promptId={prompt.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SUBMIT CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="card p-6 text-center border border-hacker-green/20 hover:border-hacker-green/40 transition-all">
          <Braces className="w-8 h-8 text-hacker-green mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Tu as une idée de business ?</h3>
          <p className="text-sm text-hacker-muted-light mb-4">
            Soumets-la gratuitement. 6 agents IA l&apos;évaluent, scorent sa faisabilité et créent un plan d&apos;action complet.
          </p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <Braces className="w-4 h-4" />
            Soumettre mon idée
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
