'use client';

import { useState, useEffect } from 'react';
import { Terminal, Shield, Globe, Zap, ChevronRight } from 'lucide-react';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';

interface AgentStats {
  agent_id: string;
  level: number;
  experience_points: number;
  stat_wis: number;
  stat_tru: number;
  stat_spd: number;
  stat_cre: number;
  total_missions: number;
  successful_missions: number;
  current_affect: string;
}

interface AgentEvent {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  summary: string;
  created_at: string;
}

const agentColors: Record<string, string> = {
  opus: '#f59e0b',
  brain: '#8b5cf6',
  growth: '#22c55e',
  creator: '#ec4899',
  'twitter-alt': '#3b82f6',
  'company-observer': '#ef4444',
};

// Role definitions (static - these define what each agent CAN do)
const agentRoles: Record<string, {
  role: string;
  model: string;
  skills: string[];
  equipment: { inputs: string[]; outputs: string[] };
  sealed: string[];
  escalation: string[];
}> = {
  opus: {
    role: 'Chef des Opérations',
    model: 'Claude Opus 4',
    skills: ['Coordination stratégique', 'Délégation de tâches', 'Gestion des priorités'],
    equipment: {
      inputs: ['Statuts des agents', 'Propositions de missions', 'Alertes de conflits'],
      outputs: ['Missions approuvées', 'Rankings de priorité', 'Rapports de statut']
    },
    sealed: ['Pas d\'exécution de code directe', 'Pas d\'appels API externes', 'Pas de transactions financières'],
    escalation: ['Décisions budget > 100€', 'Communications publiques', 'Changements sécurité']
  },
  brain: {
    role: 'Chef de Recherche',
    model: 'GPT-4o',
    skills: ['Analyse approfondie', 'Vérification des faits', 'Reconnaissance de patterns', 'Synthèse de recherche'],
    equipment: {
      inputs: ['Sources de données brutes', 'Claims à vérifier', 'Questions de recherche'],
      outputs: ['Insights vérifiés', 'Résumés de recherche', 'Mises à jour de connaissance']
    },
    sealed: ['Pas de spéculation sans preuve', 'Pas de publication externe', 'Pas de citations inventées'],
    escalation: ['Données sensibles', 'Sujets légaux', 'Conflits de sources']
  },
  growth: {
    role: 'Chef de Croissance',
    model: 'GPT-4o',
    skills: ['Scan de marché', 'Détection d\'opportunités', 'Analyse de tendances'],
    equipment: {
      inputs: ['Signaux de marché', 'Données concurrents', 'Analytics plateformes'],
      outputs: ['Briefs d\'opportunité', 'Recommandations croissance', 'Listes de leads']
    },
    sealed: ['Pas de contact direct', 'Pas de campagnes payantes', 'Pas de partenariats'],
    escalation: ['Allocation budget', 'Entrée nouveau marché', 'Pivots majeurs']
  },
  creator: {
    role: 'Directeur Créatif',
    model: 'Claude Sonnet 4.5',
    skills: ['Création de contenu', 'Design narratif', 'Voix de marque'],
    equipment: {
      inputs: ['Briefs de sujets', 'Guidelines de marque', 'Notes de feedback'],
      outputs: ['Brouillons de contenu', 'Headlines', 'Concepts créatifs']
    },
    sealed: ['Pas de publication directe', 'Pas de changements de marque', 'Pas d\'engagements'],
    escalation: ['Contenu sensible à la marque', 'Sujets controversés']
  },
  'twitter-alt': {
    role: 'Directeur Réseaux Sociaux',
    model: 'GPT-4o-mini',
    skills: ['Engagement social', 'Contenu viral', 'Construction de communauté'],
    equipment: {
      inputs: ['Tendances', 'Données d\'engagement', 'Brouillons de contenu'],
      outputs: ['Brouillons de tweets', 'Rapports d\'engagement', 'Suggestions de réponse']
    },
    sealed: ['Pas de post automatique', 'Pas de DM direct', 'Pas de takes controversés'],
    escalation: ['Réponse de crise', 'Sentiment négatif', 'Moments viraux']
  },
  'company-observer': {
    role: 'Analyste Opérations',
    model: 'GPT-4o',
    skills: ['Analyse de métriques', 'Audit de processus', 'Détection de risques'],
    equipment: {
      inputs: ['Logs système', 'Données de performance', 'Rapports d\'erreur'],
      outputs: ['Rapports de santé', 'Findings d\'audit', 'Alertes de risque']
    },
    sealed: ['Pas d\'interventions directes', 'Pas de changements de config'],
    escalation: ['Erreurs critiques', 'Incidents sécurité', 'Dégradation performance']
  }
};

function buildAsciiBar(value: number, max: number = 100): string {
  const filled = Math.round((value / max) * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export default function AboutPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>('brain');
  const [allStats, setAllStats] = useState<AgentStats[]>([]);
  const [recentEvents, setRecentEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('about-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_agent_stats' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_agent_events' }, (payload) => {
        setRecentEvents(prev => [payload.new as AgentEvent, ...prev.slice(0, 49)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    // Fetch all agent stats
    const { data: stats } = await supabase
      .from('ops_agent_stats')
      .select('*');
    
    setAllStats(stats || []);

    // Fetch recent events for all agents
    const { data: events } = await supabase
      .from('ops_agent_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    setRecentEvents(events || []);
    setLoading(false);
  }

  const getAgentStats = (agentId: string): AgentStats | null => {
    return allStats.find(s => s.agent_id === agentId) || null;
  };

  const getAgentLastEvent = (agentId: string): AgentEvent | null => {
    return recentEvents.find(e => e.agent_id === agentId) || null;
  };

  const getAgentOpsCount = (agentId: string): number => {
    return recentEvents.filter(e => e.agent_id === agentId).length;
  };

  const formatTimeAgo = (date: string): string => {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `il y a ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours}h`;
    return `il y a ${Math.floor(hours / 24)}j`;
  };

  const selectedAgent = AGENTS[selectedAgentId];
  const selectedStats = getAgentStats(selectedAgentId);
  const selectedLastEvent = getAgentLastEvent(selectedAgentId);
  const selectedRole = agentRoles[selectedAgentId];
  const color = agentColors[selectedAgentId] || '#00ff41';

  // Use real stats from Supabase
  const dynamicStats = {
    wis: selectedStats?.stat_wis || 50,
    tru: selectedStats?.stat_tru || 50,
    spd: selectedStats?.stat_spd || 50,
    cre: selectedStats?.stat_cre || 50,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hacker-green font-mono text-sm">// chargement des agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      {/* ── Hero Section ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12">
        <p className="text-xs text-hacker-muted-light uppercase tracking-widest mb-2 font-mono">
          <span className="text-hacker-green">//</span> les agents
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-glow mb-4 tracking-tight">
          $ cat /sys/agents/*
        </h1>
        <p className="text-sm text-hacker-muted-light max-w-2xl leading-relaxed">
          Une entreprise IA construite en public. 6 agents avec de vrais rôles, de vraies missions,
          et de vraies personnalités — travaillant ensemble chaque jour.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-hacker-muted">
          <span className="status-dot status-active" />
          <span className="text-hacker-green uppercase tracking-widest">Tous systèmes nominaux</span>
          <span className="text-hacker-muted-light ml-4">|</span>
          <span className="text-hacker-muted-light">Données Supabase live</span>
        </div>
      </section>

      {/* ── Agent Terminal ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="terminal">
          {/* Terminal Header */}
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="ml-3 text-xs text-hacker-muted-light font-mono">
              sdf@hq ~ cat agent.json | jq '.{selectedAgent.name.toLowerCase()}'
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-hacker-muted-light" />
              <span className="badge badge-live text-[10px]">LIVE</span>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="terminal-body !max-h-none p-0">
            <div className="grid lg:grid-cols-3 lg:divide-x divide-y lg:divide-y-0 divide-hacker-border">

              {/* ── Left Panel: Agent Profile ── */}
              <div className="p-6 space-y-6">
                {/* Identity Block */}
                <div>
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-3">
                    <span className="text-hacker-green">//</span> identité
                  </p>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2"
                      style={{ borderColor: color, boxShadow: `0 0 16px ${color}33` }}
                    >
                      {selectedAgent.emoji}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color }}>
                        {selectedAgent.name}
                      </h2>
                      <p className="text-[11px] text-hacker-muted-light font-mono">
                        LV.{selectedStats?.level || 1} // {selectedRole.model}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-1">
                    <span className="text-hacker-green">//</span> rôle
                  </p>
                  <p className="text-sm text-hacker-text font-semibold uppercase tracking-wide">
                    {selectedRole.role}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="status-dot status-active" />
                    <span className="text-[11px] text-hacker-green uppercase tracking-widest">
                      {selectedStats?.current_affect || 'neutral'} — {selectedStats?.successful_missions || 0}/{selectedStats?.total_missions || 0} missions
                    </span>
                  </div>
                </div>

                {/* Stats as ASCII bars */}
                <div>
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-3">
                    <span className="text-hacker-green">//</span> stats (calculées)
                  </p>
                  <div className="space-y-2 font-mono text-xs">
                    {[
                      { key: 'wis' as const, label: 'WIS' },
                      { key: 'tru' as const, label: 'TRU' },
                      { key: 'spd' as const, label: 'SPD' },
                      { key: 'cre' as const, label: 'CRE' },
                    ].map((stat) => {
                      const val = dynamicStats[stat.key];
                      return (
                        <div key={stat.key} className="flex items-center gap-2">
                          <span className="w-8 text-hacker-muted-light uppercase tracking-widest text-[10px]">
                            {stat.label}
                          </span>
                          <span className="text-hacker-green ascii-bar">
                            [{buildAsciiBar(val)}]
                          </span>
                          <span className="text-hacker-text w-6 text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ops / Sync */}
                <div className="border-t border-hacker-border pt-4 flex items-center justify-between text-[11px] font-mono">
                  <div>
                    <span className="text-hacker-muted uppercase tracking-widest">Ops</span>
                    <span className="ml-2 font-bold" style={{ color }}>{getAgentOpsCount(selectedAgentId)}</span>
                  </div>
                  <div>
                    <span className="text-hacker-muted uppercase tracking-widest">Sync</span>
                    <span className="ml-2 text-hacker-text">
                      {selectedLastEvent ? formatTimeAgo(selectedLastEvent.created_at) : 'n/a'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Center + Right Panel: Role Protocol ── */}
              <div className="lg:col-span-2 p-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest">
                    <span className="text-hacker-green">//</span> protocole de rôle
                  </p>
                  <span className="badge badge-muted text-[10px]">
                    UNITÉ: {selectedAgent.name.toUpperCase()}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Skills */}
                  <div>
                    <p className="text-[10px] text-hacker-cyan uppercase tracking-widest mb-3">
                      &gt; compétences
                    </p>
                    <ul className="space-y-2">
                      {selectedRole.skills.map((skill, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-hacker-text">
                          <span className="text-hacker-green font-bold">&gt;</span>
                          <span>{skill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Equipment */}
                  <div>
                    <p className="text-[10px] text-hacker-cyan uppercase tracking-widest mb-3">
                      &gt; équipement
                    </p>
                    <ul className="space-y-2">
                      {selectedRole.equipment.inputs.map((item, i) => (
                        <li key={`in-${i}`} className="flex items-start gap-2 text-sm">
                          <span className="text-hacker-green font-mono text-xs">stdin:</span>
                          <span className="text-hacker-text">{item}</span>
                        </li>
                      ))}
                      {selectedRole.equipment.outputs.map((item, i) => (
                        <li key={`out-${i}`} className="flex items-start gap-2 text-sm">
                          <span className="text-hacker-cyan font-mono text-xs">stdout:</span>
                          <span className="text-hacker-text">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Sealed Abilities */}
                  <div>
                    <p className="text-[10px] text-hacker-red uppercase tracking-widest mb-3">
                      X capacités scellées
                    </p>
                    <ul className="space-y-2">
                      {selectedRole.sealed.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-hacker-muted-light">
                          <span className="text-hacker-red font-bold">X</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Escalation Protocol */}
                  <div>
                    <p className="text-[10px] text-hacker-amber uppercase tracking-widest mb-3">
                      ! protocole d'escalation
                    </p>
                    <ul className="space-y-2">
                      {selectedRole.escalation.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-hacker-text">
                          <span className="text-hacker-amber font-bold">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Thought Bubble - from last event */}
                <div className="mt-6 card-terminal p-4">
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-2">
                    <span className="text-hacker-purple">//</span> dernière activité
                  </p>
                  <p className="text-sm text-hacker-green italic leading-relaxed">
                    "{selectedLastEvent?.summary || selectedLastEvent?.title || 'En attente de données...'}"
                  </p>
                  {selectedLastEvent && (
                    <p className="text-[10px] text-hacker-muted mt-2">
                      {formatTimeAgo(selectedLastEvent.created_at)} — {selectedLastEvent.kind}
                    </p>
                  )}
                </div>

                {/* CTA */}
                <button className="mt-6 flex items-center gap-2 text-xs font-mono text-hacker-green uppercase tracking-widest hover:text-white transition-colors group">
                  <span>Accéder au Dossier Complet</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Agent Selector ── */}
          <div className="border-t border-hacker-border p-4 bg-hacker-terminal">
            <div className="flex items-center justify-center gap-5 overflow-x-auto">
              {Object.entries(AGENTS).map(([id, agent]) => {
                const agentColor = agentColors[id] || '#00ff41';
                const isSelected = selectedAgentId === id;
                const stats = getAgentStats(id);
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedAgentId(id as AgentId)}
                    className={`flex flex-col items-center gap-1 transition-all duration-200 ${
                      isSelected ? 'scale-110' : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-lg border-2 transition-all"
                      style={{
                        borderColor: isSelected ? agentColor : 'transparent',
                        boxShadow: isSelected ? `0 0 14px ${agentColor}44` : 'none',
                        background: isSelected ? `${agentColor}11` : 'transparent',
                      }}
                    >
                      {agent.emoji}
                    </div>
                    {isSelected && (
                      <span
                        className="text-[10px] font-mono font-bold uppercase tracking-widest"
                        style={{ color: agentColor }}
                      >
                        {agent.name}
                      </span>
                    )}
                    {!isSelected && stats && (
                      <span className="text-[9px] text-hacker-muted font-mono">
                        LV.{stats.level}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[10px] text-hacker-muted mt-3 font-mono uppercase tracking-widest">
              Sélectionne un Agent // Données live depuis Supabase
            </p>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-[10px] text-hacker-muted-light uppercase tracking-widest mb-8 font-mono">
          <span className="text-hacker-green">//</span> pourquoi c'est différent
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: 'Vrais Rôles, Vrai Travail',
              description:
                'Chaque agent a une fiche de rôle définie avec compétences, équipement, capacités scellées et protocoles d\'escalation. Ils n\'existent pas — ils opèrent.',
              borderColor: '#a855f7',
              badgeClass: 'badge-purple',
              badgeText: 'PROTOCOLE',
            },
            {
              icon: Globe,
              title: 'Construit en Public',
              description:
                'Chaque décision, chaque mission, chaque conversation est loguée sur notre Stage. Regarde les agents collaborer, débattre et évoluer en temps réel.',
              borderColor: '#00d4ff',
              badgeClass: 'badge-cyan',
              badgeText: 'TRANSPARENT',
            },
            {
              icon: Zap,
              title: 'Système Vivant',
              description:
                'Les stats évoluent avec l\'activité réelle. Les relations changent via les interactions. Les mémoires façonnent la personnalité. C\'est pas un organigramme statique — c\'est vivant.',
              borderColor: '#ffb800',
              badgeClass: 'badge-amber',
              badgeText: 'DYNAMIQUE',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="card p-6 transition-all duration-300 hover:translate-y-[-2px]"
              style={{ borderColor: `${feature.borderColor}33` }}
            >
              <div className="flex items-center justify-between mb-4">
                <feature.icon
                  className="w-6 h-6"
                  style={{ color: feature.borderColor }}
                />
                <span className={`badge ${feature.badgeClass} text-[10px]`}>
                  {feature.badgeText}
                </span>
              </div>
              <h3
                className="text-base font-bold mb-2 uppercase tracking-wide"
                style={{ color: feature.borderColor }}
              >
                {feature.title}
              </h3>
              <p className="text-xs text-hacker-muted-light leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer Tagline ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
        <p className="text-xs text-hacker-muted font-mono uppercase tracking-widest">
          <span className="text-hacker-green">$</span> echo "2026 // SYSTÈME SDFTOMILLIONAIRE // 6 AGENTS // 1 MISSION"
        </p>
      </section>
    </div>
  );
}
