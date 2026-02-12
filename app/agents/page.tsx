'use client';

import { useEffect, useState } from 'react';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';
import { ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';

// ═══ TYPES ═══

interface AgentStats {
  agent_id: string;
  experience_points: number;
  level: number;
  total_missions: number;
  successful_missions: number;
  stat_wis: number;
  stat_tru: number;
  stat_spd: number;
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

// ═══ STATIC DATA ═══

const agentColors: Record<string, string> = {
  opus: '#f59e0b',
  brain: '#8b5cf6',
  growth: '#22c55e',
  creator: '#ec4899',
  'twitter-alt': '#3b82f6',
  'company-observer': '#ef4444',
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
  equipment: string[];
  sealed: string[];
  escalation: string[];
}> = {
  opus: {
    role: 'Chef des Opérations',
    rpgClass: 'Commander',
    model: 'Claude Opus 4',
    skills: ['Routage de tâches et priorité', 'Coordination d\'équipe', 'Standups et synthèses hebdo'],
    equipment: ['Propositions de l\'équipe', 'Résultats de missions', 'Décisions approuvées/rejetées', 'Rankings de priorité'],
    sealed: ['Délégation uniquement', 'Pas de déploiement sans approbation'],
    escalation: ['Décisions financières', 'Communications externes humains'],
  },
  brain: {
    role: 'Chef de Recherche',
    rpgClass: 'Sage',
    model: 'GPT-4o',
    skills: ['Recherche et analyse de données', 'Insights stratégiques', 'Vérification des faits'],
    equipment: ['Données brutes crawlers', 'Signaux marché', 'Rapports avec citations', 'Analyses de tendances'],
    sealed: ['Pas de données inventées', 'Analyse uniquement'],
    escalation: ['Sources contradictoires', 'Décisions fort enjeu'],
  },
  growth: {
    role: 'Spécialiste Croissance',
    rpgClass: 'Ranger',
    model: 'GPT-4o',
    skills: ['Détection d\'opportunités marché', 'Analyse concurrentielle', 'Stratégies de croissance'],
    equipment: ['Tendances marché', 'Activités concurrents', 'Rapports d\'opportunités', 'Alertes time-sensitive'],
    sealed: ['Pas de comparaisons non vérifiées', 'Pas de garanties'],
    escalation: ['Opportunités fort investissement', 'Actions concurrentes urgentes'],
  },
  creator: {
    role: 'Directeur Créatif',
    rpgClass: 'Artisan',
    model: 'Claude Sonnet 4.5',
    skills: ['Contenu et storytelling', 'Copywriting créatif', 'Concepts et hooks'],
    equipment: ['Insights de Kira', 'Guidelines de marque', 'Brouillons de contenu', 'Variantes pour testing'],
    sealed: ['Pas d\'invention de faits', 'Contenu original uniquement'],
    escalation: ['Sujets controversés', 'Préoccupations légales'],
  },
  'twitter-alt': {
    role: 'Directeur Réseaux Sociaux',
    rpgClass: 'Bard',
    model: 'GPT-4o-mini',
    skills: ['Stratégie d\'engagement', 'Contenu viral', 'Interaction communauté'],
    equipment: ['Brouillons de Stark', 'Feedback engagement', 'Tweets/threads', 'Flags de risque'],
    sealed: ['Brouillons uniquement', 'Pas de chiffres inventés'],
    escalation: ['Claims numériques', 'Sujets politiques'],
  },
  'company-observer': {
    role: 'Auditeur Opérations',
    rpgClass: 'Oracle',
    model: 'GPT-4o',
    skills: ['Audit de processus', 'Monitoring système', 'Détection d\'anomalies'],
    equipment: ['Logs de missions', 'Métriques agents', 'Rapports d\'audit', 'Scores de qualité'],
    sealed: ['Pas de blâme', 'Recommandations uniquement'],
    escalation: ['Échecs qualité répétés', 'Problèmes de sécurité'],
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('agents-hq-updates')
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
    const [{ data: stats }, { data: events }] = await Promise.all([
      supabase.from('ops_agent_stats').select('*'),
      supabase.from('ops_agent_events').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setAllStats(stats || []);
    setRecentEvents(events || []);
    setLoading(false);
  }

  const agent = AGENTS[selectedAgent];
  const color = agentColors[selectedAgent] || '#00ff41';
  const role = agentRoles[selectedAgent];
  const stats = allStats.find(s => s.agent_id === selectedAgent) || null;
  const lastEvent = recentEvents.find(e => e.agent_id === selectedAgent) || null;
  const opsCount = recentEvents.filter(e => e.agent_id === selectedAgent).length;

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
      {/* ═══ SHOWCASE TERMINAL — Single compact block ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12">
        <div className="terminal">
          {/* Terminal Header */}
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="ml-3 text-xs text-hacker-muted-light font-mono">
              sdf@hq ~ showcase /agents/{selectedAgent}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="badge badge-live text-[10px]">LIVE</span>
            </div>
          </div>

          {/* ═══ 3D CANVAS + OVERLAYS ═══ */}
          <div className="relative h-[420px] sm:h-[460px] bg-[#060606]">
            {/* 3D Canvas — full area */}
            <div className="absolute inset-0">
              <AgentShowcase3D
                key={selectedAgent}
                modelPath={agentModelPaths[selectedAgent]}
                agentColor={color}
                agentName={agent.name}
              />
            </div>

            {/* ── TOP-RIGHT: Title ── */}
            <div className="absolute top-4 right-4 text-right pointer-events-none">
              <h1 className="text-lg sm:text-xl font-bold text-white/80 font-mono tracking-wider uppercase">
                SDF Agent HQ
              </h1>
              <p className="text-[9px] text-hacker-muted font-mono uppercase tracking-widest">
                Unité: {agent.name}
              </p>
            </div>

            {/* ── LEFT OVERLAY: Stats ── */}
            <div
              className="absolute top-4 left-4 w-[200px] sm:w-[220px] pointer-events-none font-mono"
              style={{ background: 'rgba(6, 6, 6, 0.75)', borderRadius: '6px', border: '1px solid rgba(0, 255, 65, 0.12)', padding: '12px' }}
            >
              {/* Identity */}
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base border"
                  style={{ borderColor: color, boxShadow: `0 0 10px ${color}33` }}
                >
                  {agent.emoji}
                </div>
                <div>
                  <span className="text-sm font-bold block" style={{ color }}>{agent.name}</span>
                  <span className="text-[9px] text-hacker-muted-light">LV.{stats?.level || 1} {role.rpgClass}</span>
                </div>
              </div>

              {/* Role + status */}
              <p className="text-[9px] text-hacker-muted uppercase tracking-widest mb-1">
                {role.role}
              </p>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-hacker-green animate-pulse" />
                <span className="text-[9px] text-hacker-green uppercase tracking-widest">
                  {stats?.current_affect || 'neutral'} — {stats?.successful_missions || 0}/{stats?.total_missions || 0} ops
                </span>
              </div>

              {/* Stat Bars */}
              <div className="space-y-1 text-[10px] mb-3">
                {([
                  { key: 'stat_wis', label: 'WIS' },
                  { key: 'stat_tru', label: 'TRU' },
                  { key: 'stat_spd', label: 'SPD' },
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

              {/* Ops / Sync */}
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

            {/* ── RIGHT OVERLAY: Role Protocol ── */}
            <div
              className="absolute top-14 right-4 w-[220px] sm:w-[250px] pointer-events-none font-mono hidden md:block"
              style={{ background: 'rgba(6, 6, 6, 0.75)', borderRadius: '6px', border: '1px solid rgba(0, 255, 65, 0.12)', padding: '12px' }}
            >
              <p className="text-[9px] text-hacker-muted uppercase tracking-widest mb-3">
                Protocole de Rôle
              </p>

              {/* Skills + Equipment side by side */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[8px] text-hacker-cyan uppercase tracking-widest mb-1.5">Skills</p>
                  {role.skills.map((skill, i) => (
                    <p key={i} className="text-[9px] text-hacker-text leading-snug mb-1">
                      <span className="text-hacker-green">&gt;</span> {skill}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-[8px] text-hacker-cyan uppercase tracking-widest mb-1.5">Équipement</p>
                  {role.equipment.map((item, i) => (
                    <p key={i} className="text-[9px] text-hacker-text leading-snug mb-1">
                      <span className="text-hacker-muted">&gt;</span> {item}
                    </p>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <a
                href="/about"
                className="flex items-center gap-1 text-[9px] text-hacker-green uppercase tracking-widest hover:text-white transition-colors pointer-events-auto"
              >
                <span>Dossier Complet</span>
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>

            {/* ── BOTTOM: Agent name label ── */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
              <span
                className="text-sm sm:text-base font-bold font-mono uppercase tracking-widest"
                style={{ color, textShadow: `0 0 12px ${color}66` }}
              >
                {agent.name}
              </span>
            </div>
          </div>

          {/* ═══ AGENT SELECTOR ═══ */}
          <div className="border-t border-hacker-border px-4 py-3 bg-hacker-terminal flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto">
              {Object.entries(AGENTS).map(([id, agentInfo]) => {
                const ac = agentColors[id] || '#00ff41';
                const isSelected = selectedAgent === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedAgent(id as AgentId)}
                    className={`flex flex-col items-center gap-0.5 transition-all duration-200 shrink-0 ${
                      isSelected ? '' : 'opacity-40 hover:opacity-70'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base border-2 transition-all"
                      style={{
                        borderColor: isSelected ? ac : 'transparent',
                        boxShadow: isSelected ? `0 0 12px ${ac}44` : 'none',
                      }}
                    >
                      {agentInfo.emoji}
                    </div>
                    {isSelected && (
                      <span className="text-[8px] font-mono font-bold uppercase tracking-widest" style={{ color: ac }}>
                        {agentInfo.name}
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
    </div>
  );
}
