'use client';

import { useEffect, useState } from 'react';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';
import { Activity, Brain, Users, Zap, Trophy, TrendingUp } from 'lucide-react';

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

interface Relationship {
  agent_a: string;
  agent_b: string;
  affinity: number;
  total_interactions: number;
}

interface Memory {
  id: string;
  agent_id: string;
  memory_type: string;
  content: string;
  confidence: number;
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

function buildAsciiBar(value: number, max: number = 100): string {
  const filled = Math.round((value / max) * 15);
  const empty = 15 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>('opus');
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [allStats, setAllStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllStats();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentData();
    }
  }, [selectedAgent]);

  async function fetchAllStats() {
    const { data } = await supabase
      .from('ops_agent_stats')
      .select('*');
    setAllStats(data || []);
  }

  async function fetchAgentData() {
    setLoading(true);
    
    // Fetch relationships
    const { data: rels } = await supabase
      .from('ops_agent_relationships')
      .select('*')
      .or(`agent_a.eq.${selectedAgent},agent_b.eq.${selectedAgent}`);
    
    setRelationships(rels || []);
    
    // Fetch RPG stats
    const { data: agentStats } = await supabase
      .from('ops_agent_stats')
      .select('*')
      .eq('agent_id', selectedAgent)
      .single();
    
    setStats(agentStats);
    
    // Fetch memories for selected agent
    const { data: mems } = await supabase
      .from('ops_agent_memory')
      .select('*')
      .eq('agent_id', selectedAgent)
      .order('created_at', { ascending: false })
      .limit(5);
    
    setMemories(mems || []);
    setLoading(false);
  }

  const agent = selectedAgent ? AGENTS[selectedAgent] : null;
  const color = selectedAgent ? agentColors[selectedAgent] : '#00ff41';

  const getAgentStats = (agentId: string) => {
    return allStats.find(s => s.agent_id === agentId);
  };

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      {/* ═══ HEADER ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// agent_roster</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Registre des Agents
          </h1>
          <span className="badge badge-live">LIVE</span>
        </div>
        <p className="text-hacker-muted-light max-w-2xl">
          Statistiques en temps réel, relations inter-agents, et mémoires de chaque membre de l'équipe.
        </p>
      </section>

      {/* ═══ AGENT GRID (Selectors) ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(AGENTS).map(([id, agentInfo]) => {
            const agentStat = getAgentStats(id);
            const isSelected = selectedAgent === id;
            const agentColor = agentColors[id] || '#00ff41';
            
            return (
              <button
                key={id}
                onClick={() => setSelectedAgent(id as AgentId)}
                className={`card p-4 text-center transition-all duration-300 ${
                  isSelected 
                    ? 'border-2' 
                    : 'hover:border-hacker-green/30'
                }`}
                style={{ 
                  borderColor: isSelected ? agentColor : undefined,
                  boxShadow: isSelected ? `0 0 20px ${agentColor}33` : undefined
                }}
              >
                <div 
                  className="w-14 h-14 mx-auto mb-2 rounded-xl flex items-center justify-center text-3xl border"
                  style={{ 
                    backgroundColor: `${agentColor}15`,
                    borderColor: `${agentColor}40`
                  }}
                >
                  {agentInfo.emoji}
                </div>
                <p className="font-bold text-sm" style={{ color: agentColor }}>{agentInfo.name}</p>
                <p className="text-[10px] text-hacker-muted uppercase tracking-wider">{agentInfo.role}</p>
                {agentStat && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-[10px]">
                    <span className="text-hacker-purple">LV.{agentStat.level}</span>
                    <span className="text-hacker-muted">|</span>
                    <span className="text-hacker-amber">{agentStat.experience_points} XP</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ AGENT DETAIL TERMINAL ═══ */}
      {agent && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span className="ml-3 text-xs text-hacker-muted-light font-mono">
                sdf@hq ~ cat /agents/{selectedAgent}/profile.json
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className="badge badge-live text-[10px]">LIVE</span>
              </div>
            </div>

            <div className="terminal-body !max-h-none p-0">
              <div className="grid lg:grid-cols-3 lg:divide-x divide-y lg:divide-y-0 divide-hacker-border">
                
                {/* ── Left: Agent Identity & Stats ── */}
                <div className="p-6 space-y-6">
                  {/* Identity */}
                  <div>
                    <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-3">
                      <span className="text-hacker-green">//</span> identité
                    </p>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl border-2"
                        style={{ 
                          borderColor: color, 
                          boxShadow: `0 0 20px ${color}33`,
                          backgroundColor: `${color}15`
                        }}
                      >
                        {agent.emoji}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold" style={{ color }}>
                          {agent.name}
                        </h2>
                        <p className="text-xs text-hacker-muted-light uppercase tracking-wider">
                          {agent.role}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="status-dot status-active" />
                          <span className="text-[10px] text-hacker-green uppercase">ACTIF</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RPG Stats */}
                  {stats && (
                    <div>
                      <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-3">
                        <span className="text-hacker-green">//</span> stats rpg
                      </p>
                      
                      {/* Level & XP */}
                      <div className="card-terminal p-4 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl font-bold text-hacker-purple">
                            LV.{stats.level}
                          </span>
                          <span className="text-hacker-amber font-mono text-sm">
                            {stats.experience_points} XP
                          </span>
                        </div>
                        <div className="font-mono text-xs">
                          <span className="text-hacker-muted">[</span>
                          <span className="text-hacker-purple">{buildAsciiBar(stats.experience_points % 100)}</span>
                          <span className="text-hacker-muted">]</span>
                          <span className="text-hacker-muted-light ml-2">{stats.experience_points % 100}%</span>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                        <div className="card-terminal p-2">
                          <div className="text-hacker-green font-bold">{stats.successful_missions || 0}/{stats.total_missions || 0}</div>
                          <div className="text-hacker-muted text-[10px]">Missions</div>
                        </div>
                        <div className="card-terminal p-2">
                          <div className="text-hacker-cyan font-bold">{stats.stat_wis || 50}</div>
                          <div className="text-hacker-muted text-[10px]">WIS</div>
                        </div>
                        <div className="card-terminal p-2">
                          <div className="text-hacker-amber font-bold">{stats.stat_cre || 50}</div>
                          <div className="text-hacker-muted text-[10px]">CRE</div>
                        </div>
                      </div>

                      {/* Current Affect */}
                      <div className="mt-4 text-center">
                        <span className="badge badge-muted text-[10px]">
                          État: {stats.current_affect || 'neutral'}
                        </span>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-hacker-green border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* ── Center: Relations ── */}
                <div className="p-6">
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-4">
                    <span className="text-hacker-cyan">//</span> relations ({relationships.length})
                  </p>
                  
                  <div className="space-y-3">
                    {relationships.map((rel, i) => {
                      const otherAgentId = rel.agent_a === selectedAgent ? rel.agent_b : rel.agent_a;
                      const otherAgent = AGENTS[otherAgentId as AgentId];
                      if (!otherAgent) return null;
                      
                      const otherColor = agentColors[otherAgentId] || '#888';
                      const affinityPercent = Math.round(rel.affinity * 100);
                      
                      return (
                        <div key={i} className="card-terminal p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">{otherAgent.emoji}</span>
                            <span className="font-bold text-sm" style={{ color: otherColor }}>
                              {otherAgent.name}
                            </span>
                            <span className="ml-auto text-xs font-mono" style={{ 
                              color: affinityPercent >= 70 ? '#22c55e' : 
                                     affinityPercent >= 40 ? '#ffb800' : '#ff3e3e' 
                            }}>
                              {affinityPercent}%
                            </span>
                          </div>
                          <div className="font-mono text-xs">
                            <span className="text-hacker-muted">[</span>
                            <span style={{ 
                              color: affinityPercent >= 70 ? '#22c55e' : 
                                     affinityPercent >= 40 ? '#ffb800' : '#ff3e3e' 
                            }}>
                              {buildAsciiBar(affinityPercent)}
                            </span>
                            <span className="text-hacker-muted">]</span>
                          </div>
                          <div className="text-[10px] text-hacker-muted mt-1">
                            {rel.total_interactions || 0} interactions
                          </div>
                        </div>
                      );
                    })}
                    
                    {relationships.length === 0 && !loading && (
                      <p className="text-hacker-muted text-sm text-center py-4 font-mono">
                        // aucune relation enregistrée
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Right: Recent Memories ── */}
                <div className="p-6">
                  <p className="text-[10px] text-hacker-muted uppercase tracking-widest mb-4">
                    <span className="text-hacker-purple">//</span> mémoires récentes
                  </p>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {memories.map((mem, i) => (
                      <div key={i} className="card-terminal p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`badge text-[10px] ${
                            mem.memory_type === 'insight' ? 'badge-purple' :
                            mem.memory_type === 'pattern' ? 'badge-cyan' :
                            mem.memory_type === 'lesson' ? 'badge-live' :
                            mem.memory_type === 'strategy' ? 'badge-amber' :
                            'badge-muted'
                          }`}>
                            {mem.memory_type}
                          </span>
                          <span className="text-[10px] text-hacker-muted">
                            {new Date(mem.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-xs text-hacker-text leading-relaxed">
                          {mem.content}
                        </p>
                      </div>
                    ))}
                    
                    {memories.length === 0 && !loading && (
                      <p className="text-hacker-muted text-sm text-center py-4 font-mono">
                        // aucune mémoire enregistrée
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Footer */}
            <div className="border-t border-hacker-border p-3 bg-hacker-terminal">
              <div className="flex items-center justify-center gap-6 text-[10px] font-mono text-hacker-muted">
                <span>
                  <span className="text-hacker-green">●</span> Données live depuis Supabase
                </span>
                <span>|</span>
                <span>Refresh: 30s</span>
                <span>|</span>
                <span>Agent: <span style={{ color }}>{agent.name}</span></span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
