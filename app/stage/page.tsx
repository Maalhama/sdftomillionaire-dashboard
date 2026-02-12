'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pause, Play, RefreshCw, Activity, MessageSquare, Zap, Brain, Rocket } from 'lucide-react';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';

const agentAvatars: Record<string, string> = {
  opus: '/agents/opus.png',
  brain: '/agents/brain.png',
  growth: '/agents/growth.png',
  creator: '/agents/creator.jpg',
  'twitter-alt': '/agents/twitter-alt.png',
  'company-observer': '/agents/company-observer.jpg',
};

const agentColors: Record<string, string> = {
  opus: '#f59e0b',
  brain: '#8b5cf6',
  growth: '#22c55e',
  creator: '#ec4899',
  'twitter-alt': '#3b82f6',
  'company-observer': '#ef4444',
};

const agentNoms: Record<string, string> = {
  opus: 'CEO',
  brain: 'KIRA',
  growth: 'MADARA',
  creator: 'STARK',
  'twitter-alt': 'L',
  'company-observer': 'USOPP',
};

interface Event {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  summary: string;
  created_at: string;
}

interface Roundtable {
  id: string;
  format: string;
  topic: string;
  participants: string[];
  status: string;
  turn_count: number;
  conversation_log: Array<{
    speaker: string;
    dialogue?: string;
    message?: string;
    turn: number;
  }>;
  created_at: string;
}

interface AgentStats {
  agent_id: string;
  level: number;
  total_missions: number;
}

function tempsEcoule(date: string): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}m`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures}h`;
  return `il y a ${Math.floor(heures / 24)}j`;
}

export default function PageStage() {
  const [pause, setPause] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [roundtable, setRoundtable] = useState<Roundtable | null>(null);
  const [missionCount, setMissionCount] = useState({ done: 0, total: 0 });
  const [refresh, setRefresh] = useState(30);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async () => {
    const [{ data: eventsData }, { data: statsData }, { count: doneCount }, { count: totalCount }] = await Promise.all([
      supabase.from('ops_agent_events').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('ops_agent_stats').select('*'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }),
    ]);

    setEvents(eventsData || []);
    setStats(statsData || []);
    setMissionCount({ done: doneCount || 0, total: totalCount || 10 });

    const { data: rtData } = await supabase
      .from('ops_roundtable_queue')
      .select('*')
      .or('status.eq.running,status.eq.pending,status.eq.succeeded')
      .order('created_at', { ascending: false })
      .limit(1);

    if (rtData?.[0]) setRoundtable(rtData[0] as Roundtable);
    setLoading(false);
  }, []);

  useEffect(() => {
    charger();
    setNow(new Date());

    const channel = supabase
      .channel('stage-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_agent_events' }, (p) => {
        setEvents(prev => [p.new as Event, ...prev.slice(0, 29)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_roundtable_queue' }, (p) => {
        if (p.new) setRoundtable(p.new as Roundtable);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [charger]);

  useEffect(() => {
    if (pause) return;
    const interval = setInterval(() => {
      setRefresh(prev => {
        if (prev <= 0) {
          charger();
          setNow(new Date());
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pause, charger]);

  const getStatut = (agentId: string) => {
    const recent = events.find(e => e.agent_id === agentId);
    if (!recent) return 'veille';
    const min = (Date.now() - new Date(recent.created_at).getTime()) / 60000;
    if (min < 5) return 'actif';
    if (min < 15) return 'travail';
    return 'veille';
  };

  const getEventIcon = (kind: string) => {
    switch (kind) {
      case 'thought':
      case 'insight': return <Brain className="w-3 h-3" />;
      case 'pulse':
      case 'heartbeat': return <Zap className="w-3 h-3" />;
      case 'conversation':
      case 'chat': return <MessageSquare className="w-3 h-3" />;
      case 'mission':
      case 'mission_complete': return <Rocket className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  const pct = missionCount.total > 0 ? Math.round((missionCount.done / missionCount.total) * 100) : 0;
  const barre = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));

  const agentsData = Object.entries(AGENTS).map(([id, info]) => {
    const s = stats.find(st => st.agent_id === id);
    const statut = getStatut(id);
    const dernierEvent = events.find(e => e.agent_id === id);
    return {
      id,
      nom: agentNoms[id] || info.name,
      statut,
      pensee: dernierEvent?.summary || dernierEvent?.title || 'En attente...',
      level: s?.level || 1,
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hacker-green font-mono text-sm">Chargement du stage...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* En-tête */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hacker-green flex items-center gap-2">
              // Le Stage
              <span className="badge badge-live text-xs">Live</span>
            </h1>
            <div className="flex items-center gap-3 text-xs text-hacker-muted font-mono mt-1">
              <span>{refresh}s</span>
              <span>•</span>
              <span>{events.length} événements</span>
              <span>•</span>
              <span>{now?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPause(!pause)} className="btn-secondary text-xs flex items-center gap-1">
              {pause ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {pause ? 'Reprendre' : 'Pause'}
            </button>
            <button onClick={() => { charger(); setRefresh(30); }} className="btn-secondary text-xs flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Actualiser
            </button>
          </div>
        </div>

        {/* Monitoring Agents */}
        <div className="mb-6">
          <p className="text-xs text-hacker-green font-mono mb-3">// monitoring_agents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentsData.map((agent) => {
              const color = agentColors[agent.id];
              const isActif = agent.statut !== 'veille';
              return (
                <div
                  key={agent.id}
                  className="card-terminal"
                  style={{ borderColor: isActif ? color : undefined }}
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-hacker-border bg-hacker-terminal">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        agent.statut === 'actif' ? 'bg-hacker-green animate-pulse' : 
                        agent.statut === 'travail' ? 'bg-hacker-amber' : 'bg-hacker-muted'
                      }`} />
                      <span className="text-xs font-bold" style={{ color }}>{agent.nom}</span>
                      <span className="text-[10px] text-hacker-muted">Nv.{agent.level}</span>
                    </div>
                    <span className="text-[10px] text-hacker-muted uppercase">
                      {agent.statut === 'actif' ? 'ACTIF' : agent.statut === 'travail' ? 'TRAVAIL' : 'VEILLE'}
                    </span>
                  </div>
                  <div className="px-3 py-2 text-xs">
                    <span className="text-hacker-muted">&gt; </span>
                    <span className="text-hacker-text">{agent.pensee}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progression Missions */}
        <div className="card-terminal p-4 mb-6">
          <p className="text-xs text-hacker-green font-mono mb-2">// progression_missions</p>
          <div className="font-mono text-sm">
            <span className="text-hacker-amber">MISSIONS {missionCount.done}/{missionCount.total}</span>
            <span className="text-hacker-muted mx-2">[</span>
            <span className="text-hacker-green">{barre}</span>
            <span className="text-hacker-muted">]</span>
            <span className="text-hacker-text ml-2">{pct}%</span>
          </div>
        </div>

        {/* Conversation Live */}
        {roundtable && (
          <div className="mb-6">
            <p className="text-xs text-hacker-green font-mono mb-3">// conversation_live</p>
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot red" />
                <div className="terminal-dot yellow" />
                <div className="terminal-dot green" />
                <span className="text-xs text-hacker-muted ml-3 font-mono">
                  roundtable --format={roundtable.format}
                </span>
                <span className={`ml-auto badge ${roundtable.status === 'running' ? 'badge-live' : 'badge-muted'} text-[10px]`}>
                  {roundtable.status === 'running' ? '🔴 Live' : roundtable.status.toUpperCase()}
                </span>
              </div>

              <div className="p-4 max-h-[350px] overflow-y-auto">
                <div className="mb-3 pb-2 border-b border-hacker-border">
                  <p className="text-sm text-hacker-amber mb-1">💬 {roundtable.topic}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {roundtable.participants.map((p) => (
                      <span key={p} className="badge badge-muted" style={{ color: agentColors[p] }}>
                        {agentNoms[p] || p}
                      </span>
                    ))}
                    <span className="text-hacker-muted ml-2">
                      {roundtable.turn_count} tours
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {roundtable.conversation_log?.map((tour, idx) => (
                    <div key={idx} className="font-mono text-xs">
                      <span className="text-hacker-muted">[{idx + 1}]</span>{' '}
                      <span style={{ color: agentColors[tour.speaker] }} className="font-bold">
                        {agentNoms[tour.speaker] || tour.speaker}:
                      </span>{' '}
                      <span className="text-hacker-text">{tour.dialogue || tour.message}</span>
                    </div>
                  ))}
                  {roundtable.status === 'running' && (
                    <div className="font-mono text-xs text-hacker-green animate-pulse">
                      ▋ en attente...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fil d'événements */}
        <div>
          <p className="text-xs text-hacker-green font-mono mb-3">// fil_événements</p>
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span className="text-xs text-hacker-muted ml-3 font-mono">tail -f /var/log/events</span>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto space-y-1">
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-8 h-8 text-hacker-muted mx-auto mb-2" />
                  <p className="text-hacker-muted text-sm">Aucun événement récent</p>
                </div>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 py-1.5 border-b border-hacker-border/30 font-mono text-xs"
                  >
                    <span className="text-hacker-muted w-16 shrink-0">{tempsEcoule(event.created_at)}</span>
                    <span className="font-bold w-16 shrink-0" style={{ color: agentColors[event.agent_id] }}>
                      {agentNoms[event.agent_id]}
                    </span>
                    <span className="text-hacker-muted">{getEventIcon(event.kind)}</span>
                    <span className="text-hacker-text">{event.title || event.summary}</span>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-hacker-border">
                <span className="text-hacker-green animate-blink">█</span>
                <span className="text-hacker-green/70 text-xs">écoute Supabase...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
