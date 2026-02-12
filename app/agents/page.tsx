'use client';

import { useEffect, useState } from 'react';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';

interface AgentStats {
  agent_id: string;
  xp: number;
  level: number;
  missions_completed: number;
  missions_failed: number;
  conversations_participated: number;
  current_streak: number;
  best_streak: number;
  skills: Record<string, { rank: number; xp: number }>;
  achievements: string[];
}

interface Relationship {
  agent_a: string;
  agent_b: string;
  affinity: number;
  total_interactions: number;
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>('opus');
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedAgent]);

  async function fetchData() {
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
    if (selectedAgent) {
      const { data: mems } = await supabase
        .from('ops_agent_memory')
        .select('*')
        .eq('agent_id', selectedAgent)
        .order('created_at', { ascending: false })
        .limit(10);
      
      setMemories(mems || []);
    }
    
    setLoading(false);
  }

  const agent = selectedAgent ? AGENTS[selectedAgent] : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agents</h1>
      
      {/* Agent Grid */}
      <div className="grid grid-cols-6 gap-3">
        {Object.entries(AGENTS).map(([id, agentInfo]) => (
          <button
            key={id}
            onClick={() => setSelectedAgent(id as AgentId)}
            className={`p-4 rounded-xl border text-center transition ${
              selectedAgent === id
                ? 'bg-sdftomillionaire-accent/20 border-sdftomillionaire-accent'
                : 'bg-sdftomillionaire-card border-sdftomillionaire-border hover:border-sdftomillionaire-accent/30'
            }`}
          >
            <div 
              className="w-14 h-14 mx-auto mb-2 rounded-xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: `${agentInfo.color}20` }}
            >
              {agentInfo.emoji}
            </div>
            <p className="font-semibold">{agentInfo.name}</p>
            <p className="text-xs text-gray-500">{agentInfo.role}</p>
          </button>
        ))}
      </div>

      {agent && (
        <div className="grid grid-cols-2 gap-6">
          {/* Agent Details */}
          <div className="bg-sdftomillionaire-card border border-sdftomillionaire-border rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl"
                style={{ backgroundColor: `${agent.color}20` }}
              >
                {agent.emoji}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{agent.name}</h2>
                <p className="text-gray-500">{agent.role}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-500">Active</span>
                </div>
              </div>
            </div>

            {/* RPG Stats */}
            {stats && (
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-3xl font-bold">Lvl {stats.level}</span>
                    <span className="text-gray-500 ml-2">{stats.xp} XP</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Streak</div>
                    <div className="text-xl font-bold text-orange-400">🔥 {stats.current_streak || 0}</div>
                  </div>
                </div>
                
                {/* XP Bar */}
                <div className="h-2 bg-sdftomillionaire-border rounded-full overflow-hidden mb-3">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    style={{ width: `${Math.min(100, (stats.xp % 100))}%` }}
                  ></div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="bg-sdftomillionaire-dark/50 rounded-lg p-2">
                    <div className="text-green-400 font-bold">{stats.missions_completed || 0}</div>
                    <div className="text-gray-500 text-xs">Missions ✓</div>
                  </div>
                  <div className="bg-sdftomillionaire-dark/50 rounded-lg p-2">
                    <div className="text-blue-400 font-bold">{stats.conversations_participated || 0}</div>
                    <div className="text-gray-500 text-xs">Convos</div>
                  </div>
                  <div className="bg-sdftomillionaire-dark/50 rounded-lg p-2">
                    <div className="text-yellow-400 font-bold">{stats.best_streak || 0}</div>
                    <div className="text-gray-500 text-xs">Best Streak</div>
                  </div>
                </div>
                
                {/* Achievements */}
                {stats.achievements && stats.achievements.length > 0 && (
                  <div className="mt-3 flex gap-1 flex-wrap">
                    {stats.achievements.map((a, i) => (
                      <span key={i} className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                        🏆 {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Relationships */}
            <h3 className="font-semibold mb-3">Relations</h3>
            <div className="space-y-2">
              {relationships.map((rel, i) => {
                const otherAgentId = rel.agent_a === selectedAgent ? rel.agent_b : rel.agent_a;
                const otherAgent = AGENTS[otherAgentId as AgentId];
                if (!otherAgent) return null;
                
                const affinityColor = rel.affinity >= 0.7 ? 'bg-green-500' :
                                      rel.affinity >= 0.4 ? 'bg-yellow-500' : 'bg-red-500';
                
                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-sdftomillionaire-dark/50">
                    <span className="text-xl">{otherAgent.emoji}</span>
                    <span className="flex-1 text-sm">{otherAgent.name}</span>
                    <div className="w-24 h-2 bg-sdftomillionaire-border rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${affinityColor} transition-all`}
                        style={{ width: `${rel.affinity * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {Math.round(rel.affinity * 100)}%
                    </span>
                  </div>
                );
              })}
              {relationships.length === 0 && (
                <p className="text-gray-500 text-sm">Aucune relation enregistrée</p>
              )}
            </div>
          </div>

          {/* Memories */}
          <div className="bg-sdftomillionaire-card border border-sdftomillionaire-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Mémoires Récentes</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {memories.map((mem, i) => (
                <div key={i} className="p-3 bg-sdftomillionaire-dark/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      mem.memory_type === 'insight' ? 'bg-purple-500/20 text-purple-400' :
                      mem.memory_type === 'pattern' ? 'bg-blue-500/20 text-blue-400' :
                      mem.memory_type === 'lesson' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {mem.memory_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(mem.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{mem.content}</p>
                </div>
              ))}
              {memories.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">Aucune mémoire enregistrée</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
