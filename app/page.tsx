'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { Play, Users, ArrowRight, Activity, Cpu, Eye, Zap, Terminal, ChevronRight, Send, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const agentMetadata: Record<string, { name: string; role: string; emoji: string; avatar: string; color: string }> = {
  'opus': { name: 'CEO', role: 'Chef des Opérations', emoji: '🎩', avatar: '/agents/opus.png', color: '#f59e0b' },
  'brain': { name: 'Kira', role: 'Chef de Recherche', emoji: '🧠', avatar: '/agents/brain.png', color: '#8b5cf6' },
  'growth': { name: 'Madara', role: 'Spécialiste Croissance', emoji: '👁️', avatar: '/agents/growth.png', color: '#22c55e' },
  'creator': { name: 'Stark', role: 'Directeur Créatif', emoji: '🎨', avatar: '/agents/creator.jpg', color: '#ec4899' },
  'twitter-alt': { name: 'L', role: 'Directeur Réseaux Sociaux', emoji: '⚡', avatar: '/agents/twitter-alt.png', color: '#3b82f6' },
  'company-observer': { name: 'Usopp', role: 'Auditeur Opérations', emoji: '🎯', avatar: '/agents/company-observer.jpg', color: '#ef4444' },
};

const MAX_CHARS = 350;

export default function HomePage() {
  const { user, profile } = useAuth();
  const [agents, setAgents] = useState<any[]>([]);
  const [signalsToday, setSignalsToday] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [loggedOutBanner, setLoggedOutBanner] = useState(false);

  // Prompt submission state
  const [prompt, setPrompt] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [countdown, setCountdown] = useState('');

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

  // Fetch real agent data from Supabase
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const { data: stats } = await supabase
          .from('ops_agent_stats')
          .select('*');

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { data: events } = await supabase
          .from('ops_agent_events')
          .select('agent_id')
          .gte('created_at', yesterday.toISOString());

        const eventCounts: Record<string, number> = {};
        events?.forEach(e => {
          eventCounts[e.agent_id] = (eventCounts[e.agent_id] || 0) + 1;
        });

        const agentsData = stats?.map(stat => {
          const meta = agentMetadata[stat.agent_id];
          const opsCount = eventCounts[stat.agent_id] || 0;
          const isActive = opsCount > 0 || stat.total_missions > 0;
          
          return {
            id: stat.agent_id,
            name: meta?.name || stat.agent_id,
            role: meta?.role || 'Agent',
            status: isActive ? 'active' : 'idle',
            emoji: meta?.emoji || '🤖',
            avatar: meta?.avatar || '/agents/opus.png',
            color: meta?.color || '#888',
            ops: opsCount,
            level: stat.level,
            missions: stat.total_missions,
          };
        }) || [];

        setAgents(agentsData);
        setSignalsToday(events?.length || 0);
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch today's prompt count
  useEffect(() => {
    const fetchTodayCount = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('user_prompts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);
      setTodayCount(count || 0);
    };
    fetchTodayCount();
  }, [submitted]);

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

  const handleSubmitPrompt = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_CHARS) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          author_name: authorName.trim() || 'Anonyme',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la soumission');
      }

      setSubmitted(true);
      localStorage.setItem('lastSubmitDate', new Date().toISOString().split('T')[0]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la soumission';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }, [prompt, authorName]);

  const getStatusColor = useCallback((status: string) => {
    return status === 'active' ? 'text-hacker-green' : 'text-hacker-muted';
  }, []);

  const getStatusDot = useCallback((status: string) => {
    return status === 'active' ? 'status-active' : 'status-idle';
  }, []);

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

      {/* ═══ HERO ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <div>
            <div className="badge badge-live mb-6">soumissions ouvertes</div>

            <h1 className="text-3xl sm:text-5xl font-bold mb-6 leading-tight">
              <span className="text-hacker-green text-glow">Ton idée.</span>
              <br />
              <span className="text-white">6 Agents IA la construisent.</span>
              <br />
              <span className="text-hacker-muted-light text-lg sm:text-2xl font-normal">
                De l&apos;idée au produit, sans coder.
              </span>
            </h1>

            <p className="text-hacker-muted-light text-sm mb-8 max-w-lg leading-relaxed">
              Tu as une idée d&apos;app, de site ou de business ? Décris-la en quelques mots.
              Nos 6 agents IA l&apos;analysent et créent un plan d&apos;action gratuit.
              La communauté vote, et le projet gagnant est construit pour de vrai.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/gallery" className="btn-primary flex items-center gap-2">
                <Play className="w-4 h-4" />
                voir les idées
              </Link>
              <Link href="/agents" className="btn-secondary flex items-center gap-2">
                <Users className="w-4 h-4" />
                découvrir l&apos;équipe
              </Link>
            </div>
          </div>

          {/* Right - Prompt Submission */}
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span className="text-xs text-hacker-muted ml-2">soumets ton idée</span>
            </div>
            <div className="p-4 space-y-4">
              {submitted ? (
                <div className="space-y-3 min-h-[200px] flex flex-col justify-center">
                  <div className="flex gap-2 text-sm">
                    <span className="text-hacker-green">✓</span>
                    <span className="text-hacker-green">idée transmise aux agents...</span>
                  </div>
                  <div className="flex gap-2 text-xs text-hacker-muted">
                    <span>$</span>
                    <span>en cours d&apos;analyse par les agents</span>
                    <span className="inline-block w-2 h-4 bg-hacker-green animate-blink" />
                  </div>
                  <div className="border-t border-hacker-border mt-4 pt-3 space-y-2">
                    <div className="text-xs text-hacker-muted">
                      &gt; {todayCount} idée{todayCount > 1 ? 's' : ''} soumise{todayCount > 1 ? 's' : ''} aujourd&apos;hui
                    </div>
                    <div className="text-xs text-hacker-muted">
                      &gt; prochains résultats dans {countdown}
                    </div>
                    <div className="text-xs text-hacker-muted">
                      &gt; 6 agents IA évaluent ton idée et génèrent un plan d&apos;action
                    </div>
                    <Link href="/gallery" className="inline-flex items-center gap-1.5 text-xs text-hacker-cyan hover:text-hacker-green transition-colors mt-2">
                      <ArrowRight className="w-3 h-3" />
                      voir les idées et voter dans la galerie
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs text-hacker-muted">
                    <span className="text-hacker-green">$</span> Décris ton idée d&apos;app, de site ou de business<span className="inline-block w-1.5 h-3.5 bg-hacker-green animate-blink ml-0.5" />
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
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
                      onClick={handleSubmitPrompt}
                      disabled={submitting || !prompt.trim()}
                      className="btn-primary flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:color-current disabled:hover:shadow-none"
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

                  <div className="border-t border-hacker-border pt-3 space-y-1">
                    <div className="text-xs text-hacker-muted">
                      &gt; {todayCount} idée{todayCount > 1 ? 's' : ''} soumise{todayCount > 1 ? 's' : ''} aujourd&apos;hui
                    </div>
                    <div className="text-xs text-hacker-muted">
                      &gt; prochains résultats dans {countdown}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LIVE AGENT STATUS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <Link href="/stage" className="block">
          <div className="card p-5 hover:border-hacker-green/20 transition-all group">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-hacker-green" />
                <span className="text-xs text-hacker-muted-light uppercase tracking-widest">
                  Activité en direct
                </span>
                <span className="badge badge-live text-[10px]">live</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-hacker-muted group-hover:text-hacker-green transition-colors">
                <span>{signalsToday} signaux</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-3 rounded border border-hacker-border hover:border-opacity-50 transition-all"
                  style={{ borderColor: `${agent.color}20` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Image src={agent.avatar} alt={agent.name} width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
                    <span className="text-xs font-medium text-white">{agent.name}</span>
                    <span className={`status-dot ${getStatusDot(agent.status)}`} />
                  </div>
                  <div className="text-[10px] text-hacker-muted mb-1">{agent.role}</div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase ${getStatusColor(agent.status)}`}>
                      {agent.status === 'active' ? 'actif' : 'inactif'}
                    </span>
                    <span className="text-[10px] text-hacker-muted">{agent.ops} ops</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Link>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-hacker-border">
        <div className="text-center mb-12">
          <span className="text-hacker-green text-xs uppercase tracking-[0.3em] mb-4 block">
            // comment ça marche
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            De l&apos;idée au <span className="text-hacker-green">produit</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Send,
              title: '1. Tu décris ton idée',
              description: 'Écris en quelques mots l\'app, le site ou le business que tu imagines. 6 agents IA l\'analysent et créent un plan d\'action complet — gratuitement.',
              color: 'text-hacker-purple',
              borderColor: 'border-purple-500/20 hover:border-purple-500/40',
            },
            {
              icon: Users,
              title: '2. La communauté vote',
              description: 'Tout le monde peut voter pour l\'idée qu\'il préfère. Chaque jour à 21h, l\'idée la plus populaire est sélectionnée.',
              color: 'text-hacker-amber',
              borderColor: 'border-amber-500/20 hover:border-amber-500/40',
            },
            {
              icon: Zap,
              title: '3. Les agents construisent',
              description: 'Les 6 agents IA travaillent ensemble pour transformer l\'idée gagnante en vrai produit. Code, design, mise en ligne — tout est automatique.',
              color: 'text-hacker-green',
              borderColor: 'border-hacker-green/20 hover:border-hacker-green/40',
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`card p-6 border ${item.borderColor} transition-all`}
            >
              <item.icon className={`w-8 h-8 ${item.color} mb-4`} />
              <h3 className="text-white font-mono text-lg mb-3">{item.title}</h3>
              <p className="text-hacker-muted-light text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="card p-12 text-center bg-gradient-to-br from-hacker-dark to-black border-2 border-hacker-green/30">
          <Terminal className="w-12 h-12 text-hacker-green mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">
            Ta prochaine idée vaut peut-être <span className="text-hacker-green">des millions.</span>
          </h2>
          <p className="text-hacker-muted-light mb-8 max-w-2xl mx-auto">
            Pas besoin de savoir coder. Décris ton idée, les agents IA l&apos;analysent gratuitement.
            Si la communauté vote pour toi, ils la construisent — pour de vrai.
          </p>
          <Link href="/gallery" className="btn-primary inline-flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Voir les idées et voter
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
