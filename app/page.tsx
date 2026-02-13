'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { ArrowRight, Send, Cpu, Users, Zap, Activity, Trophy, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const MAX_CHARS = 350;

const SUGGESTIONS = [
  'Une app qui trouve des colocataires compatibles',
  'Un site qui compare les abonnements et trouve les doublons',
  'Un outil qui génère des factures automatiquement',
];

const STEPS = [
  {
    icon: Send,
    num: '01',
    title: 'Tu décris ton idée',
    desc: 'En quelques mots, décris l\'app ou le business que tu imagines.',
    color: 'text-hacker-green',
    border: 'border-hacker-green/20',
    glow: 'group-hover:shadow-[0_0_20px_rgba(0,255,65,0.1)]',
  },
  {
    icon: Cpu,
    num: '02',
    title: '6 agents IA l\'analysent',
    desc: 'Faisabilité, marché, plan d\'action — tout est évalué automatiquement.',
    color: 'text-hacker-cyan',
    border: 'border-hacker-cyan/20',
    glow: 'group-hover:shadow-[0_0_20px_rgba(0,212,255,0.1)]',
  },
  {
    icon: Users,
    num: '03',
    title: 'La communauté vote',
    desc: 'Chaque jour à 21h, l\'idée la plus votée est sélectionnée.',
    color: 'text-hacker-purple',
    border: 'border-purple-500/20',
    glow: 'group-hover:shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
  {
    icon: Zap,
    num: '04',
    title: 'Les agents construisent',
    desc: 'L\'idée gagnante est transformée en vrai produit. Code, design, mise en ligne.',
    color: 'text-hacker-amber',
    border: 'border-amber-500/20',
    glow: 'group-hover:shadow-[0_0_20px_rgba(255,184,0,0.1)]',
  },
];

const agentMetadata: Record<string, { name: string; role: string; avatar: string; color: string }> = {
  'opus': { name: 'CEO', role: 'Chef des Opérations', avatar: '/agents/opus.png', color: '#f59e0b' },
  'brain': { name: 'Kira', role: 'Chef de Recherche', avatar: '/agents/brain.png', color: '#8b5cf6' },
  'growth': { name: 'Madara', role: 'Spécialiste Croissance', avatar: '/agents/growth.png', color: '#22c55e' },
  'creator': { name: 'Stark', role: 'Directeur Créatif', avatar: '/agents/creator.jpg', color: '#ec4899' },
  'twitter-alt': { name: 'L', role: 'Directeur Réseaux Sociaux', avatar: '/agents/twitter-alt.png', color: '#3b82f6' },
  'company-observer': { name: 'Usopp', role: 'Auditeur Opérations', avatar: '/agents/company-observer.jpg', color: '#ef4444' },
};

export default function HomePage() {
  const { user, profile } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [signalsToday, setSignalsToday] = useState(0);
  const [loggedOutBanner, setLoggedOutBanner] = useState(false);

  // Show logged out banner
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('logged_out=1')) {
      setLoggedOutBanner(true);
      window.history.replaceState({}, '', '/');
      const timer = setTimeout(() => setLoggedOutBanner(false), 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-fill author name from profile
  useEffect(() => {
    if (profile?.display_name && !authorName) {
      setAuthorName(profile.display_name);
    } else if (profile?.username && !authorName) {
      setAuthorName(profile.username);
    }
  }, [profile]);

  // Fetch real agent data + realtime
  const fetchAgents = useCallback(async () => {
    try {
      const { data: stats } = await supabase.from('ops_agent_stats').select('*');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { data: events } = await supabase
        .from('ops_agent_events')
        .select('agent_id')
        .gte('created_at', yesterday.toISOString());

      const eventCounts: Record<string, number> = {};
      events?.forEach(e => { eventCounts[e.agent_id] = (eventCounts[e.agent_id] || 0) + 1; });

      const agentsData = stats?.map(stat => {
        const meta = agentMetadata[stat.agent_id];
        const opsCount = eventCounts[stat.agent_id] || 0;
        return {
          id: stat.agent_id,
          name: meta?.name || stat.agent_id,
          role: meta?.role || 'Agent',
          status: (opsCount > 0 || stat.total_missions > 0) ? 'active' : 'idle',
          avatar: meta?.avatar || '/agents/opus.png',
          color: meta?.color || '#888',
          ops: opsCount,
        };
      }) || [];

      setAgents(agentsData);
      setSignalsToday(events?.length || 0);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  }, []);

  useEffect(() => {
    fetchAgents();

    // Realtime: refresh on new agent events or stats changes
    const channel = supabase
      .channel('homepage-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_agent_events' }, () => {
        fetchAgents();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_agent_stats' }, () => {
        fetchAgents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAgents]);

  // Fetch today's prompt count + realtime
  const fetchTodayCount = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('user_prompts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);
      setTodayCount(count || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchTodayCount();

    // Realtime: refresh count on new prompts
    const channel = supabase
      .channel('homepage-prompts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_prompts' }, () => {
        fetchTodayCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTodayCount, submitted]);

  // Countdown to 21h
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const deadline = new Date();
      deadline.setHours(21, 0, 0, 0);
      if (now > deadline) deadline.setDate(deadline.getDate() + 1);
      const diff = deadline.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(`${hours}h${String(minutes).padStart(2, '0')}`);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || trimmed.length > MAX_CHARS) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, author_name: authorName.trim() || 'Anonyme' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la soumission');
      setSubmitted(true);
      localStorage.setItem('lastSubmitDate', new Date().toISOString().split('T')[0]);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  }, [prompt, authorName]);

  const displayName = profile?.display_name || profile?.username || null;

  return (
    <div className="bg-grid">
      {/* ═══ LOGGED OUT BANNER ═══ */}
      {loggedOutBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded border border-hacker-green/30 bg-hacker-dark/95 backdrop-blur-sm shadow-lg font-mono text-sm">
            <LogOut className="w-4 h-4 text-hacker-green" />
            <span className="text-hacker-green">Déconnecté avec succès</span>
          </div>
        </div>
      )}

      {submitted ? (
        /* ═══ SUCCESS STATE ═══ */
        <div className="min-h-[calc(100vh-57px)] flex items-center justify-center px-4">
          <div className="text-center space-y-5 max-w-lg animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-hacker-green/10 border border-hacker-green/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,255,65,0.15)]">
              <Trophy className="w-7 h-7 text-hacker-green" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              Idée transmise aux <span className="text-hacker-green">agents</span>
            </h2>
            <div className="terminal inline-block mx-auto">
              <div className="terminal-header">
                <div className="terminal-dot red" />
                <div className="terminal-dot yellow" />
                <div className="terminal-dot green" />
                <span className="text-xs text-hacker-muted ml-2">statut</span>
              </div>
              <div className="p-4 space-y-2 text-left">
                <div className="flex gap-2 text-xs text-hacker-muted">
                  <span className="text-hacker-green">$</span>
                  <span>en cours d&apos;analyse par les agents</span>
                  <span className="inline-block w-1.5 h-3.5 bg-hacker-green animate-blink" />
                </div>
                <div className="text-xs text-hacker-muted">
                  &gt; prochains résultats dans <span className="text-hacker-green">{countdown}</span>
                </div>
                <div className="text-xs text-hacker-muted">
                  &gt; 6 agents IA évaluent ton idée et génèrent un plan d&apos;action
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
              <Link href="/gallery" className="btn-primary inline-flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Voir les idées et voter
              </Link>
              <button
                onClick={() => { setSubmitted(false); setPrompt(''); }}
                className="btn-secondary inline-flex items-center justify-center gap-2"
              >
                Soumettre une autre idée
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ═══ HERO + TERMINAL PROMPT ═══ */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-20 pb-16">
            <div className="grid lg:grid-cols-2 gap-5 lg:gap-12 items-center">
              {/* Left — Value prop */}
              <div>
                {displayName && (
                  <p className="text-sm text-hacker-green/70 font-mono mb-3 animate-fade-in">
                    &gt; salut {displayName}_
                  </p>
                )}

                <h1 className="mb-4 leading-tight">
                  <span className="block text-3xl sm:text-5xl font-bold text-hacker-green text-glow">Décris ton idée.</span>
                  <span className="block text-lg sm:text-xl font-semibold text-white mt-1">6 agents IA la construisent !</span>
                </h1>

                <p className="text-hacker-muted-light text-sm sm:text-base mb-6 leading-relaxed max-w-lg">
                  Décris l&apos;app, le site ou le business que tu imagines.
                  <span className="text-white/80"> 6 agents IA</span> l&apos;analysent, la communauté vote, et on construit l&apos;idée gagnante — <span className="text-hacker-green font-medium">chaque jour à 21h</span>.
                </p>

                {/* Live badges */}
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-hacker-green/20 bg-hacker-green/5">
                    <span className="status-dot status-active" />
                    <span className="text-xs text-hacker-green font-mono">
                      {todayCount} idée{todayCount > 1 ? 's' : ''} aujourd&apos;hui
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-hacker-border bg-hacker-dark/50">
                    <span className="text-xs text-hacker-muted-light font-mono">
                      résultats dans <span className="text-hacker-green">{countdown}</span>
                    </span>
                  </div>
                </div>

              </div>

              {/* Right — Terminal prompt */}
              <div className="terminal">
                <div className="terminal-header">
                  <div className="terminal-dot red" />
                  <div className="terminal-dot yellow" />
                  <div className="terminal-dot green" />
                  <span className="text-xs text-hacker-muted ml-2">soumets ton idée</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="text-xs text-hacker-muted">
                    <span className="text-hacker-green">$</span> Décris ton idée d&apos;app, de site ou de business<span className="inline-block w-1.5 h-3.5 bg-hacker-green animate-blink ml-0.5" />
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    maxLength={MAX_CHARS}
                    rows={4}
                    placeholder="Un site pour vendre des... Une app qui aide à... Un outil qui automatise..."
                    className="w-full bg-transparent border border-hacker-border text-hacker-text font-mono text-sm resize-none focus:border-hacker-green/50 focus:outline-none rounded px-3 py-2 placeholder:text-hacker-muted/40"
                    disabled={submitting}
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-hacker-muted shrink-0">Pseudo:</span>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Anonyme"
                      maxLength={30}
                      className="flex-1 bg-transparent border border-hacker-border text-hacker-text font-mono text-xs focus:border-hacker-green/50 focus:outline-none rounded px-2 py-1.5 placeholder:text-hacker-muted/40"
                      disabled={submitting}
                    />
                  </div>

                  {submitError && (
                    <div className="text-xs text-red-400">&gt; erreur: {submitError}</div>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !prompt.trim()}
                      className="btn-primary flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submitting ? 'envoi...' : 'soumettre'}
                    </button>
                    <span className={`text-xs font-mono ${
                      prompt.length > 340 ? 'text-red-400' :
                      prompt.length > 300 ? 'text-hacker-amber' :
                      'text-hacker-green/60'
                    }`}>
                      {prompt.length}/{MAX_CHARS}
                    </span>
                  </div>

                </div>
              </div>
            </div>

            {/* Suggestion pills — below the grid */}
            <div className="flex flex-wrap gap-2 mt-8 justify-center lg:justify-start">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(s)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-hacker-border text-hacker-muted-light hover:border-hacker-green/30 hover:text-hacker-green hover:bg-hacker-green/5 transition-all font-mono"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* ═══ LIVE AGENT STATUS — marquee on mobile, grid on desktop ═══ */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
            <Link href="/stage" className="block">
              <div className="card p-5 hover:border-hacker-green/20 transition-all group">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-hacker-green" />
                    <span className="text-[10px] sm:text-xs text-hacker-muted-light uppercase tracking-widest">
                      Activité en direct
                    </span>
                    <span className="badge badge-live text-[9px] sm:text-[10px]">live</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-hacker-muted group-hover:text-hacker-green transition-colors">
                    <span>{signalsToday} signaux</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>

                {/* Desktop: grid */}
                <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="p-3 rounded border border-hacker-border hover:border-opacity-50 transition-all" style={{ borderColor: `${agent.color}20` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Image src={agent.avatar} alt={agent.name} width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
                        <span className="text-xs font-medium text-white">{agent.name}</span>
                        <span className={`status-dot ${agent.status === 'active' ? 'status-active' : 'status-idle'}`} />
                      </div>
                      <div className="text-[10px] text-hacker-muted mb-1">{agent.role}</div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase ${agent.status === 'active' ? 'text-hacker-green' : 'text-hacker-muted'}`}>{agent.status === 'active' ? 'actif' : 'inactif'}</span>
                        <span className="text-[10px] text-hacker-muted">{agent.ops} ops</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile: horizontal scroll */}
                <div className="sm:hidden relative">
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-1">
                    {agents.map((agent) => (
                      <div key={agent.id} className="p-3 rounded border border-hacker-border shrink-0 w-[140px]" style={{ borderColor: `${agent.color}20` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Image src={agent.avatar} alt={agent.name} width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
                          <span className="text-xs font-medium text-white">{agent.name}</span>
                          <span className={`status-dot ${agent.status === 'active' ? 'status-active' : 'status-idle'}`} />
                        </div>
                        <div className="text-[10px] text-hacker-muted mb-1">{agent.role}</div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase ${agent.status === 'active' ? 'text-hacker-green' : 'text-hacker-muted'}`}>{agent.status === 'active' ? 'actif' : 'inactif'}</span>
                          <span className="text-[10px] text-hacker-muted">{agent.ops} ops</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Matrix scroll arrow */}
                  <div className="absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-hacker-card to-transparent flex items-center justify-end pointer-events-none">
                    <span className="text-hacker-green text-sm font-mono animate-pulse mr-1">&gt;&gt;</span>
                  </div>
                </div>
              </div>
            </Link>
          </section>

          {/* ═══ COMMENT ÇA MARCHE — marquee on mobile, grid on desktop ═══ */}
          <section className="pb-20 border-t border-hacker-border pt-16">
            <div className="text-center mb-10 px-4">
              <span className="text-hacker-green text-xs uppercase tracking-[0.3em] font-mono mb-3 block">
                // comment ça marche
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                De l&apos;idée au <span className="text-hacker-green">produit</span> en 4 étapes
              </h2>
            </div>

            {/* Desktop: grid */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto px-4">
              {STEPS.map((step) => (
                <div key={step.num} className={`group card p-5 border ${step.border} ${step.glow} transition-all hover:-translate-y-0.5`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded border border-current/20 flex items-center justify-center ${step.color}`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-xs font-mono ${step.color} opacity-60`}>{step.num}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-2">{step.title}</h3>
                  <p className="text-hacker-muted-light text-xs leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Mobile: horizontal scroll */}
            <div className="sm:hidden relative px-4">
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                {STEPS.map((step) => (
                  <div key={step.num} className={`card p-5 border ${step.border} shrink-0 w-[260px]`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded border border-current/20 flex items-center justify-center ${step.color}`}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-mono ${step.color} opacity-60`}>{step.num}</span>
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-2">{step.title}</h3>
                    <p className="text-hacker-muted-light text-xs leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
              {/* Matrix scroll arrow */}
              <div className="absolute right-4 top-0 bottom-2 w-10 bg-gradient-to-l from-hacker-bg to-transparent flex items-center justify-end pointer-events-none">
                <span className="text-hacker-green text-sm font-mono animate-pulse mr-1">&gt;&gt;</span>
              </div>
            </div>

            {/* CTA bottom */}
            <div className="text-center mt-12 px-4">
              <p className="text-hacker-muted text-sm mb-4">
                C&apos;est gratuit, sans inscription, et ça prend 30 secondes.
              </p>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Soumettre mon idée
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
