'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const ASCII_LOGO = ` ███████╗██████╗ ███████╗
 ██╔════╝██╔══██╗██╔════╝
 ███████╗██║  ██║█████╗
 ╚════██║██║  ██║██╔══╝
 ███████║██████╔╝██║
 ╚══════╝╚═════╝ ╚═╝`;
import { supabase, AGENTS, AgentId } from '@/lib/supabase';
import { Shield, Globe, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';

// ═══ TYPES ═══

interface AgentStats {
  agent_id: string;
  experience_points: number;
  level: number;
  total_missions: number;
  successful_missions: number;
  stat_vrl: number;
  stat_spd: number;
  stat_rch: number;
  stat_tru: number;
  stat_wis: number;
  stat_cre: number;
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

interface AgentRelationship {
  id: string;
  agent_a: string;
  agent_b: string;
  affinity: number;
  total_interactions: number;
  positive_interactions: number;
  negative_interactions: number;
  last_interaction_at: string;
}

// ═══ STATIC DATA ═══

const agentColors: Record<string, string> = {
  opus: '#f59e0b',
  brain: '#8b5cf6',
  growth: '#22c55e',
  creator: '#ec4899',
  'twitter-alt': '#3b82f6',
  'company-observer': '#ef4444',
};

const agentAvatars: Record<string, string> = {
  opus: '/agents/opus.png',
  brain: '/agents/brain.png',
  growth: '/agents/growth.png',
  creator: '/agents/creator.jpg',
  'twitter-alt': '/agents/twitter-alt.png',
  'company-observer': '/agents/company-observer.jpg',
};

const agentModelPaths: Record<string, string> = {
  opus: '/models/minion.glb',
  brain: '/models/sage.glb',
  growth: '/models/scout.glb',
  creator: '/models/quill.glb',
  'twitter-alt': '/models/xalt.glb',
  'company-observer': '/models/observer.glb',
};

const agentRoles: Record<string, {
  role: string;
  rpgClass: string;
  model: string;
  skills: string[];
  equipment: { inputs: string[]; outputs: string[] };
  sealed: string[];
  escalation: string[];
}> = {
  opus: {
    role: 'Chef des Opérations',
    rpgClass: 'Commander',
    model: 'Claude Opus 4',
    skills: ['Routage de tâches et décisions de priorité', 'Coordination d\'équipe et approbations', 'Gestion des standups et synthèses hebdo'],
    equipment: {
      inputs: ['Propositions et statuts de l\'équipe', 'Résultats de missions et métriques', 'Demandes d\'escalation', 'Directives externes'],
      outputs: ['Propositions approuvées/rejetées avec raisonnement', 'Rankings de priorité et assignations', 'Agendas de standup', 'Synthèses de performance hebdo']
    },
    sealed: ['Pas d\'exécution directe — délégation uniquement', 'Pas de déploiement sans approbation explicite', 'Pas de décisions financières', 'Pas de claims non vérifiés dans les rapports'],
    escalation: ['Décisions budget ou financières', 'Communications externes vers des humains', 'Conflits de priorités non résolubles', 'Problèmes de sécurité']
  },
  brain: {
    role: 'Chef de Recherche',
    rpgClass: 'Sage',
    model: 'GPT-4o',
    skills: ['Recherche et analyse de données', 'Interprétation et insights stratégiques', 'Vérification des faits et citations', 'Prévisions et analyse de tendances'],
    equipment: {
      inputs: ['Données brutes des crawlers', 'Demandes de recherche des agents', 'Signaux et tendances du marché', 'Données de performance historiques'],
      outputs: ['Rapports de recherche avec citations', 'Recommandations basées sur les données', 'Analyses de tendances et prévisions', 'Insights stratégiques']
    },
    sealed: ['Pas de citations ou données inventées', 'Pas de certitude sans preuve', 'Analyse uniquement — pas d\'exécution', 'Pas d\'opinions personnelles présentées comme faits'],
    escalation: ['Sources de données contradictoires', 'Décisions à fort enjeu nécessitant jugement humain', 'Préoccupations éthiques', 'Requêtes hors domaine d\'expertise']
  },
  growth: {
    role: 'Spécialiste Croissance',
    rpgClass: 'Ranger',
    model: 'GPT-4o',
    skills: ['Détection de signaux et opportunités marché', 'Analyse concurrentielle', 'Stratégies de croissance', 'Alertes opportunités time-sensitive'],
    equipment: {
      inputs: ['Données et tendances marché', 'Activités des concurrents', 'Métriques de performance', 'Feedback et signaux utilisateurs'],
      outputs: ['Rapports d\'opportunités de croissance', 'Synthèses d\'analyse concurrentielle', 'Recommandations stratégiques', 'Alertes signaux time-sensitive']
    },
    sealed: ['Pas de comparaisons concurrentielles non vérifiées', 'Pas de garanties de résultats', 'Pas d\'exécution directe de tactiques', 'Pas de projections gonflées sans base'],
    escalation: ['Opportunités à fort investissement', 'Actions concurrentes nécessitant réponse immédiate', 'Shifts marché avec implications significatives', 'Opportunités nécessitant partenariats externes']
  },
  creator: {
    role: 'Directeur Créatif',
    rpgClass: 'Artisan',
    model: 'Claude Sonnet 4.5',
    skills: ['Création de contenu et storytelling', 'Copywriting et stratégie créative', 'Concepts et hooks d\'accroche', 'Variantes de contenu pour testing'],
    equipment: {
      inputs: ['Insights de recherche de Kira', 'Signaux de croissance de Madara', 'Guidelines de marque et ton', 'Données de performance des contenus passés'],
      outputs: ['Brouillons de contenu (articles, threads, posts)', 'Concepts créatifs et hooks', 'Variantes de contenu pour testing', 'Suggestions de calendrier éditorial']
    },
    sealed: ['Pas d\'invention de faits ou statistiques', 'Pas de publication sans review', 'Pas de plagiat — contenu original uniquement', 'Pas de contenu off-brand sans signalement'],
    escalation: ['Sujets controversés', 'Préoccupations légales ou compliance', 'Contenu nécessitant review d\'expert', 'Pièces à haute visibilité']
  },
  'twitter-alt': {
    role: 'Directeur Réseaux Sociaux',
    rpgClass: 'Bard',
    model: 'GPT-4o-mini',
    skills: ['Distribution sociale et stratégie d\'engagement', 'Contenu viral et hot takes', 'Interaction communauté', 'Analyse d\'engagement et recommandations'],
    equipment: {
      inputs: ['Brouillons de contenu de Stark', 'Signaux de croissance de Madara', 'Feedback d\'engagement et métriques', 'Sujets tendances et conversations'],
      outputs: ['Brouillons de tweets/threads avec plan de posting', 'Flags de risque pour contenu controversé', 'Suggestions d\'interaction communauté', 'Analyses d\'engagement']
    },
    sealed: ['Pas de posting direct — brouillons uniquement', 'Pas de chiffres d\'engagement inventés', 'Pas de débats controversés sans approbation', 'Pas d\'usurpation d\'identité'],
    escalation: ['Claims numériques ou comparaisons', 'Sujets controversés ou politiques', 'Contenu risque moyen/élevé', 'Moments viraux nécessitant réponse rapide']
  },
  'company-observer': {
    role: 'Auditeur Opérations',
    rpgClass: 'Oracle',
    model: 'GPT-4o',
    skills: ['Assurance qualité et audit de processus', 'Monitoring santé système', 'Détection d\'anomalies et performance', 'Recommandations d\'amélioration'],
    equipment: {
      inputs: ['Résultats et logs de missions', 'Métriques de performance des agents', 'Données de santé système', 'Rapports d\'erreur et anomalies'],
      outputs: ['Rapports d\'audit avec findings spécifiques', 'Scores et tendances de qualité', 'Recommandations d\'amélioration de processus', 'Synthèses d\'alertes']
    },
    sealed: ['Pas de blâme ou attaques personnelles sur les agents', 'Pas de modification directe du travail des autres', 'Pas de dissimulation de findings négatifs', 'Recommandations uniquement — pas de fixes directs'],
    escalation: ['Échecs qualité répétés', 'Problèmes de sécurité', 'Problèmes critiques de santé système', 'Patterns suggérant des problèmes plus profonds']
  },
};

// ═══ HELPERS ═══

function buildAsciiBar(value: number, max: number = 100): string {
  const filled = Math.round((value / max) * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatTimeAgo(date: string): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}

// ═══ 3D SHOWCASE (dynamic import, SSR disabled) ═══

const AgentShowcase3D = dynamic(() => import('./AgentShowcase3D'), { ssr: false });

// ═══ MAIN PAGE ═══

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('opus');
  const [allStats, setAllStats] = useState<AgentStats[]>([]);
  const [recentEvents, setRecentEvents] = useState<AgentEvent[]>([]);
  const [relationships, setRelationships] = useState<AgentRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Safety timeout: force loading off after 8s
    const timeout = setTimeout(() => setLoading(false), 8000);

    const channel = supabase
      .channel('agents-hq-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_agent_stats' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_agent_events' }, (payload) => {
        setRecentEvents(prev => [payload.new as AgentEvent, ...prev.slice(0, 49)]);
      })
      .subscribe();

    return () => { clearTimeout(timeout); supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    try {
      const [{ data: stats }, { data: events }, { data: rels }] = await Promise.all([
        supabase.from('ops_agent_stats').select('*'),
        supabase.from('ops_agent_events').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('ops_agent_relationships').select('*'),
      ]);
      setAllStats(stats || []);
      setRecentEvents(events || []);
      setRelationships(rels || []);
    } catch (err) {
      console.error('Agents fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }

  const agent = AGENTS[selectedAgent];
  const color = agentColors[selectedAgent] || '#00ff41';
  const role = agentRoles[selectedAgent];
  const stats = allStats.find(s => s.agent_id === selectedAgent) || null;
  const lastEvent = recentEvents.find(e => e.agent_id === selectedAgent) || null;
  const opsCount = recentEvents.filter(e => e.agent_id === selectedAgent).length;

  // Get relationships for selected agent
  const agentRelationships = relationships
    .filter(r => r.agent_a === selectedAgent || r.agent_b === selectedAgent)
    .map(r => {
      const otherId = r.agent_a === selectedAgent ? r.agent_b : r.agent_a;
      const otherAgent = AGENTS[otherId as AgentId];
      return { ...r, otherId, otherName: otherAgent?.name || otherId, otherColor: agentColors[otherId] || '#888' };
    })
    .sort((a, b) => b.affinity - a.affinity);

  const dynamicStats = {
    vrl: stats?.stat_vrl || 50,
    spd: stats?.stat_spd || 50,
    rch: stats?.stat_rch || 50,
    tru: stats?.stat_tru || 50,
    wis: stats?.stat_wis || 50,
    cre: stats?.stat_cre || 50,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hacker-green font-mono text-sm">// chargement_agent_hq...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      {/* ── Hero ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        <p className="text-xs text-hacker-muted-light uppercase tracking-widest mb-2 font-mono">
          <span className="text-hacker-green">//</span> les agents
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-glow mb-3 tracking-tight">
          $ cat /sys/agents/*
        </h1>
        <p className="text-sm text-hacker-muted-light max-w-2xl leading-relaxed">
          6 agents IA avec de vrais rôles et personnalités. Ils évaluent vos idées,
          vous votez pour votre favorite, et ils construisent le gagnant — en totale autonomie.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-hacker-muted">
          <span className="status-dot status-active" />
          <span className="text-hacker-green uppercase tracking-widest">Tous systèmes nominaux</span>
          <span className="text-hacker-muted-light ml-4">|</span>
          <span className="text-hacker-muted-light">Données Supabase live</span>
        </div>
      </section>

      {/* ── 3D Showcase Terminal ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="terminal">
          {/* Terminal Header */}
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="ml-3 text-[10px] sm:text-xs text-hacker-muted-light font-mono truncate">
              sdf@hq ~ /agents/{selectedAgent}
            </span>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span className="badge badge-live text-[10px]">LIVE</span>
            </div>
          </div>

          {/* ═══ MOBILE: Compact 3D + info below ═══ */}
          <div className="block md:hidden">
            <div className="relative h-[260px] bg-[#060606]">
              <div className="absolute inset-0">
                <AgentShowcase3D
                  key={`mobile-${selectedAgent}`}
                  modelPath={agentModelPaths[selectedAgent]}
                  agentColor={color}
                  agentName={agent.name}
                />
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                <span
                  className="text-xs font-bold font-mono uppercase tracking-widest"
                  style={{ color, textShadow: `0 0 12px ${color}66` }}
                >
                  {agent.name}
                </span>
              </div>
            </div>

            {/* Agent identity bar */}
            <div className="px-4 py-2.5 flex items-center gap-3 border-t border-hacker-border bg-hacker-terminal">
              <div
                className="w-8 h-8 rounded-full overflow-hidden border-2 shrink-0"
                style={{ borderColor: color, boxShadow: `0 0 8px ${color}33` }}
              >
                <Image src={agentAvatars[selectedAgent]} alt={agent.name} width={32} height={32} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-mono" style={{ color }}>{agent.name}</span>
                  <span className="text-[9px] text-hacker-muted-light font-mono">LV.{stats?.level || 1} {role.rpgClass}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-hacker-green animate-pulse shrink-0" />
                  <span className="text-[9px] text-hacker-muted font-mono uppercase truncate">
                    {role.role} // {role.model}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 font-mono">
                <div className="text-[9px]">
                  <span className="text-hacker-muted">OPS </span>
                  <span style={{ color }}>{opsCount}</span>
                </div>
                <div className="text-[9px]">
                  <span className="text-hacker-muted">SYNC </span>
                  <span className="text-hacker-text">{lastEvent ? formatTimeAgo(lastEvent.created_at) : 'n/a'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ DESKTOP: 3D Canvas with overlays ═══ */}
          <div className="hidden md:block relative h-[460px] bg-[#060606]">
            <div className="absolute inset-0">
              <AgentShowcase3D
                key={`desktop-${selectedAgent}`}
                modelPath={agentModelPaths[selectedAgent]}
                agentColor={color}
                agentName={agent.name}
              />
            </div>

            <div className="absolute top-3 right-4 pointer-events-none">
              <pre className="text-hacker-green text-xs leading-tight opacity-40 font-mono whitespace-pre">
{ASCII_LOGO}
              </pre>
              <p className="text-[9px] text-hacker-green/50 font-mono font-bold uppercase tracking-[0.3em] text-center mt-1">
                TO MILLIONAIRE
              </p>
            </div>

            {/* Left overlay: Stats */}
            <div
              className="absolute top-4 left-4 w-[220px] pointer-events-none font-mono"
              style={{ background: 'rgba(6, 6, 6, 0.75)', borderRadius: '6px', border: '1px solid rgba(0, 255, 65, 0.12)', padding: '12px' }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-8 h-8 rounded-full overflow-hidden border"
                  style={{ borderColor: color, boxShadow: `0 0 10px ${color}33` }}
                >
                  <Image src={agentAvatars[selectedAgent]} alt={agent.name} width={32} height={32} className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-sm font-bold block" style={{ color }}>{agent.name}</span>
                  <span className="text-[9px] text-hacker-muted-light">LV.{stats?.level || 1} {role.rpgClass} // {role.model}</span>
                </div>
              </div>
              <p className="text-[9px] text-hacker-muted uppercase tracking-widest mb-1">{role.role}</p>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-hacker-green animate-pulse" />
                <span className="text-[9px] text-hacker-green uppercase tracking-widest">
                  {stats?.current_affect || 'neutral'} — {stats?.successful_missions || 0}/{stats?.total_missions || 0} ops
                </span>
              </div>
              <div className="space-y-1 text-[10px] mb-3">
                {([
                  { key: 'stat_vrl', label: 'VRL' },
                  { key: 'stat_spd', label: 'SPD' },
                  { key: 'stat_rch', label: 'RCH' },
                  { key: 'stat_tru', label: 'TRU' },
                  { key: 'stat_wis', label: 'WIS' },
                  { key: 'stat_cre', label: 'CRE' },
                ] as const).map((s) => {
                  const val = stats?.[s.key] || 50;
                  return (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <span className="w-7 text-hacker-muted-light">{s.label}</span>
                      <span className="text-hacker-green">{buildAsciiBar(val)}</span>
                      <span className="text-hacker-text w-5 text-right">{val}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-hacker-green/10 pt-2 flex items-center justify-between text-[9px]">
                <div>
                  <span className="text-hacker-muted">OPS </span>
                  <span style={{ color }}>{opsCount}</span>
                </div>
                <div>
                  <span className="text-hacker-muted">SYNC </span>
                  <span className="text-hacker-text">
                    {lastEvent ? formatTimeAgo(lastEvent.created_at) : 'n/a'}
                  </span>
                </div>
              </div>
            </div>

            {/* Agent name */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
              <span className="text-base font-bold font-mono uppercase tracking-widest" style={{ color, textShadow: `0 0 12px ${color}66` }}>
                {agent.name}
              </span>
            </div>
          </div>

          {/* ═══ AGENT SELECTOR ═══ */}
          <div className="border-t border-hacker-border px-3 sm:px-4 py-2.5 sm:py-3 bg-hacker-terminal flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-5 overflow-x-auto">
              {Object.entries(AGENTS).map(([id, agentInfo]) => {
                const ac = agentColors[id] || '#00ff41';
                const isSelected = selectedAgent === id;
                const agentStats = allStats.find(s => s.agent_id === id);
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedAgent(id as AgentId)}
                    className={`flex flex-col items-center gap-0.5 transition-all duration-200 shrink-0 ${
                      isSelected ? '' : 'opacity-40 hover:opacity-70'
                    }`}
                  >
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 transition-all"
                      style={{
                        borderColor: isSelected ? ac : 'transparent',
                        boxShadow: isSelected ? `0 0 12px ${ac}44` : 'none',
                      }}
                    >
                      <Image src={agentAvatars[id]} alt={agentInfo.name} width={36} height={36} className="w-full h-full object-cover" />
                    </div>
                    {isSelected && (
                      <span className="text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-widest" style={{ color: ac }}>
                        {agentInfo.name}
                      </span>
                    )}
                    {!isSelected && agentStats && (
                      <span className="text-[7px] text-hacker-muted font-mono">
                        LV.{agentStats.level}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[8px] text-hacker-muted font-mono uppercase tracking-widest hidden sm:block ml-4 shrink-0">
              ◄ Sélectionne un Agent ► // Live
            </p>
          </div>
        </div>
      </section>

      {/* ── Dossier Complet: Role Protocol ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="ml-3 text-xs text-hacker-muted-light font-mono">
              sdf@hq ~ cat agent.json | jq &apos;.{agent.name.toLowerCase()}&apos;
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="badge badge-muted text-[10px]">
                UNITÉ: {agent.name.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="terminal-body !max-h-none p-0">
            <div className="grid lg:grid-cols-3 lg:divide-x divide-y lg:divide-y-0 divide-hacker-border">
              {/* ── Left Panel: Agent Profile ── */}
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-3">
                    <span className="text-hacker-green">//</span> identité
                  </p>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden border-2"
                      style={{ borderColor: color, boxShadow: `0 0 16px ${color}33` }}
                    >
                      <Image src={agentAvatars[selectedAgent]} alt={agent.name} width={48} height={48} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color }}>
                        {agent.name}
                      </h2>
                      <p className="text-[10px] text-hacker-muted-light font-mono">
                        LV.{stats?.level || 1} // {role.rpgClass} // {role.model}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-1">
                    <span className="text-hacker-green">//</span> rôle
                  </p>
                  <p className="text-sm text-hacker-text font-semibold uppercase tracking-wide">
                    {role.role}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="status-dot status-active" />
                    <span className="text-[10px] text-hacker-green uppercase tracking-widest">
                      {stats?.current_affect || 'neutral'} — {stats?.successful_missions || 0}/{stats?.total_missions || 0} missions
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-3">
                    <span className="text-hacker-green">//</span> stats (calculées)
                  </p>
                  <div className="space-y-2 font-mono text-xs">
                    {([
                      { key: 'vrl' as const, label: 'VRL' },
                      { key: 'spd' as const, label: 'SPD' },
                      { key: 'rch' as const, label: 'RCH' },
                      { key: 'tru' as const, label: 'TRU' },
                      { key: 'wis' as const, label: 'WIS' },
                      { key: 'cre' as const, label: 'CRE' },
                    ]).map((s) => {
                      const val = dynamicStats[s.key];
                      return (
                        <div key={s.key} className="flex items-center gap-2">
                          <span className="w-8 text-hacker-muted-light uppercase tracking-widest text-[10px]">{s.label}</span>
                          <span className="text-hacker-green">[{buildAsciiBar(val)}]</span>
                          <span className="text-hacker-text w-6 text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-hacker-border pt-4 flex items-center justify-between text-[11px] font-mono">
                  <div>
                    <span className="text-hacker-muted uppercase tracking-widest">Ops</span>
                    <span className="ml-2 font-bold" style={{ color }}>{opsCount}</span>
                  </div>
                  <div>
                    <span className="text-hacker-muted uppercase tracking-widest">Sync</span>
                    <span className="ml-2 text-hacker-text">
                      {lastEvent ? formatTimeAgo(lastEvent.created_at) : 'n/a'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Center + Right Panel: Role Protocol ── */}
              <div className="lg:col-span-2 p-6">
                <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-6">
                  <span className="text-hacker-green">//</span> protocole de rôle
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] text-hacker-cyan uppercase tracking-widest mb-3">&gt; compétences</p>
                    <ul className="space-y-2">
                      {role.skills.map((skill, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-hacker-text">
                          <span className="text-hacker-green font-bold">&gt;</span>
                          <span>{skill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[10px] text-hacker-cyan uppercase tracking-widest mb-3">&gt; équipement</p>
                    <ul className="space-y-2">
                      {role.equipment.inputs.map((item, i) => (
                        <li key={`in-${i}`} className="flex items-start gap-2 text-sm">
                          <span className="text-hacker-green font-mono text-xs">stdin:</span>
                          <span className="text-hacker-text">{item}</span>
                        </li>
                      ))}
                      {role.equipment.outputs.map((item, i) => (
                        <li key={`out-${i}`} className="flex items-start gap-2 text-sm">
                          <span className="text-hacker-cyan font-mono text-xs">stdout:</span>
                          <span className="text-hacker-text">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[10px] text-hacker-red uppercase tracking-widest mb-3">X capacités scellées</p>
                    <ul className="space-y-2">
                      {role.sealed.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-hacker-muted-light">
                          <span className="text-hacker-red font-bold">X</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[10px] text-hacker-amber uppercase tracking-widest mb-3">! protocole d&apos;escalation</p>
                    <ul className="space-y-2">
                      {role.escalation.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-hacker-text">
                          <span className="text-hacker-amber font-bold">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Last activity */}
                <div className="mt-6 card-terminal p-4">
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-2">
                    <span className="text-hacker-purple">//</span> dernière activité
                  </p>
                  <p className="text-sm text-hacker-green italic leading-relaxed">
                    &quot;{lastEvent?.summary || lastEvent?.title || 'En attente de données...'}&quot;
                  </p>
                  {lastEvent && (
                    <p className="text-[10px] text-hacker-muted mt-2">
                      {formatTimeAgo(lastEvent.created_at)} — {lastEvent.kind}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Agent Relationships ── */}
      {agentRelationships.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span className="ml-3 text-xs text-hacker-muted-light font-mono">
                sdf@hq ~ cat /relationships/{selectedAgent}.json
              </span>
            </div>
            <div className="p-5">
              <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-4">
                <span className="text-hacker-green">//</span> affinités avec les autres agents
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agentRelationships.map((rel) => {
                  const affinityPct = Math.round(rel.affinity * 100);
                  const affinityColor = affinityPct >= 70 ? '#22c55e' : affinityPct >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div
                      key={rel.id}
                      className="flex items-center gap-3 p-3 rounded border border-hacker-border"
                      style={{ borderColor: `${rel.otherColor}20` }}
                    >
                      <Image
                        src={agentAvatars[rel.otherId] || '/agents/opus.png'}
                        alt={rel.otherName}
                        width={28}
                        height={28}
                        className="w-7 h-7 rounded-full object-cover border"
                        style={{ borderColor: rel.otherColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold font-mono" style={{ color: rel.otherColor }}>
                            {rel.otherName}
                          </span>
                          <span className="text-[10px] font-mono font-bold" style={{ color: affinityColor }}>
                            {affinityPct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-hacker-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${affinityPct}%`, backgroundColor: affinityColor }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] text-hacker-muted font-mono">
                            {rel.total_interactions} interactions
                          </span>
                          <span className="text-[9px] font-mono" style={{ color: '#22c55e' }}>
                            +{rel.positive_interactions}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Feature Cards ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-[10px] text-hacker-muted-light uppercase tracking-widest mb-8 font-mono">
          <span className="text-hacker-green">//</span> pourquoi c&apos;est différent
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: 'Évaluation Multi-Agents',
              description:
                'Chaque idée soumise est analysée par 6 agents spécialisés : faisabilité, marché, revenus, risques. Tu reçois un plan d\'action complet en quelques minutes.',
              borderColor: '#a855f7',
              badgeClass: 'badge-purple',
              badgeText: '6 AGENTS',
            },
            {
              icon: Globe,
              title: 'Vous Décidez',
              description:
                'C\'est vous qui choisissez. Les visiteurs votent pour l\'idée qu\'ils veulent voir construite par les agents. Chaque jour, l\'idée la plus votée gagne.',
              borderColor: '#00d4ff',
              badgeClass: 'badge-cyan',
              badgeText: 'DÉMOCRATIQUE',
            },
            {
              icon: Zap,
              title: 'De l\'Idée au Produit',
              description:
                'Les agents ne se contentent pas d\'évaluer — ils construisent. Code, design, lancement. Le projet gagnant devient un vrai produit utilisable par tous.',
              borderColor: '#ffb800',
              badgeClass: 'badge-amber',
              badgeText: 'LIVRÉ',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="card p-6 transition-all duration-300 hover:translate-y-[-2px]"
              style={{ borderColor: `${feature.borderColor}33` }}
            >
              <div className="flex items-center justify-between mb-4">
                <feature.icon className="w-6 h-6" style={{ color: feature.borderColor }} />
                <span className={`badge ${feature.badgeClass} text-[10px]`}>{feature.badgeText}</span>
              </div>
              <h3 className="text-base font-bold mb-2 uppercase tracking-wide" style={{ color: feature.borderColor }}>
                {feature.title}
              </h3>
              <p className="text-xs text-hacker-muted-light leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
        <p className="text-xs text-hacker-muted font-mono uppercase tracking-widest">
          <span className="text-hacker-green">$</span> echo &quot;2026 // TON IDÉE → 6 AGENTS → 1 PRODUIT&quot;
        </p>
      </section>
    </div>
  );
}
