'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Lightbulb,
  Clock,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Target,
  DollarSign,
  Timer,
  Users,
} from 'lucide-react';

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
  evaluated: { label: 'EVALUÉ', badge: 'badge badge-live' },
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
  const [filter, setFilter] = useState<'all' | 'evaluated' | 'pending'>('all');

  useEffect(() => {
    async function fetchPrompts() {
      const { data } = await supabase
        .from('user_prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setPrompts(data);
      setLoading(false);
    }
    fetchPrompts();

    // Realtime updates
    const channel = supabase
      .channel('prompts-gallery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_prompts' }, () => {
        fetchPrompts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = prompts.filter(p => {
    if (filter === 'evaluated') return p.status === 'evaluated';
    if (filter === 'pending') return p.status === 'pending' || p.status === 'evaluating';
    return true;
  });

  const evaluatedCount = prompts.filter(p => p.status === 'evaluated').length;
  const pendingCount = prompts.filter(p => p.status === 'pending' || p.status === 'evaluating').length;

  const filters = [
    { value: 'all' as const, label: `all (${prompts.length})` },
    { value: 'evaluated' as const, label: `evaluated (${evaluatedCount})` },
    { value: 'pending' as const, label: `pending (${pendingCount})` },
  ];

  return (
    <div className="bg-grid min-h-screen">
      {/* HEADER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// prompt gallery</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Galerie des Idées
          </h1>
          <span className="badge badge-live">live</span>
        </div>
        <p className="text-hacker-muted-light">
          Idées soumises par la communauté, évaluées par nos 6 agents IA. Vote pour tes favorites.
        </p>
      </section>

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="card p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-hacker-green">{prompts.length}</div>
              <div className="text-sm text-hacker-muted-light">Idées soumises</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-hacker-cyan">{evaluatedCount}</div>
              <div className="text-sm text-hacker-muted-light">Évaluées par l&apos;IA</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-hacker-amber">{pendingCount}</div>
              <div className="text-sm text-hacker-muted-light">En attente</div>
            </div>
          </div>
        </div>
      </section>

      {/* FILTERS */}
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

      {/* PROMPTS LIST */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {loading ? (
          <div className="text-center py-12 font-mono text-hacker-muted">
            <span className="animate-blink">_</span> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-8 h-8 text-hacker-muted mx-auto mb-3" />
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
                          {plan?.feasibility_score !== undefined && (
                            <ScoreBar score={plan.feasibility_score} />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-hacker-muted-light">
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-sm font-mono">{prompt.votes_count}</span>
                        </div>
                        {plan && (
                          isExpanded
                            ? <ChevronUp className="w-5 h-5 text-hacker-muted" />
                            : <ChevronDown className="w-5 h-5 text-hacker-muted" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded AI Plan */}
                  {isExpanded && plan && (
                    <div className="border-t border-hacker-border bg-hacker-terminal">
                      {/* Summary + Key Stats */}
                      <div className="p-5 space-y-4">
                        <p className="text-hacker-text text-sm leading-relaxed">{plan.summary}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <DollarSign className="w-3.5 h-3.5 text-hacker-green" />
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
                            <Target className="w-3.5 h-3.5 text-hacker-purple" />
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
          <Lightbulb className="w-8 h-8 text-hacker-green mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Vous aussi, soumettez votre idée !</h3>
          <p className="text-sm text-hacker-muted-light mb-4">
            Nos 6 agents IA l&apos;évalueront et vous donneront un plan d&apos;action détaillé.
          </p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
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
