'use client';

import { useEffect, useState } from 'react';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';

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
    return AGENTS[agentId as AgentId] || { name: agentId, emoji: '🤖', color: '#888' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-sdftomillionaire-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mémoires</h1>
        <div className="flex gap-3">
          {/* Agent Filter */}
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-sdftomillionaire-card border border-sdftomillionaire-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">Tous les agents</option>
            {Object.entries(AGENTS).map(([id, agent]) => (
              <option key={id} value={id}>{agent.emoji} {agent.name}</option>
            ))}
          </select>
          
          {/* Type Filter */}
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-sdftomillionaire-card border border-sdftomillionaire-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">Tous les types</option>
            {memoryTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        {Object.entries(AGENTS).map(([id, agent]) => {
          const count = memories.filter(m => m.agent_id === id).length;
          return (
            <button
              key={id}
              onClick={() => setFilter(filter === id ? 'all' : id)}
              className={`p-3 rounded-xl border text-center transition ${
                filter === id
                  ? 'bg-sdftomillionaire-accent/20 border-sdftomillionaire-accent'
                  : 'bg-sdftomillionaire-card border-sdftomillionaire-border hover:border-sdftomillionaire-accent/30'
              }`}
            >
              <span className="text-2xl">{agent.emoji}</span>
              <p className="text-xl font-bold mt-1">{count}</p>
              <p className="text-xs text-gray-500">{agent.name}</p>
            </button>
          );
        })}
      </div>

      {/* Memories List */}
      <div className="bg-sdftomillionaire-card border border-sdftomillionaire-border rounded-xl overflow-hidden">
        <div className="divide-y divide-sdftomillionaire-border">
          {filteredMemories.map((memory) => {
            const agent = getAgentInfo(memory.agent_id);
            return (
              <div key={memory.id} className="p-4 hover:bg-white/5 transition animate-slide-up">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${agent.color}20` }}
                  >
                    {agent.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold" style={{ color: agent.color }}>
                        {agent.name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        memory.memory_type === 'insight' ? 'bg-purple-500/20 text-purple-400' :
                        memory.memory_type === 'pattern' ? 'bg-blue-500/20 text-blue-400' :
                        memory.memory_type === 'strategy' ? 'bg-orange-500/20 text-orange-400' :
                        memory.memory_type === 'lesson' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {memory.memory_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {memory.confidence ? `${Math.round(memory.confidence * 100)}% confiance` : ''}
                      </span>
                    </div>
                    <p className="text-gray-300">{memory.content}</p>
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {memory.tags.map((tag, i) => (
                          <span key={i} className="text-xs bg-sdftomillionaire-border px-2 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 text-right flex-shrink-0">
                    <p>{new Date(memory.created_at).toLocaleDateString('fr-FR')}</p>
                    <p>{new Date(memory.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredMemories.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Aucune mémoire trouvée
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
