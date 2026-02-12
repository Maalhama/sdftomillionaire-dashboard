'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';
import { Brain, Filter, Clock, Tag, Sparkles } from 'lucide-react';

interface Memory {
  id: string;
  agent_id: string;
  memory_type: string;
  content: string;
  confidence: number;
  tags: string[];
  source_type: string;
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

const memoryTypeConfig: Record<string, { badge: string; icon: string }> = {
  insight: { badge: 'badge-purple', icon: '💡' },
  pattern: { badge: 'badge-cyan', icon: '🔄' },
  strategy: { badge: 'badge-amber', icon: '🎯' },
  lesson: { badge: 'badge-live', icon: '📚' },
  observation: { badge: 'badge-muted', icon: '👁️' },
};

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMemories();
    
    const channel = supabase
      .channel('memories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_agent_memory' }, (payload) => {
        setMemories(prev => [payload.new as Memory, ...prev]);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchMemories() {
    const { data } = await supabase
      .from('ops_agent_memory')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    setMemories(data || []);
    setLoading(false);
  }

  const filteredMemories = memories.filter(m => {
    if (filter !== 'all' && m.agent_id !== filter) return false;
    if (typeFilter !== 'all' && m.memory_type !== typeFilter) return false;
    return true;
  });

  const memoryTypes = Array.from(new Set(memories.map(m => m.memory_type)));

  const getAgentInfo = (agentId: string) => {
    return AGENTS[agentId as AgentId] || { name: agentId, emoji: '🤖', color: '#888', role: 'Agent' };
  };

  const getMemoryCount = (agentId: string) => {
    return memories.filter(m => m.agent_id === agentId).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hacker-green font-mono text-sm">// chargement des mémoires...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      {/* ═══ HEADER ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <p className="text-hacker-green text-sm mb-2 font-mono">// memory_bank</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Mémoires
          </h1>
          <span className="badge badge-live">LIVE</span>
          <span className="badge badge-muted">{memories.length} entrées</span>
        </div>
        <p className="text-hacker-muted-light">
          Ce que les agents apprennent en évaluant vos idées et en construisant les projets. Mise à jour en temps réel.
        </p>
      </section>

      {/* ═══ AGENT STATS GRID ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(AGENTS).map(([id, agent]) => {
            const count = getMemoryCount(id);
            const color = agentColors[id] || '#888';
            const isSelected = filter === id;
            
            return (
              <button
                key={id}
                onClick={() => setFilter(filter === id ? 'all' : id)}
                className={`card p-4 text-center transition-all ${
                  isSelected ? 'border-2' : 'hover:border-hacker-green/30'
                }`}
                style={{ 
                  borderColor: isSelected ? color : undefined,
                  boxShadow: isSelected ? `0 0 15px ${color}33` : undefined
                }}
              >
                <Image src={agent.avatar} alt={agent.name} width={28} height={28} className="w-7 h-7 rounded-full object-cover mx-auto mb-0.5" />
                <p className="text-2xl font-bold" style={{ color }}>{count}</p>
                <p className="text-[10px] text-hacker-muted uppercase tracking-wider">{agent.name}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ FILTERS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-hacker-green font-mono text-sm">
            <Filter className="w-4 h-4" />
            <span>$ filter --type=</span>
          </div>
          
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              typeFilter === 'all'
                ? 'bg-hacker-green/10 text-hacker-green border border-hacker-green/30'
                : 'text-hacker-muted-light border border-transparent hover:text-hacker-text hover:border-hacker-border'
            }`}
          >
            all
          </button>
          
          {memoryTypes.map(type => {
            const config = memoryTypeConfig[type] || { badge: 'badge-muted', icon: '📝' };
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
                  typeFilter === type
                    ? 'bg-hacker-green/10 text-hacker-green border border-hacker-green/30'
                    : 'text-hacker-muted-light border border-transparent hover:text-hacker-text hover:border-hacker-border'
                }`}
              >
                <span>{config.icon}</span>
                {type}
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ MEMORIES LIST ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="ml-3 text-xs text-hacker-muted-light font-mono">
              tail -f /var/log/agent_memories.log | grep "{filter !== 'all' ? filter : '*'}"
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-hacker-muted">
                {filteredMemories.length} résultats
              </span>
            </div>
          </div>

          <div className="max-h-[700px] overflow-y-auto divide-y divide-hacker-border">
            {filteredMemories.map((memory, i) => {
              const agent = getAgentInfo(memory.agent_id);
              const color = agentColors[memory.agent_id] || '#888';
              const typeConfig = memoryTypeConfig[memory.memory_type] || { badge: 'badge-muted', icon: '📝' };
              
              return (
                <div 
                  key={memory.id} 
                  className="p-4 hover:bg-hacker-card-hover transition-all animate-fade-in"
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Agent Avatar */}
                    <div
                      className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden border"
                      style={{
                        backgroundColor: `${color}15`,
                        borderColor: `${color}40`
                      }}
                    >
                      <Image src={agent.avatar} alt={agent.name} width={40} height={40} className="w-full h-full object-cover" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold text-sm" style={{ color }}>
                          {agent.name}
                        </span>
                        <span className={`badge ${typeConfig.badge} text-[10px]`}>
                          {typeConfig.icon} {memory.memory_type}
                        </span>
                        {memory.confidence && (
                          <span className="text-[10px] text-hacker-muted font-mono">
                            {Math.round(memory.confidence * 100)}% confiance
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-hacker-text leading-relaxed mb-2">
                        {memory.content}
                      </p>
                      
                      {/* Tags */}
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {memory.tags.map((tag, j) => (
                            <span 
                              key={j} 
                              className="text-[10px] bg-hacker-border px-2 py-0.5 rounded text-hacker-muted-light font-mono"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Timestamp */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-hacker-muted font-mono">
                        {new Date(memory.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-[10px] text-hacker-muted font-mono">
                        {new Date(memory.created_at).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredMemories.length === 0 && (
              <div className="p-12 text-center">
                <Brain className="w-12 h-12 text-hacker-muted mx-auto mb-4" />
                <p className="text-hacker-muted font-mono text-sm">
                  // aucune mémoire trouvée
                </p>
                <p className="text-hacker-muted-light text-xs mt-2">
                  Essaie de modifier les filtres
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-hacker-border p-3 bg-hacker-terminal">
            <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-hacker-muted">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-hacker-green" />
                Realtime Supabase
              </span>
              <span>|</span>
              <span>
                Total: <span className="text-hacker-green">{memories.length}</span> mémoires
              </span>
              <span>|</span>
              <span>
                Agents: <span className="text-hacker-cyan">{Object.keys(AGENTS).length}</span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
