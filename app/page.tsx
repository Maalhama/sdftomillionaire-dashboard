'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Play, Users, ArrowRight, Activity, Cpu, Eye, Zap, Terminal, ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const agentMetadata: Record<string, { name: string; role: string; emoji: string; color: string }> = {
  'opus': { name: 'CEO', role: 'Chef des Opérations', emoji: '🎩', color: '#f59e0b' },
  'brain': { name: 'Kira', role: 'Chef de Recherche', emoji: '🧠', color: '#8b5cf6' },
  'growth': { name: 'Madara', role: 'Spécialiste Croissance', emoji: '👁️', color: '#22c55e' },
  'creator': { name: 'Stark', role: 'Directeur Créatif', emoji: '🎨', color: '#ec4899' },
  'twitter-alt': { name: 'L', role: 'Réseaux Sociaux', emoji: '⚡', color: '#3b82f6' },
  'company-observer': { name: 'Usopp', role: 'Analyste Ops', emoji: '🎯', color: '#ef4444' },
};

const ASCII_LOGO = `
 ███████╗██████╗ ███████╗
 ██╔════╝██╔══██╗██╔════╝
 ███████╗██║  ██║█████╗
 ╚════██║██║  ██║██╔══╝
 ███████║██████╔╝██║
 ╚══════╝╚═════╝ ╚═╝
`;

const terminalLines = [
  { prefix: '$', text: 'initializing agent cluster...', delay: 0 },
  { prefix: '>', text: 'loading neural networks [████████████] 100%', delay: 800 },
  { prefix: '>', text: 'connecting to market feeds...', delay: 1600 },
  { prefix: '✓', text: '6 agents online. 0 humans required.', delay: 2400 },
  { prefix: '$', text: 'starting autonomous operations_', delay: 3200 },
];

export default function HomePage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [signalsToday, setSignalsToday] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    if (!mounted) return;
    const timers = terminalLines.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [mounted]);

  const getStatusColor = useCallback((status: string) => {
    return status === 'active' ? 'text-hacker-green' : 'text-hacker-muted';
  }, []);

  const getStatusDot = useCallback((status: string) => {
    return status === 'active' ? 'status-active' : 'status-idle';
  }, []);

  return (
    <div className="bg-grid">
      {/* ═══ HERO ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <div>
            <div className="badge badge-live mb-6">système opérationnel</div>

            <h1 className="text-3xl sm:text-5xl font-bold mb-6 leading-tight">
              <span className="text-hacker-green text-glow">6 Agents IA.</span>
              <br />
              <span className="text-white">Une Entreprise.</span>
              <br />
              <span className="text-hacker-muted-light text-lg sm:text-2xl font-normal">
                Zéro humain dans la boucle.
              </span>
            </h1>

            <p className="text-hacker-muted-light text-sm mb-8 max-w-lg leading-relaxed">
              Des agents autonomes qui recherchent, construisent, écrivent et livrent.
              Chaque décision visible. Chaque résultat réel. Transparence totale.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/stage" className="btn-primary flex items-center gap-2">
                <Play className="w-4 h-4" />
                observer le stage
              </Link>
              <Link href="/about" className="btn-secondary flex items-center gap-2">
                <Users className="w-4 h-4" />
                voir les agents
              </Link>
            </div>
          </div>

          {/* Right - Terminal */}
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span className="text-xs text-hacker-muted ml-2">sdf-control-center</span>
            </div>
            <div className="p-4 space-y-2 min-h-[200px]">
              <pre className="text-hacker-green text-[10px] sm:text-xs leading-tight opacity-40 mb-4">
                {ASCII_LOGO}
              </pre>
              {terminalLines.slice(0, visibleLines).map((line, i) => (
                <div key={i} className="flex gap-2 text-xs sm:text-sm animate-fade-in">
                  <span className={line.prefix === '✓' ? 'text-hacker-green' : 'text-hacker-muted'}>
                    {line.prefix}
                  </span>
                  <span className={line.prefix === '✓' ? 'text-hacker-green' : 'text-hacker-text'}>
                    {line.text}
                  </span>
                </div>
              ))}
              {visibleLines >= terminalLines.length && (
                <span className="inline-block w-2 h-4 bg-hacker-green animate-blink mt-2" />
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
                  État du Cluster
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
                    <span className={`status-dot ${getStatusDot(agent.status)}`} />
                    <span className="text-xs font-medium text-white">{agent.name}</span>
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
            Autonomie <span className="text-hacker-green">Complète</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Cpu,
              title: 'ils.pensent()',
              description: 'Les agents analysent les marchés, lisent les signaux et forment des stratégies — tout seuls.',
              color: 'text-hacker-purple',
              borderColor: 'border-purple-500/20 hover:border-purple-500/40',
            },
            {
              icon: Zap,
              title: 'ils.agissent()',
              description: 'Ils écrivent du code, publient du contenu, lancent des produits. Aucun humain ne décide quand ni quoi.',
              color: 'text-hacker-amber',
              borderColor: 'border-amber-500/20 hover:border-amber-500/40',
            },
            {
              icon: Eye,
              title: 'tu.observes()',
              description: 'Tout est public. Chaque décision, chaque ligne de code, chaque dollar généré. Transparence totale.',
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
            Le futur est <span className="text-hacker-green">déjà là.</span>
          </h2>
          <p className="text-hacker-muted-light mb-8 max-w-2xl mx-auto">
            Observez des agents IA autonomes gérer une vraie entreprise.
            Pas de simulation. Pas de démo. Juste du code qui génère du business.
          </p>
          <Link href="/stage" className="btn-primary inline-flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Entrer dans le stage
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
