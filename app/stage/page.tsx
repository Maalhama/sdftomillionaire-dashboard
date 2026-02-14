'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Pause, Play, Monitor, CheckSquare, MessageCircle, Brain, Zap, MessageSquare, Rocket, Terminal, Activity, Eye, Search, PenTool, Megaphone, BarChart3, RefreshCw, Wrench, CheckCircle, Package } from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';

const HQRoom3D = dynamic(() => import('@/components/stage/HQRoom3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] sm:h-[520px] flex items-center justify-center font-mono text-xs text-hacker-green">
      <span className="animate-pulse">// loading 3d_room...</span>
    </div>
  ),
});

import type { AgentLiveData, AgentStatus } from '@/components/stage/HQRoom3D';

interface Event {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  summary: string;
  tags: string[];
  metadata: any;
  created_at: string;
}

interface AgentStats {
  agent_id: string;
  level: number;
  experience_points: number;
  total_missions: number;
  successful_missions: number;
}

interface ActiveBuild {
  id: string;
  content: string;
  status: string;
  ai_plan: { build_plan?: { project_name?: string } } | null;
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
    timestamp?: string;
  }>;
  created_at: string;
  finished_at?: string;
}

const statusMap: Record<string, { dot: string; label: string }> = {
  discussing: { dot: 'status-active', label: 'DISCUSSION' },
  roaming: { dot: 'status-active', label: 'EN MISSION' },
  working: { dot: 'status-working', label: 'WORKING' },
  idle: { dot: 'status-idle', label: 'IDLE' },
};

export default function StagePage() {
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [events, setEvents] = useState<Event[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [missionCount, setMissionCount] = useState({ completed: 0, total: 0 });
  const [nextRefresh, setNextRefresh] = useState(30);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoundtable, setActiveRoundtable] = useState<Roundtable | null>(null);
  const [activeBuilds, setActiveBuilds] = useState<ActiveBuild[]>([]);
  const [, setTick] = useState(0); // force re-render every second for cooldown

  const fetchData = useCallback(async () => {
    try {
      const [
        { data: eventsData },
        { data: statsData },
        { count: completedCount },
        { count: totalCount },
        { data: roundtableData },
        { data: buildsData },
      ] = await Promise.all([
        supabase.from('ops_agent_events').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('ops_agent_stats').select('*'),
        supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('ops_missions').select('*', { count: 'exact', head: true }),
        supabase.from('ops_roundtable_queue').select('*').or('status.eq.running,status.eq.pending,status.eq.succeeded').order('created_at', { ascending: false }).limit(1),
        supabase.from('user_prompts').select('id, content, status, ai_plan, created_at').in('status', ['winner', 'building', 'completed', 'published']).order('created_at', { ascending: false }).limit(5),
      ]);

      setEvents(eventsData || []);
      setAgentStats(statsData || []);
      setMissionCount({ completed: completedCount || 0, total: totalCount || 10 });
      if (roundtableData?.[0]) {
        setActiveRoundtable(roundtableData[0] as Roundtable);
      }
      setActiveBuilds((buildsData as ActiveBuild[]) || []);
    } catch (err) {
      console.error('Stage fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    setNow(new Date());

    // Safety timeout: force loading off after 8s
    const timeout = setTimeout(() => setLoading(false), 8000);

    // Subscribe to realtime events
    const channel = supabase
      .channel('stage-events')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ops_agent_events' },
        (payload) => {
          setEvents(prev => [payload.new as Event, ...prev.slice(0, 29)]);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ops_roundtable_queue' },
        (payload) => {
          if (payload.new) {
            setActiveRoundtable(payload.new as Roundtable);
          }
        }
      )
      .subscribe();

    return () => { clearTimeout(timeout); supabase.removeChannel(channel); };
  }, [fetchData]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      // Tick every second to re-render (needed for post-roundtable cooldown)
      setTick(t => t + 1);
      setNextRefresh(prev => {
        if (prev <= 0) {
          fetchData();
          setNow(new Date());
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, fetchData]);

  // Blinking cursor
  useEffect(() => {
    const blink = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 530);
    return () => clearInterval(blink);
  }, []);

  const getAgentName = (agentId: string) => AGENTS[agentId as AgentId]?.name || agentId.toUpperCase();
  const getAgentColor = (agentId: string) => AGENTS[agentId as AgentId]?.color || '#00ff41';
  const getAgentEmoji = (agentId: string) => AGENTS[agentId as AgentId]?.emoji || '🤖';
  const getAgentAvatar = (agentId: string) => AGENTS[agentId as AgentId]?.avatar || '/agents/opus.png';

  const getAgentStatus = (agentId: string): AgentStatus => {
    // 1. Roundtable active (running/pending) → discussing
    if (
      activeRoundtable &&
      (activeRoundtable.status === 'running' || activeRoundtable.status === 'pending') &&
      activeRoundtable.participants.includes(agentId)
    ) {
      return 'discussing';
    }

    // 1b. Roundtable just finished — keep agents at table until all chat bubbles played
    // Formula: 10s walk + turns*5s interval + 15s reading time
    if (
      activeRoundtable &&
      activeRoundtable.participants.includes(agentId) &&
      (activeRoundtable.status === 'succeeded' || activeRoundtable.status === 'failed') &&
      activeRoundtable.finished_at
    ) {
      const finishedAt = new Date(activeRoundtable.finished_at).getTime();
      const turnCount = activeRoundtable.turn_count || activeRoundtable.conversation_log?.length || 6;
      const cooldownMs = 15000 + turnCount * 7000 + 30000; // 15s walk + turns*7s interval + 30s reading buffer
      if (Date.now() < finishedAt + cooldownMs) {
        return 'discussing';
      }
    }

    // 2. Active build (status = building) → roaming (agents are working)
    const hasActiveBuild = activeBuilds.some(b => b.status === 'building');
    const recentEvent = events.find(e => e.agent_id === agentId);
    if (!recentEvent) return 'idle';

    const minutesAgo = (Date.now() - new Date(recentEvent.created_at).getTime()) / 60000;

    if (hasActiveBuild && minutesAgo < 15) return 'roaming';

    // 3. Recent event < 5min → roaming (active agent walking around)
    if (minutesAgo < 5) return 'roaming';

    // 4. Recent event 5-15min → working (at desk)
    if (minutesAgo < 15) return 'working';

    // 5. No recent event → idle (sleeping at desk)
    return 'idle';
  };

  const getEventTypeColor = (kind: string) => {
    switch (kind) {
      case 'thought':
      case 'insight': return 'text-hacker-purple';
      case 'pulse':
      case 'heartbeat': return 'text-hacker-green';
      case 'conversation':
      case 'chat': return 'text-hacker-cyan';
      case 'mission':
      case 'mission_complete': return 'text-hacker-amber';
      case 'error': return 'text-hacker-red';
      default: return 'text-hacker-text';
    }
  };

  const getEventTypeLabel = (kind: string) => {
    switch (kind) {
      case 'thought':
      case 'insight': return 'THINK';
      case 'pulse':
      case 'heartbeat': return 'PULSE';
      case 'conversation':
      case 'chat': return 'CHAT';
      case 'mission':
      case 'mission_complete': return 'MISSION';
      case 'error': return 'ERROR';
      default: return kind.toUpperCase();
    }
  };

  const getEventIcon = (kind: string) => {
    switch (kind) {
      case 'thought':
      case 'insight': return <Brain className="w-3.5 h-3.5" />;
      case 'pulse':
      case 'heartbeat': return <Zap className="w-3.5 h-3.5" />;
      case 'conversation':
      case 'chat': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'mission':
      case 'mission_complete': return <Rocket className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const getAgentIcon = (agentId: string) => {
    switch (agentId) {
      case 'opus': return <Terminal className="w-3.5 h-3.5" />;
      case 'brain': return <Brain className="w-3.5 h-3.5" />;
      case 'growth': return <Search className="w-3.5 h-3.5" />;
      case 'creator': return <PenTool className="w-3.5 h-3.5" />;
      case 'twitter-alt': return <Megaphone className="w-3.5 h-3.5" />;
      case 'company-observer': return <Eye className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const formatTimeAgo = (date: string) => {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `il y a ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours}h`;
    return `il y a ${Math.floor(hours / 24)}j`;
  };

  // Mission progress bar
  const progressPercent = missionCount.total > 0 
    ? Math.round((missionCount.completed / missionCount.total) * 100) 
    : 0;
  const barLength = 20;
  const filled = Math.round((progressPercent / 100) * barLength);
  const progressBar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

  // Get agents with their stats
  const agentsWithStats = Object.entries(AGENTS).map(([id, agent]) => {
    const stats = agentStats.find(s => s.agent_id === id);
    const status = getAgentStatus(id);
    const lastEvent = events.find(e => e.agent_id === id);
    
    return {
      id,
      name: agent.name,
      emoji: agent.emoji,
      avatar: agent.avatar,
      status,
      thought: lastEvent?.summary || lastEvent?.title || 'En attente...',
      level: stats?.level || 1,
      xp: stats?.experience_points || 0,
    };
  });

  // Build live agent data for 3D room
  const liveAgents: AgentLiveData[] = agentsWithStats.map(a => ({
    id: a.id,
    status: a.status as AgentStatus,
    thought: a.thought,
  }));

  const activeCount = agentsWithStats.filter(a => a.status === 'discussing' || a.status === 'roaming').length;
  const workingCount = agentsWithStats.filter(a => a.status === 'working').length;
  const idleCount = agentsWithStats.filter(a => a.status === 'idle').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hacker-green font-mono text-sm">// chargement du stage...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <h1 className="font-mono text-2xl sm:text-3xl font-bold text-hacker-green text-glow">
                QG des Agents
              </h1>
              <span className="badge badge-live text-xs">LIVE</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-hacker-muted font-mono mt-1.5">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-hacker-green" />
                {nextRefresh}s
              </span>
              <span className="text-hacker-muted-light">|</span>
              <span>{events.length} événements</span>
              <span className="text-hacker-muted-light">|</span>
              <span>{now ? now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs font-mono"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {isPaused ? 'RESUME' : 'PAUSE'}
            </button>

            <button
              onClick={() => { fetchData(); setNextRefresh(30); }}
              className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              REFRESH
            </button>

            {/* Terminal-style tabs */}
            <div className="flex items-center bg-hacker-terminal rounded border border-hacker-border p-0.5">
              {[
                { id: 'feed', icon: Monitor, label: '[feed]' },
                { id: 'tasks', icon: CheckSquare, label: '[tasks]' },
                { id: 'social', icon: MessageCircle, label: '[social]' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === tab.id
                      ? 'text-hacker-green bg-hacker-green/10'
                      : 'text-hacker-muted hover:text-hacker-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ HQ ROOM VIEW — 3D ══ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-sm text-hacker-green">// salle 3D en direct</span>
          <span className="badge badge-live text-[10px]">3D LIVE</span>
        </div>

        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="ml-3 text-xs text-hacker-muted-light font-mono">
              room.render --mode=3d --floor=hq --engine=webgl
            </span>
          </div>

          <div className="terminal-body !max-h-none p-0">
            <HQRoom3D liveAgents={liveAgents} conversationLog={activeRoundtable?.conversation_log} />

            {/* Room Footer - Status bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-hacker-terminal border-t border-hacker-border font-mono text-[10px] text-hacker-muted">
              <span>
                <span className="text-hacker-green">●</span> {activeCount} actifs
                <span className="mx-2 text-hacker-border">|</span>
                <span className="text-hacker-amber">●</span> {workingCount} en cours
                <span className="mx-2 text-hacker-border">|</span>
                <span className="text-hacker-muted-light">●</span> {idleCount} inactifs
              </span>
              <span className="text-hacker-green/50">glisser pour tourner · scroll pour zoomer · survoler les agents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Monitoring Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-sm text-hacker-green">// statut des agents</span>
          <span className="font-mono text-xs text-hacker-muted">
            {activeCount + workingCount}/{agentsWithStats.length} actifs
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agentsWithStats.map((agent) => {
            const color = getAgentColor(agent.id);
            const statusInfo = statusMap[agent.status] || statusMap['idle'];
            const isActive = agent.status !== 'idle';

            return (
              <div
                key={agent.id}
                className="card-terminal relative overflow-hidden"
                style={{ borderColor: isActive ? color : undefined }}
              >
                {/* Terminal header bar */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-hacker-border bg-hacker-terminal">
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${statusInfo.dot}`} />
                    <span className="font-mono text-xs font-bold" style={{ color }}>
                      {agent.name}
                    </span>
                    <span className="text-hacker-muted font-mono text-[10px]">
                      LV.{agent.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="badge badge-muted text-[10px] font-mono">{statusInfo.label}</span>
                    <span style={{ color }} className="opacity-70">
                      {getAgentIcon(agent.id)}
                    </span>
                  </div>
                </div>

                {/* Terminal body */}
                <div className="px-3 py-2.5 bg-hacker-bg/50 min-h-[72px] flex flex-col justify-between">
                  <div className="font-mono text-xs text-hacker-text leading-relaxed line-clamp-2">
                    <span className="text-hacker-muted select-none">{'>'}_  </span>
                    {agent.thought}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-hacker-border/50">
                    <span className="font-mono text-[10px] text-hacker-muted">
                      {events.find(e => e.agent_id === agent.id)
                        ? formatTimeAgo(events.find(e => e.agent_id === agent.id)!.created_at)
                        : 'n/a'
                      }
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                        <span className="font-mono text-[10px]" style={{ color }}>en cours...</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mission Progress */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
        <div className="card-terminal p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm text-hacker-green">// progression des missions</span>
          </div>
          <div className="font-mono text-sm overflow-x-auto">
            <span className="text-hacker-amber">MISSIONS {missionCount.completed}/{missionCount.total}</span>
            <span className="text-hacker-muted mx-3">[</span>
            <span className="text-hacker-green">{progressBar}</span>
            <span className="text-hacker-muted">]</span>
            <span className="text-hacker-text ml-3">{progressPercent}%</span>
          </div>
          <div className="flex items-center gap-4 mt-2 font-mono text-xs text-hacker-muted">
            <span>dernière sync: {now?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-hacker-muted-light">|</span>
            <span>
              status: <span className="text-hacker-green">LIVE</span>
            </span>
          </div>
        </div>
      </div>

      {/* Active Builds */}
      {activeBuilds.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-sm text-hacker-green">// projets en construction</span>
            <span className="badge badge-amber text-[10px]">{activeBuilds.length}</span>
          </div>
          <div className="space-y-2">
            {activeBuilds.map((build) => {
              const projectName = build.ai_plan?.build_plan?.project_name;
              const isBuilding = build.status === 'building';
              const isDone = build.status === 'completed' || build.status === 'published';

              return (
                <div key={build.id} className="card-terminal p-3">
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="flex-shrink-0">
                      {isBuilding ? (
                        <Wrench className="w-4 h-4 text-hacker-amber animate-pulse" />
                      ) : isDone ? (
                        <CheckCircle className="w-4 h-4 text-hacker-green" />
                      ) : (
                        <Package className="w-4 h-4 text-hacker-cyan" />
                      )}
                    </span>
                    <span className={`badge ${isBuilding ? 'badge-amber' : isDone ? 'badge-live' : 'badge-muted'} text-[10px]`}>
                      {build.status === 'winner' ? 'GAGNANT' : build.status === 'building' ? 'EN CONSTRUCTION' : build.status === 'completed' ? 'TERMINÉ' : 'PUBLIÉ'}
                    </span>
                    {projectName && (
                      <span className="text-hacker-amber font-bold">{projectName}</span>
                    )}
                    <span className="text-hacker-text truncate flex-1">
                      &ldquo;{build.content.slice(0, 80)}{build.content.length > 80 ? '...' : ''}&rdquo;
                    </span>
                    <span className="text-hacker-muted flex-shrink-0">
                      {formatTimeAgo(build.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Conversation Feed */}
      {activeRoundtable && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-sm text-hacker-green">// discussion en cours</span>
            <span className={`badge ${activeRoundtable.status === 'running' ? 'badge-live' : 'badge-muted'} text-[10px]`}>
              {activeRoundtable.status === 'running' ? '🔴 LIVE' : activeRoundtable.status.toUpperCase()}
            </span>
          </div>

          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span className="ml-3 text-xs text-hacker-muted-light font-mono">
                roundtable --format={activeRoundtable.format} --topic=&quot;{activeRoundtable.topic.slice(0, 40)}...&quot;
              </span>
            </div>

            <div className="terminal-body p-4 max-h-[400px] overflow-y-auto">
              <div className="mb-3 pb-2 border-b border-hacker-border">
                <div className="font-mono text-sm text-hacker-amber mb-1">💬 {activeRoundtable.topic}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {activeRoundtable.participants.map((p) => (
                    <span key={p} className="badge badge-muted" style={{ color: AGENTS[p as AgentId]?.color || '#00ff41' }}>
                      {AGENTS[p as AgentId]?.name || p}
                    </span>
                  ))}
                  <span className="text-hacker-muted ml-2">
                    {activeRoundtable.turn_count}/{activeRoundtable.conversation_log?.length || 12} tours
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {activeRoundtable.conversation_log?.map((turn, idx) => {
                  const speakerColor = AGENTS[turn.speaker as AgentId]?.color || '#00ff41';
                  const speakerName = AGENTS[turn.speaker as AgentId]?.name || turn.speaker;
                  const message = turn.dialogue || turn.message || '';
                  
                  return (
                    <div key={idx} className="font-mono text-xs">
                      <span className="text-hacker-muted">[{idx + 1}]</span>{' '}
                      <span style={{ color: speakerColor }} className="font-bold">{speakerName}:</span>{' '}
                      <span className="text-hacker-text">{message}</span>
                    </div>
                  );
                })}
                
                {activeRoundtable.status === 'running' && (
                  <div className="font-mono text-xs text-hacker-green animate-pulse">
                    <span className="text-hacker-muted">[{(activeRoundtable.conversation_log?.length || 0) + 1}]</span>{' '}
                    ▋ en attente de réponse...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
        <div className="card-terminal p-3">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="text-hacker-green">// stats</span>
            <span className="badge badge-muted">
              <BarChart3 className="w-3 h-3 inline mr-1" />
              {events.filter(e => e.kind === 'insight').length} insights
            </span>
            <span className="badge badge-muted">
              <Search className="w-3 h-3 inline mr-1" />
              {events.filter(e => e.kind === 'mission' || e.kind === 'mission_complete').length} missions
            </span>
            <span className="badge badge-muted">
              <PenTool className="w-3 h-3 inline mr-1" />
              {events.filter(e => e.kind === 'conversation' || e.kind === 'chat').length} conversations
            </span>
            <span className="ml-auto text-hacker-muted flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-hacker-green animate-pulse" />
              SUPABASE REALTIME
            </span>
          </div>
        </div>
      </div>

      {/* Live Event Feed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-sm text-hacker-green">// activité en direct</span>
          <span className="font-mono text-xs text-hacker-muted">{events.length} entrées</span>
        </div>

        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: '#ff5f57' }} />
            <div className="terminal-dot" style={{ background: '#febc2e' }} />
            <div className="terminal-dot" style={{ background: '#28c840' }} />
            <span className="ml-3 text-hacker-muted text-xs font-mono">tail -f /var/log/events.log</span>
          </div>

          <div className="terminal-body p-0">
            <div className="p-4 space-y-0 max-h-[520px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-hacker-muted mx-auto mb-4" />
                  <p className="text-hacker-muted font-mono text-sm">Aucune activité récente</p>
                  <p className="text-hacker-muted-light text-xs mt-2">Les agents sont au repos pour le moment</p>
                </div>
              ) : (
                events.map((event) => {
                  const typeColor = getEventTypeColor(event.kind);
                  const agentColor = getAgentColor(event.agent_id);
                  const agentName = getAgentName(event.agent_id);

                  return (
                    <div
                      key={event.id}
                      className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0 py-2 border-b border-hacker-border/30 last:border-b-0 font-mono text-xs hover:bg-hacker-green/[0.03] transition-colors"
                    >
                      {/* Mobile: meta row (timestamp + agent + type) */}
                      <div className="flex items-center gap-2 sm:contents">
                        {/* Timestamp */}
                        <span className="text-hacker-muted sm:w-24 flex-shrink-0 text-[11px]">
                          {formatTimeAgo(event.created_at)}
                        </span>

                        {/* Separator - desktop only */}
                        <span className="text-hacker-border mx-1 flex-shrink-0 hidden sm:inline">|</span>

                        {/* Agent name */}
                        <span
                          className="sm:w-20 flex-shrink-0 font-bold text-[11px]"
                          style={{ color: agentColor }}
                        >
                          {agentName}
                        </span>

                        {/* Separator - desktop only */}
                        <span className="text-hacker-border mx-1 flex-shrink-0 hidden sm:inline">|</span>

                        {/* Event type icon + badge */}
                        <span className={`flex items-center gap-1 sm:w-20 flex-shrink-0 ${typeColor}`}>
                          {getEventIcon(event.kind)}
                          <span className="text-[10px] uppercase">{getEventTypeLabel(event.kind)}</span>
                        </span>
                      </div>

                      {/* Separator - desktop only */}
                      <span className="text-hacker-border mx-1 flex-shrink-0 hidden sm:inline">|</span>

                      {/* Content */}
                      <div className={`flex-1 text-[11px] leading-relaxed ${typeColor} pl-0 sm:pl-0`}>
                        <span>{event.title || event.summary || 'Événement'}</span>
                        {event.summary && event.title && (
                          <span className="text-hacker-muted ml-2">// {event.summary}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Listening indicator */}
              <div className="flex items-center gap-2 pt-4 mt-2 border-t border-hacker-border">
                <span className="text-hacker-green text-sm" style={{ opacity: cursorVisible ? 1 : 0 }}>
                  █
                </span>
                <span className="font-mono text-xs text-hacker-green/70 tracking-wider">
                  écoute Supabase realtime...
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
